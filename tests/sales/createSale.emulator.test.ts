// HU-301 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSaleIn, listOpenSaleTitlesIn } from '../../src/sales/salesRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-create-sale';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;
let db: Firestore;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), COLLECTIONS.users, 'admin-activo'), {
      username: 'admin',
      email: 'a@example.com',
      active: true,
    });
  });
  db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('crear una oportunidad de venta (HU-301)', () => {
  it('guarda la venta, sus productos y el primer registro del historial', async () => {
    const saleId = await createSaleIn(db, {
      contactId: 'contact-001',
      title: '  Café en grano para su cafetería ',
      stage: 'contactado',
      estimatedAmount: 450000,
      nextFollowUpAt: new Date('2026-10-20T06:00:00Z'),
      notes: 'Notas de prueba',
      products: [
        { productId: 'product-001', quantity: 20 },
        { productId: 'product-002', quantity: 10 },
      ],
    });

    const sale = (await getDoc(doc(db, COLLECTIONS.sales, saleId))).data()!;
    expect(sale).toMatchObject({
      contactId: 'contact-001',
      title: 'Café en grano para su cafetería',
      stage: 'contactado',
      estimatedAmount: 450000,
      notes: 'Notas de prueba',
      lastCommunicationAt: null,
    });
    expect(sale.nextFollowUpAt.toDate().toISOString()).toBe('2026-10-20T06:00:00.000Z');
    // Al crear, stageChangedAt es igual a createdAt.
    expect(sale.stageChangedAt.toMillis()).toBe(sale.createdAt.toMillis());

    const products = await getDocs(query(collection(db, COLLECTIONS.saleProducts), where('saleId', '==', saleId)));
    expect(products.docs.map((d) => d.id).sort()).toEqual([`${saleId}_product-001`, `${saleId}_product-002`]);
    expect(products.docs.find((d) => d.id.endsWith('product-001'))!.data()).toEqual({
      saleId,
      productId: 'product-001',
      quantity: 20,
    });

    const history = await getDocs(query(collection(db, COLLECTIONS.stageHistory), where('saleId', '==', saleId)));
    expect(history.size).toBe(1);
    const entry = history.docs[0].data();
    expect(entry).toMatchObject({ previousStage: null, newStage: 'contactado', lossReason: null });
    expect(entry.changedAt.toMillis()).toBe(sale.createdAt.toMillis());
  });

  it('sin productos ni seguimiento también se guarda', async () => {
    const saleId = await createSaleIn(db, {
      contactId: 'contact-009',
      title: 'Solo lo obligatorio',
      stage: 'nuevo_interesado',
      estimatedAmount: 0,
      nextFollowUpAt: null,
      notes: '',
      products: [],
    });
    const sale = (await getDoc(doc(db, COLLECTIONS.sales, saleId))).data()!;
    expect(sale.nextFollowUpAt).toBeNull();
    expect(sale.estimatedAmount).toBe(0);
    const products = await getDocs(query(collection(db, COLLECTIONS.saleProducts), where('saleId', '==', saleId)));
    expect(products.size).toBe(0);
  });

  it('un contacto puede tener varias ventas a la vez y crear una no cambia las anteriores', async () => {
    const input = { contactId: 'contact-002', stage: 'nuevo_interesado' as const, estimatedAmount: 1, nextFollowUpAt: null, notes: '', products: [] };
    const first = await createSaleIn(db, { ...input, title: 'Primera' });
    const before = (await getDoc(doc(db, COLLECTIONS.sales, first))).data();

    const second = await createSaleIn(db, { ...input, title: 'Segunda', stage: 'en_negociacion' });

    expect(second).not.toBe(first);
    expect((await getDoc(doc(db, COLLECTIONS.sales, first))).data()).toEqual(before);
    expect((await listOpenSaleTitlesIn(db, 'contact-002')).sort()).toEqual(['Primera', 'Segunda']);
  });

  it('sin sesión no se puede crear y no queda nada guardado', async () => {
    const anon = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(
      createSaleIn(anon, {
        contactId: 'contact-003',
        title: 'No debería guardarse',
        stage: 'nuevo_interesado',
        estimatedAmount: 1,
        nextFollowUpAt: null,
        notes: '',
        products: [{ productId: 'product-001', quantity: 1 }],
      }),
    );
    expect(await listOpenSaleTitlesIn(db, 'contact-003')).toEqual([]);
  });
});
