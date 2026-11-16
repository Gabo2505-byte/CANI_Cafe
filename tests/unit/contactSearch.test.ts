import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { canSearchContacts, CONTACT_SEARCH_MESSAGES, contactSecondaryLine, searchContacts } from '../../src/sales/contactSearch';
import type { Contact } from '../../src/shared/types';

const contact = (id: string, fullName: string, email: string | null, status: Contact['status'] = 'activo'): Contact => ({
  id,
  fullName,
  nameSortKey: fullName.toLowerCase(),
  email,
  phoneCountry: null,
  phoneNumber: null,
  address: null,
  classification: 'persona_interesada',
  status,
  origin: null,
  createdAt: Timestamp.fromDate(new Date('2026-09-01T12:00:00Z')),
});

const CONTACTS = [
  contact('1', 'Ana Prueba Mora', 'ana.prueba@example.com'),
  contact('2', 'Álvaro Demo', null),
  contact('3', 'Bruno Ficticio Solís', 'bruno@example.com'),
  contact('4', 'Diego Ejemplo', 'diego@example.com', 'inactivo'),
];

describe('HU-302 búsqueda de contactos', () => {
  it('necesita al menos 2 letras; con menos no devuelve nada', () => {
    expect(canSearchContacts('a')).toBe(false);
    expect(canSearchContacts(' a ')).toBe(false);
    expect(canSearchContacts('an')).toBe(true);
    expect(searchContacts(CONTACTS, 'a')).toEqual([]);
    expect(searchContacts(CONTACTS, '')).toEqual([]);
  });

  it('busca por nombre, también por apellido, sin distinguir mayúsculas ni tildes', () => {
    expect(searchContacts(CONTACTS, 'MORA').map((c) => c.id)).toEqual(['1']);
    expect(searchContacts(CONTACTS, 'alvaro').map((c) => c.id)).toEqual(['2']);
    expect(searchContacts(CONTACTS, 'solis').map((c) => c.id)).toEqual(['3']);
  });

  it('busca por correo', () => {
    expect(searchContacts(CONTACTS, 'bruno@ex').map((c) => c.id)).toEqual(['3']);
  });

  it('nunca ofrece contactos inactivos', () => {
    expect(searchContacts(CONTACTS, 'diego')).toEqual([]);
  });

  it('sin coincidencias devuelve lista vacía', () => {
    expect(searchContacts(CONTACTS, 'zzz')).toEqual([]);
  });

  it('devuelve como máximo 10, ordenados por nombre', () => {
    const many = Array.from({ length: 15 }, (_, i) => contact(`m${i}`, `Mario Relleno ${String(i).padStart(2, '0')}`, null));
    const found = searchContacts(many, 'mario');
    expect(found).toHaveLength(10);
    expect(found[0].fullName).toBe('Mario Relleno 00');
    expect(found[9].fullName).toBe('Mario Relleno 09');
  });
});

// CAMBIO-TELEFONO-PRIMERO: también se busca por teléfono, con la misma comparación del buscador de contactos (HU-205).
describe('búsqueda por teléfono y línea secundaria (CAMBIO-TELEFONO-PRIMERO)', () => {
  const withPhone = (
    id: string,
    name: string,
    email: string | null,
    country: string | null,
    number: string | null,
    status: Contact['status'] = 'activo',
  ): Contact => ({
    ...contact(id, name, email, status),
    phoneCountry: country,
    phoneNumber: number,
  });
  const PHONES = [
    withPhone('p1', 'Rosa Solo Teléfono', null, 'CR', '88123456'),
    withPhone('p2', 'Tomás Ambos', 'tomas@example.com', 'US', '3055551234'),
    withPhone('p3', 'Úrsula Solo Correo', 'ursula@example.com', null, null),
    withPhone('p4', 'Víctor Inactivo', null, 'CR', '88129999', 'inactivo'),
  ];

  it('el texto de ayuda nuevo', () => {
    expect(CONTACT_SEARCH_MESSAGES.placeholder).toBe('Escriba al menos 2 caracteres del nombre, correo o teléfono');
  });

  it('encuentra por parte del número, con guion o con el código del país', () => {
    expect(searchContacts(PHONES, '8812').map((c) => c.id)).toEqual(['p1']);
    expect(searchContacts(PHONES, '8812-3456').map((c) => c.id)).toEqual(['p1']);
    expect(searchContacts(PHONES, '+506 8812').map((c) => c.id)).toEqual(['p1']);
    expect(searchContacts(PHONES, '1305').map((c) => c.id)).toEqual(['p2']);
  });

  it('con 2 dígitos ya busca; con 1 no; nunca ofrece inactivos por teléfono', () => {
    expect(searchContacts(PHONES, '8')).toEqual([]);
    expect(searchContacts(PHONES, '88').map((c) => c.id)).toEqual(['p1']);
    expect(searchContacts(PHONES, '88129999')).toEqual([]);
  });

  it('un número que no coincide no devuelve nada, y nombre y correo siguen funcionando', () => {
    expect(searchContacts(PHONES, '7777')).toEqual([]);
    expect(searchContacts(PHONES, 'ursula@').map((c) => c.id)).toEqual(['p3']);
    expect(searchContacts(PHONES, 'tomas').map((c) => c.id)).toEqual(['p2']);
  });

  it('línea secundaria: primero el teléfono y después el correo; si solo hay uno, solo ese', () => {
    expect(contactSecondaryLine(PHONES[1])).toBe('+1 3055551234 · tomas@example.com');
    expect(contactSecondaryLine(PHONES[0])).toBe('+506 8812-3456');
    expect(contactSecondaryLine(PHONES[2])).toBe('ursula@example.com');
    expect(contactSecondaryLine({ email: null, phoneCountry: null, phoneNumber: null })).toBeNull();
    expect(contactSecondaryLine({ email: '  ', phoneCountry: null, phoneNumber: null })).toBeNull();
  });
});
