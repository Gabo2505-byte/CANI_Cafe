// HU-104 contra los emuladores reales de Auth y Firestore. Corre con: npm run test:emulators
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { usernameToAuthEmail } from '../../src/auth/username';
import { COLLECTIONS } from '../../src/shared/constants/collections';

// Proyecto propio para no tocar los datos de otras pruebas.
const PROJECT_ID = 'demo-cani-crm-signout';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();

  app = initializeApp({ apiKey: 'demo-api-key', projectId: PROJECT_ID }, 'hu104');
  auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  db = getFirestore(app);
  connectFirestoreEmulator(db, host, Number(port));

  const { user } = await createUserWithEmailAndPassword(auth, usernameToAuthEmail(`prueba-hu104-${Date.now()}`), 'clave-123456');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, COLLECTIONS.users, user.uid), { username: 'prueba', email: 'prueba@example.com', active: true });
    await setDoc(doc(adminDb, COLLECTIONS.contacts, 'contact-001'), { fullName: 'Contacto Prueba' });
  });
});

afterAll(async () => {
  await deleteApp(app);
  await testEnv?.cleanup();
});

describe('HU-104 contra emuladores', () => {
  it('con sesión activa se puede leer contacts; después de cerrar sesión la lectura es rechazada', async () => {
    const contactRef = doc(db, COLLECTIONS.contacts, 'contact-001');

    const before = await getDoc(contactRef);
    expect(before.get('fullName')).toBe('Contacto Prueba');

    await signOut(auth);
    expect(auth.currentUser).toBeNull();

    await expect(getDoc(contactRef)).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
