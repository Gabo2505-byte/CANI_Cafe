// HU-102 contra los emuladores reales de Auth y Firestore. Corre con: npm run test:emulators
// La cuenta de Auth usa el correo real y el índice `usernames` traduce el usuario (src/auth/usernameDirectory.ts).
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut, type Auth } from 'firebase/auth';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOGIN_MESSAGES, loginErrorFromAuth } from '../../src/auth/loginErrors';
import { signInWithUsernameOn } from '../../src/auth/signInWithUsernameOn';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-signin';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
// Usuario único por corrida para no depender del estado del emulador.
const USERNAME = `prueba-hu102-${Date.now()}`;
const EMAIL = `${USERNAME}@example.com`;
const PASSWORD = 'clave-correcta-123';
let testEnv: RulesTestEnvironment;
let app: FirebaseApp;
let auth: Auth;
/** Firestore SIN sesión: así está la pantalla de ingreso cuando busca el usuario. */
let publicDb: Firestore;

async function errorOf(username: string, password: string) {
  try {
    await signInWithUsernameOn(auth, publicDb, username, password);
    return 'sin error';
  } catch (error) {
    return loginErrorFromAuth(error);
  }
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();
  publicDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;

  app = initializeApp({ apiKey: 'demo-api-key', projectId: PROJECT_ID }, 'hu102');
  auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const { user } = await createUserWithEmailAndPassword(auth, EMAIL, PASSWORD);
  await signOut(auth);
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), COLLECTIONS.usernames, USERNAME), { uid: user.uid, email: EMAIL });
  });
});

afterAll(async () => {
  await deleteApp(app);
  await testEnv?.cleanup();
});

describe('ingreso contra los emuladores', () => {
  it('usuario inexistente → "El usuario ingresado no existe."', async () => {
    expect(await errorOf('no-existe-nunca', PASSWORD)).toEqual({ username: LOGIN_MESSAGES.userNotFound });
  });

  it('contraseña incorrecta → "La contraseña es incorrecta."', async () => {
    expect(await errorOf(USERNAME, 'incorrecta')).toEqual({ password: LOGIN_MESSAGES.wrongPassword });
  });

  it('credenciales correctas ingresan, sin importar mayúsculas ni espacios en el usuario', async () => {
    expect(await errorOf(`  ${USERNAME.toUpperCase()} `, PASSWORD)).toBe('sin error');
    expect(auth.currentUser?.email).toBe(EMAIL);
    await signOut(auth);
  });
});
