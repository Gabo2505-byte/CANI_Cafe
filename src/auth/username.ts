// La pantalla de ingreso pide "Usuario"; Firebase Auth autentica por correo.
// Cada cuenta de Auth usa el correo REAL de la persona (ahí llega el enlace de recuperación, HU-107), y la
// colección `usernames` dice qué correo corresponde a cada usuario (src/auth/usernameDirectory.ts).

/** Usuario tal como se guarda y se busca: sin espacios alrededor y en minúsculas. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}
