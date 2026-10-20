// Catálogo en dos pasos (variedad y presentación) para elegir el producto de una posible venta (HU-304).
import type { Product } from '../shared/types';

/** Una variedad con sus presentaciones, en el orden del catálogo. */
export interface VarietyGroup {
  /** `Product.name` (por ejemplo "Geisha"). */
  name: string;
  /** Los productos de la variedad: uno por presentación, en el orden del catálogo. */
  products: Product[];
}

/**
 * Agrupa los productos por variedad (`name`) en el orden del catálogo del cliente. El id lleva el orden
 * (`prod-01-villa-sarchi-0250-molido`: variedad, peso y formato), así que ordenar por id como texto da el orden del
 * documento sin una lista aparte ni leer el texto de la presentación. Por eso no se usa `sortProducts`, que ordena
 * alfabéticamente. Un producto con otro tipo de id queda donde le toque por su id.
 */
export function groupByVariety(products: Product[]): VarietyGroup[] {
  const ordered = [...products].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const groups: VarietyGroup[] = [];
  for (const product of ordered) {
    const group = groups.find((g) => g.name === product.name);
    if (group) group.products.push(product);
    else groups.push({ name: product.name, products: [product] });
  }
  return groups;
}
