// HU-205: Buscar y filtrar contactos. Funciones puras (se prueban sin Firebase).
//
// Decisión: la búsqueda se hace en el navegador, sobre la lista completa de contactos.
// - El criterio pide texto parcial en cualquier parte ("mar" encuentra "Ana María") y en tres campos (nombre, correo
//   y teléfono), sin distinguir mayúsculas ni tildes. Firestore solo permite prefijos sobre un campo (por ejemplo
//   sobre nameSortKey), así que no alcanza.
// - CANI Café tiene pocos cientos de contactos (carga inicial más los del formulario): traerlos una vez cuesta pocas
//   lecturas y después la tabla cambia al instante mientras se escribe.
// - Sin búsqueda ni filtro, la lista sigue paginada en Firestore como en HU-204 (no descarga todo).
import { formatPhone } from '../shared/phone/phone';
import type { Contact, ContactClassification } from '../shared/types';
import { toSortKey } from '../shared/utils/text';

/** HU-205: texto literal del buscador. */
export const CONTACT_SEARCH_LABEL = 'Buscar por nombre, correo o teléfono';

/** HU-205: opciones de la lista "Clasificación", en el orden del criterio. */
export const CLASSIFICATION_FILTER_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'persona_interesada', label: 'Persona interesada' },
  { value: 'cliente', label: 'Cliente' },
] as const satisfies readonly { value: 'todos' | ContactClassification; label: string }[];

export type ClassificationFilter = (typeof CLASSIFICATION_FILTER_OPTIONS)[number]['value'];

/** Valor de la URL ("?clasificacion=cliente") → filtro. Cualquier otro valor es "Todos". */
export function classificationFilterFromParam(value: string | null): ClassificationFilter {
  return CLASSIFICATION_FILTER_OPTIONS.find((o) => o.value === value)?.value ?? 'todos';
}

/** HU-205: "Se encontraron 12 contactos." / "No se encontraron contactos.". */
export function foundContactsMessage(count: number): string {
  if (count === 0) return 'No se encontraron contactos.';
  // Texto no definido en la HU: el singular.
  if (count === 1) return 'Se encontró 1 contacto.';
  return `Se encontraron ${count} contactos.`;
}

/** Solo dígitos y signos de teléfono: entonces también se busca por número. */
const PHONE_QUERY = /^[\d\s+\-().]+$/;
const onlyDigits = (text: string) => text.replace(/\D/g, '');

/**
 * HU-205: ¿el contacto coincide con lo escrito? Texto parcial, sin mayúsculas ni tildes, en el nombre o el correo.
 * Si lo escrito es un número ("8812", "8812-3456", "+506 8812"), se comparan solo los dígitos con el teléfono,
 * con y sin el código del país.
 */
export function matchesContactSearch(contact: Contact, query: string): boolean {
  const text = toSortKey(query);
  if (text === '') return true;
  if (toSortKey(contact.fullName).includes(text)) return true;
  if (contact.email && toSortKey(contact.email).includes(text)) return true;
  if (PHONE_QUERY.test(query) && contact.phoneNumber) {
    const digits = onlyDigits(query);
    if (digits === '') return false;
    const full = onlyDigits(formatPhone(contact.phoneCountry ?? 'CR', contact.phoneNumber));
    return onlyDigits(contact.phoneNumber).includes(digits) || full.includes(digits);
  }
  return false;
}

/** HU-205: contactos que cumplen la búsqueda Y la clasificación, en el mismo orden en que llegaron. */
export function filterContacts(contacts: Contact[], query: string, classification: ClassificationFilter): Contact[] {
  return contacts.filter(
    (c) => (classification === 'todos' || c.classification === classification) && matchesContactSearch(c, query),
  );
}

/** ¿Hay búsqueda o filtro activo? (Si no, la lista se pagina en Firestore como en HU-204.) */
export function isFiltering(query: string, classification: ClassificationFilter): boolean {
  return query.trim() !== '' || classification !== 'todos';
}
