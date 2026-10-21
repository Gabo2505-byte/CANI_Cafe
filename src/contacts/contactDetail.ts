// HU-207: lógica pura de la ficha del contacto (sin Firestore ni React; se prueba con Vitest).
import { ROUTES } from '../app/routes';
import type { CommunicationsCursor } from '../communications/communicationsRepository';
import { formatPhone } from '../shared/phone/phone';
import {
  CONTACT_ORIGIN_LABELS,
  type Communication,
  type Contact,
  type Product,
  type Sale,
  type SaleProduct,
  SALE_STAGE_LABELS,
  isOpenSaleStage,
} from '../shared/types';
import { formatDateCR, formatDateNumericCR } from '../shared/utils/dates';
import { formatColones } from '../shared/utils/money';
import { toSortKey } from '../shared/utils/text';

export const CONTACT_DETAIL_MESSAGES = {
  back: '← Volver a contactos',
  dataTitle: 'Datos del contacto',
  missing: 'No registrado',
  loading: 'Cargando…',
  notFound: 'El contacto no existe.',
  loadError: 'No se pudo cargar el contacto.',
  recordsLoading: 'Cargando registros…',
  recordsError: 'No se pudieron cargar los registros del contacto. Intente de nuevo.',
  noCommunications: 'Este contacto no tiene comunicaciones registradas.',
  loadMore: 'Ver más',
  loadMoreError: 'No se pudieron cargar más comunicaciones. Intente de nuevo.',
  noSales: 'Este contacto no tiene oportunidades de venta.',
  noFollowUp: 'Sin seguimiento programado',
  noCommunication: 'Sin comunicaciones',
  noProducts: 'Sin productos de interés.',
} as const;

/** Las tres pestañas, en orden. La primera es la que se ve al abrir la ficha. */
export const CONTACT_TABS = [
  { id: 'comunicaciones', label: 'Comunicaciones' },
  { id: 'ventas', label: 'Oportunidades de venta' },
  { id: 'productos', label: 'Productos de interés' },
] as const;
export type ContactTabId = (typeof CONTACT_TABS)[number]['id'];

/** Texto de la pestaña: "Comunicaciones (3)". Sin conteo mientras carga o si falló. */
export function tabLabel(label: string, count: number | null): string {
  return count === null ? label : `${label} (${count})`;
}

/** Producto de interés: un producto que aparece en alguna posible venta del contacto. */
export interface InterestProduct {
  productId: string;
  name: string;
  presentation: string;
}

/** Lo que muestran las pestañas. */
export interface ContactRecords {
  /** HU-213: la primera página del historial (las 10 más recientes). */
  communications: Communication[];
  /** HU-213: total de comunicaciones del contacto (si no viene, las de `communications`). */
  communicationsTotal?: number;
  /** HU-213: para "Ver más"; null o sin indicar si no hay más. */
  communicationsCursor?: CommunicationsCursor | null;
  /** HU-213: nombre de usuario de quien registró cada comunicación (users.id → username). */
  userNames?: Record<string, string>;
  sales: Sale[];
  products: InterestProduct[];
}

/** Estado de la lista de contactos que viaja a la ficha para volver "tal como estaba". */
export interface FromListState {
  from?: string;
}

/**
 * Destino de "Volver a contactos": la lista con la misma búsqueda, filtros y página
 * (todo vive en la URL de la lista). Si se llegó a la ficha por otro camino, la lista desde el inicio.
 * Solo acepta rutas de la lista de contactos (no se puede usar para salir a otra pantalla).
 */
export function backToListPath(state: unknown): string {
  const from = (state as FromListState | null)?.from;
  if (typeof from === 'string' && (from === ROUTES.contacts || from.startsWith(`${ROUTES.contacts}?`))) return from;
  return ROUTES.contacts;
}

/** Lee "?pagina=N" (1, 2, …) y devuelve el índice de página (0, 1, …). Cualquier otro valor es la primera. */
export function pageIndexFromParam(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n - 1 : 0;
}

/** Filas del recuadro "Datos del contacto". Un dato vacío dice "No registrado". */
export function contactDataRows(contact: Contact): [string, string][] {
  // HU-202: "+506 8888-8888" para Costa Rica, "+1 3055551234" para otros países.
  const phone = contact.phoneNumber ? formatPhone(contact.phoneCountry ?? 'CR', contact.phoneNumber) : null;
  const rows: [string, string | null][] = [
    ['Correo electrónico', contact.email?.trim() || null],
    ['Teléfono', phone],
    ['Dirección', contact.address?.trim() || null],
    ['Fecha de registro', contact.createdAt ? formatDateCR(contact.createdAt) : null],
    ['Origen', contact.origin ? (CONTACT_ORIGIN_LABELS[contact.origin] ?? contact.origin) : null],
  ];
  return rows.map(([label, value]) => [label, value ?? CONTACT_DETAIL_MESSAGES.missing]);
}

