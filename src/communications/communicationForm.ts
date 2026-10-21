// HU-211: datos de una comunicación y sus reglas (funciones puras, sin Firebase; se prueban con Vitest).
import { COMMUNICATION_MEDIUM_LABELS, COMMUNICATION_MEDIUMS, type Communication, type CommunicationMedium } from '../shared/types';

export const COMMUNICATION_LIMITS = { note: 1000, otherMedium: 50 } as const;

export const COMMUNICATION_MESSAGES = {
  button: 'Registrar comunicación',
  title: 'Registrar comunicación',
  saved: 'Comunicación registrada correctamente.',
  saveError: 'No se pudo registrar la comunicación. Intente de nuevo.',
  dateRequired: 'Seleccione la fecha.',
  dateFuture: 'La fecha no puede ser posterior a hoy.',
  mediumRequired: 'Seleccione el medio.',
  otherMediumRequired: 'Indique cuál fue el medio.',
  otherMediumTooLong: `El medio acepta como máximo ${COMMUNICATION_LIMITS.otherMedium} caracteres.`,
  saleRequired: 'Seleccione la oportunidad de venta.',
  saleNotOpen: 'La oportunidad de venta elegida ya no está abierta. Elija otra o "Todas sus oportunidades de venta".',
  noteRequired: 'Ingrese la nota.',
  noteTooLong: `La nota acepta como máximo ${COMMUNICATION_LIMITS.note} caracteres.`,
  /** Aviso informativo del contador (no es un error: el dato es válido). */
  atLimit: (max: number) => `Llegó al máximo de ${max} caracteres.`,
} as const;

/** HU-212: valor del campo "Oportunidad de venta" cuando la conversación no fue sobre una venta en particular. */
export const ALL_SALES = 'todas';
export const ALL_SALES_LABEL = 'Todas sus oportunidades de venta';

/** Posible venta abierta (ni ganada ni perdida) que se puede elegir. */
export interface OpenSaleOption {
  id: string;
  title: string;
}

/** HU-212: "Todas sus oportunidades de venta" primero (la opción automática) y luego las abiertas del contacto. */
export function saleOptions(openSales: OpenSaleOption[]): { value: string; label: string }[] {
  return [{ value: ALL_SALES, label: ALL_SALES_LABEL }, ...openSales.map((sale) => ({ value: sale.id, label: sale.title }))];
}

/** Opciones del campo "Medio", en el orden de la HU. */
export const MEDIUM_OPTIONS = COMMUNICATION_MEDIUMS.map((value) => ({ value, label: COMMUNICATION_MEDIUM_LABELS[value] }));

export interface CommunicationFormValues {
  /** "aaaa-mm-dd" del campo de fecha. */
  date: string;
  /** "" hasta que se elija. */
  medium: CommunicationMedium | '';
  /** Solo cuenta si medium es "otro". */
  otherMedium: string;
  /** HU-212: ALL_SALES o el id de una posible venta abierta del contacto. */
  sale: string;
  note: string;
}

/** Valores iniciales: la fecha viene con el día de hoy (en Costa Rica) y "Todas sus oportunidades de venta" elegida. */
export function emptyCommunicationForm(today: string): CommunicationFormValues {
  return { date: today, medium: '', otherMedium: '', sale: ALL_SALES, note: '' };
}

export type CommunicationFormErrors = Partial<Record<'date' | 'medium' | 'otherMedium' | 'sale' | 'note', string>>;

/**
 * Fecha, medio y nota son obligatorios. La fecha no puede ser posterior a hoy (`today`, "aaaa-mm-dd" en
 * Costa Rica: se recibe para poder probar con cualquier día). Si el medio es "Otro" hay que escribir cuál.
 */
export function validateCommunicationForm(
  values: CommunicationFormValues,
  today: string,
  /** HU-212: ids de las posibles ventas abiertas del contacto (las que se pueden elegir). */
  openSaleIds: readonly string[] = [],
): CommunicationFormErrors {
  const errors: CommunicationFormErrors = {};
  if (!values.date) errors.date = COMMUNICATION_MESSAGES.dateRequired;
  else if (values.date > today) errors.date = COMMUNICATION_MESSAGES.dateFuture;

  if (!values.medium) errors.medium = COMMUNICATION_MESSAGES.mediumRequired;
  else if (values.medium === 'otro') {
    const other = values.otherMedium.trim();
    if (!other) errors.otherMedium = COMMUNICATION_MESSAGES.otherMediumRequired;
    else if (other.length > COMMUNICATION_LIMITS.otherMedium) errors.otherMedium = COMMUNICATION_MESSAGES.otherMediumTooLong;
  }

  // HU-212: la posible venta es obligatoria: "Todas sus oportunidades de venta" o una abierta del contacto.
  if (!values.sale || (values.sale !== ALL_SALES && !openSaleIds.includes(values.sale))) {
    errors.sale = COMMUNICATION_MESSAGES.saleRequired;
  }

  const note = values.note.trim();
  if (!note) errors.note = COMMUNICATION_MESSAGES.noteRequired;
  else if (note.length > COMMUNICATION_LIMITS.note) errors.note = COMMUNICATION_MESSAGES.noteTooLong;
  return errors;
}

/** "aaaa-mm-dd" → 00:00 de ese día en Costa Rica (UTC-6, sin horario de verano). */
export function communicationDayToDate(day: string): Date {
  return new Date(`${day}T00:00:00-06:00`);
}

/** Lo que se guarda (sin id, usuario ni fecha de registro, que pone el repositorio). */
export interface NewCommunicationInput {
  contactId: string;
  date: Date;
  medium: CommunicationMedium;
  otherMedium: string | null;
  /**
   * HU-212: posible venta a la que corresponde, o null/sin indicar = "Todas sus oportunidades de venta".
   * Lo que llega sin elegir venta (por ejemplo, el formulario del sitio web) queda como "Todas".
   */
  saleId?: string | null;
  note: string;
}

/** Datos ya validados → lo que se guarda. Recorta espacios; `otherMedium` solo si el medio es "Otro". */
export function toNewCommunication(contactId: string, values: CommunicationFormValues): NewCommunicationInput {
  const medium = values.medium as CommunicationMedium;
  return {
    contactId,
    date: communicationDayToDate(values.date),
    medium,
    otherMedium: medium === 'otro' ? values.otherMedium.trim() : null,
    saleId: values.sale === ALL_SALES ? null : values.sale,
    note: values.note.trim(),
  };
}

/** Cómo se muestra el medio en el historial: "WhatsApp", o "Otro: Instagram". */
export function mediumLabel(communication: Pick<Communication, 'medium' | 'otherMedium'>): string {
  const label = COMMUNICATION_MEDIUM_LABELS[communication.medium] ?? communication.medium;
  return communication.medium === 'otro' && communication.otherMedium ? `${label}: ${communication.otherMedium}` : label;
}
