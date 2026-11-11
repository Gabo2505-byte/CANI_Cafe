// HU-205: Buscar y filtrar contactos. HU-504: con etiqueta, primero. Funciones puras (se prueban sin Firebase).
//
// Decisión: la lista de contactos se arma en el navegador, sobre todos los contactos (se traen una vez al abrirla).
// - HU-205 pide texto parcial en cualquier parte ("mar" encuentra "Ana María") y en tres campos (nombre, correo y
//   teléfono), sin distinguir mayúsculas ni tildes. Firestore solo permite prefijos sobre un campo (por ejemplo
//   sobre nameSortKey), así que no alcanza.
// - HU-504 pide los contactos con etiqueta de primeros. Firestore no puede ordenar por "tiene etiqueta" (los contactos
//   que nunca enviaron el formulario no tienen el campo y quedarían fuera de la consulta), así que la paginación por
//   consultas de HU-204 ya no sirve.
// - CANI Café tiene pocos cientos de contactos (carga inicial más los del formulario): traerlos una vez cuesta pocas
//   lecturas y después la tabla cambia al instante mientras se escribe. Se pagina de 20 en 20 aquí mismo (HU-204).
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

/**
 * HU-504 (criterio 3): los contactos con etiqueta ("Nuevo" o "Nuevo mensaje") de primeros. Dentro de cada grupo se
 * mantiene el orden en que llegaron (alfabético, HU-204).
 */
export function badgedFirst(contacts: Contact[]): Contact[] {
  return [...contacts.filter((c) => c.formBadge), ...contacts.filter((c) => !c.formBadge)];
}
