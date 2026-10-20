// HU-304: filas de productos de una posible venta (lógica de validación, sin pantalla).

export const SALE_PRODUCT_LIMITS = { minQuantity: 1, maxQuantity: 9999 } as const;

export const SALE_PRODUCT_MESSAGES = {
  quantity: 'Ingrese una cantidad entre 1 y 9999.',
  productMissing: 'Seleccione un producto o elimine la fila.',
  productDuplicated: 'Este producto ya fue agregado.',
  add: 'Agregar producto',
} as const;

/**
 * Una fila del formulario. `key` solo identifica la fila en pantalla; la cantidad es el texto escrito.
 * El producto se elige en dos pasos: `variety` es la variedad elegida (solo de pantalla: puede haber variedad sin
 * presentación todavía) y `productId` el producto completo (variedad + presentación), que es lo que se guarda.
 */
export interface SaleProductRow {
  key: string;
  variety: string;
  productId: string;
  quantity: string;
}

export interface SaleProductRowErrors {
  product?: string;
  quantity?: string;
}

/** Errores por fila, indexados por `key`. Solo tiene entradas de filas con algún error. */
export type SaleProductErrors = Record<string, SaleProductRowErrors>;

let nextKey = 0;

/** Fila nueva y vacía. */
export function newSaleProductRow(): SaleProductRow {
  nextKey += 1;
  return { key: `row-${nextKey}`, variety: '', productId: '', quantity: '' };
}

/** Cantidad entera de 1 a 9999 escrita solo con dígitos. Devuelve null si no es válida. */
export function parseQuantity(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= SALE_PRODUCT_LIMITS.minQuantity && value <= SALE_PRODUCT_LIMITS.maxQuantity ? value : null;
}

/**
 * Valida todas las filas. Una fila sin producto (sin variedad o sin presentación) avisa que lo elija o la quite; si el producto ya
 * está en una fila anterior, la repetida avisa "Este producto ya fue agregado.".
 * Sin filas no hay errores: la posible venta se puede guardar sin productos.
 */
export function validateSaleProductRows(rows: SaleProductRow[]): SaleProductErrors {
  const errors: SaleProductErrors = {};
  const seen = new Set<string>();
  for (const row of rows) {
    const rowErrors: SaleProductRowErrors = {};
    if (!row.productId) rowErrors.product = SALE_PRODUCT_MESSAGES.productMissing;
    else if (seen.has(row.productId)) rowErrors.product = SALE_PRODUCT_MESSAGES.productDuplicated;
    else seen.add(row.productId);
    if (parseQuantity(row.quantity) === null) rowErrors.quantity = SALE_PRODUCT_MESSAGES.quantity;
    if (rowErrors.product || rowErrors.quantity) errors[row.key] = rowErrors;
  }
  return errors;
}

/** Filas ya validadas → datos para guardar en `saleProducts`. */
export function toSaleProductInputs(rows: SaleProductRow[]): { productId: string; quantity: number }[] {
  return rows.map((row) => ({ productId: row.productId, quantity: parseQuantity(row.quantity) as number }));
}
