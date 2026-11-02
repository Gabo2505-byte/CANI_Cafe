// Catálogo del sitio público (HU-402). Usa Firestore Lite (el SDK del sitio público): no debe arrastrar Auth, el SDK
// completo ni la configuración del admin. Por eso recibe una instancia de Lite, no la del sistema interno.
import { collection, getDocs, query, where, type Firestore } from 'firebase/firestore/lite';
import { COLLECTIONS } from '../shared/constants/collections';
import type { Product } from '../shared/types';

/** Máximo de caracteres de la descripción que se muestra en una tarjeta (HU-402, criterio 2). */
export const PUBLIC_DESCRIPTION_MAX = 300;

/**
 * Productos activos, para quien no ha iniciado sesión. La consulta lleva `where('active', '==', true)`: las reglas de
 * Firestore solo permiten leer sin sesión una consulta que lo incluya. El orden del catálogo lo da `groupByVariety`.
 */
export async function listPublicProductsIn(db: Firestore): Promise<Product[]> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.products), where('active', '==', true)));
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Product, 'id'>), id: d.id }));
}

/** Descripción para la tarjeta: nunca pasa de 300 caracteres. */
export function publicDescription(description: string): string {
  return description.length > PUBLIC_DESCRIPTION_MAX
    ? description.slice(0, PUBLIC_DESCRIPTION_MAX).trimEnd()
    : description;
}
