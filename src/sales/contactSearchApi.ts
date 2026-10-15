// Funciones ligadas a la instancia de Firestore de la app (se mockean en las pruebas de pantallas).
import { db } from '../shared/firebase/config';
import type { Contact } from '../shared/types';
import { listActiveContactsIn } from './contactSearchRepository';

export function listActiveContacts(): Promise<Contact[]> {
  return listActiveContactsIn(db);
}
