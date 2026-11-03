// Corre con: npm run test:emulators
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '../../src/shared/constants/collections';
import { FORM_REQUESTS_COLLECTION } from '../../src/shared/types/formRequest';

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

// `communications` tiene reglas propias (HU-211): ver tests/communications/createCommunication.emulator.test.ts y communicationSale.emulator.test.ts.
// `formRequests` (formulario del sitio público, HU-405) también: solo acepta solicitudes con su esquema, así que
// `{ campo: 'valor' }` se rechaza a propósito. Ver tests/rules/formRequests.rules.test.ts.
const ALL_COLLECTIONS = Object.values(COLLECTIONS).filter(
  (c: string) => c !== COLLECTIONS.communications && c !== FORM_REQUESTS_COLLECTION,
);

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

  // HU-402: el sitio público lee solo los productos activos, sin sesión.
  describe('products: lectura pública de los activos (HU-402)', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'products/activo'), { name: 'A', presentation: 'P', description: 'D', active: true });
        await setDoc(doc(db, 'products/inactivo'), { name: 'B', presentation: 'P', description: 'D', active: false });
      });
    });

    it('sin sesión se puede leer un producto activo, pero no uno inactivo', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(getDoc(doc(db, 'products/activo')));
      await assertFails(getDoc(doc(db, 'products/inactivo')));
    });

    it('sin sesión la consulta con where("active", "==", true) funciona y trae solo los activos', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      const snap = await assertSucceeds(getDocs(query(collection(db, 'products'), where('active', '==', true))));
      expect(snap.docs.map((d) => d.id)).toEqual(['activo']);
    });

    it('sin sesión se deniega la consulta sin el filtro de activos, o con active == false', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDocs(collection(db, 'products')));
      await assertFails(getDocs(query(collection(db, 'products'), where('active', '==', false))));
    });

    it('sin sesión no se puede crear, cambiar ni borrar un producto, ni leer otra colección', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(setDoc(doc(db, 'products/nuevo'), { name: 'X', active: true }));
      await assertFails(setDoc(doc(db, 'products/activo'), { active: false }, { merge: true }));
      await assertFails(deleteDoc(doc(db, 'products/activo')));
      await assertFails(getDocs(collection(db, 'contacts')));
      await assertFails(getDocs(query(collection(db, 'sales'), where('active', '==', true))));
    });

    it('con sesión activa se siguen leyendo todos los productos, también los inactivos', async () => {
      const db = testEnv.authenticatedContext('active-user').firestore();
      await assertSucceeds(getDoc(doc(db, 'products/inactivo')));
      const snap = await assertSucceeds(getDocs(collection(db, 'products')));
      expect(snap.size).toBe(2);
    });

    it('un usuario inactivo solo ve los activos, igual que cualquier visitante', async () => {
      const db = testEnv.authenticatedContext('inactive-user').firestore();
      await assertSucceeds(getDoc(doc(db, 'products/activo')));
      await assertFails(getDoc(doc(db, 'products/inactivo')));
      await assertFails(getDocs(collection(db, 'products')));
    });
  });

  // HU-101 y HU-106: el índice usuario → cuenta se lee por id sin sesión (ingreso y recuperación), nunca se lista
  // ni se escribe sin sesión.
  describe('usernames', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'usernames/activo'), { uid: 'active-user', email: 'activo@example.com' });
      });
    });

    it('sin sesión se lee un usuario por su id exacto', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      const snap = await assertSucceeds(getDoc(doc(db, 'usernames/activo')));
      expect(snap.data()).toEqual({ uid: 'active-user', email: 'activo@example.com' });
    });

    it('sin sesión no se pueden listar ni buscar usuarios', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDocs(collection(db, 'usernames')));
      await assertFails(getDocs(query(collection(db, 'usernames'), where('email', '==', 'activo@example.com'))));
    });

    it('sin sesión, o con usuario inactivo, no se puede crear, cambiar ni borrar', async () => {
      for (const db of [testEnv.unauthenticatedContext().firestore(), testEnv.authenticatedContext('inactive-user').firestore()]) {
        await assertFails(setDoc(doc(db, 'usernames/intruso'), { uid: 'x', email: 'x@example.com' }));
        await assertFails(setDoc(doc(db, 'usernames/activo'), { uid: 'x', email: 'x@example.com' }));
        await assertFails(deleteDoc(doc(db, 'usernames/activo')));
      }
    });
  });
});
