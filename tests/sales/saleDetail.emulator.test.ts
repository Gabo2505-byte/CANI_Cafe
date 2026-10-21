// HU-308 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSaleDetailIn } from '../../src/sales/saleDetailRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-sale-detail';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;

const at = (iso: string) => Timestamp.fromDate(new Date(iso));

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, COLLECTIONS.users, 'admin-activo'), { username: 'admin', email: 'a@example.com', active: true });
    await setDoc(doc(db, COLLECTIONS.contacts, 'c-1'), { fullName: 'Ana Activa', status: 'activo' });
    await setDoc(doc(db, COLLECTIONS.products, 'p-1'), { name: 'Café en grano', presentation: 'Bolsa de 1 kg', description: '', active: true });
    await setDoc(doc(db, COLLECTIONS.products, 'p-2'), { name: 'Café molido', presentation: 'Bolsa de 340 g', description: '', active: false });
    await setDoc(doc(db, COLLECTIONS.sales, 's-1'), {
      contactId: 'c-1',
      title: 'Venta con historial',
      stage: 'en_negociacion',
      estimatedAmount: 100,
      nextFollowUpAt: null,
      notes: '',
      createdAt: at('2026-09-01T12:00:00Z'),
      stageChangedAt: at('2026-09-20T12:00:00Z'),
      lastCommunicationAt: null,
    });
    await setDoc(doc(db, COLLECTIONS.sales, 's-2'), { contactId: 'otro', title: 'Otra', stage: 'contactado' });
    // En desorden a propósito.
    await setDoc(doc(db, COLLECTIONS.stageHistory, 's-1_02'), { saleId: 's-1', previousStage: 'nuevo_interesado', newStage: 'contactado', changedAt: at('2026-09-10T12:00:00Z'), lossReason: null });
    await setDoc(doc(db, COLLECTIONS.stageHistory, 's-1_03'), { saleId: 's-1', previousStage: 'contactado', newStage: 'en_negociacion', changedAt: at('2026-09-20T12:00:00Z'), lossReason: null });
    await setDoc(doc(db, COLLECTIONS.stageHistory, 's-1_01'), { saleId: 's-1', previousStage: null, newStage: 'nuevo_interesado', changedAt: at('2026-09-01T12:00:00Z'), lossReason: null });
    await setDoc(doc(db, COLLECTIONS.stageHistory, 's-2_01'), { saleId: 's-2', previousStage: null, newStage: 'contactado', changedAt: at('2026-09-02T12:00:00Z'), lossReason: null });
    await setDoc(doc(db, COLLECTIONS.saleProducts, 's-1_p-1'), { saleId: 's-1', productId: 'p-1', quantity: 20 });
    await setDoc(doc(db, COLLECTIONS.saleProducts, 's-1_p-2'), { saleId: 's-1', productId: 'p-2', quantity: 5 });
    await setDoc(doc(db, COLLECTIONS.saleProducts, 's-1_p-9'), { saleId: 's-1', productId: 'p-9', quantity: 1 });
    await setDoc(doc(db, COLLECTIONS.saleProducts, 's-2_p-1'), { saleId: 's-2', productId: 'p-1', quantity: 99 });
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('detalle de una oportunidad de venta (HU-308)', () => {
  it('trae la venta, el contacto, los productos con nombre y el historial del más reciente al más antiguo', async () => {
    const db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
    const result = await loadSaleDetailIn(db, 's-1');
    expect(result).not.toBeNull();
    expect(result!.sale).toMatchObject({ id: 's-1', title: 'Venta con historial', contactId: 'c-1' });
    expect(result!.contactName).toBe('Ana Activa');
    expect(result!.history.map((h) => h.newStage)).toEqual(['en_negociacion', 'contactado', 'nuevo_interesado']);
  });

  it('los productos incluyen los inactivos y los que ya no están en el catálogo, solo los de esa venta', async () => {
    const db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
    const { products } = (await loadSaleDetailIn(db, 's-1'))!;
    expect(products.map((p) => `${p.name} · ${p.presentation} x${p.quantity}`)).toEqual([
      'Café en grano · Bolsa de 1 kg x20',
      'Café molido · Bolsa de 340 g x5',
      'Producto no disponible · — x1',
    ]);
  });

  it('un contacto que no existe da nombre nulo', async () => {
    const db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
    expect((await loadSaleDetailIn(db, 's-2'))!.contactName).toBeNull();
  });

  it('una venta que no existe da null', async () => {
    const db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
    expect(await loadSaleDetailIn(db, 'no-existe')).toBeNull();
  });

  it('sin sesión no se puede leer', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(loadSaleDetailIn(db, 's-1'));
  });
});
