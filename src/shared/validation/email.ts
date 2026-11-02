// Reglas de correo para el sitio público. Son copia de las de src/contacts/contactForm.ts (el sitio público no puede
// importar código del sistema interno); si cambian allá, hay que revisarlas aquí.

/** nombre@dominio.com: sin espacios, con una "@" y un dominio con punto. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

/** Correo como se guarda y se compara: sin espacios alrededor y en minúsculas. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
