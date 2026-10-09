// HU-102: mensajes que indican qué dato está mal al ingresar.
export const LOGIN_MESSAGES = {
  emptyUsername: 'Ingrese su usuario.',
  emptyPassword: 'Ingrese su contraseña.',
  userNotFound: 'El usuario ingresado no existe.',
  wrongPassword: 'La contraseña es incorrecta.',
} as const;

export type LoginField = 'username' | 'password';
export type LoginErrors = Partial<Record<LoginField, string>>;

/** Validación antes de consultar a Firebase. Puede devolver los dos mensajes a la vez. */
export function validateLoginInput(username: string, password: string): LoginErrors {
  const errors: LoginErrors = {};
  if (username.trim() === '') errors.username = LOGIN_MESSAGES.emptyUsername;
  if (password === '') errors.password = LOGIN_MESSAGES.emptyPassword;
  return errors;
}

/**
 * Traduce un error de Firebase Auth al campo que está mal.
 * Nota: si el proyecto tiene activada la "protección contra enumeración de correos",
 * Firebase responde auth/invalid-credential en ambos casos y no se puede distinguir (ver README).
 */
export function loginErrorFromAuth(error: unknown): LoginErrors | null {
  const code = (error as { code?: unknown } | null)?.code;
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return { username: LOGIN_MESSAGES.userNotFound };
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return { password: LOGIN_MESSAGES.wrongPassword };
    default:
      return null;
  }
}
