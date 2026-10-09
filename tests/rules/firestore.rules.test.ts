// Corre con: npm run test:emulators
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { COLLECTIONS } from '../../src/shared/constants/collections';

// Proyecto propio para estas pruebas: clearFirestore() no toca los datos del seed.
const PROJECT_ID = 'demo-cani-crm-rules';
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
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
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/active-user'), { username: 'activo', email: 'activo@example.com', active: true });
    await setDoc(doc(db, 'users/inactive-user'), { username: 'inactivo', email: 'inactivo@example.com', active: false });
    await setDoc(doc(db, 'contacts/contact-001'), { fullName: 'Contacto Prueba' });
  });
});

const ALL_COLLECTIONS = Object.values(COLLECTIONS);

describe('firestore.rules', () => {
  it('niega lectura y escritura sin autenticación', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'contacts/contact-001')));
    await assertFails(setDoc(doc(db, 'contacts/nuevo'), { fullName: 'X' }));
  });

  it('niega a un usuario autenticado sin documento en users', async () => {
    const db = testEnv.authenticatedContext('sin-perfil').firestore();
    await assertFails(getDoc(doc(db, 'contacts/contact-001')));
    await assertFails(setDoc(doc(db, 'contacts/nuevo'), { fullName: 'X' }));
  });

  it('niega a un usuario inactivo, incluso su propio perfil', async () => {
    const db = testEnv.authenticatedContext('inactive-user').firestore();
    await assertFails(getDoc(doc(db, 'contacts/contact-001')));
    await assertFails(getDoc(doc(db, 'users/inactive-user')));
    await assertFails(setDoc(doc(db, 'users/inactive-user'), { active: true }));
  });

  it.each(ALL_COLLECTIONS)('permite a un usuario activo leer y escribir en %s', async (collection) => {
    const db = testEnv.authenticatedContext('active-user').firestore();
    await assertSucceeds(setDoc(doc(db, `${collection}/doc-prueba`), { campo: 'valor' }));
    await assertSucceeds(getDoc(doc(db, `${collection}/doc-prueba`)));
  });

  it('niega colecciones fuera del contrato, incluso a usuarios activos', async () => {
    const db = testEnv.authenticatedContext('active-user').firestore();
    await assertFails(setDoc(doc(db, 'otraColeccion/x'), { campo: 'valor' }));
    await assertFails(setDoc(doc(db, 'contacts/contact-001/sub/x'), { campo: 'valor' }));
  });
});
