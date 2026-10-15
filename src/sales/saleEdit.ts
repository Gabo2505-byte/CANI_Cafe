// HU-309: reglas para editar una posible venta (funciones puras, sin Firebase).
import { OPEN_SALE_STAGES, type Sale } from '../shared/types';
import { toCostaRicaDateKey } from '../shared/utils/dates';
import { SALE_LIMITS, SALE_MESSAGES, titleKey, validateSaleForm, type SaleFormErrors, type SaleFormValues } from './saleForm';

export const EDIT_MESSAGES = {
  saved: 'Cambios guardados correctamente.',
  saveError: 'No se pudieron guardar los cambios. Intente de nuevo.',
} as const;

/** Lo que se puede editar: título, monto, seguimiento y notas (los productos van aparte). La etapa se cambia con HU-310. */
export type SaleEditValues = Omit<SaleFormValues, 'stage'>;

/** Una venta ganada es definitiva: solo se pueden cambiar las notas. */
export function isNotesOnly(sale: Pick<Sale, 'stage'>): boolean {
  return sale.stage === 'ganada';
}

/** Valores con los que arranca el formulario de edición. */
export function toEditValues(sale: Sale): SaleEditValues {
  return {
    title: sale.title,
    amount: String(sale.estimatedAmount),
    followUpDate: sale.nextFollowUpAt ? toCostaRicaDateKey(sale.nextFollowUpAt) : '',
    notes: sale.notes,
  };
}

export interface SaleEditContext {
  /** Hoy en Costa Rica como "aaaa-mm-dd". Se recibe para poder probar con cualquier fecha. */
  today: string;
  /** Títulos de las otras posibles ventas abiertas del mismo contacto (sin la que se edita). */
  openTitles: string[];
}

/**
 * Mismas reglas que al crear (título obligatorio de hasta 100 caracteres y sin repetir, monto de ₡ 0 a
 * ₡ 999 999 999, seguimiento no anterior a hoy, notas hasta 1000), con dos precisiones:
 * - Lo que no se tocó no se vuelve a revisar contra otras ventas ni contra hoy: un seguimiento ya
 *   vencido o un título que coincide con otra venta no impiden guardar un cambio en las notas.
 * - En una venta ganada solo se revisan las notas.
 */
export function validateSaleEdit(sale: Sale, values: SaleEditValues, context: SaleEditContext): SaleFormErrors {
  if (isNotesOnly(sale)) {
    return values.notes.length > SALE_LIMITS.notes ? { notes: SALE_MESSAGES.notesTooLong } : {};
  }
  const original = toEditValues(sale);
  const titleChanged = titleKey(values.title) !== titleKey(original.title);
  const followUpChanged = values.followUpDate !== original.followUpDate;
  const errors = validateSaleForm(
    { ...values, stage: OPEN_SALE_STAGES[0] },
    {
      contactId: sale.contactId,
      today: followUpChanged ? context.today : '0000-00-00',
      openTitles: titleChanged ? context.openTitles : [],
    },
  );
  delete errors.contact;
  return errors;
}
