// Solicitud del formulario del sitio público (HU-405). Contrato v3 CONFIRMADO por Gabriel y Dylan
// (docs-local/CONTRATO_FORMULARIO.md). Dylan escribe la solicitud (FormRequestData); Gabriel la procesa (HU-502 a
// HU-504) y solo agrega los campos de procesamiento. El nombre de la colección se define SOLO aquí: si cambia, se
// cambia en este archivo (y en firestore.rules).
import type { Timestamp } from 'firebase/firestore';

/** Nombre de la colección (confirmado en el contrato v3). */
export const FORM_REQUESTS_COLLECTION = 'formRequests';

/** Topes que validan el formulario y las reglas de Firestore. */
export const FORM_REQUEST_LIMITS = {
  fullName: 100,
  email: 100,
  message: 1000,
  minInterests: 1,
  maxInterests: 72,
  minQuantity: 1,
  maxQuantity: 9999,
} as const;

/** Un producto marcado con su cantidad aproximada. */
export interface FormRequestInterest {
  productId: string;
  quantity: number;
}

/** Lo que escribe el sitio público, sin los campos que pone el servidor. */
export interface FormRequestData {
  fullName: string;
  /** En minúsculas y sin espacios alrededor. */
  email: string;
  /** Código ISO del país ("CR"), o null si no dejó teléfono. */
  phoneCountry: string | null;
  /** Solo dígitos, sin el código del país, o null. */
  phoneNumber: string | null;
  /** De 1 a 72, en el orden del catálogo (variedad, peso, formato). */
  interests: FormRequestInterest[];
  /** Hasta 1000 caracteres, o null si no escribió mensaje. */
  message: string | null;
}

/** Resultado del procesamiento: contacto creado (HU-502), actualizado (HU-503) o solicitud rechazada por datos inválidos. */
export const FORM_REQUEST_OUTCOMES = ['created', 'updated', 'rejected'] as const;
export type FormRequestOutcome = (typeof FORM_REQUEST_OUTCOMES)[number];

/** Documento de la colección `formRequests`. */
export interface FormRequest extends FormRequestData {
  /** serverTimestamp() al crear. */
  submittedAt: Timestamp;
  /** false al crear; true cuando el procesamiento del sistema interno terminó (con cualquier resultado). */
  processed: boolean;

  // Campos de procesamiento: los escribe SOLO el sistema interno (las reglas no permiten cambiar los demás).
  /** Reclamo para no procesarla dos veces: hora del servidor al tomarla. Vence a los 2 minutos. */
  claimedAt?: Timestamp;
  /** uid de quien la tomó. */
  claimedBy?: string;
  /** Hora del servidor al cerrar el procesamiento. */
  processedAt?: Timestamp;
  outcome?: FormRequestOutcome;
  /** → contacts.id creado o actualizado (outcome 'created' o 'updated'). */
  contactId?: string;
  /** Motivo, solo si outcome es 'rejected' (hasta 500 caracteres). */
  error?: string;
}
