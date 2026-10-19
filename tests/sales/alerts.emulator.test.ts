// HU-314 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
  createdAt: at('2026-09-01T09:00:00'),
  stageChangedAt: at('2026-09-01T09:00:00'),
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
