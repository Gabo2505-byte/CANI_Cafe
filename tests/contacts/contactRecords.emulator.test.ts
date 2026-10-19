// HU-207 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContactRecordsIn } from '../../src/contacts/contactDetailRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-records';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;
let db: Firestore;

const at = (iso: string) => Timestamp.fromDate(new Date(iso));

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    await setDoc(doc(fs, COLLECTIONS.users, 'admin-activo'), { username: 'admin', email: 'admin@example.com', active: true });
    const products = [
      ['p1', 'Café molido', 'Bolsa de 340 g'],
      ['p2', 'Café en grano', 'Bolsa de 1 kg'],
      ['p3', 'Café en grano', 'Bolsa de 340 g'],
    ];
    for (const [id, name, presentation] of products) {
      await setDoc(doc(fs, COLLECTIONS.products, id), { name, presentation, description: '', active: id !== 'p3' });
    }
    const sale = (contactId: string, title: string, createdAt: string, stage = 'contactado') => ({
      contactId,
      title,
      stage,
      estimatedAmount: 1000,
      nextFollowUpAt: null,
      notes: '',
      createdAt: at(createdAt),
      stageChangedAt: at(createdAt),
      lastCommunicationAt: null,
    });
    await setDoc(doc(fs, COLLECTIONS.sales, 's1'), sale('ana', 'Venta vieja', '2026-08-01T10:00:00Z'));
    await setDoc(doc(fs, COLLECTIONS.sales, 's2'), sale('ana', 'Venta nueva', '2026-10-01T10:00:00Z'));
    await setDoc(doc(fs, COLLECTIONS.sales, 's3'), sale('otro', 'Venta de otro', '2026-10-01T10:00:00Z'));
    // HU-208: las ganadas y perdidas (aunque sean antiguas) también son del contacto.
    await setDoc(doc(fs, COLLECTIONS.sales, 's4'), sale('ana', 'Venta ganada antigua', '2026-06-01T10:00:00Z', 'ganada'));
    await setDoc(doc(fs, COLLECTIONS.sales, 's5'), sale('ana', 'Venta perdida', '2026-09-01T10:00:00Z', 'perdida'));
    const saleProducts: [string, string][] = [
      ['s1', 'p1'],
      ['s1', 'p2'],
      ['s2', 'p2'],
      ['s2', 'p3'],
      ['s3', 'p1'],
    ];
    for (const [saleId, productId] of saleProducts) {
      await setDoc(doc(fs, COLLECTIONS.saleProducts, `${saleId}_${productId}`), { saleId, productId, quantity: 1 });
    }
    const comm = (contactId: string, date: string, note: string) => ({
      contactId,
      saleId: null,
      appliesToAllSales: false,
      date: at(date),
      medium: 'llamada',
      note,
      source: 'usuario',
      userId: 'admin-activo',
      createdAt: at(date),
    });
    await setDoc(doc(fs, COLLECTIONS.communications, 'k1'), comm('ana', '2026-09-01T10:00:00Z', 'primera'));
    await setDoc(doc(fs, COLLECTIONS.communications, 'k2'), comm('ana', '2026-10-05T10:00:00Z', 'segunda'));
    await setDoc(doc(fs, COLLECTIONS.communications, 'k3'), comm('otro', '2026-10-05T10:00:00Z', 'de otro'));
  });
  db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('HU-207 registros de la ficha desde Firestore', () => {
  it('solo trae los registros del contacto, en orden, con los productos de interés sin repetir', async () => {
    const records = await loadContactRecordsIn(db, 'ana');
    expect(records.communications.map((c) => c.note)).toEqual(['segunda', 'primera']);
    expect(records.sales.map((s) => s.title)).toEqual(['Venta nueva', 'Venta perdida', 'Venta vieja', 'Venta ganada antigua']);
    // p3 está inactivo pero se muestra: aparece en una venta del contacto.
    expect(records.products.map((p) => `${p.name} · ${p.presentation}`)).toEqual([
      'Café en grano · Bolsa de 1 kg',
      'Café en grano · Bolsa de 340 g',
      'Café molido · Bolsa de 340 g',
    ]);
  });

  it('contacto sin registros: todo vacío', async () => {
    expect(await loadContactRecordsIn(db, 'sin-registros')).toEqual({
      communications: [],
      communicationsTotal: 0,
      communicationsCursor: null,
      userNames: {},
      sales: [],
      products: [],
    });
  });

  it('sin sesión no se pueden leer', async () => {
    const anon = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(loadContactRecordsIn(anon, 'ana'));
  });
});
