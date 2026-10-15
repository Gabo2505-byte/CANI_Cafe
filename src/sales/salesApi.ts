// Funciones de ventas ligadas a la instancia de Firestore de la app (se mockean en las pruebas de pantallas).
import { db } from '../shared/firebase/config';
import { createSaleIn, listOpenSaleTitlesIn, type NewSaleInput } from './salesRepository';

export type { NewSaleInput };

export function listOpenSaleTitles(contactId: string, excludeSaleId?: string): Promise<string[]> {
  return listOpenSaleTitlesIn(db, contactId, excludeSaleId);
}

export function createSale(input: NewSaleInput): Promise<string> {
  return createSaleIn(db, input);
}
