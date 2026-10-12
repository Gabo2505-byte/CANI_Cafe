// HU-202: teléfonos de Costa Rica y de otros países.
// Se guarda el país (ISO 3166-1 alfa-2, ej. "CR") y el número solo con dígitos, sin el código.
// La lista de países y sus códigos viene de libphonenumber-js; las reglas de largo son las de la HU.
import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js/min';
import { DEFAULT_PHONE_COUNTRY } from '../types';

export { DEFAULT_PHONE_COUNTRY };

export const PHONE_MESSAGES = {
  costaRicaLength: 'El teléfono debe tener 8 dígitos.',
  otherLength: 'El teléfono debe tener entre 6 y 14 dígitos.',
} as const;

const CR_DIGITS = 8;
const OTHER_MIN_DIGITS = 6;
const OTHER_MAX_DIGITS = 14;

export interface PhoneCountryOption {
  /** ISO 3166-1 alfa-2, ej. "CR". */
  code: string;
  name: string;
  /** Con "+", ej. "+506". */
  dialCode: string;
  /** Texto de la lista, ej. "Costa Rica (+506)". */
  label: string;
}

let countriesCache: PhoneCountryOption[] | null = null;

/** Países con su código, ordenados por nombre en español. */
export function getPhoneCountries(): PhoneCountryOption[] {
  if (countriesCache) return countriesCache;
  const names = new Intl.DisplayNames(['es'], { type: 'region' });
  countriesCache = getCountries()
    .map((code) => {
      const name = names.of(code) ?? code;
      const dialCode = `+${getCountryCallingCode(code)}`;
      return { code, name, dialCode, label: `${name} (${dialCode})` };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return countriesCache;
}

export function dialCodeOf(country: string): string {
  try {
    return `+${getCountryCallingCode(country as CountryCode)}`;
  } catch {
    return '';
  }
}

/** Solo dígitos (se aceptan espacios, guiones o paréntesis al escribir). */
export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Mensaje de error si el número no tiene la cantidad correcta de dígitos; null si está bien. */
export function validatePhoneNumber(country: string, digits: string): string | null {
  if (country === DEFAULT_PHONE_COUNTRY) {
    return digits.length === CR_DIGITS ? null : PHONE_MESSAGES.costaRicaLength;
  }
  return digits.length >= OTHER_MIN_DIGITS && digits.length <= OTHER_MAX_DIGITS ? null : PHONE_MESSAGES.otherLength;
}

/** Costa Rica: "+506 8888-8888". Otros países: "+1 3055551234". */
export function formatPhone(country: string, digits: string): string {
  const dial = dialCodeOf(country);
  if (country === DEFAULT_PHONE_COUNTRY && digits.length === CR_DIGITS) {
    return `${dial} ${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${dial} ${digits}`.trim();
}

/**
 * Forma única del teléfono (código + número, ej. "+50688888888") para comparar
 * y detectar duplicados (HU-203).
 */
export function phoneKey(country: string, digits: string): string {
  return `${dialCodeOf(country)}${normalizePhoneDigits(digits)}`;
}
