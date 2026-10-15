// Datos de prueba 100% ficticios: nombres inventados, correos @example.com / .test, teléfonos 0000xxxx.
// IDs y fechas fijos para que el seed sea idempotente y determinista.
import type { Timestamp } from 'firebase/firestore';
import type { Communication, Contact, Product, Sale, SaleProduct, StageHistory, User } from '../../src/shared/types';
import { toSortKey } from '../../src/shared/utils/text';

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

// nameSortKey (HU-204) se calcula a partir de fullName, igual que al guardar desde la app.
const seedContactsBase: Seeded<Omit<Contact, 'nameSortKey'>>[] = [
  {
    id: 'contact-001',
    data: {
      fullName: 'Ana Prueba Mora',
      email: 'ana.prueba@example.com',
      phoneCountry: 'CR',
      phoneNumber: '00000001',
      address: 'Dirección de prueba 1, San José',
      classification: 'persona_interesada',
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
      address: 'Dirección de prueba 2, Heredia',
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
      // Solo correo: sin teléfono (permitido, HU-201)
      phoneCountry: null,
      phoneNumber: null,
      address: null,
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
      // Teléfono de otro país (HU-202): número ficticio de la serie 555.
      phoneCountry: 'US',
      phoneNumber: '3055550104',
      address: 'Dirección de prueba 4, Cartago',
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
      // Solo teléfono: sin correo (permitido, HU-201)
      email: null,
      phoneCountry: 'CR',
      phoneNumber: '00000005',
      address: null,
      classification: 'persona_interesada',
      status: 'activo',
      origin: null,
      createdAt: cr('2026-09-10T16:45:00'),
    },
  },
];

export const seedContacts: Seeded<Contact>[] = seedContactsBase.map(({ id, data }) => ({
  id,
  data: { ...data, nameSortKey: toSortKey(data.fullName) },
}));

export const seedSales: Seeded<Sale>[] = [
  {
    id: 'sale-001',
    data: {
      contactId: 'contact-002',
      title: 'Café en grano para cafetería (mock)',
      stage: 'en_negociacion',
      stageChangedAt: cr('2026-10-01T10:00:00'),
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
      stage: 'cotizacion_enviada',
      stageChangedAt: cr('2026-09-28T09:00:00'),
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
      stageChangedAt: cr('2026-10-02T12:00:00'),
      estimatedAmount: 300_000,
      nextFollowUpAt: null,
      notes: 'Venta simulada para pruebas.',
      createdAt: cr('2026-09-25T10:00:00'),
      lastCommunicationAt: cr('2026-10-02T11:00:00'), // comm-003 (aplica a todas)
    },
  },
  {
    // Perdida hace pocos días: se ve en la columna "Venta perdida".
    id: 'sale-004',
    data: {
      contactId: 'contact-001',
      title: 'Muestras para eventos (mock)',
      stage: 'perdida',
      stageChangedAt: cr('2026-10-08T15:00:00'),
      estimatedAmount: 80_000,
      nextFollowUpAt: null,
      notes: 'Venta simulada para pruebas.',
      createdAt: cr('2026-09-10T09:30:00'),
      lastCommunicationAt: null,
    },
  },
  {
    // Ganada hace más de 30 días: no debe verse en el tablero (HU-305).
    id: 'sale-005',
    data: {
      contactId: 'contact-002',
      title: 'Pedido antiguo de temporada (mock)',
      stage: 'ganada',
      stageChangedAt: cr('2026-08-20T12:00:00'),
      estimatedAmount: 250_000,
      nextFollowUpAt: null,
      notes: 'Venta simulada para pruebas.',
      createdAt: cr('2026-08-01T10:00:00'),
      lastCommunicationAt: null,
    },
  },
  {
    // Sin seguimiento programado y sin productos.
    id: 'sale-006',
    data: {
      contactId: 'contact-005',
      title: 'Primer contacto con Elena (mock)',
      stage: 'nuevo_interesado',
      stageChangedAt: cr('2026-10-10T16:45:00'),
      estimatedAmount: 0,
      nextFollowUpAt: null,
      notes: 'Venta simulada para pruebas.',
      createdAt: cr('2026-10-10T16:45:00'),
      lastCommunicationAt: null,
    },
  },
];

// PROVISIONAL: productos de ejemplo mientras el cliente entrega el catálogo real
// (nombre, presentación y descripción). Para reemplazarlos basta con editar esta lista.
export const seedProducts: Seeded<Product>[] = [
  {
    id: 'product-001',
    data: {
      name: 'Café en grano',
      presentation: 'Bolsa de 340 g',
      description: 'Café en grano tostado, producto de ejemplo.',
      active: true,
    },
  },
  {
    id: 'product-002',
    data: {
      name: 'Café en grano',
      presentation: 'Bolsa de 1 kg',
      description: 'Café en grano tostado en presentación familiar, producto de ejemplo.',
      active: true,
    },
  },
  {
    id: 'product-003',
    data: {
      name: 'Café molido',
      presentation: 'Bolsa de 340 g',
      description: 'Café molido listo para preparar, producto de ejemplo.',
      active: true,
    },
  },
  {
    id: 'product-004',
    data: {
      name: 'Café molido',
      presentation: 'Bolsa de 1 kg',
      description: 'Café molido para cafeterías, producto de ejemplo.',
      active: true,
    },
  },
  {
    id: 'product-005',
    data: {
      name: 'Café para espresso',
      presentation: 'Bolsa de 2,5 kg',
      description: 'Mezcla para máquina de espresso, producto de ejemplo.',
      active: true,
    },
  },
  {
    // Inactivo: no aparece al elegir productos, pero sigue existiendo para ventas antiguas.
    id: 'product-006',
    data: {
      name: 'Café de temporada',
      presentation: 'Bolsa de 250 g',
      description: 'Producto descontinuado, de ejemplo.',
      active: false,
    },
  },
];

