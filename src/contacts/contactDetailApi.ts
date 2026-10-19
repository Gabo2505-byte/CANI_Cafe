// HU-207: registros de la ficha ligados a la instancia de Firestore de la app (se mockea en las pruebas de pantallas).
import { db } from '../shared/firebase/config';
import type { ContactRecords } from './contactDetail';
import { loadContactRecordsIn } from './contactDetailRepository';

export function loadContactRecords(contactId: string): Promise<ContactRecords> {
  return loadContactRecordsIn(db, contactId);
}
