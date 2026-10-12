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

/** Sin tildes y en mayúsculas, para agrupar y buscar ("México" → "MEXICO"). */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

export interface CountryGroup {
  /** "A", o un rango si se juntaron letras con pocos países: "D – E". */
  label: string;
  countries: PhoneCountryOption[];
}

/**
 * Agrupa por la primera letra del nombre. Las letras seguidas con pocos países se juntan
 * hasta tener al menos `minPerGroup` (ej. "D – E", "U – Z").
 */
export function groupCountriesByLetter(countries: PhoneCountryOption[], minPerGroup = 6): CountryGroup[] {
  const byLetter = new Map<string, PhoneCountryOption[]>();
  for (const country of countries) {
    const letter = foldText(country.name).charAt(0);
    byLetter.set(letter, [...(byLetter.get(letter) ?? []), country]);
  }

  const groups: { from: string; to: string; countries: PhoneCountryOption[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  for (const [letter, list] of byLetter) {
    if (!current) current = { from: letter, to: letter, countries: [] };
    current.to = letter;
    current.countries.push(...list);
    if (current.countries.length >= minPerGroup) {
      groups.push(current);
      current = null;
    }
  }
  if (current) {
    // Las últimas letras con pocos países se suman al grupo anterior.
    const last = groups.at(-1);
    if (last) {
      last.to = current.to;
      last.countries.push(...current.countries);
    } else groups.push(current);
  }
  return groups.map((g) => ({ label: g.from === g.to ? g.from : `${g.from} – ${g.to}`, countries: g.countries }));
}

/**
 * Busca por nombre (sin importar tildes), siglas ("CR") o código ("+506" / "506").
 * Primero los países cuyo nombre empieza con lo escrito ("pan" → Panamá antes que España).
 */
export function filterCountries(countries: PhoneCountryOption[], query: string): PhoneCountryOption[] {
  const q = foldText(query.trim());
  if (!q) return countries;
  const isDialSearch = /^\+?\d+$/.test(q);
  const digits = q.replace(/\D/g, '');

  const rank = (c: PhoneCountryOption): number => {
    const name = foldText(c.name);
    if (c.code === q || name.startsWith(q)) return 0;
    if (name.split(/[\s-]+/).some((word) => word.startsWith(q))) return 1;
    if (name.includes(q)) return 2;
    if (isDialSearch && c.dialCode.slice(1).startsWith(digits)) return 0;
    return -1;
  };

  return countries
    .map((country) => ({ country, rank: rank(country) }))
    .filter((r) => r.rank >= 0)
    .sort((a, b) => a.rank - b.rank) // estable: dentro del mismo rango sigue el orden alfabético
    .map((r) => r.country);
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
