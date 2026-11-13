// HU-106, HU-107 y HU-108 contra los emuladores reales de Auth y Firestore. Corre con: npm run test:emulators
// El emulador de Auth no manda correos de verdad: guarda cada enlace y lo expone en /emulator/v1/projects/{id}/oobCodes.
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut, type Auth } from 'firebase/auth';
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkResetLinkIn, markResetLinkUsedIn, parseResetLink, RESET_LINK_MINUTES } from '../../src/auth/passwordResetLinks';
import { NEW_PASSWORD_MESSAGES, saveNewPasswordIn } from '../../src/auth/newPassword';
import { RECOVERY_MESSAGES, requestPasswordResetIn } from '../../src/auth/passwordRecovery';
import { signInWithUsernameOn } from '../../src/auth/signInWithUsernameOn';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-recovery';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST;
// El emulador de Auth guarda los enlaces bajo el proyecto con el que arrancó (emulators:exec lo deja en
// GCLOUD_PROJECT), no bajo el projectId de la app de prueba.
const AUTH_PROJECT_ID = process.env.GCLOUD_PROJECT ?? PROJECT_ID;
const USERNAME = `prueba-hu106-${Date.now()}`;
const ORIGIN = 'http://localhost:5173';
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
    expect(await requestPasswordResetIn(auth, publicDb, '   ', ORIGIN)).toEqual({ ok: false, message: RECOVERY_MESSAGES.emptyUsername });
  });

  it('usuario inexistente → "El usuario ingresado no existe." y no se envía correo', async () => {
    expect(await requestPasswordResetIn(auth, publicDb, 'no-existe-nunca', ORIGIN)).toEqual({
      ok: false,
      message: RECOVERY_MESSAGES.userNotFound,
    });
    expect(await resetLinksFor('borrada@example.com')).toHaveLength(0);
  });

  it('índice que apunta a una cuenta inexistente en Auth → "El usuario ingresado no existe."', async () => {
    expect(await requestPasswordResetIn(auth, publicDb, 'cuenta-borrada', ORIGIN)).toEqual({
      ok: false,
      message: RECOVERY_MESSAGES.userNotFound,
    });
  });

  it('usuario existente → envía el enlace al correo de la cuenta y devuelve el correo enmascarado', async () => {
    const result = await requestPasswordResetIn(auth, publicDb, ` ${USERNAME.toUpperCase()} `, ORIGIN);
    expect(result).toEqual({ ok: true, maskedEmail: 'd*****@example.com' });
    const links = await resetLinksFor(EMAIL);
    expect(links).toHaveLength(1);
    expect(links[0].oobLink).toContain('mode=resetPassword');
  });
});

/** Último enlace "enviado" a un correo, leído como lo abriría la pantalla "Nueva contraseña". */
async function lastLink(email: string) {
  const links = await resetLinksFor(email);
  const url = new URL(links[links.length - 1].oobLink);
  return parseResetLink(url.search);
}

describe('HU-107 validez del enlace (emuladores, sin sesión)', () => {
  it('el enlace lleva el usuario y el rid del registro, y sirve recién enviado', async () => {
    await requestPasswordResetIn(auth, publicDb, USERNAME, ORIGIN);
    const link = await lastLink(EMAIL);
    expect(link).not.toBeNull();
    expect(link!.username).toBe(USERNAME);
    const saved = (await getDoc(doc(publicDb, COLLECTIONS.passwordResets, USERNAME))).data();
    expect(saved).toMatchObject({ rid: link!.rid, used: false });
    const check = await checkResetLinkIn(auth, publicDb, link!);
    expect(check).toMatchObject({ ok: true, email: EMAIL });
  });

  it('deja de servir si se pidió un enlace nuevo', async () => {
    await requestPasswordResetIn(auth, publicDb, USERNAME, ORIGIN);
    const first = (await lastLink(EMAIL))!;
    await requestPasswordResetIn(auth, publicDb, USERNAME, ORIGIN);
    const second = (await lastLink(EMAIL))!;
    expect(await checkResetLinkIn(auth, publicDb, first)).toEqual({ ok: false });
    expect((await checkResetLinkIn(auth, publicDb, second)).ok).toBe(true);
  });

  it(`deja de servir ${RESET_LINK_MINUTES} minutos después de enviado`, async () => {
    await requestPasswordResetIn(auth, publicDb, USERNAME, ORIGIN);
    const link = (await lastLink(EMAIL))!;
    const later = Date.now() + RESET_LINK_MINUTES * 60 * 1000 + 1000;
    expect(await checkResetLinkIn(auth, publicDb, link, later)).toEqual({ ok: false });
  });

  it('deja de servir después de usarlo', async () => {
    await requestPasswordResetIn(auth, publicDb, USERNAME, ORIGIN);
    const link = (await lastLink(EMAIL))!;
    await markResetLinkUsedIn(publicDb, link);
    expect(await checkResetLinkIn(auth, publicDb, link)).toEqual({ ok: false });
  });

  it('un código inventado no sirve aunque el rid sea el actual', async () => {
    await requestPasswordResetIn(auth, publicDb, USERNAME, ORIGIN);
    const link = (await lastLink(EMAIL))!;
    expect(await checkResetLinkIn(auth, publicDb, { ...link, oobCode: 'inventado' })).toEqual({ ok: false });
  });
});


