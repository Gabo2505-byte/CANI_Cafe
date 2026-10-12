import type { Timestamp } from 'firebase/firestore';

// "Persona interesada" es la clasificación de todo contacto nuevo (HU-201).
// La conversión a cliente (HU-313, Dylan) cambia persona_interesada → cliente.
export const CONTACT_CLASSIFICATIONS = ['persona_interesada', 'cliente', 'distribuidor', 'otro'] as const;
export type ContactClassification = (typeof CONTACT_CLASSIFICATIONS)[number];

/** Texto que se muestra en pantalla para cada clasificación. */
export const CONTACT_CLASSIFICATION_LABELS: Record<ContactClassification, string> = {
  persona_interesada: 'Persona interesada',
  cliente: 'Cliente',
  distribuidor: 'Distribuidor',
  otro: 'Otro',
};

export const CONTACT_STATUSES = ['activo', 'inactivo'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_ORIGINS = ['referido', 'redes_sociales', 'sitio_web', 'feria', 'visita', 'otro'] as const;
export type ContactOrigin = (typeof CONTACT_ORIGINS)[number];

/** País del teléfono elegido por defecto: Costa Rica (+506). Lista y reglas en src/shared/phone. */
export const DEFAULT_PHONE_COUNTRY = 'CR';

/**
 * Colección `contacts`.
 * Los datos no obligatorios se guardan como `null` cuando no se llenan.
 * Obligatorio: fullName, y al menos uno de email / phoneNumber.
 */
export interface Contact {
  id: string;
  fullName: string;
  email: string | null;
  /** País del teléfono, ISO 3166-1 alfa-2 ("CR", "US"…). null si no hay teléfono. */
  phoneCountry: string | null;
  /** Solo dígitos, sin código de país. CR: 8 dígitos; otros países: 6 a 14 (HU-202). */
  phoneNumber: string | null;
  address: string | null;
  classification: ContactClassification;
  status: ContactStatus;
  /** Cómo llegó el contacto. null hasta que una HU lo defina. */
  origin: ContactOrigin | null;
  createdAt: Timestamp;
}
