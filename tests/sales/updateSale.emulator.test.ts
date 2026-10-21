// HU-309 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { updateSaleIn } from '../../src/sales/salesRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';
import { Timestamp } from 'firebase/firestore';

const PROJECT_ID = 'demo-cani-crm-update-sale';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;
let db: Firestore;

const at = (iso: string) => Timestamp.fromDate(new Date(iso));
const baseSale = {
  contactId: 'c-1',
  title: 'Título original',
  stage: 'en_negociacion',
  estimatedAmount: 100_000,
  nextFollowUpAt: at('2026-11-01T06:00:00Z'),
  notes: 'Notas originales',
  createdAt: at('2026-09-01T12:00:00Z'),
  stageChangedAt: at('2026-10-01T12:00:00Z'),
  lastCommunicationAt: at('2026-10-05T12:00:00Z'),
};

async function resetData() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();
    await setDoc(doc(admin, COLLECTIONS.users, 'admin-activo'), { username: 'admin', email: 'a@example.com', active: true });
    await setDoc(doc(admin, COLLECTIONS.sales, 's-open'), baseSale);
    await setDoc(doc(admin, COLLECTIONS.sales, 's-won'), { ...baseSale, title: 'Ganada', stage: 'ganada' });
    await setDoc(doc(admin, COLLECTIONS.stageHistory, 's-open_01'), { saleId: 's-open', previousStage: null, newStage: 'en_negociacion', changedAt: at('2026-09-01T12:00:00Z'), lossReason: null });
    for (const [sale, product, quantity] of [['s-open', 'p-1', 10], ['s-open', 'p-2', 20], ['s-won', 'p-1', 5], ['otra', 'p-1', 99]] as const) {
      await setDoc(doc(admin, COLLECTIONS.saleProducts, `${sale}_${product}`), { saleId: sale, productId: product, quantity });
    }
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
});
beforeEach(resetData);
afterAll(async () => {
  await testEnv?.cleanup();
});

const productsOf = async (saleId: string) => {
  const snap = await getDocs(query(collection(db, COLLECTIONS.saleProducts), where('saleId', '==', saleId)));
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.get('quantity')]));
};

describe('editar una oportunidad de venta (HU-309)', () => {
  it('guarda título, monto, seguimiento y notas sin tocar etapa, historial ni última comunicación', async () => {
    await updateSaleIn(db, 's-open', {
      title: '  Título nuevo ',
      estimatedAmount: 250_000,
      nextFollowUpAt: new Date('2026-12-15T06:00:00Z'),
      notes: 'Notas nuevas',
      products: [{ productId: 'p-1', quantity: 10 }],
    });
    const sale = (await getDoc(doc(db, COLLECTIONS.sales, 's-open'))).data()!;
    expect(sale).toMatchObject({ title: 'Título nuevo', estimatedAmount: 250_000, notes: 'Notas nuevas', stage: 'en_negociacion' });
    expect(sale.nextFollowUpAt.toDate().toISOString()).toBe('2026-12-15T06:00:00.000Z');
    expect(sale.createdAt.toMillis()).toBe(baseSale.createdAt.toMillis());
    expect(sale.stageChangedAt.toMillis()).toBe(baseSale.stageChangedAt.toMillis());
    expect(sale.lastCommunicationAt.toMillis()).toBe(baseSale.lastCommunicationAt.toMillis());
    const history = await getDocs(query(collection(db, COLLECTIONS.stageHistory), where('saleId', '==', 's-open')));
    expect(history.size).toBe(1);
  });

  it('quitar el seguimiento lo deja en null', async () => {
    await updateSaleIn(db, 's-open', { title: 'T', estimatedAmount: 0, nextFollowUpAt: null, notes: '', products: [] });
    const sale = (await getDoc(doc(db, COLLECTIONS.sales, 's-open'))).data()!;
    expect(sale.nextFollowUpAt).toBeNull();
    expect(sale.estimatedAmount).toBe(0);
  });

  it('reemplaza los productos: borra los que ya no están, cambia cantidades y agrega nuevos; no toca otras ventas', async () => {
    await updateSaleIn(db, 's-open', {
      title: 'T',
      estimatedAmount: 1,
      nextFollowUpAt: null,
      notes: '',
      products: [
        { productId: 'p-2', quantity: 25 },
        { productId: 'p-3', quantity: 3 },
      ],
    });
    expect(await productsOf('s-open')).toEqual({ 's-open_p-2': 25, 's-open_p-3': 3 });
    expect(await productsOf('s-won')).toEqual({ 's-won_p-1': 5 });
    expect(await productsOf('otra')).toEqual({ 'otra_p-1': 99 });
  });

  it('sin productos quita todos los de esa venta', async () => {
    await updateSaleIn(db, 's-open', { title: 'T', estimatedAmount: 1, nextFollowUpAt: null, notes: '', products: [] });
    expect(await productsOf('s-open')).toEqual({});
  });

  it('una venta ganada solo guarda las notas, aunque se pidan otros cambios', async () => {
    await updateSaleIn(db, 's-won', {
      title: 'Título que no debe guardarse',
      estimatedAmount: 1,
      nextFollowUpAt: null,
      notes: 'Notas de la ganada',
      products: [],
    });
    const sale = (await getDoc(doc(db, COLLECTIONS.sales, 's-won'))).data()!;
    expect(sale).toMatchObject({ title: 'Ganada', estimatedAmount: 100_000, notes: 'Notas de la ganada', stage: 'ganada' });
    expect(sale.nextFollowUpAt.toMillis()).toBe(baseSale.nextFollowUpAt.toMillis());
    expect(await productsOf('s-won')).toEqual({ 's-won_p-1': 5 });
  });

  it('una venta que no existe da error y no crea nada', async () => {
    await expect(
      updateSaleIn(db, 'no-existe', { title: 'T', estimatedAmount: 1, nextFollowUpAt: null, notes: '', products: [{ productId: 'p-1', quantity: 1 }] }),
    ).rejects.toThrow(/no existe/);
    expect((await getDoc(doc(db, COLLECTIONS.sales, 'no-existe'))).exists()).toBe(false);
    expect(await productsOf('no-existe')).toEqual({});
  });

  it('sin sesión no se puede editar y no cambia nada', async () => {
    const anon = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(updateSaleIn(anon, 's-open', { title: 'Hackeado', estimatedAmount: 1, nextFollowUpAt: null, notes: '', products: [] }));
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-open'))).get('title')).toBe('Título original');
  });
});
