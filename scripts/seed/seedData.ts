// Datos de prueba 100% ficticios: nombres inventados, correos @example.com / .test, teléfonos 0000xxxx.
// IDs y fechas fijos para que el seed sea idempotente y determinista.
import type { Timestamp } from 'firebase/firestore';
import type { Communication, Contact, Sale, User } from '../../src/shared/types';

/** Documento listo para escribir: sin `id` (va como id del doc) y con Date en lugar de Timestamp. */
type ToDate<V> = V extends Timestamp ? Date : V;
export type SeedDoc<T extends { id: string }> = { [K in Exclude<keyof T, 'id'>]: ToDate<T[K]> };
export type Seeded<T extends { id: string }> = { id: string; data: SeedDoc<T> };

/** Fecha/hora local de Costa Rica (UTC-6, sin horario de verano) → Date. */
const cr = (localIso: string) => new Date(`${localIso}-06:00`);

export const SEED_ADMIN = {
  uid: 'seed-admin-001',
  email: 'admin@cani-crm.test',
  username: 'admin',
} as const;

export const seedUsers: Seeded<User>[] = [
  { id: SEED_ADMIN.uid, data: { username: SEED_ADMIN.username, email: SEED_ADMIN.email, active: true } },
];

export const seedContacts: Seeded<Contact>[] = [
  {
    id: 'contact-001',
    data: {
      fullName: 'Ana Prueba Mora',
      email: 'ana.prueba@example.com',
      phoneCountry: 'CR',
      phoneNumber: '00000001',
      classification: 'prospecto',
      status: 'activo',
      origin: 'redes_sociales',
      createdAt: cr('2026-09-01T09:00:00'),
    },
  },
  {
    id: 'contact-002',
    data: {
      fullName: 'Bruno Ficticio Solís',
      email: 'bruno.ficticio@example.com',
      phoneCountry: 'CR',
      phoneNumber: '00000002',
      classification: 'cliente',
      status: 'activo',
      origin: 'referido',
      createdAt: cr('2026-09-03T10:30:00'),
    },
  },
  {
    id: 'contact-003',
    data: {
      fullName: 'Carla Demo Vargas',
      email: 'carla.demo@example.com',
      phoneCountry: 'CR',
      phoneNumber: '00000003',
      classification: 'distribuidor',
      status: 'activo',
      origin: 'feria',
      createdAt: cr('2026-09-05T14:00:00'),
    },
  },
  {
    id: 'contact-004',
    data: {
      fullName: 'Diego Ejemplo Rojas',
      email: 'diego.ejemplo@example.com',
      phoneCountry: 'CR',
      phoneNumber: '00000004',
      classification: 'cliente',
      status: 'inactivo',
      origin: 'sitio_web',
      createdAt: cr('2026-09-08T08:15:00'),
    },
  },
  {
    id: 'contact-005',
    data: {
      fullName: 'Elena Muestra Castro',
      email: 'elena.muestra@example.com',
      phoneCountry: 'CR',
      phoneNumber: '00000005',
      classification: 'prospecto',
      status: 'activo',
      origin: 'visita',
      createdAt: cr('2026-09-10T16:45:00'),
    },
  },
];

// MOCK: las ventas las define Dylan. Se ajustan cuando cierre su contrato de etapas.
export const seedSales: Seeded<Sale>[] = [
  {
    id: 'sale-001',
    data: {
      contactId: 'contact-002',
      title: 'Café en grano para cafetería (mock)',
      stage: 'negociacion',
      estimatedAmount: 450_000,
      nextFollowUpAt: cr('2026-10-12T10:00:00'),
      notes: 'Venta simulada para pruebas.',
      createdAt: cr('2026-09-15T09:00:00'),
      lastCommunicationAt: cr('2026-10-02T11:00:00'), // comm-003 (aplica a todas)
    },
  },
  {
    id: 'sale-002',
    data: {
      contactId: 'contact-003',
      title: 'Distribución mensual de café molido (mock)',
      stage: 'propuesta',
      estimatedAmount: 1_200_000,
      nextFollowUpAt: cr('2026-10-09T15:00:00'),
      notes: 'Venta simulada para pruebas.',
      createdAt: cr('2026-09-20T13:00:00'),
      lastCommunicationAt: cr('2026-10-03T15:30:00'), // comm-004
    },
  },
  {
    id: 'sale-003',
    data: {
      contactId: 'contact-002',
      title: 'Pedido de temporada navideña (mock)',
      stage: 'ganada',
      estimatedAmount: 300_000,
      nextFollowUpAt: null,
      notes: 'Venta simulada para pruebas.',
      createdAt: cr('2026-09-25T10:00:00'),
      lastCommunicationAt: cr('2026-10-02T11:00:00'), // comm-003 (aplica a todas)
    },
  },
];

export const seedCommunications: Seeded<Communication>[] = [
  {
    id: 'comm-001',
    data: {
      contactId: 'contact-001',
      saleId: null,
      appliesToAllSales: false,
      date: cr('2026-09-28T09:30:00'),
      medium: 'llamada',
      note: 'Primer contacto, interesada en conocer los productos.',
      userId: SEED_ADMIN.uid,
    },
  },
  {
    id: 'comm-002',
    data: {
      contactId: 'contact-002',
      saleId: 'sale-001',
      appliesToAllSales: false,
      date: cr('2026-09-30T14:00:00'),
      medium: 'reunion',
      note: 'Revisión de volúmenes para la cafetería.',
      userId: SEED_ADMIN.uid,
    },
  },
  {
    id: 'comm-003',
    data: {
      contactId: 'contact-002',
      saleId: null,
      appliesToAllSales: true,
      date: cr('2026-10-02T11:00:00'),
      medium: 'correo',
      note: 'Actualización de condiciones de pago para todos sus pedidos.',
      userId: SEED_ADMIN.uid,
    },
  },
  {
    id: 'comm-004',
    data: {
      contactId: 'contact-003',
      saleId: 'sale-002',
      appliesToAllSales: false,
      date: cr('2026-10-03T15:30:00'),
      medium: 'whatsapp',
      note: 'Envió dudas sobre la propuesta de distribución.',
      userId: SEED_ADMIN.uid,
    },
  },
  {
    id: 'comm-005',
    data: {
      contactId: 'contact-005',
      saleId: null,
      appliesToAllSales: false,
      date: cr('2026-10-05T10:00:00'),
      medium: 'visita',
      note: 'Visita al local; pidió muestras.',
      userId: SEED_ADMIN.uid,
    },
  },
];
