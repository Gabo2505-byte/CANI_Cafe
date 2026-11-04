// HU-502 y HU-503: reglas de la comunicación del formulario web (isValidFormCommunication) contra el emulador.
// Corre con: npm run test:emulators
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, serverTimestamp, setDoc, Timestamp, writeBatch, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-formcomm';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;

const admin = () => testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
const anon = () => testEnv.unauthenticatedContext().firestore() as unknown as Firestore;

const products = [{ productId: 'p1', name: 'Villa Sarchí', presentation: 'Bolsa de 340 g, grano entero', quantity: 2 }];

/** Comunicación del formulario válida para un contacto. */
const formComm = (contactId: string, changes: Record<string, unknown> = {}) => ({
  contactId,
  saleId: null,
  appliesToAllSales: true,
  date: Timestamp.fromDate(new Date(Date.now() - 60_000)),
  medium: 'formulario_web',
  otherMedium: null,
  note: 'Sin mensaje\n\nProductos:\n- Villa Sarchí (Bolsa de 340 g, grano entero): 2',
  source: 'formulario_web',
  userId: null,
  createdAt: serverTimestamp(),
  products,
  ...changes,
});

const newContact = {
  fullName: 'Persona Nueva',
  nameSortKey: 'persona nueva',
  email: 'nueva@example.com',
  phoneCountry: null,
  phoneNumber: null,
  address: null,
  classification: 'persona_interesada',
  status: 'activo',
  origin: 'formulario_web',
  createdAt: Timestamp.now(),
};

const create = (db: Firestore, data: Record<string, unknown>) => setDoc(doc(collection(db, COLLECTIONS.communications)), data);

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    await setDoc(doc(fs, COLLECTIONS.users, 'admin-activo'), { username: 'admin', email: 'admin@example.com', active: true });
    await setDoc(doc(fs, COLLECTIONS.users, 'admin-inactivo'), { username: 'viejo', email: 'viejo@example.com', active: false });
    await setDoc(doc(fs, COLLECTIONS.contacts, 'existente'), { ...newContact, fullName: 'Existente' });
  });
});

describe('communications: comunicación del formulario web (HU-502 y HU-503)', () => {
  it('se permite para un contacto existente, con sesión activa', async () => {
    await assertSucceeds(create(admin(), formComm('existente')));
  });

  it('se permite en el MISMO lote que crea el contacto nuevo (existsAfter)', async () => {
    const db = admin();
    const contactRef = doc(collection(db, COLLECTIONS.contacts));
    const batch = writeBatch(db);
    batch.set(contactRef, newContact);
    batch.set(doc(collection(db, COLLECTIONS.communications)), formComm(contactRef.id));
    await assertSucceeds(batch.commit());
  });

  it('sin el contacto (ni antes ni en el lote) se rechaza', async () => {
    await assertFails(create(admin(), formComm('no-existe')));
  });

  it('una nota de hasta 8000 caracteres se permite; de 8001, no', async () => {
    await assertSucceeds(create(admin(), formComm('existente', { note: 'x'.repeat(8000) })));
    await assertFails(create(admin(), formComm('existente', { note: 'x'.repeat(8001) })));
  });

  it('sin sesión o con un usuario inactivo se rechaza', async () => {
    await assertFails(create(anon(), formComm('existente')));
    await assertFails(create(testEnv.authenticatedContext('admin-inactivo').firestore() as unknown as Firestore, formComm('existente')));
  });

  it.each([
    ['otro origen', { source: 'usuario' }],
    ['otro medio', { medium: 'correo' }],
    ['con usuario', { userId: 'admin-activo' }],
    ['con otro medio escrito', { otherMedium: 'Instagram' }],
    ['para una venta', { saleId: 'venta-1' }],
    ['no para todas las ventas', { appliesToAllSales: false }],
    ['fecha futura', { date: Timestamp.fromDate(new Date(Date.now() + 3_600_000)) }],
    ['nota vacía', { note: '   ' }],
    ['sin productos', { products: [] }],
    ['productos que no son lista', { products: 'p1' }],
    ['más de 72 productos', { products: Array.from({ length: 73 }, () => products[0]) }],
    ['createdAt inventado', { createdAt: Timestamp.now() }],
    ['un campo de más', { extra: true }],
  ])('se rechaza: %s', async (_name, changes) => {
    await assertFails(create(admin(), formComm('existente', changes)));
  });

  it('sin el campo products se rechaza', async () => {
    const { products: _omit, ...withoutProducts } = formComm('existente');
    await assertFails(create(admin(), withoutProducts));
  });

  it('una comunicación manual (HU-211) no puede traer products ni usar el medio del formulario', async () => {
    const manual = {
      contactId: 'existente',
      saleId: null,
      appliesToAllSales: true,
      date: Timestamp.fromDate(new Date(Date.now() - 60_000)),
      medium: 'llamada',
      otherMedium: null,
      note: 'Llamada de seguimiento.',
      source: 'usuario',
      userId: 'admin-activo',
      createdAt: serverTimestamp(),
    };
    await assertSucceeds(create(admin(), manual));
    await assertFails(create(admin(), { ...manual, products }));
    await assertFails(create(admin(), { ...manual, medium: 'formulario_web' }));
  });
});
