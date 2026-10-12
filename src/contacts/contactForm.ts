// HU-201 / HU-202: datos y reglas del formulario de contacto (funciones puras, sin Firebase).
import { DEFAULT_PHONE_COUNTRY, normalizePhoneDigits, validatePhoneNumber } from '../shared/phone/phone';
import type { NewContactInput } from './contactsRepository';

export { normalizePhoneDigits as normalizePhone };

export const CONTACT_MESSAGES = {
  created: 'Contacto registrado correctamente.',
  leaveConfirm: '¿Desea salir sin guardar? Los datos ingresados se perderán.',
  fullNameRequired: 'Ingrese el nombre completo.',
  emailOrPhoneRequired: 'Ingrese un correo electrónico o un teléfono.',
  saveError: 'No se pudo registrar el contacto. Intente de nuevo.',
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

export type ContactFormErrors = Partial<Record<'fullName' | 'emailOrPhone' | 'phone', string>>;

/**
 * Nombre obligatorio; correo o teléfono, al menos uno (o los dos); dirección opcional.
 * Si se escribe un teléfono, debe tener la cantidad correcta de dígitos según el país (HU-202).
 */
export function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {};
  const phone = normalizePhoneDigits(values.phone);
  if (values.fullName.trim() === '') errors.fullName = CONTACT_MESSAGES.fullNameRequired;
  if (values.email.trim() === '' && phone === '') {
    errors.emailOrPhone = CONTACT_MESSAGES.emailOrPhoneRequired;
  }
  if (phone !== '') {
    const phoneError = validatePhoneNumber(values.phoneCountry, phone);
    if (phoneError) errors.phone = phoneError;
  }
  return errors;
}

/** ¿Se escribió algo? Elegir otro país en la lista no cuenta como escribir. */
export function isContactFormDirty(values: ContactFormValues): boolean {
  const { phoneCountry: _country, ...written } = values;
  return Object.values(written).some((value) => value.trim() !== '');
}

/** Convierte el formulario al documento: lo no llenado se guarda como null. */
export function toNewContactInput(values: ContactFormValues): NewContactInput {
  const email = values.email.trim();
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
