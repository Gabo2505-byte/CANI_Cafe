// HU-314: avisos internos de las posibles ventas (funciones puras, sin Firebase).
// Los avisos no se guardan: se calculan al consultar a partir de las ventas y los contactos.
import { isOpenSaleStage, type Sale } from '../shared/types';
import { formatDateNumericCR, toCostaRicaDateKey } from '../shared/utils/dates';

export const ALERT_MESSAGES = {
  title: 'Avisos',
  empty: 'No hay avisos pendientes.',
  loading: 'Cargando avisos…',
  loadError: 'No se pudieron cargar los avisos. Intente de nuevo.',
} as const;

export type AlertKind = 'seguimiento_hoy' | 'seguimiento_vencido';

export interface SaleAlert {
  /** Una venta genera como máximo un aviso de cada tipo. */
  id: string;
  kind: AlertKind;
  saleId: string;
  contactId: string;
  contactName: string;
  saleTitle: string;
  /** Texto del aviso. */
  message: string;
  /** Fecha del aviso: el día del seguimiento. */
  date: Date;
}

/** Lo que se necesita saber del contacto para decidir si la venta genera avisos. */
export interface AlertContact {
  fullName: string;
  status: string;
}

/** "Seguimiento programado para hoy con [contacto] – [título]." */
export function followUpTodayMessage(contactName: string, title: string): string {
  return `Seguimiento programado para hoy con ${contactName} – ${title}.`;
}

/** "Seguimiento vencido desde el [fecha] con [contacto] – [título]." (fecha dd/mm/aaaa) */
export function followUpOverdueMessage(followUpAt: Date, contactName: string, title: string): string {
  return `Seguimiento vencido desde el ${formatDateNumericCR(followUpAt)} con ${contactName} – ${title}.`;
}

/**
 * HU-314: aviso de seguimiento de una posible venta, o null si no corresponde.
 * Solo generan aviso las ventas abiertas de contactos activos que tienen fecha de seguimiento. Los días se
 * comparan como día calendario de Costa Rica: desde las 00:00 del día del seguimiento es "para hoy" y al día
 * siguiente pasa a "vencido". Registrar una comunicación no lo quita (no se mira `lastCommunicationAt`).
 */
export function followUpAlert(sale: Sale, contact: AlertContact | undefined, now: Date): SaleAlert | null {
  if (!contact || contact.status !== 'activo') return null;
  if (!isOpenSaleStage(sale.stage) || !sale.nextFollowUpAt) return null;

  const followUpAt = sale.nextFollowUpAt.toDate();
  const followUpDay = toCostaRicaDateKey(followUpAt);
  const today = toCostaRicaDateKey(now);
  if (followUpDay > today) return null;

  const isToday = followUpDay === today;
  return {
    id: `${sale.id}:${isToday ? 'seguimiento_hoy' : 'seguimiento_vencido'}`,
    kind: isToday ? 'seguimiento_hoy' : 'seguimiento_vencido',
    saleId: sale.id,
    contactId: sale.contactId,
    contactName: contact.fullName,
    saleTitle: sale.title,
    message: isToday
      ? followUpTodayMessage(contact.fullName, sale.title)
      : followUpOverdueMessage(followUpAt, contact.fullName, sale.title),
    date: followUpAt,
  };
}

/** Avisos de seguimiento de todas las ventas dadas, los más antiguos primero. */
export function buildFollowUpAlerts(sales: Sale[], contacts: Map<string, AlertContact>, now: Date): SaleAlert[] {
  return sales
    .map((sale) => followUpAlert(sale, contacts.get(sale.contactId), now))
    .filter((alert): alert is SaleAlert => alert !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
}
