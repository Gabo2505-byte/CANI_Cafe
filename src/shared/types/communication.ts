import type { Timestamp } from 'firebase/firestore';

// Medio por el que ocurrió la comunicación (solo registro; el sistema no envía nada).
// HU-211 fija la lista y su orden en pantalla: Llamada telefónica, WhatsApp, Correo electrónico,
// Visita presencial u Otro (con `otherMedium`). Reemplaza la lista provisional de HT-001 (sin "reunión").
export const COMMUNICATION_MEDIUMS = ['llamada', 'whatsapp', 'correo', 'visita', 'otro'] as const;
export type CommunicationMedium = (typeof COMMUNICATION_MEDIUMS)[number];

/** Texto que se muestra en pantalla para cada medio. */
export const COMMUNICATION_MEDIUM_LABELS: Record<CommunicationMedium, string> = {
  llamada: 'Llamada telefónica',
  whatsapp: 'WhatsApp',
  correo: 'Correo electrónico',
  visita: 'Visita presencial',
  otro: 'Otro',
};

/**
 * HU-213: de dónde vino la comunicación. "usuario" = la registró alguien con sesión (HU-211);
 * "formulario_web" = llegó del formulario del sitio web (sin usuario; se muestra "Sistema (formulario web)").
 */
export const COMMUNICATION_SOURCES = ['usuario', 'formulario_web'] as const;
export type CommunicationSource = (typeof COMMUNICATION_SOURCES)[number];

/** Colección `communications`. */
export interface Communication {
  id: string;
  /** → contacts.id */
  contactId: string;
  /** → sales.id. null cuando no aplica a una venta específica. */
  saleId: string | null;
  /** true = aplica a todas las ventas del contacto; en ese caso saleId es null. */
  appliesToAllSales: boolean;
  /** Día de la comunicación: 00:00 de ese día en Costa Rica (HU-211). No puede ser futuro. */
  date: Timestamp;
  medium: CommunicationMedium;
  /** Cuál fue el medio cuando `medium` es "otro" (ej. "Instagram"); null en los demás. */
  otherMedium: string | null;
  /** Qué se conversó. Hasta 1000 caracteres (HU-211). */
  note: string;
  /** HU-213: de dónde vino. */
  source: CommunicationSource;
  /** → users.id (quién la registró). null solo si `source` es "formulario_web". */
  userId: string | null;
  /** Cuándo se registró (hora del servidor). Desempata comunicaciones del mismo día. */
  createdAt: Timestamp;
}
