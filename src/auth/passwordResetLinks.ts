// HU-107: validez del enlace de recuperación.
// Firebase Auth genera el código del enlace (oobCode), lo manda por correo y lo invalida al usarlo, pero no deja
// configurar el vencimiento (es fijo) ni anula un enlace cuando se pide otro. Por eso cada solicitud guarda en
// `passwordResets/{usuario}` un identificador aleatorio (rid) y la hora; el rid viaja dentro del enlace
// (continueUrl) y la pantalla "Nueva contraseña" solo acepta el enlace si:
//   - es el último que se pidió para ese usuario (mismo rid),
//   - no se usó, y
//   - no pasaron 30 minutos desde que se envió,
// además de que Firebase Auth lo acepte (verifyPasswordResetCode).
import { verifyPasswordResetCode, type ActionCodeSettings, type Auth } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { ROUTES } from '../app/routes';
import { COLLECTIONS } from '../shared/constants/collections';
import type { PasswordResetRequest } from '../shared/types';
import { normalizeUsername } from './username';

/** HU-107: el enlace vence 30 minutos después de enviado. */
export const RESET_LINK_MINUTES = 30;
const RESET_LINK_MS = RESET_LINK_MINUTES * 60 * 1000;

export const RESET_LINK_MESSAGES = {
  /** HU-107: texto literal del criterio. */
  invalid: 'El enlace ya no es válido. Solicite uno nuevo.',
} as const;

/** Identificador aleatorio del enlace (32 caracteres hexadecimales, criptográficamente aleatorio). */
export function newResetId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * HU-107: registra que se pidió un enlace nuevo para el usuario. Al sobrescribir el rid, el enlace anterior deja de
 * servir. Se hace SIN sesión (pantalla "Recuperar contraseña"); las reglas solo lo permiten para usuarios existentes.
 */
export async function registerResetRequestIn(db: Firestore, username: string, rid: string): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.passwordResets, normalizeUsername(username)), {
    rid,
    requestedAt: serverTimestamp(),
    used: false,
  });
}

/**
 * Configuración del enlace del correo: la pantalla de nueva contraseña, con el usuario y el rid.
 * Firebase lo pone como `continueUrl` dentro del enlace; en producción el enlace abre la acción personalizada
 * (Authentication → Plantillas → URL de acción personalizada = <sitio del administrador>/nueva-contrasena).
 */
export function resetActionCodeSettings(origin: string, username: string, rid: string): ActionCodeSettings {
  const params = new URLSearchParams({ u: normalizeUsername(username), rid });
  return { url: `${origin}${ROUTES.resetPassword}?${params.toString()}`, handleCodeInApp: false };
}

/** Lo que trae la dirección de la pantalla "Nueva contraseña". */
export interface ResetLinkParams {
  oobCode: string;
  username: string;
  rid: string;
}

/**
 * Lee la dirección que abrió el botón del correo: `?mode=resetPassword&oobCode=…&continueUrl=…?u=…&rid=…`.
 * También acepta `u` y `rid` directos (por si se abre la continueUrl con el código agregado). null si falta algo.
 */
export function parseResetLink(search: string): ResetLinkParams | null {
  const params = new URLSearchParams(search);
  if (params.get('mode') !== 'resetPassword') return null;
  const oobCode = params.get('oobCode');
  let username = params.get('u');
  let rid = params.get('rid');
  const continueUrl = params.get('continueUrl');
  if (continueUrl && (!username || !rid)) {
    try {
      const inner = new URL(continueUrl).searchParams;
      username = username ?? inner.get('u');
      rid = rid ?? inner.get('rid');
    } catch {
      return null;
    }
  }
  if (!oobCode || !username || !rid) return null;
  return { oobCode, username, rid };
}

/** Pura (se prueba sin Firebase): ¿el registro del usuario permite este rid ahora? */
export function isResetRequestCurrent(
  request: Pick<PasswordResetRequest, 'rid' | 'used'> & { requestedAt: { toMillis(): number } | null } | null,
  rid: string,
  now: number,
): boolean {
  if (!request || request.used || request.rid !== rid || !request.requestedAt) return false;
  return now - request.requestedAt.toMillis() < RESET_LINK_MS;
}

/** Hora en que vence un enlace pedido a `requestedAt`. */
export function resetLinkExpiresAt(requestedAt: { toMillis(): number }): Date {
  return new Date(requestedAt.toMillis() + RESET_LINK_MS);
}

export type ResetLinkCheck = { ok: true; email: string; expiresAt: Date } | { ok: false };

/** HU-107: ¿el enlace sigue sirviendo? Sin sesión. Cualquier falla cuenta como "no válido". */
export async function checkResetLinkIn(
  auth: Auth,
  db: Firestore,
  link: ResetLinkParams,
  now: number = Date.now(),
): Promise<ResetLinkCheck> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.passwordResets, normalizeUsername(link.username)));
    const request = snap.exists() ? (snap.data() as PasswordResetRequest) : null;
    if (!request || !isResetRequestCurrent(request, link.rid, now)) return { ok: false };
    // Firebase revisa que el código exista, no haya vencido y no se haya usado.
    const email = await verifyPasswordResetCode(auth, link.oobCode);
    return { ok: true, email, expiresAt: resetLinkExpiresAt(request.requestedAt) };
  } catch {
    return { ok: false };
  }
}

/** HU-107: después de crear la contraseña, el enlace queda usado (solo se puede usar una vez). */
export async function markResetLinkUsedIn(db: Firestore, link: Pick<ResetLinkParams, 'username' | 'rid'>): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.passwordResets, normalizeUsername(link.username)), { used: true });
}
