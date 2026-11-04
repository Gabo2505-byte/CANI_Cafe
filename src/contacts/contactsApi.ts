// Funciones de contactos ligadas a la instancia de Firestore de la app (se mockean en las pruebas de pantallas).
import { db } from '../shared/firebase/config';
import type { Contact } from '../shared/types';
import type { ContactDuplicates } from './contactForm';
import {
  createContactIn,
  findDuplicateContactsIn,
  getContactIn,
  listAllContactsIn,
  updateContactIn,
  type NewContactInput,
} from './contactsRepository';

export function createContact(input: NewContactInput): Promise<string> {
  return createContactIn(db, input);
}

export function getContact(id: string): Promise<Contact | null> {
  return getContactIn(db, id);
}

export function updateContact(id: string, input: NewContactInput): Promise<void> {
  return updateContactIn(db, id, input);
}

export function findDuplicateContacts(input: NewContactInput, excludeId?: string): Promise<ContactDuplicates> {
  return findDuplicateContactsIn(db, input, excludeId);
}

export function listAllContacts(): Promise<Contact[]> {
  return listAllContactsIn(db);
}
