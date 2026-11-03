// HU-106 (y el envío de HU-107) contra los emuladores reales de Auth y Firestore. Corre con: npm run test:emulators
// El emulador de Auth no manda correos de verdad: guarda cada enlace y lo expone en /emulator/v1/projects/{id}/oobCodes.
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut, type Auth } from 'firebase/auth';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RECOVERY_MESSAGES, requestPasswordResetIn } from '../../src/auth/passwordRecovery';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-recovery';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST;
// El emulador de Auth guarda los enlaces bajo el proyecto con el que arrancó (emulators:exec lo deja en
// GCLOUD_PROJECT), no bajo el projectId de la app de prueba.
const AUTH_PROJECT_ID = process.env.GCLOUD_PROJECT ?? PROJECT_ID;
const USERNAME = `prueba-hu106-${Date.now()}`;
const EMAIL = `d${Date.now()}@example.com`;
let testEnv: RulesTestEnvironment;
let app: FirebaseApp;
let auth: Auth;
let publicDb: Firestore;

interface OobCode {
  email: string;
  requestType: string;
  oobLink: string;
}

/** Enlaces de restablecimiento que el emulador "envió" a un correo. */
async function resetLinksFor(email: string): Promise<OobCode[]> {
  const res = await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${AUTH_PROJECT_ID}/oobCodes`);
  const { oobCodes } = (await res.json()) as { oobCodes: OobCode[] };
  return oobCodes.filter((code) => code.email === email && code.requestType === 'PASSWORD_RESET');
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();
  publicDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;

  app = initializeApp({ apiKey: 'demo-api-key', projectId: PROJECT_ID }, 'hu106');
  auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  const { user } = await createUserWithEmailAndPassword(auth, EMAIL, 'clave-123456');
  await signOut(auth);
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), COLLECTIONS.usernames, USERNAME), { uid: user.uid, email: EMAIL });
    // Índice que apunta a una cuenta borrada de Auth.
    await setDoc(doc(ctx.firestore(), COLLECTIONS.usernames, 'cuenta-borrada'), { uid: 'x', email: 'borrada@example.com' });
  });
});

afterAll(async () => {
  await deleteApp(app);
  await testEnv?.cleanup();
});

describe('HU-106 Solicitar la recuperación de la contraseña (emuladores, sin sesión)', () => {
  it('usuario vacío → "Ingrese su usuario." y no se envía correo', async () => {
    expect(await requestPasswordResetIn(auth, publicDb, '   ')).toEqual({ ok: false, message: RECOVERY_MESSAGES.emptyUsername });
  });

  it('usuario inexistente → "El usuario ingresado no existe." y no se envía correo', async () => {
    expect(await requestPasswordResetIn(auth, publicDb, 'no-existe-nunca')).toEqual({
      ok: false,
      message: RECOVERY_MESSAGES.userNotFound,
    });
    expect(await resetLinksFor('borrada@example.com')).toHaveLength(0);
  });

  it('índice que apunta a una cuenta inexistente en Auth → "El usuario ingresado no existe."', async () => {
    expect(await requestPasswordResetIn(auth, publicDb, 'cuenta-borrada')).toEqual({
      ok: false,
      message: RECOVERY_MESSAGES.userNotFound,
    });
  });

  it('usuario existente → envía el enlace al correo de la cuenta y devuelve el correo enmascarado', async () => {
    const result = await requestPasswordResetIn(auth, publicDb, ` ${USERNAME.toUpperCase()} `);
    expect(result).toEqual({ ok: true, maskedEmail: 'd*****@example.com' });
    const links = await resetLinksFor(EMAIL);
    expect(links).toHaveLength(1);
    expect(links[0].oobLink).toContain('mode=resetPassword');
  });
});
