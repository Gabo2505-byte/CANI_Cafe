// Las fechas se guardan como Firestore Timestamp (UTC) y se muestran en hora de Costa Rica.
export const CR_TIME_ZONE = 'America/Costa_Rica';
const CR_LOCALE = 'es-CR';

/** Acepta Timestamp del SDK web, del Admin SDK o un Date. */
export type DateInput = Date | { toDate(): Date };

function toJsDate(value: DateInput): Date {
  return value instanceof Date ? value : value.toDate();
}

const dateTimeFormat = new Intl.DateTimeFormat(CR_LOCALE, {
  timeZone: CR_TIME_ZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
});

const dateFormat = new Intl.DateTimeFormat(CR_LOCALE, {
  timeZone: CR_TIME_ZONE,
  dateStyle: 'medium',
});

const dateKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: CR_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Ej.: "8 oct 2026, 12:00 p. m." */
export function formatDateTimeCR(value: DateInput): string {
  return dateTimeFormat.format(toJsDate(value));
}

/** Ej.: "8 oct 2026" */
export function formatDateCR(value: DateInput): string {
  return dateFormat.format(toJsDate(value));
}

/** Día calendario en Costa Rica como "YYYY-MM-DD" (útil para comparar "hoy", vencidos, etc.). */
export function toCostaRicaDateKey(value: DateInput): string {
  const parts = dateKeyFormat.formatToParts(toJsDate(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
