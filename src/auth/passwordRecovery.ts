// HU-106: Solicitar la recuperación de la contraseña. Recibe Auth y Firestore (se prueba contra los emuladores).
import { sendPasswordResetEmail, type ActionCodeSettings, type Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { LOGIN_MESSAGES } from './loginErrors';
import { findAccountByUsernameIn } from './usernameDirectory';

export const RECOVERY_MESSAGES = {
  emptyUsername: LOGIN_MESSAGES.emptyUsername,
  userNotFound: LOGIN_MESSAGES.userNotFound,
  /** No está en los criterios: falla de conexión o demasiados intentos. Sin este aviso el botón no haría nada. */
  sendFailed: 'No se pudo enviar el enlace. Intente de nuevo en unos minutos.',
} as const;

/** HU-106: "Se envió un enlace de recuperación a d*****@gmail.com." */
export function sentMessage(maskedEmail: string): string {
  return `Se envió un enlace de recuperación a ${maskedEmail}.`;
}

/** HU-106: segundos que hay que esperar para usar "Reenviar enlace". */
export const RESEND_WAIT_SECONDS = 60;

/**
 * HU-106: del correo solo se ve la primera letra y lo que va después de "@": "d*****@gmail.com".
 * Siempre cinco asteriscos (como en el criterio), así no se revela el largo del nombre.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '*****';
  return `${email[0]}*****${email.slice(at)}`;
}

export type RecoveryResult = { ok: true; maskedEmail: string } | { ok: false; message: string };

/**
 * HU-106: valida el usuario y, si existe, pide a Firebase Auth que envíe el correo de recuperación (HU-107) al
 * correo de esa cuenta. Si el usuario está vacío o no existe, no se envía ningún correo.
 */
export async function requestPasswordResetIn(
  auth: Auth,
  db: Firestore,
  username: string,
  actionCodeSettings?: ActionCodeSettings,
): Promise<RecoveryResult> {
  if (username.trim() === '') return { ok: false, message: RECOVERY_MESSAGES.emptyUsername };
  try {
    const account = await findAccountByUsernameIn(db, username);
    if (!account) return { ok: false, message: RECOVERY_MESSAGES.userNotFound };
    await sendPasswordResetEmail(auth, account.email, actionCodeSettings);
    return { ok: true, maskedEmail: maskEmail(account.email) };
  } catch (error) {
    // El índice apunta a una cuenta que ya no existe en Auth: para la persona es lo mismo que un usuario inexistente.
    if ((error as { code?: unknown } | null)?.code === 'auth/user-not-found') {
      return { ok: false, message: RECOVERY_MESSAGES.userNotFound };
    }
    return { ok: false, message: RECOVERY_MESSAGES.sendFailed };
  }
}
