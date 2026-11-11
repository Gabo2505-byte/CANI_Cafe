import type { Timestamp } from 'firebase/firestore';

// "Persona interesada" es la clasificación de todo contacto nuevo (HU-201).
// La conversión a cliente (HU-313, Dylan) cambia persona_interesada → cliente.
// Solo existen estas dos (decisión de Danny, 2026-11-08: "Distribuidor" y "Otro" se quitaron del sistema).
export const CONTACT_CLASSIFICATIONS = ['persona_interesada', 'cliente'] as const;
export type ContactClassification = (typeof CONTACT_CLASSIFICATIONS)[number];

/** Texto que se muestra en pantalla para cada clasificación. */
export const CONTACT_CLASSIFICATION_LABELS: Record<ContactClassification, string> = {
  persona_interesada: 'Persona interesada',
  cliente: 'Cliente',
};

export const CONTACT_STATUSES = ['activo', 'inactivo'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

// Contrato v3 (punto 2): 'formulario_web' (HU-502) y 'carga_inicial' (E5-050.1) los pone SOLO el sistema; ningún
// formulario manual los ofrece.
export const CONTACT_ORIGINS = [
  'referido',
  'redes_sociales',
  'sitio_web',
  'feria',
  'visita',
  'otro',
  'formulario_web',
  'carga_inicial',
] as const;
export type ContactOrigin = (typeof CONTACT_ORIGINS)[number];

/** Texto que se muestra en pantalla para cada origen (ficha del contacto, HU-207). */
export const CONTACT_ORIGIN_LABELS: Record<ContactOrigin, string> = {
  referido: 'Referido',
  redes_sociales: 'Redes sociales',
  sitio_web: 'Sitio web',
  feria: 'Feria',
  visita: 'Visita',
  otro: 'Otro',
  formulario_web: 'Formulario web',
  carga_inicial: 'Carga inicial',
};

/**
 * HU-504 (contrato v3, punto 10): etiqueta mientras no se abra la ficha. 'Nuevo' = lo creó el formulario (HU-502);
 * 'Nuevo mensaje' = ya existía y volvió a enviar (HU-503). null o sin campo = sin etiqueta.
 */
export const FORM_BADGES = ['Nuevo', 'Nuevo mensaje'] as const;
export type FormBadge = (typeof FORM_BADGES)[number];

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
  /**
   * Interno (HU-204): fullName en minúsculas y sin tildes, para ordenar alfabéticamente.
   * Lo calcula el sistema al guardar (src/shared/utils/text.ts → toSortKey). No se muestra.
   */
  nameSortKey: string;
  /** Se guarda en minúsculas (HU-203). */
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
  /**
   * HU-209 (contrato v3): productos que la persona indicó en su último formulario, con la cantidad aproximada,
   * en el orden del catálogo. HU-502 y HU-503 lo reemplazan completo en cada envío. Sin campo = sin productos.
   */
  interests?: ContactInterest[];
  /** HU-209: fecha y hora del último formulario que envió (submittedAt). Sin campo o null = nunca lo envió. */
  interestsUpdatedAt?: Timestamp | null;
  /** HU-504: etiqueta del formulario mientras no se abra la ficha. */
  formBadge?: FormBadge | null;
}

/** HU-209: un producto de interés con su cantidad aproximada. */
export interface ContactInterest {
  /** → products.id */
  productId: string;
  quantity: number;
}
