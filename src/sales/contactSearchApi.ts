// Funciones ligadas a la instancia de Firestore de la app (se mockean en las pruebas de pantallas).
import { db } from '../shared/firebase/config';
import type { Contact } from '../shared/types';
import { getContactForSaleIn, getContactNamesIn, listActiveContactsIn } from './contactSearchRepository';

export function listActiveContacts(): Promise<Contact[]> {
  return listActiveContactsIn(db);
}

export function getContactForSale(id: string): Promise<Contact | null> {
  return getContactForSaleIn(db, id);
}

export function getContactNames(ids: string[]): Promise<Map<string, string>> {
  return getContactNamesIn(db, ids);
}
