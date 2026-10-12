// Funciones de contactos ligadas a la instancia de Firestore de la app (se mockean en las pruebas de pantallas).
import { db } from '../shared/firebase/config';
import type { Contact } from '../shared/types';
import type { ContactDuplicates } from './contactForm';
import {
  countContactsIn,
  createContactIn,
  findDuplicateContactsIn,
  getContactIn,
  listContactsPageIn,
  type ContactsCursor,
  type ContactsPage,
  type NewContactInput,
} from './contactsRepository';

export function createContact(input: NewContactInput): Promise<string> {
  return createContactIn(db, input);
}

export function getContact(id: string): Promise<Contact | null> {
  return getContactIn(db, id);
}

export function findDuplicateContacts(input: NewContactInput, excludeId?: string): Promise<ContactDuplicates> {
  return findDuplicateContactsIn(db, input, excludeId);
}

export function listContactsPage(after: ContactsCursor | null): Promise<ContactsPage> {
  return listContactsPageIn(db, after);
}

export function countContacts(): Promise<number> {
  return countContactsIn(db);
}
