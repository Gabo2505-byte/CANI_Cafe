import type { Timestamp } from 'firebase/firestore';

// Medio por el que ocurrió la comunicación (solo registro; el CRM no envía nada).
// Valores iniciales propuestos en HT-001; pendientes de validar.
export const COMMUNICATION_MEDIUMS = ['llamada', 'correo', 'whatsapp', 'reunion', 'visita', 'otro'] as const;
export type CommunicationMedium = (typeof COMMUNICATION_MEDIUMS)[number];

/** Colección `communications`. */
export interface Communication {
  id: string;
  /** → contacts.id */
  contactId: string;
  /** → sales.id. null cuando no aplica a una venta específica. */
  saleId: string | null;
  /** true = aplica a todas las ventas del contacto; en ese caso saleId es null. */
  appliesToAllSales: boolean;
  date: Timestamp;
  medium: CommunicationMedium;
  note: string;
  /** → users.id (quién la registró) */
  userId: string;
}
