// Funciones de comunicaciones ligadas a la instancia de Firestore de la app (se mockean en las pruebas de pantallas).
import { db } from '../shared/firebase/config';
import type { NewCommunicationInput } from './communicationForm';
import {
  createCommunicationIn,
  listCommunicationsPageIn,
  type CommunicationsCursor,
  type CommunicationsPage,
} from './communicationsRepository';

export function createCommunication(input: NewCommunicationInput, userId: string): Promise<string> {
  return createCommunicationIn(db, input, userId);
}

/** HU-213: "Ver más" en el historial. */
export function listCommunicationsPage(contactId: string, after: CommunicationsCursor | null): Promise<CommunicationsPage> {
  return listCommunicationsPageIn(db, contactId, after);
}
