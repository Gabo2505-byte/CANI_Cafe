// Regla de cantidad (1 a 9999) para el sitio público. Es copia de la de src/sales/saleProductRows.ts (el sitio público
// no puede importar código del sistema interno); si cambia allá, hay que revisarla aquí.

export const QUANTITY_LIMITS = { min: 1, max: 9999 } as const;

/** Cantidad entera de 1 a 9999 escrita solo con dígitos. Devuelve null si no es válida. */
export function parseQuantity(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= QUANTITY_LIMITS.min && value <= QUANTITY_LIMITS.max ? value : null;
}
