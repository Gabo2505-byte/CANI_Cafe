// HU-305 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getContactNamesIn } from '../../src/sales/contactSearchRepository';
import { listBoardSalesIn } from '../../src/sales/salesRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-board';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;

const NOW = new Date('2026-10-14T18:00:00Z');
const daysAgo = (days: number) => Timestamp.fromDate(new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000));

const SALES = [
  { id: 's-nuevo', stage: 'nuevo_interesado', stageChangedAt: daysAgo(200) },
  { id: 's-contactado', stage: 'contactado', stageChangedAt: daysAgo(3) },
  { id: 's-cotizacion', stage: 'cotizacion_enviada', stageChangedAt: daysAgo(3) },
  { id: 's-negociacion', stage: 'en_negociacion', stageChangedAt: daysAgo(3) },
  { id: 's-ganada-reciente', stage: 'ganada', stageChangedAt: daysAgo(29) },
  { id: 's-ganada-antigua', stage: 'ganada', stageChangedAt: daysAgo(31) },
  { id: 's-perdida-reciente', stage: 'perdida', stageChangedAt: daysAgo(1) },
  { id: 's-perdida-antigua', stage: 'perdida', stageChangedAt: daysAgo(90) },
];

const contact = (fullName: string) => ({ fullName, nameSortKey: fullName.toLowerCase(), status: 'activo' });

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, COLLECTIONS.users, 'admin-activo'), { username: 'admin', email: 'a@example.com', active: true });
    for (const { id, ...data } of SALES) {
      await setDoc(doc(db, COLLECTIONS.sales, id), { contactId: 'c-1', title: id, estimatedAmount: 1, notes: '', ...data });
    }
    await setDoc(doc(db, COLLECTIONS.contacts, 'c-1'), contact('Ana Activa'));
    await setDoc(doc(db, COLLECTIONS.contacts, 'c-2'), { ...contact('Iván Inactivo'), status: 'inactivo' });
    for (let i = 0; i < 35; i += 1) await setDoc(doc(db, COLLECTIONS.contacts, `bulk-${i}`), contact(`Contacto ${i}`));
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('ventas del tablero (HU-305)', () => {
  it('trae todas las abiertas y solo las ganadas/perdidas de los últimos 30 días', async () => {
    const db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
    const sales = await listBoardSalesIn(db, NOW);
    expect(sales.map((s) => s.id).sort()).toEqual([
      's-contactado',
      's-cotizacion',
      's-ganada-reciente',
      's-negociacion',
      's-nuevo',
      's-perdida-reciente',
    ]);
  });

  it('sin sesión no se puede leer', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(listBoardSalesIn(db, NOW));
  });
});

describe('nombres de los contactos de las tarjetas (HU-305)', () => {
  it('devuelve el nombre por id, también de contactos inactivos', async () => {
    const db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
    const names = await getContactNamesIn(db, ['c-1', 'c-2', 'c-1', 'no-existe']);
    expect(Object.fromEntries(names)).toEqual({ 'c-1': 'Ana Activa', 'c-2': 'Iván Inactivo' });
  });

  it('con más de 30 contactos hace varias consultas y los trae todos', async () => {
    const db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
    const ids = Array.from({ length: 35 }, (_, i) => `bulk-${i}`);
    const names = await getContactNamesIn(db, ids);
    expect(names.size).toBe(35);
    expect(names.get('bulk-34')).toBe('Contacto 34');
  });

  it('sin ids no consulta nada', async () => {
    const db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
    expect((await getContactNamesIn(db, [])).size).toBe(0);
  });
});
