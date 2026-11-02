// HT-002 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp } from 'firebase/app';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { connectFirestoreEmulator, getFirestore as getLiteFirestore } from 'firebase/firestore/lite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listPublicProductsIn } from '../../src/products/publicCatalog';
import { listActiveProductsIn, listProductsIn } from '../../src/products/productsRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-products';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;

const PRODUCTS = [
  { id: 'p-1', name: 'Zeta', presentation: 'Bolsa de 1 kg', description: 'Ejemplo', active: true },
  { id: 'p-2', name: 'Álamo', presentation: 'Bolsa de 340 g', description: 'Ejemplo', active: true },
  { id: 'p-3', name: 'beta', presentation: 'Bolsa de 1 kg', description: 'Ejemplo', active: false },
];

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, COLLECTIONS.users, 'admin-activo'), { username: 'admin', email: 'a@example.com', active: true });
    for (const { id, ...data } of PRODUCTS) await setDoc(doc(db, COLLECTIONS.products, id), data);
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('catálogo de productos (HT-002)', () => {
  it('lista los productos con su id, ordenados sin importar tildes ni mayúsculas', async () => {
    const db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
    const products = await listProductsIn(db);
    expect(products.map((p) => p.id)).toEqual(['p-2', 'p-3', 'p-1']);
  });

  it('para elegir productos en una venta solo ofrece los activos', async () => {
    const db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
    const products = await listActiveProductsIn(db);
    expect(products.map((p) => p.name)).toEqual(['Álamo', 'Zeta']);
  });

  it('sin sesión no se puede leer el catálogo', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(listProductsIn(db));
  });

  it('sin sesión (sitio público, con Firestore Lite) solo se leen los productos activos, con su id', async () => {
    // El sitio público usa Firestore Lite: necesita su propio cliente (sin sesión) contra el mismo proyecto del emulador,
    // así que las reglas que cargó testEnv se aplican igual.
    const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-api-key' }, 'publico-lite-productos');
    const db = getLiteFirestore(app);
    connectFirestoreEmulator(db, host, Number(port));
    const products = await listPublicProductsIn(db).finally(() => deleteApp(app));
    expect(products.map((p) => p.id).sort()).toEqual(['p-1', 'p-2']);
    expect(products.every((p) => p.active)).toBe(true);
  });
});
