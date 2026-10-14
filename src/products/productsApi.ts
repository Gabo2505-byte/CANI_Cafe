// Funciones de productos ligadas a la instancia de Firestore de la app (se mockean en las pruebas de pantallas).
import { db } from '../shared/firebase/config';
import type { Product } from '../shared/types';
import { listActiveProductsIn, listProductsIn } from './productsRepository';

export function listProducts(): Promise<Product[]> {
  return listProductsIn(db);
}

export function listActiveProducts(): Promise<Product[]> {
  return listActiveProductsIn(db);
}
