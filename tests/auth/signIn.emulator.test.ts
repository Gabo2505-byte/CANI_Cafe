// HU-102 contra el emulador real de Auth. Corre con: npm run test:emulators
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut, type Auth } from 'firebase/auth';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOGIN_MESSAGES, loginErrorFromAuth } from '../../src/auth/loginErrors';
import { signInWithUsernameOn } from '../../src/auth/signInWithUsernameOn';
import { usernameToAuthEmail } from '../../src/auth/username';

// Usuario único por corrida para no depender del estado del emulador.
const USERNAME = `prueba-hu102-${Date.now()}`;
const PASSWORD = 'clave-correcta-123';
let app: FirebaseApp;
let auth: Auth;

async function errorOf(username: string, password: string) {
  try {
    await signInWithUsernameOn(auth, username, password);
    return 'sin error';
  } catch (error) {
    return loginErrorFromAuth(error);
  }
}

beforeAll(async () => {
  app = initializeApp({ apiKey: 'demo-api-key', projectId: process.env.VITE_FIREBASE_PROJECT_ID }, 'hu102');
  auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  await createUserWithEmailAndPassword(auth, usernameToAuthEmail(USERNAME), PASSWORD);
  await signOut(auth);
});

afterAll(async () => {
  await deleteApp(app);
});

describe('ingreso contra el emulador de Auth', () => {
  it('usuario inexistente → "El usuario ingresado no existe."', async () => {
    expect(await errorOf('no-existe-nunca', PASSWORD)).toEqual({ username: LOGIN_MESSAGES.userNotFound });
  });

  it('contraseña incorrecta → "La contraseña es incorrecta."', async () => {
    expect(await errorOf(USERNAME, 'incorrecta')).toEqual({ password: LOGIN_MESSAGES.wrongPassword });
  });

  it('credenciales correctas ingresan', async () => {
    expect(await errorOf(USERNAME, PASSWORD)).toBe('sin error');
    await signOut(auth);
  });
});