/** Nombre que se muestra si un producto de una venta ya no está en el catálogo. */
const UNKNOWN_PRODUCT = { name: 'Producto no disponible', presentation: '—' } as const;

/**
 * Productos de interés: los productos distintos que aparecen en las posibles ventas del contacto
 * (cualquier etapa), ordenados por nombre y presentación.
 */
export function interestProducts(saleProducts: SaleProduct[], catalog: Product[]): InterestProduct[] {
  const byId = new Map(catalog.map((product) => [product.id, product]));
  const unique = new Map<string, InterestProduct>();
  for (const { productId } of saleProducts) {
    if (unique.has(productId)) continue;
    const product = byId.get(productId);
    unique.set(productId, {
      productId,
      name: product?.name ?? UNKNOWN_PRODUCT.name,
      presentation: product?.presentation ?? UNKNOWN_PRODUCT.presentation,
    });
  }
  return [...unique.values()].sort(
    (a, b) =>
      toSortKey(a.name).localeCompare(toSortKey(b.name), 'es') ||
      toSortKey(a.presentation).localeCompare(toSortKey(b.presentation), 'es'),
  );
}

const millis = (value: { toMillis(): number } | null | undefined) => value?.toMillis() ?? 0;

/**
 * Comunicaciones de la más reciente a la más antigua: por día (`date`) y, el mismo día, por cuándo se
 * registró (`createdAt`), así la recién registrada (HU-211) queda arriba.
 */
export function sortCommunications(communications: Communication[]): Communication[] {
  return [...communications].sort(
    (a, b) => millis(b.date) - millis(a.date) || millis(b.createdAt) - millis(a.createdAt) || a.id.localeCompare(b.id),
  );
}

/**
 * HU-208: todas las posibles ventas del contacto (también ganadas y perdidas), de la más reciente
 * a la más antigua por fecha de creación (igual que el tablero). En empate, por id para que el orden sea estable.
 */
export function sortSales(sales: Sale[]): Sale[] {
  return [...sales].sort((a, b) => millis(b.createdAt) - millis(a.createdAt) || a.id.localeCompare(b.id));
}

/** HU-212: posibles ventas que se pueden elegir al registrar una comunicación (ni ganadas ni perdidas). */
export function openSaleOptions(sales: Sale[]): { id: string; title: string }[] {
  return sales.filter((sale) => isOpenSaleStage(sale.stage)).map((sale) => ({ id: sale.id, title: sale.title }));
}

/**
 * HU-212: a qué posible venta corresponde una comunicación, para el historial:
 * "Todas sus oportunidades de venta", el título de la venta, o null si es una comunicación antigua sin ese dato.
 */
export function communicationSaleLabel(communication: Pick<Communication, 'saleId' | 'appliesToAllSales'>, sales: Sale[]): string | null {
  if (communication.saleId) return sales.find((sale) => sale.id === communication.saleId)?.title ?? '—';
  return communication.appliesToAllSales ? 'Todas sus oportunidades de venta' : null;
}

/** HU-213: "Registrado por: …": el usuario, o "Sistema (formulario web)" si llegó del sitio web. */
export function registeredByLabel(
  communication: Pick<Communication, 'source' | 'userId'>,
  userNames: Record<string, string> = {},
): string {
  if (communication.source === 'formulario_web') return 'Registrado por: Sistema (formulario web)';
  return `Registrado por: ${(communication.userId && userNames[communication.userId]) || '—'}`;
}

/** HU-208: columnas de la tabla de la pestaña "Oportunidades de venta". */
export const CONTACT_SALES_COLUMNS = ['Título', 'Etapa', 'Monto estimado', 'Próximo seguimiento', 'Última comunicación'] as const;

/** HU-208: celdas de una fila (mismos formatos que el tablero y el detalle de HU-308). */
export function contactSaleCells(sale: Sale): [string, string, string, string, string] {
  return [
    sale.title,
    SALE_STAGE_LABELS[sale.stage] ?? sale.stage,
    formatColones(sale.estimatedAmount),
    sale.nextFollowUpAt ? formatDateNumericCR(sale.nextFollowUpAt) : CONTACT_DETAIL_MESSAGES.noFollowUp,
    sale.lastCommunicationAt ? formatDateNumericCR(sale.lastCommunicationAt) : CONTACT_DETAIL_MESSAGES.noCommunication,
  ];
}
