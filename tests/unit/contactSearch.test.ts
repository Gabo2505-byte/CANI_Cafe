import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { canSearchContacts, searchContacts } from '../../src/sales/contactSearch';
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
