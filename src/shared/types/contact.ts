import type { Timestamp } from 'firebase/firestore';

// Valores iniciales propuestos en HT-001; pendientes de validar con el negocio.
export const CONTACT_CLASSIFICATIONS = ['prospecto', 'cliente', 'distribuidor', 'otro'] as const;
export type ContactClassification = (typeof CONTACT_CLASSIFICATIONS)[number];

export const CONTACT_STATUSES = ['activo', 'inactivo'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_ORIGINS = ['referido', 'redes_sociales', 'sitio_web', 'feria', 'visita', 'otro'] as const;
export type ContactOrigin = (typeof CONTACT_ORIGINS)[number];

/** Colección `contacts`. */
export interface Contact {
  id: string;
  fullName: string;
  email: string;
  /** Código de país ISO 3166-1 alfa-2 (ej. "CR"). */
  phoneCountry: string;
  /** Solo dígitos, sin código de país. */
  phoneNumber: string;
  classification: ContactClassification;
  status: ContactStatus;
  origin: ContactOrigin;
  createdAt: Timestamp;
}
