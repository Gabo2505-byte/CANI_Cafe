// HU-303: datos de una posible venta y sus reglas (funciones puras, sin Firebase).
import { OPEN_SALE_STAGES, type OpenSaleStage } from '../shared/types';
import { toSortKey } from '../shared/utils/text';

export const SALE_LIMITS = { title: 100, notes: 1000, maxAmount: 999_999_999 } as const;

export const SALE_MESSAGES = {
  contactRequired: 'Seleccione un contacto.',
  titleRequired: 'Ingrese el título.',
  titleTooLong: `El título acepta como máximo ${SALE_LIMITS.title} caracteres.`,
  titleDuplicated: 'Este contacto ya tiene una posible venta abierta con este título.',
  amountInvalid: 'Ingrese un monto válido.',
  followUpPast: 'La fecha de seguimiento no puede ser anterior a hoy.',
  notesTooLong: `Las notas aceptan como máximo ${SALE_LIMITS.notes} caracteres.`,
  /** Aviso informativo del contador (no es un error: el dato es válido). */
  atLimit: (max: number) => `Llegó al máximo de ${max} caracteres.`,
} as const;

export interface SaleFormValues {
  title: string;
  /** Al crear solo se puede elegir una de las cuatro etapas abiertas. */
  stage: OpenSaleStage;
  /** Texto escrito; se interpreta con parseAmount. */
  amount: string;
  /** "aaaa-mm-dd" del campo de fecha, o "" si no hay seguimiento. */
  followUpDate: string;
  notes: string;
}

export const EMPTY_SALE_FORM: SaleFormValues = {
  title: '',
  stage: OPEN_SALE_STAGES[0],
  amount: '',
  followUpDate: '',
  notes: '',
};

export type SaleFormErrors = Partial<Record<'contact' | 'title' | 'amount' | 'followUpDate' | 'notes', string>>;

/** Entero de ₡ 0 a ₡ 999 999 999. Acepta espacios entre los miles ("150 000"). null si no es válido. */
export function parseAmount(text: string): number | null {
  const compact = text.replace(/\s/g, '');
  if (!/^\d+$/.test(compact)) return null;
  const value = Number(compact);
  return value <= SALE_LIMITS.maxAmount ? value : null;
}

/** Forma en que se compara un título: sin mayúsculas, tildes ni espacios de más. */
export function titleKey(title: string): string {
  return toSortKey(title);
}

/** ¿Ya hay una posible venta abierta con este título? (`openTitles`: las del mismo contacto). */
export function isDuplicateTitle(title: string, openTitles: string[]): boolean {
  const key = titleKey(title);
  return openTitles.some((other) => titleKey(other) === key);
}

export interface SaleFormContext {
  /** Contacto elegido (HU-302). */
  contactId: string | null;
  /** Hoy en Costa Rica como "aaaa-mm-dd" (toCostaRicaDateKey). Se recibe para poder probar con cualquier fecha. */
  today: string;
  /** Títulos de las posibles ventas abiertas del mismo contacto, sin contar la que se edita. */
  openTitles: string[];
}

/**
 * Contacto, título y monto son obligatorios; el título tiene hasta 100 caracteres y no se repite
 * entre las abiertas del contacto; el monto va de ₡ 0 a ₡ 999 999 999; el seguimiento no puede
 * ser anterior a hoy; las notas, hasta 1000 caracteres.
 */
export function validateSaleForm(values: SaleFormValues, context: SaleFormContext): SaleFormErrors {
  const errors: SaleFormErrors = {};
  if (!context.contactId) errors.contact = SALE_MESSAGES.contactRequired;

  const title = values.title.trim();
  if (!title) errors.title = SALE_MESSAGES.titleRequired;
  else if (title.length > SALE_LIMITS.title) errors.title = SALE_MESSAGES.titleTooLong;
  else if (isDuplicateTitle(title, context.openTitles)) errors.title = SALE_MESSAGES.titleDuplicated;

  if (parseAmount(values.amount) === null) errors.amount = SALE_MESSAGES.amountInvalid;

  if (values.followUpDate && values.followUpDate < context.today) errors.followUpDate = SALE_MESSAGES.followUpPast;

  if (values.notes.length > SALE_LIMITS.notes) errors.notes = SALE_MESSAGES.notesTooLong;
  return errors;
}

/** Fecha de seguimiento → instante de las 00:00 de ese día en Costa Rica (UTC-6), o null si no hay. */
export function followUpToDate(followUpDate: string): Date | null {
  return followUpDate ? new Date(`${followUpDate}T00:00:00-06:00`) : null;
}
