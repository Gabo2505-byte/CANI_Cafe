/**
 * Colección `saleProducts` (dominio de Dylan).
 * Sugerencia de id de documento: `${saleId}_${productId}` para evitar duplicados.
 */
export interface SaleProduct {
  /** → sales.id */
  saleId: string;
  /** → products.id */
  productId: string;
  quantity: number;
}
