// HU-314 y HU-315 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createCommunicationIn } from '../../src/communications/communicationsRepository';
import { listAlertsIn } from '../../src/sales/alertsRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-alerts';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;
let db: Firestore;

const cr = (iso: string) => new Date(`${iso}-06:00`);
const at = (iso: string) => Timestamp.fromDate(cr(iso));
const NOW = cr('2026-10-19T12:00:00');
const baseSale = {
  contactId: 'c-1',
  title: 'Venta',
  stage: 'contactado',
  estimatedAmount: 1000,
  nextFollowUpAt: at('2026-10-19T09:00:00'),
  notes: '',
  // Creada ayer: todavía no corresponde el aviso de falta de comunicación (HU-315).
  createdAt: at('2026-10-18T09:00:00'),
  stageChangedAt: at('2026-10-18T09:00:00'),
  lastCommunicationAt: null,
};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();
    await setDoc(doc(admin, COLLECTIONS.users, 'admin-activo'), { username: 'admin', email: 'a@example.com', active: true });
    await setDoc(doc(admin, COLLECTIONS.contacts, 'c-1'), { fullName: 'Ana Activa', classification: 'persona_interesada', status: 'activo' });
    await setDoc(doc(admin, COLLECTIONS.contacts, 'c-2'), { fullName: 'Bruno Inactivo', classification: 'cliente', status: 'inactivo' });
  });
});
afterAll(async () => {
  await testEnv?.cleanup();
});

const put = (id: string, data: Record<string, unknown>) =>
  testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), COLLECTIONS.sales, id), { ...baseSale, ...data });
  });

describe('avisos de seguimiento contra Firestore (HU-314)', () => {
  it('genera el aviso de hoy y el vencido, los más antiguos primero, con el nombre del contacto', async () => {
    await put('s-hoy', { title: 'De hoy' });
    await put('s-vencida', { title: 'Vencida', nextFollowUpAt: at('2026-10-12T10:00:00') });

    const alerts = await listAlertsIn(db, NOW);
    expect(alerts.map((a) => a.message)).toEqual([
      'Seguimiento vencido desde el 12/10/2026 con Ana Activa – Vencida.',
      'Seguimiento programado para hoy con Ana Activa – De hoy.',
    ]);
    expect(alerts.map((a) => a.saleId)).toEqual(['s-vencida', 's-hoy']);
  });

  it('no avisa de ventas ganadas o perdidas, sin fecha, a futuro ni de contactos inactivos', async () => {
    await put('s-ganada', { stage: 'ganada' });
    await put('s-perdida', { stage: 'perdida' });
    await put('s-sin-fecha', { nextFollowUpAt: null });
    await put('s-futura', { nextFollowUpAt: at('2026-10-25T10:00:00') });
    await put('s-inactivo', { contactId: 'c-2' });
    expect(await listAlertsIn(db, NOW)).toEqual([]);
  });

  it('una comunicación reciente no quita el aviso de seguimiento', async () => {
    await put('s-1', { lastCommunicationAt: at('2026-10-19T08:00:00') });
    expect(await listAlertsIn(db, NOW)).toHaveLength(1);
  });

  it('si no hay ventas no hay avisos', async () => {
    expect(await listAlertsIn(db, NOW)).toEqual([]);
  });

  it('sin sesión no se puede consultar', async () => {
    await put('s-1', {});
    const anon = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(listAlertsIn(anon, NOW));
  });
});

describe('avisos por falta de comunicación contra Firestore (HU-315)', () => {
  const kinds = async (now = NOW) => (await listAlertsIn(db, now)).map((a) => `${a.saleId}:${a.kind}`);
  const quiet = { nextFollowUpAt: null, lastCommunicationAt: at('2026-10-01T10:00:00') };
  const comm = (saleId: string | null, day: Date) => ({
    contactId: 'c-1',
    date: day,
    medium: 'llamada' as const,
    otherMedium: null,
    saleId,
    note: 'Nota',
  });

  it('avisa desde el día 11 con el número de días y usa la fecha de creación si nunca hubo comunicaciones', async () => {
    await put('s-con', { ...quiet, title: 'Con historial' });
    await put('s-nunca', { ...quiet, lastCommunicationAt: null, title: 'Nunca', createdAt: at('2026-10-05T10:00:00') });

    const alerts = await listAlertsIn(db, NOW);
    expect(alerts.map((a) => a.message)).toEqual([
      'Ana Activa – Con historial no tiene comunicaciones desde hace 18 días.',
      'Ana Activa – Nunca no tiene comunicaciones desde hace 14 días.',
    ]);
    // El día 10 aún no, el 11 sí (ejemplo del documento: última 01/10, aviso 12/10).
    expect(await kinds(cr('2026-10-11T12:00:00'))).toEqual([]);
    expect(await kinds(cr('2026-10-12T12:00:00'))).toEqual(['s-con:sin_comunicacion']);
  });

  it('registrar una comunicación sobre esa venta quita su aviso y no el de otra venta del contacto', async () => {
    await put('s-a', quiet);
    await put('s-b', quiet);
    expect(await kinds()).toEqual(['s-a:sin_comunicacion', 's-b:sin_comunicacion']);

    await createCommunicationIn(db, comm('s-a', NOW), 'admin-activo');
    expect(await kinds()).toEqual(['s-b:sin_comunicacion']);
  });

  it('registrar una comunicación como "Todas sus posibles ventas" quita el aviso de todas las abiertas del contacto', async () => {
    await put('s-a', quiet);
    await put('s-b', quiet);
    await createCommunicationIn(db, comm(null, NOW), 'admin-activo');
    expect(await kinds()).toEqual([]);
  });

  it('solo avisa de ventas abiertas de contactos activos', async () => {
    await put('s-ganada', { ...quiet, stage: 'ganada' });
    await put('s-perdida', { ...quiet, stage: 'perdida' });
    await put('s-inactivo', { ...quiet, contactId: 'c-2' });
    expect(await kinds()).toEqual([]);
  });

  it('pueden convivir el aviso de seguimiento y el de falta de comunicación de la misma venta', async () => {
    await put('s-1', { lastCommunicationAt: at('2026-10-01T10:00:00') });
    expect((await kinds()).sort()).toEqual(['s-1:seguimiento_hoy', 's-1:sin_comunicacion']);
  });
});
