// Solicitud del formulario del sitio público (HU-405). PROVISIONAL: contrato v2 propuesto por Dylan, pendiente de
// confirmar con Gabriel (E5-020.1), que procesa las solicitudes (HU-502 a HU-504). El nombre de la colección se define
// SOLO aquí: si cambia, se cambia en este archivo (y en firestore.rules).
import type { Timestamp } from 'firebase/firestore';

/** Nombre PROVISIONAL de la colección (Gabriel había propuesto "solicitudesFormulario"). */
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

/** Documento de la colección `formRequests`. */
export interface FormRequest extends FormRequestData {
  /** serverTimestamp() al crear. */
  submittedAt: Timestamp;
  /** false al crear; lo cambia el procesamiento del sistema interno (Gabriel). */
  processed: boolean;
  processedAt?: Timestamp;
  contactId?: string;
  outcome?: 'created' | 'updated';
}
