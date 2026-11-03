// HU-108: Crear una nueva contraseña. La regla y los mensajes son puros (se prueban sin Firebase);
// saveNewPasswordIn recibe Auth y Firestore (se prueba contra los emuladores).
import { confirmPasswordReset, type Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { markResetLinkUsedIn, RESET_LINK_MESSAGES, type ResetLinkParams } from './passwordResetLinks';

/** HU-108: al menos 8 caracteres. */
export const NEW_PASSWORD_MIN_LENGTH = 8;

export const NEW_PASSWORD_MESSAGES = {
  /** Regla escrita debajo del primer campo (texto no definido en la HU: la regla dicha en palabras). */
  rule: 'Al menos 8 caracteres, con al menos una letra y un número.',
  /** HU-108: texto literal del criterio. */
  weak: 'La contraseña debe tener al menos 8 caracteres, una letra y un número.',
  /** HU-108: texto literal del criterio. */
  mismatch: 'Las contraseñas no coinciden.',
  /** HU-108: texto literal del criterio (se muestra en la pantalla de ingreso). */
  saved: 'Contraseña actualizada correctamente. Ya puede iniciar sesión.',
  /** Texto no definido en la HU: falla de conexión al guardar. */
  saveFailed: 'No se pudo guardar la contraseña. Intente de nuevo.',
} as const;

/**
 * HU-108: ¿cumple la regla? Se cuentan caracteres (no unidades UTF-16) y cualquier letra cuenta,
 * incluidas las tildes y la ñ.
 */
export function isValidNewPassword(password: string): boolean {
  return [...password].length >= NEW_PASSWORD_MIN_LENGTH && /\p{L}/u.test(password) && /\p{Nd}/u.test(password);
}

export interface NewPasswordErrors {
  password?: string;
  confirm?: string;
}

/** HU-108: errores del formulario. Se revisan los dos campos a la vez, para mostrar todo lo que falta corregir. */
export function validateNewPassword(password: string, confirm: string): NewPasswordErrors {
  const errors: NewPasswordErrors = {};
  if (!isValidNewPassword(password)) errors.password = NEW_PASSWORD_MESSAGES.weak;
  if (password !== confirm) errors.confirm = NEW_PASSWORD_MESSAGES.mismatch;
  return errors;
}

export type SaveNewPasswordResult = { ok: true } | { ok: false; message: string };

/** Códigos de Firebase que indican que el enlace ya no sirve (vencido, usado o inventado). */
const INVALID_LINK_CODES = new Set(['auth/expired-action-code', 'auth/invalid-action-code', 'auth/user-disabled', 'auth/user-not-found']);

/**
 * HU-108: guarda la nueva contraseña con el código del enlace. Desde ese momento la anterior deja de funcionar.
 * Después marca el enlace como usado (HU-107: un solo uso). Si esa marca falla, la contraseña igual quedó
 * cambiada y Firebase ya no acepta el código, así que se informa como éxito.
 */
export async function saveNewPasswordIn(
  auth: Auth,
  db: Firestore,
  link: ResetLinkParams,
  password: string,
): Promise<SaveNewPasswordResult> {
  try {
    await confirmPasswordReset(auth, link.oobCode, password);
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (typeof code === 'string' && INVALID_LINK_CODES.has(code)) {
      return { ok: false, message: RESET_LINK_MESSAGES.invalid };
    }
    return { ok: false, message: NEW_PASSWORD_MESSAGES.saveFailed };
  }
  try {
    await markResetLinkUsedIn(db, link);
  } catch {
    // Ver el comentario de la función: el código ya quedó consumido en Firebase.
  }
  return { ok: true };
}
