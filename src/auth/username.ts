// La pantalla de ingreso pide "Usuario"; Firebase Auth autentica por correo.
// Cada usuario se registra en Auth con un correo interno derivado de su username.
// (users.email sigue siendo el correo de contacto de la persona.)
export const AUTH_EMAIL_DOMAIN = 'usuarios.cani-crm.local';

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function usernameToAuthEmail(username: string): string {
  return `${normalizeUsername(username)}@${AUTH_EMAIL_DOMAIN}`;
}
