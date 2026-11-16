// HU-302: búsqueda de contactos para una posible venta (lógica pura, sin pantalla).
import { matchesContactSearch } from '../contacts/contactSearch';
import { formatPhone } from '../shared/phone/phone';
import type { Contact } from '../shared/types';
import { toSortKey } from '../shared/utils/text';

export const CONTACT_SEARCH_LIMITS = { minLength: 2, maxResults: 10 } as const;

export const CONTACT_SEARCH_MESSAGES = {
  /** Ayuda del campo (CAMBIO-TELEFONO-PRIMERO). Antes: "Escriba al menos 2 letras del nombre o del correo". */
  placeholder: 'Escriba al menos 2 caracteres del nombre, correo o teléfono',
  noResults: 'No se encontraron contactos.',
  loadError: 'No se pudieron cargar los contactos. Intente de nuevo.',
} as const;

/** ¿Ya se escribió lo suficiente para buscar? (al menos 2 caracteres, sin contar espacios de los lados). */
export function canSearchContacts(query: string): boolean {
  return toSortKey(query).length >= CONTACT_SEARCH_LIMITS.minLength;
}

/**
 * Hasta 10 contactos activos cuyo nombre, correo o teléfono contienen lo escrito, sin distinguir mayúsculas
 * ni tildes, ordenados por nombre. Con menos de 2 caracteres no devuelve nada.
 * Compara igual que el buscador de la lista de contactos (HU-205, `matchesContactSearch`): un número ("8812",
 * "8812-3456", "+506 8812") se compara solo por dígitos con el teléfono, con y sin el código del país.
 * Se busca sobre los contactos activos que ya se leyeron: no hay consultas ni lecturas nuevas.
 */
export function searchContacts(contacts: Contact[], query: string): Contact[] {
  if (!canSearchContacts(query)) return [];
  return contacts
    .filter((contact) => contact.status === 'activo')
    .filter((contact) => matchesContactSearch(contact, query))
    .sort((a, b) => toSortKey(a.fullName).localeCompare(toSortKey(b.fullName), 'es'))
    .slice(0, CONTACT_SEARCH_LIMITS.maxResults);
}

/**
 * Línea secundaria de un contacto: primero el teléfono ("+506 8888-8888") y después el correo, separados por " · ".
 * Si solo tiene uno, solo ese, sin separador; si no tiene ninguno, null.
 */
export function contactSecondaryLine(contact: Pick<Contact, 'email' | 'phoneCountry' | 'phoneNumber'>): string | null {
  const phone = contact.phoneNumber ? formatPhone(contact.phoneCountry ?? 'CR', contact.phoneNumber) : null;
  const email = contact.email?.trim() || null;
  const parts = [phone, email].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(' · ') : null;
}
