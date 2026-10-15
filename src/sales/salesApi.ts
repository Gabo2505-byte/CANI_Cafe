// Funciones de ventas ligadas a la instancia de Firestore de la app (se mockean en las pruebas de pantallas).
import { db } from '../shared/firebase/config';
import { listOpenSaleTitlesIn } from './salesRepository';

export function listOpenSaleTitles(contactId: string, excludeSaleId?: string): Promise<string[]> {
  return listOpenSaleTitlesIn(db, contactId, excludeSaleId);
}
