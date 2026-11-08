// HU-205: búsqueda y filtro de la lista de contactos. HU-504: con etiqueta, primero. (Sin Firebase.)
import { describe, expect, it } from 'vitest';
import {
  CLASSIFICATION_FILTER_OPTIONS,
  classificationFilterFromParam,
  CONTACT_SEARCH_LABEL,
  filterContacts,
  foundContactsMessage,
  badgedFirst,
  matchesContactSearch,
} from '../../src/contacts/contactSearch';
import type { Contact } from '../../src/shared/types';

const contact = (overrides: Partial<Contact>): Contact => ({
  id: 'x',
  fullName: 'Sin Nombre',
  nameSortKey: 'sin nombre',
  email: null,
  phoneCountry: null,
  phoneNumber: null,
  address: null,
  classification: 'persona_interesada',
  status: 'activo',
  origin: null,
  createdAt: null,
  ...overrides,
}) as Contact;

const maria = contact({ id: 'm', fullName: 'María Rodríguez', email: 'maria.rodriguez@example.com', classification: 'cliente' });
const pedro = contact({ id: 'p', fullName: 'Pedro Solano', phoneCountry: 'CR', phoneNumber: '88123456' });
const john = contact({ id: 'j', fullName: 'John Smith', email: 'JOHN@Example.com', phoneCountry: 'US', phoneNumber: '3055550104' });
const ana = contact({ id: 'a', fullName: 'Ana Marín', classification: 'persona_interesada' });
const carla = contact({ id: 'c', fullName: 'Carla Mar', classification: 'cliente' });

describe('HU-205 textos', () => {
  it('buscador y opciones literales de los criterios', () => {
    expect(CONTACT_SEARCH_LABEL).toBe('Buscar por nombre, correo o teléfono');
    expect(CLASSIFICATION_FILTER_OPTIONS.map((o) => o.label)).toEqual(['Todos', 'Persona interesada', 'Cliente']);
  });

  it('mensajes del conteo', () => {
    expect(foundContactsMessage(12)).toBe('Se encontraron 12 contactos.');
    expect(foundContactsMessage(0)).toBe('No se encontraron contactos.');
    expect(foundContactsMessage(1)).toBe('Se encontró 1 contacto.');
  });

  it('la clasificación de la URL: solo valores conocidos, si no "Todos"', () => {
    expect(classificationFilterFromParam(null)).toBe('todos');
    expect(classificationFilterFromParam('cliente')).toBe('cliente');
    expect(classificationFilterFromParam('persona_interesada')).toBe('persona_interesada');
    expect(classificationFilterFromParam('distribuidor')).toBe('todos');
    expect(classificationFilterFromParam('<script>')).toBe('todos');
  });
});

describe('HU-205 búsqueda', () => {
  it('"mar" encuentra "María Rodríguez" (parcial, sin mayúsculas ni tildes)', () => {
    expect(matchesContactSearch(maria, 'mar')).toBe(true);
    expect(matchesContactSearch(maria, 'MARIA')).toBe(true);
    expect(matchesContactSearch(maria, 'rodriguez')).toBe(true);
    expect(matchesContactSearch(maria, 'ía ro')).toBe(true);
  });

  it('el texto puede estar en cualquier parte del nombre', () => {
    expect(matchesContactSearch(ana, 'mar')).toBe(true);
    expect(matchesContactSearch(ana, 'rin')).toBe(true);
  });

  it('busca en el correo', () => {
    expect(matchesContactSearch(maria, 'example.com')).toBe(true);
    expect(matchesContactSearch(john, 'john@example')).toBe(true);
  });

  it('"8812" encuentra el teléfono 8812-3456; también con guion, espacios o código de país', () => {
    expect(matchesContactSearch(pedro, '8812')).toBe(true);
    expect(matchesContactSearch(pedro, '8812-3456')).toBe(true);
    expect(matchesContactSearch(pedro, '3456')).toBe(true);
    expect(matchesContactSearch(pedro, '+506 8812')).toBe(true);
    expect(matchesContactSearch(pedro, '(506) 88 12')).toBe(true);
    expect(matchesContactSearch(john, '305 555')).toBe(true);
  });

  it('un número que no está no coincide; un contacto sin teléfono tampoco', () => {
    expect(matchesContactSearch(pedro, '9999')).toBe(false);
    expect(matchesContactSearch(maria, '8812')).toBe(false);
  });

  it('letras con números no se buscan como teléfono', () => {
    expect(matchesContactSearch(pedro, 'a1')).toBe(false);
  });

  it('vacío o solo espacios: todos coinciden', () => {
    expect(matchesContactSearch(pedro, '')).toBe(true);
    expect(matchesContactSearch(pedro, '   ')).toBe(true);
  });

  it('sin coincidencias', () => {
    expect(matchesContactSearch(maria, 'zzz')).toBe(false);
  });
});

describe('HU-205 búsqueda + clasificación', () => {
  const all = [ana, carla, john, maria, pedro];

  it('"Todos" no filtra por clasificación', () => {
    expect(filterContacts(all, '', 'todos')).toEqual(all);
    expect(filterContacts(all, 'mar', 'todos').map((c) => c.id)).toEqual(['a', 'c', 'm']);
  });

  it('solo la clasificación', () => {
    expect(filterContacts(all, '', 'cliente').map((c) => c.id)).toEqual(['c', 'm']);
    expect(filterContacts(all, '', 'persona_interesada').map((c) => c.id)).toEqual(['a', 'j', 'p']);
  });

  it('los dos a la vez: solo los que cumplen ambos', () => {
    expect(filterContacts(all, 'mar', 'persona_interesada').map((c) => c.id)).toEqual(['a']);
    expect(filterContacts(all, 'mar', 'cliente').map((c) => c.id)).toEqual(['c', 'm']);
    expect(filterContacts(all, '8812', 'cliente')).toEqual([]);
  });
});

describe('HU-504 con etiqueta, primero', () => {
  it('los contactos con etiqueta van de primeros; dentro de cada grupo se mantiene el orden alfabético', () => {
    const list = [
      contact({ id: 'a', fullName: 'Ana' }),
      contact({ id: 'b', fullName: 'Bruno', formBadge: 'Nuevo mensaje' }),
      contact({ id: 'c', fullName: 'Carla', formBadge: null }),
      contact({ id: 'd', fullName: 'Diego', formBadge: 'Nuevo' }),
    ];
    expect(badgedFirst(list).map((c) => c.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('sin etiquetas, el orden no cambia', () => {
    const list = [contact({ id: 'a' }), contact({ id: 'b' })];
    expect(badgedFirst(list).map((c) => c.id)).toEqual(['a', 'b']);
  });
});
