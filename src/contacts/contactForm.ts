// HU-201: datos y reglas del formulario "Nuevo contacto" (funciones puras, sin Firebase).
import { DEFAULT_PHONE_COUNTRY } from '../shared/types';
import type { NewContactInput } from './contactsRepository';

export const CONTACT_MESSAGES = {
  created: 'Contacto registrado correctamente.',
  leaveConfirm: '¿Desea salir sin guardar? Los datos ingresados se perderán.',
  // Textos provisionales: los mensajes de validación definitivos son de HU-202.
  fullNameRequired: 'Ingrese el nombre completo.',
  emailOrPhoneRequired: 'Ingrese un correo electrónico o un teléfono.',
  saveError: 'No se pudo registrar el contacto. Intente de nuevo.',
} as const;

export interface ContactFormValues {
  fullName: string;
  email: string;
  phone: string;
  address: string;
}

export const EMPTY_CONTACT_FORM: ContactFormValues = { fullName: '', email: '', phone: '', address: '' };

export type ContactFormErrors = Partial<Record<'fullName' | 'emailOrPhone', string>>;

/** Solo dígitos (se aceptan espacios o guiones al escribir). */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Nombre obligatorio; correo o teléfono, al menos uno; dirección opcional. */
export function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {};
  if (values.fullName.trim() === '') errors.fullName = CONTACT_MESSAGES.fullNameRequired;
  if (values.email.trim() === '' && normalizePhone(values.phone) === '') {
    errors.emailOrPhone = CONTACT_MESSAGES.emailOrPhoneRequired;
  }
  return errors;
}

/** ¿Se escribió algo? (para preguntar antes de salir sin guardar). */
export function isContactFormDirty(values: ContactFormValues): boolean {
  return Object.values(values).some((value) => value.trim() !== '');
}

/** Convierte el formulario al documento: lo no llenado se guarda como null. */
export function toNewContactInput(values: ContactFormValues): NewContactInput {
  const email = values.email.trim();
  const phone = normalizePhone(values.phone);
  const address = values.address.trim();
  return {
    fullName: values.fullName.trim(),
    email: email || null,
    phoneCountry: phone ? DEFAULT_PHONE_COUNTRY : null,
    phoneNumber: phone || null,
    address: address || null,
  };
}