describe('HU-108 Crear una nueva contraseña (emuladores, sin sesión)', () => {
  const OLD = 'clave-123456';
  const NEW = 'cafe2026nueva';

  it('guarda la nueva contraseña: la anterior deja de funcionar, la nueva sirve y el enlace ya no', async () => {
    await requestPasswordResetIn(auth, publicDb, USERNAME, ORIGIN);
    const link = (await lastLink(EMAIL))!;
    expect((await checkResetLinkIn(auth, publicDb, link)).ok).toBe(true);

    expect(await saveNewPasswordIn(auth, publicDb, link, NEW)).toEqual({ ok: true });

    // La contraseña anterior deja de funcionar; la nueva sí (ingreso por usuario, como en la pantalla).
    await expect(signInWithUsernameOn(auth, publicDb, USERNAME, OLD)).rejects.toMatchObject({
      code: expect.stringMatching(/auth\/(wrong-password|invalid-credential|invalid-login-credentials)/),
    });
    await signInWithUsernameOn(auth, publicDb, USERNAME, NEW);
    expect(auth.currentUser?.email).toBe(EMAIL);
    await signOut(auth);

    // El enlace quedó usado en Firestore y Firebase tampoco acepta el código otra vez.
    const saved = (await getDoc(doc(publicDb, COLLECTIONS.passwordResets, USERNAME))).data();
    expect(saved).toMatchObject({ rid: link.rid, used: true });
    expect(await checkResetLinkIn(auth, publicDb, link)).toEqual({ ok: false });
    expect(await saveNewPasswordIn(auth, publicDb, link, 'otra2026clave')).toEqual({
      ok: false,
      message: 'El enlace ya no es válido. Solicite uno nuevo.',
    });
    await signInWithUsernameOn(auth, publicDb, USERNAME, NEW);
    await signOut(auth);
  });

  it('si pasaron los 30 minutos con la pantalla abierta, no guarda y avisa que el enlace no es válido', async () => {
    await requestPasswordResetIn(auth, publicDb, USERNAME, ORIGIN);
    const link = (await lastLink(EMAIL))!;
    expect((await checkResetLinkIn(auth, publicDb, link)).ok).toBe(true);
    const later = Date.now() + RESET_LINK_MINUTES * 60 * 1000 + 1000;
    expect(await saveNewPasswordIn(auth, publicDb, link, 'otra2026clave', later)).toEqual({
      ok: false,
      message: 'El enlace ya no es válido. Solicite uno nuevo.',
    });
    // No cambió nada: sigue la contraseña de antes y el enlace no quedó usado.
    await signInWithUsernameOn(auth, publicDb, USERNAME, NEW);
    await signOut(auth);
    expect((await getDoc(doc(publicDb, COLLECTIONS.passwordResets, USERNAME))).get('used')).toBe(false);
  });

  it('si se pidió otro enlace mientras tenía la pantalla abierta, el viejo no guarda', async () => {
    await requestPasswordResetIn(auth, publicDb, USERNAME, ORIGIN);
    const first = (await lastLink(EMAIL))!;
    await requestPasswordResetIn(auth, publicDb, USERNAME, ORIGIN);
    expect(await saveNewPasswordIn(auth, publicDb, first, 'otra2026clave')).toEqual({
      ok: false,
      message: 'El enlace ya no es válido. Solicite uno nuevo.',
    });
    await signInWithUsernameOn(auth, publicDb, USERNAME, NEW);
    await signOut(auth);
  });

  it('un código inventado no cambia la contraseña y avisa que el enlace no es válido', async () => {
    await requestPasswordResetIn(auth, publicDb, USERNAME, ORIGIN);
    const link = (await lastLink(EMAIL))!;
    expect(await saveNewPasswordIn(auth, publicDb, { ...link, oobCode: 'inventado' }, 'otra2026clave')).toEqual({
      ok: false,
      message: 'El enlace ya no es válido. Solicite uno nuevo.',
    });
    await signInWithUsernameOn(auth, publicDb, USERNAME, NEW);
    await signOut(auth);
    // El enlace verdadero sigue sirviendo.
    expect((await checkResetLinkIn(auth, publicDb, link)).ok).toBe(true);
    expect(NEW_PASSWORD_MESSAGES.saved).toBe('Contraseña actualizada correctamente. Ya puede iniciar sesión.');
  });
});
