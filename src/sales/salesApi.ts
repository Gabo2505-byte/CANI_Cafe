// Funciones de ventas ligadas a la instancia de Firestore de la app (se mockean en las pruebas de pantallas).
import { db } from '../shared/firebase/config';
import type { Sale } from '../shared/types';
import {
  createSaleIn,
  listBoardSalesIn,
  listOpenSaleTitlesIn,
  updateSaleIn,
  type NewSaleInput,
  type SaleUpdateInput,
} from './salesRepository';

export type { NewSaleInput, SaleUpdateInput };

export function listOpenSaleTitles(contactId: string, excludeSaleId?: string): Promise<string[]> {
  return listOpenSaleTitlesIn(db, contactId, excludeSaleId);
}

export function createSale(input: NewSaleInput): Promise<string> {
  return createSaleIn(db, input);
}

export function listBoardSales(now?: Date): Promise<Sale[]> {
  return listBoardSalesIn(db, now);
}

export function updateSale(saleId: string, input: SaleUpdateInput): Promise<void> {
  return updateSaleIn(db, saleId, input);
}
