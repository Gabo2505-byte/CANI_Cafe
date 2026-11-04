import type { Timestamp } from 'firebase/firestore';

// Medio por el que ocurrió la comunicación (solo registro; el sistema no envía nada).
// HU-211 fija la lista y su orden en pantalla: Llamada telefónica, WhatsApp, Correo electrónico,
// Visita presencial u Otro (con `otherMedium`). Reemplaza la lista provisional de HT-001 (sin "reunión").
// Es la lista del registro manual (HU-211): no incluye 'formulario_web'.
export const COMMUNICATION_MEDIUMS = ['llamada', 'whatsapp', 'correo', 'visita', 'otro'] as const;
export type ManualCommunicationMedium = (typeof COMMUNICATION_MEDIUMS)[number];

/** HU-502 y HU-503: medio de lo que llega del formulario del sitio web. Solo lo pone el sistema. */
export const FORM_COMMUNICATION_MEDIUM = 'formulario_web';
export type CommunicationMedium = ManualCommunicationMedium | typeof FORM_COMMUNICATION_MEDIUM;

/** Texto que se muestra en pantalla para cada medio. */
export const COMMUNICATION_MEDIUM_LABELS: Record<CommunicationMedium, string> = {
  llamada: 'Llamada telefónica',
  whatsapp: 'WhatsApp',
  correo: 'Correo electrónico',
  visita: 'Visita presencial',
  otro: 'Otro',
  formulario_web: 'Formulario web',
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
  /**
   * Día de la comunicación: 00:00 de ese día en Costa Rica (HU-211). No puede ser futuro.
   * Excepción (HU-502 y HU-503): las del formulario web guardan la fecha y hora EXACTAS del envío.
   */
  date: Timestamp;
  medium: CommunicationMedium;
  /** Cuál fue el medio cuando `medium` es "otro" (ej. "Instagram"); null en los demás. */
  otherMedium: string | null;
  /**
   * Qué se conversó. Hasta 1000 caracteres (HU-211). Las del formulario web: el mensaje (o "Sin mensaje"), los
   * productos con sus cantidades y, al final, los datos distintos (HU-502 y HU-503); hasta 8000 caracteres.
   */
  note: string;
  /** HU-213: de dónde vino. */
  source: CommunicationSource;
  /** → users.id (quién la registró). null solo si `source` es "formulario_web". */
  userId: string | null;
  /** Cuándo se registró (hora del servidor). Desempata comunicaciones del mismo día. */
  createdAt: Timestamp;
  /** HU-502 y HU-503: productos enviados en el formulario, con el nombre y la presentación del momento del envío. */
  products?: CommunicationProduct[];
}

/** Un producto enviado en el formulario, tal como era al enviarlo. */
export interface CommunicationProduct {
  /** → products.id */
  productId: string;
  name: string;
  presentation: string;
  quantity: number;
}
