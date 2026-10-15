// HU-302: búsqueda de contactos para una posible venta (lógica pura, sin pantalla).
import type { Contact } from '../shared/types';
import { toSortKey } from '../shared/utils/text';

export const CONTACT_SEARCH_LIMITS = { minLength: 2, maxResults: 10 } as const;

export const CONTACT_SEARCH_MESSAGES = {
  noResults: 'No se encontraron contactos.',
  loadError: 'No se pudieron cargar los contactos. Intente de nuevo.',
} as const;

/** ¿Ya se escribió lo suficiente para buscar? (al menos 2 letras, sin contar espacios de los lados). */
export function canSearchContacts(query: string): boolean {
  return toSortKey(query).length >= CONTACT_SEARCH_LIMITS.minLength;
}

/**
 * Hasta 10 contactos activos cuyo nombre o correo contienen lo escrito, sin distinguir mayúsculas
 * ni tildes, ordenados por nombre. Con menos de 2 letras no devuelve nada.
 */
export function searchContacts(contacts: Contact[], query: string): Contact[] {
  if (!canSearchContacts(query)) return [];
  const needle = toSortKey(query);
  return contacts
    .filter((contact) => contact.status === 'activo')
    .filter(
      (contact) =>
        toSortKey(contact.fullName).includes(needle) || (contact.email !== null && toSortKey(contact.email).includes(needle)),
    )
    .sort((a, b) => toSortKey(a.fullName).localeCompare(toSortKey(b.fullName), 'es'))
    .slice(0, CONTACT_SEARCH_LIMITS.maxResults);
}
