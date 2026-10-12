// HU-201 / HU-202 / HU-203: datos y reglas del formulario de contacto (funciones puras, sin Firebase).
import { DEFAULT_PHONE_COUNTRY, normalizePhoneDigits, validatePhoneNumber } from '../shared/phone/phone';
import type { NewContactInput } from './contactsRepository';

export { normalizePhoneDigits as normalizePhone };

/** HU-203: largos máximos. */
export const CONTACT_LIMITS = { fullName: 100, email: 100, address: 250 } as const;

export const CONTACT_MESSAGES = {
  created: 'Contacto registrado correctamente.',
  leaveConfirm: '¿Desea salir sin guardar? Los datos ingresados se perderán.',
  fullNameRequired: 'Ingrese el nombre completo.',
  emailOrPhoneRequired: 'Ingrese un correo electrónico o un teléfono.',
  saveError: 'No se pudo registrar el contacto. Intente de nuevo.',
  // HU-203
  invalidEmail: 'Ingrese un correo electrónico válido.',
  duplicateEmail: 'Ya existe un contacto con este correo electrónico.',
  duplicatePhone: 'Ya existe un contacto con este teléfono.',
  viewContact: 'Ver contacto',
  fullNameTooLong: `El nombre completo acepta como máximo ${CONTACT_LIMITS.fullName} caracteres.`,
  emailTooLong: `El correo electrónico acepta como máximo ${CONTACT_LIMITS.email} caracteres.`,
  addressTooLong: `La dirección acepta como máximo ${CONTACT_LIMITS.address} caracteres.`,
  /** Aviso informativo del contador (no es un error: el dato es válido). */
  atLimit: (max: number) => `Llegó al máximo de ${max} caracteres.`,
} as const;

export interface ContactFormValues {
  fullName: string;
  email: string;
  /** País del teléfono (ISO, ej. "CR"). Costa Rica viene elegido por defecto. */
  phoneCountry: string;
  phone: string;
  address: string;
}

export const EMPTY_CONTACT_FORM: ContactFormValues = {
  fullName: '',
  email: '',
  phoneCountry: DEFAULT_PHONE_COUNTRY,
  phone: '',
  address: '',
};

export type ContactFormErrors = Partial<Record<'fullName' | 'email' | 'emailOrPhone' | 'phone' | 'address', string>>;

/** Contacto ya existente con el mismo correo o teléfono (id para el enlace "Ver contacto"). */
export type ContactDuplicates = Partial<Record<'email' | 'phone', string>>;

/** nombre@dominio.com: sin espacios, con una "@" y un dominio con punto. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

/** Correo como se guarda y se compara: sin espacios alrededor y en minúsculas. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Nombre obligatorio; correo o teléfono, al menos uno (o los dos); dirección opcional.
 * HU-202: el teléfono, si se escribe, con la cantidad correcta de dígitos según el país.
 * HU-203: largos máximos y formato del correo. (Los repetidos se revisan contra la base al guardar.)
 */
export function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {};
  const fullName = values.fullName.trim();
  const email = values.email.trim();
  const phone = normalizePhoneDigits(values.phone);

  if (fullName === '') errors.fullName = CONTACT_MESSAGES.fullNameRequired;
  else if (fullName.length > CONTACT_LIMITS.fullName) errors.fullName = CONTACT_MESSAGES.fullNameTooLong;

  if (email === '' && phone === '') errors.emailOrPhone = CONTACT_MESSAGES.emailOrPhoneRequired;

  // El correo tal como se escribió: con espacios en medio no es válido.
  if (values.email !== '' && values.email.trim() !== '') {
    if (email.length > CONTACT_LIMITS.email) errors.email = CONTACT_MESSAGES.emailTooLong;
    else if (!isValidEmail(email)) errors.email = CONTACT_MESSAGES.invalidEmail;
  }

  if (phone !== '') {
    const phoneError = validatePhoneNumber(values.phoneCountry, phone);
    if (phoneError) errors.phone = phoneError;
  }

  if (values.address.trim().length > CONTACT_LIMITS.address) errors.address = CONTACT_MESSAGES.addressTooLong;
  return errors;
}

/** Mensajes de dato repetido (HU-203). */
export function duplicateErrors(duplicates: ContactDuplicates): ContactFormErrors {
  const errors: ContactFormErrors = {};
  if (duplicates.email) errors.email = CONTACT_MESSAGES.duplicateEmail;
  if (duplicates.phone) errors.phone = CONTACT_MESSAGES.duplicatePhone;
  return errors;
}

/** ¿Se escribió algo? Elegir otro país en la lista no cuenta como escribir. */
export function isContactFormDirty(values: ContactFormValues): boolean {
  const { phoneCountry: _country, ...written } = values;
  return Object.values(written).some((value) => value.trim() !== '');
}

/** Convierte el formulario al documento: lo no llenado se guarda como null. */
export function toNewContactInput(values: ContactFormValues): NewContactInput {
  const email = normalizeEmail(values.email);
  const phone = normalizePhoneDigits(values.phone);
  const address = values.address.trim();
  return {
    fullName: values.fullName.trim(),
    email: email || null,
    phoneCountry: phone ? values.phoneCountry : null,
    phoneNumber: phone || null,
    address: address || null,
  };
}
