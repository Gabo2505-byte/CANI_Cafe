// HU-212 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeEach, beforeAll, describe, expect, it } from 'vitest';
import { communicationDayToDate } from '../../src/communications/communicationForm';
import { createCommunicationIn, SaleNotOpenError } from '../../src/communications/communicationsRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-communication-sale';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;
let db: Firestore;

const day = (d: string) => Timestamp.fromDate(communicationDayToDate(d));

const sale = (contactId: string, stage: string, lastCommunicationAt: Timestamp | null = null) => ({
  contactId,
  title: `Venta ${stage}`,
  stage,
  estimatedAmount: 1000,
  nextFollowUpAt: null,
  notes: '',
  createdAt: day('2026-09-01'),
  stageChangedAt: day('2026-09-01'),
  lastCommunicationAt,
});

const lastOf = async (saleId: string) =>
  ((await getDoc(doc(db, COLLECTIONS.sales, saleId))).get('lastCommunicationAt') as Timestamp | null)?.toMillis() ?? null;

const input = (overrides: Partial<Parameters<typeof createCommunicationIn>[1]> = {}) => ({
  contactId: 'ana',
  date: communicationDayToDate('2026-10-10'),
  medium: 'llamada' as const,
  otherMedium: null,
  note: 'Conversación de prueba.',
  ...overrides,
});

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
    const fs = ctx.firestore();
    await setDoc(doc(fs, COLLECTIONS.users, 'admin-activo'), { username: 'admin', email: 'admin@example.com', active: true });
    await setDoc(doc(fs, COLLECTIONS.contacts, 'ana'), { fullName: 'Ana' });
    await setDoc(doc(fs, COLLECTIONS.contacts, 'otro'), { fullName: 'Otro' });
    await setDoc(doc(fs, COLLECTIONS.sales, 'abierta-1'), sale('ana', 'contactado'));
    await setDoc(doc(fs, COLLECTIONS.sales, 'abierta-2'), sale('ana', 'en_negociacion', day('2026-10-15')));
    await setDoc(doc(fs, COLLECTIONS.sales, 'ganada'), sale('ana', 'ganada', day('2026-09-05')));
    await setDoc(doc(fs, COLLECTIONS.sales, 'perdida'), sale('ana', 'perdida'));
    await setDoc(doc(fs, COLLECTIONS.sales, 'de-otro'), sale('otro', 'contactado'));
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('HU-212 relacionar una comunicación con una posible venta', () => {
  it('con una posible venta: se guarda con su saleId y actualiza solo su última comunicación', async () => {
    const id = await createCommunicationIn(db, input({ saleId: 'abierta-1' }), 'admin-activo');
    const comm = (await getDoc(doc(db, COLLECTIONS.communications, id))).data();
    expect(comm).toMatchObject({ saleId: 'abierta-1', appliesToAllSales: false });
    expect(await lastOf('abierta-1')).toBe(day('2026-10-10').toMillis());
    expect(await lastOf('perdida')).toBeNull();
    expect(await lastOf('de-otro')).toBeNull();
  });

  it('con "Todas sus posibles ventas": actualiza todas las abiertas del contacto, no las ganadas, perdidas ni de otros', async () => {
    const id = await createCommunicationIn(db, input({ saleId: null, date: communicationDayToDate('2026-10-18') }), 'admin-activo');
    expect((await getDoc(doc(db, COLLECTIONS.communications, id))).data()).toMatchObject({ saleId: null, appliesToAllSales: true });
    expect(await lastOf('abierta-1')).toBe(day('2026-10-18').toMillis());
    expect(await lastOf('abierta-2')).toBe(day('2026-10-18').toMillis());
    expect(await lastOf('ganada')).toBe(day('2026-09-05').toMillis());
    expect(await lastOf('perdida')).toBeNull();
    expect(await lastOf('de-otro')).toBeNull();
  });

  it('sin indicar venta (como el formulario del sitio web) queda como "Todas sus posibles ventas"', async () => {
    const { saleId: _omit, ...withoutSale } = input();
    const id = await createCommunicationIn(db, withoutSale, 'admin-activo');
    expect((await getDoc(doc(db, COLLECTIONS.communications, id))).data()).toMatchObject({ saleId: null, appliesToAllSales: true });
    expect(await lastOf('abierta-1')).toBe(day('2026-10-10').toMillis());
  });

  it('una comunicación con fecha anterior no retrocede la última comunicación', async () => {
    await createCommunicationIn(db, input({ saleId: null, date: communicationDayToDate('2026-10-01') }), 'admin-activo');
    expect(await lastOf('abierta-2')).toBe(day('2026-10-15').toMillis()); // tenía una más reciente
    expect(await lastOf('abierta-1')).toBe(day('2026-10-01').toMillis()); // no tenía ninguna
  });

  it('no se puede elegir una venta ganada, perdida o de otro contacto', async () => {
    for (const saleId of ['ganada', 'perdida', 'de-otro', 'no-existe']) {
      await expect(createCommunicationIn(db, input({ saleId }), 'admin-activo')).rejects.toBeInstanceOf(SaleNotOpenError);
    }
  });

  it('las reglas exigen la venta: "Todas" sin saleId, o una venta abierta del mismo contacto', async () => {
    const base = {
      contactId: 'ana',
      date: day('2026-10-10'),
      medium: 'llamada',
      otherMedium: null,
      note: 'x',
      source: 'usuario',
      userId: 'admin-activo',
      createdAt: serverTimestamp(),
    };
    const write = (data: object) => setDoc(doc(db, COLLECTIONS.communications, `c-${Math.random()}`), data);
    await assertFails(write({ ...base, saleId: null, appliesToAllSales: false })); // sin venta
    await assertFails(write({ ...base, saleId: 'abierta-1', appliesToAllSales: true })); // las dos cosas
    await assertFails(write({ ...base, saleId: 'ganada', appliesToAllSales: false }));
    await assertFails(write({ ...base, saleId: 'perdida', appliesToAllSales: false }));
    await assertFails(write({ ...base, saleId: 'de-otro', appliesToAllSales: false }));
    await assertFails(write({ ...base, saleId: 'no-existe', appliesToAllSales: false }));
  });
});
