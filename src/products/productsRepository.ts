// HT-002: acceso de lectura al catálogo de productos para los formularios de ventas.
// No hay pantalla de administración de productos (fuera de alcance): el catálogo lo carga el seed.
import { collection, getDocs, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '../shared/constants/collections';
import type { Product } from '../shared/types';
import { toSortKey } from '../shared/utils/text';

/**
 * Ordena por nombre y luego por presentación, sin distinguir mayúsculas ni tildes.
 * El catálogo es pequeño, así que se ordena aquí y no en Firestore (que ordena por código de
 * carácter y dejaría "Árbol" después de "Zoe"); además así no hace falta un índice.
 */
export function sortProducts(products: Product[]): Product[] {
  return [...products].sort(
    (a, b) =>
      toSortKey(a.name).localeCompare(toSortKey(b.name), 'es') ||
      toSortKey(a.presentation).localeCompare(toSortKey(b.presentation), 'es'),
  );
}

/** Todos los productos, activos e inactivos (una venta antigua puede incluir un producto inactivo). */
export async function listProductsIn(db: Firestore): Promise<Product[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.products));
  return sortProducts(snap.docs.map((d) => ({ ...(d.data() as Omit<Product, 'id'>), id: d.id })));
}

/** Productos que se pueden elegir al armar una venta. */
export async function listActiveProductsIn(db: Firestore): Promise<Product[]> {
  return (await listProductsIn(db)).filter((product) => product.active);
}
