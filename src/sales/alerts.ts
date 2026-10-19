// HU-314 y HU-315: avisos internos de las posibles ventas (funciones puras, sin Firebase).
// Los avisos no se guardan: se calculan al consultar a partir de las ventas y los contactos.
import { isOpenSaleStage, type Sale } from '../shared/types';
import { formatDateNumericCR, toCostaRicaDateKey } from '../shared/utils/dates';

export const ALERT_MESSAGES = {
  title: 'Avisos',
  empty: 'No hay avisos pendientes.',
  loading: 'Cargando avisos…',
  loadError: 'No se pudieron cargar los avisos. Intente de nuevo.',
} as const;

/** HU-315: más de 10 días sin comunicaciones (desde el día 11). */
export const NO_COMMUNICATION_AFTER_DAYS = 10;

export type AlertKind = 'seguimiento_hoy' | 'seguimiento_vencido' | 'sin_comunicacion';

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
  /** Fecha del aviso: el día del seguimiento, o (sin comunicación) el día en que empezó a avisar. */
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

const DAY_MS = 24 * 60 * 60 * 1000;

/** Días calendario de Costa Rica de `from` a `to` (0 si son el mismo día). */
export function calendarDaysBetween(from: Date, to: Date): number {
  const [fy, fm, fd] = toCostaRicaDateKey(from).split('-').map(Number);
  const [ty, tm, td] = toCostaRicaDateKey(to).split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

/** "[Contacto] – [título] no tiene comunicaciones desde hace [número] días." */
export function noCommunicationMessage(contactName: string, title: string, days: number): string {
  return `${contactName} – ${title} no tiene comunicaciones desde hace ${days} días.`;
}

/**
 * HU-315: aviso por falta de comunicación de una posible venta, o null si no corresponde.
 * La referencia es la última comunicación (`lastCommunicationAt`, que ya incluye las registradas como "Todas sus
 * posibles ventas", HU-212) o, si nunca hubo, la fecha de creación. Hay aviso desde el día 11 (más de 10 días
 * calendario de Costa Rica): con la última el 01/10/2026 aparece el 12/10/2026. El número se recalcula cada día.
 * Solo ventas abiertas de contactos activos; cada venta se revisa por separado.
 */
export function noCommunicationAlert(sale: Sale, contact: AlertContact | undefined, now: Date): SaleAlert | null {
  if (!contact || contact.status !== 'activo' || !isOpenSaleStage(sale.stage)) return null;

  const reference = (sale.lastCommunicationAt ?? sale.createdAt).toDate();
  const days = calendarDaysBetween(reference, now);
  if (days <= NO_COMMUNICATION_AFTER_DAYS) return null;

  return {
    id: `${sale.id}:sin_comunicacion`,
    kind: 'sin_comunicacion',
    saleId: sale.id,
    contactId: sale.contactId,
    contactName: contact.fullName,
    saleTitle: sale.title,
    message: noCommunicationMessage(contact.fullName, sale.title, days),
    date: new Date(reference.getTime() + (NO_COMMUNICATION_AFTER_DAYS + 1) * DAY_MS),
  };
}

/** Todos los avisos (seguimiento y falta de comunicación) de las ventas dadas, los más antiguos primero. */
export function buildAlerts(sales: Sale[], contacts: Map<string, AlertContact>, now: Date): SaleAlert[] {
  return sales
    .flatMap((sale) => [followUpAlert(sale, contacts.get(sale.contactId), now), noCommunicationAlert(sale, contacts.get(sale.contactId), now)])
    .filter((alert): alert is SaleAlert => alert !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
}