/** `saleProducts` no tiene `id` en el contrato: el id del documento es `${saleId}_${productId}`. */
type SeedSaleProduct = SaleProduct & { id: string };
export const seedSaleProducts: Seeded<SeedSaleProduct>[] = [
  { id: 'sale-001_product-001', data: { saleId: 'sale-001', productId: 'product-001', quantity: 20 } },
  { id: 'sale-001_product-002', data: { saleId: 'sale-001', productId: 'product-002', quantity: 10 } },
  { id: 'sale-002_product-003', data: { saleId: 'sale-002', productId: 'product-003', quantity: 50 } },
  { id: 'sale-003_product-002', data: { saleId: 'sale-003', productId: 'product-002', quantity: 5 } },
  { id: 'sale-003_product-004', data: { saleId: 'sale-003', productId: 'product-004', quantity: 5 } },
  { id: 'sale-004_product-005', data: { saleId: 'sale-004', productId: 'product-005', quantity: 3 } },
];

/**
 * `stageHistory` no tiene `id` en el contrato: el id es `${saleId}_${número de cambio}`.
 * El último cambio de cada venta coincide con su `stage` y su `stageChangedAt`.
 */
type SeedStageHistory = StageHistory & { id: string };
export const seedStageHistory: Seeded<SeedStageHistory>[] = [
  {
    id: 'sale-001_01',
    data: { saleId: 'sale-001', previousStage: null, newStage: 'nuevo_interesado', changedAt: cr('2026-09-15T09:00:00'), lossReason: null },
  },
  {
    id: 'sale-001_02',
    data: { saleId: 'sale-001', previousStage: 'nuevo_interesado', newStage: 'contactado', changedAt: cr('2026-09-18T11:00:00'), lossReason: null },
  },
  {
    id: 'sale-001_03',
    data: { saleId: 'sale-001', previousStage: 'contactado', newStage: 'cotizacion_enviada', changedAt: cr('2026-09-24T14:30:00'), lossReason: null },
  },
  {
    id: 'sale-001_04',
    data: { saleId: 'sale-001', previousStage: 'cotizacion_enviada', newStage: 'en_negociacion', changedAt: cr('2026-10-01T10:00:00'), lossReason: null },
  },
  {
    id: 'sale-002_01',
    data: { saleId: 'sale-002', previousStage: null, newStage: 'nuevo_interesado', changedAt: cr('2026-09-20T13:00:00'), lossReason: null },
  },
  {
    id: 'sale-002_02',
    data: { saleId: 'sale-002', previousStage: 'nuevo_interesado', newStage: 'cotizacion_enviada', changedAt: cr('2026-09-28T09:00:00'), lossReason: null },
  },
  {
    id: 'sale-003_01',
    data: { saleId: 'sale-003', previousStage: null, newStage: 'nuevo_interesado', changedAt: cr('2026-09-25T10:00:00'), lossReason: null },
  },
  {
    id: 'sale-003_02',
    data: { saleId: 'sale-003', previousStage: 'nuevo_interesado', newStage: 'en_negociacion', changedAt: cr('2026-09-29T16:00:00'), lossReason: null },
  },
  {
    id: 'sale-003_03',
    data: { saleId: 'sale-003', previousStage: 'en_negociacion', newStage: 'ganada', changedAt: cr('2026-10-02T12:00:00'), lossReason: null },
  },
  {
    id: 'sale-004_01',
    data: { saleId: 'sale-004', previousStage: null, newStage: 'nuevo_interesado', changedAt: cr('2026-09-10T09:30:00'), lossReason: null },
  },
  {
    id: 'sale-004_02',
    data: { saleId: 'sale-004', previousStage: 'nuevo_interesado', newStage: 'contactado', changedAt: cr('2026-09-16T10:00:00'), lossReason: null },
  },
  {
    id: 'sale-004_03',
    data: { saleId: 'sale-004', previousStage: 'contactado', newStage: 'perdida', changedAt: cr('2026-10-08T15:00:00'), lossReason: 'El cliente eligió otro proveedor.' },
  },
  {
    id: 'sale-005_01',
    data: { saleId: 'sale-005', previousStage: null, newStage: 'nuevo_interesado', changedAt: cr('2026-08-01T10:00:00'), lossReason: null },
  },
  {
    id: 'sale-005_02',
    data: { saleId: 'sale-005', previousStage: 'nuevo_interesado', newStage: 'ganada', changedAt: cr('2026-08-20T12:00:00'), lossReason: null },
  },
  {
    id: 'sale-006_01',
    data: { saleId: 'sale-006', previousStage: null, newStage: 'nuevo_interesado', changedAt: cr('2026-10-10T16:45:00'), lossReason: null },
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
