// Bitácora por contacto dentro de la pantalla "Avisos" (idea del mentor, decisión del grupo): una línea de tiempo de
// solo lectura con las comunicaciones del contacto y los cambios de etapa de todas sus oportunidades de venta.
// Funciones puras (sin Firebase ni React). No se muestra quién hizo cada acción.
import { mediumLabel } from '../communications/communicationForm';
import { communicationDateLabel, communicationSaleLabel } from '../contacts/contactDetail';
import { CONTACT_SEARCH_MESSAGES } from './contactSearch';
import { lossReasonText } from './saleDetail';
import type { Communication, Sale, SaleStage, StageHistory } from '../shared/types';
import { formatDateNumericCR, toCostaRicaDateKey } from '../shared/utils/dates';

/** Tope de eventos por contacto: se muestran los más recientes. */
export const TIMELINE_MAX_EVENTS = 100;

export const TIMELINE_MESSAGES = {
  tabsLabel: 'Vistas de avisos',
  tabAlerts: 'Avisos pendientes',
  tabTimeline: 'Bitácora',
  intro: 'Busque un contacto para ver su bitácora: sus comunicaciones y los cambios de etapa de sus oportunidades de venta.',
  contactsLoading: 'Cargando contactos…',
  contactsError: CONTACT_SEARCH_MESSAGES.loadError,
  noContacts: CONTACT_SEARCH_MESSAGES.noResults,
  resultsLabel: 'Contactos encontrados',
  openContact: 'Ver ficha del contacto',
  changeContact: 'Cambiar contacto',
  loading: 'Cargando bitácora…',
  loadError: 'No se pudo cargar la bitácora. Intente de nuevo.',
  empty: 'Este contacto no tiene comunicaciones ni cambios de etapa registrados.',
  emptyFiltered: 'Este contacto no tiene eventos de este tipo.',
  filterLabel: 'Tipo de evento',
  communication: 'Comunicación',
  stageChange: 'Cambio de etapa',
  creation: 'Oportunidad creada',
  eventsLabel: 'Eventos de la bitácora',
  originForm: 'Origen: formulario web',
  originManual: 'Origen: registro manual',
  saleLabel: 'Oportunidad de venta',
  initialStage: 'Etapa inicial',
  stage: 'Etapa',
  lossReason: 'Motivo de pérdida',
} as const;

/** "Se muestran los 100 eventos más recientes." (cuando el contacto tiene más que el tope). */
export function truncatedMessage(max: number = TIMELINE_MAX_EVENTS): string {
  return `Se muestran los ${max} eventos más recientes.`;
}

/** Filtro "Tipo de evento". */
export const TIMELINE_FILTER_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'comunicaciones', label: 'Comunicaciones' },
  { value: 'etapas', label: 'Cambios de etapa' },
] as const;
export type TimelineFilter = (typeof TIMELINE_FILTER_OPTIONS)[number]['value'];

interface BaseEvent {
  /** Único en la línea de tiempo ("comm:<id>" o "stage:<id>"). */
  id: string;
  /** Instante para ordenar (ms). */
  at: number;
  /** Fecha como se muestra. */
  dateLabel: string;
}

export interface CommunicationEvent extends BaseEvent {
  kind: 'comunicacion';
  /** "WhatsApp", "Otro: Instagram", "Formulario web"… */
  medium: string;
  note: string;
  /** Llegó del formulario del sitio web (si no, la registró alguien a mano). */
  fromWebForm: boolean;
  /** Oportunidad a la que corresponde (null si es "Todas sus oportunidades de venta" o no aplica). */
  saleId: string | null;
  /** Título de la oportunidad, "Todas sus oportunidades de venta", o null si no aplica a ninguna. */
  saleLabel: string | null;
}

export interface StageEvent extends BaseEvent {
  kind: 'etapa';
  saleId: string;
  saleTitle: string;
  /** null en la entrada inicial: se muestra como la creación de la oportunidad. */
  previousStage: SaleStage | null;
  newStage: SaleStage;
  /** Solo en los cambios a "Venta perdida": el motivo o "Sin motivo registrado". */
  lossReason: string | null;
}

export type TimelineEvent = CommunicationEvent | StageEvent;

export interface Timeline {
  /** Del más reciente al más antiguo, como máximo TIMELINE_MAX_EVENTS. */
  events: TimelineEvent[];
  /** Hay más eventos que el tope (se ven solo los más recientes). */
  truncated: boolean;
}

export type TimelineStageEntry = StageHistory & { id: string };

export interface TimelineSource {
  communications: Communication[];
  /** Todas las oportunidades del contacto (para los títulos). */
  sales: Sale[];
  history: TimelineStageEntry[];
  /** La lectura ya se cortó en el tope (hay más en la base de datos). */
  truncated?: boolean;
}

/**
 * Instante con que se ordena una comunicación. Las del formulario guardan la fecha y hora exactas del envío. Las
 * registradas a mano guardan solo el día (00:00 de Costa Rica): si se registraron ese mismo día se usa la hora del
 * registro (`createdAt`), para que queden bien ordenadas frente a los cambios de etapa de ese día; si se registraron
 * otro día (con fecha anterior), se usa el día indicado.
 */
export function communicationInstant(communication: Pick<Communication, 'date' | 'createdAt' | 'source'>): number {
  const day = communication.date.toDate();
  if (communication.source === 'formulario_web' || !communication.createdAt) return day.getTime();
  const created = communication.createdAt.toDate();
  return toCostaRicaDateKey(created) === toCostaRicaDateKey(day) ? created.getTime() : day.getTime();
}

function toCommunicationEvent(communication: Communication, sales: Sale[]): CommunicationEvent {
  return {
    kind: 'comunicacion',
    id: `comm:${communication.id}`,
    at: communicationInstant(communication),
    dateLabel: communicationDateLabel(communication),
    medium: mediumLabel(communication),
    note: communication.note,
    fromWebForm: communication.source === 'formulario_web',
    saleId: communication.saleId,
    saleLabel: communicationSaleLabel(communication, sales),
  };
}

function toStageEvent(entry: TimelineStageEntry, titles: Map<string, string>): StageEvent {
  return {
    kind: 'etapa',
    id: `stage:${entry.id}`,
    at: entry.changedAt.toMillis(),
    dateLabel: formatDateNumericCR(entry.changedAt),
    saleId: entry.saleId,
    saleTitle: titles.get(entry.saleId) ?? '—',
    previousStage: entry.previousStage,
    newStage: entry.newStage,
    lossReason: lossReasonText(entry),
  };
}

/** ¿Es la entrada inicial de una oportunidad (su creación)? */
export function isCreationEvent(event: TimelineEvent): event is StageEvent {
  return event.kind === 'etapa' && event.previousStage === null;
}

/** En un empate de instante: cambios de etapa, luego comunicaciones y al final las creaciones (lo más antiguo abajo). */
function tieRank(event: TimelineEvent): number {
  if (event.kind === 'comunicacion') return 1;
  return event.previousStage === null ? 2 : 0;
}

/** Del más reciente al más antiguo; los empates se resuelven siempre igual (tipo y luego id). */
export function compareEvents(a: TimelineEvent, b: TimelineEvent): number {
  return b.at - a.at || tieRank(a) - tieRank(b) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
}

/** Combina comunicaciones y cambios de etapa en una sola línea de tiempo, con el tope de eventos. */
export function buildTimeline(source: TimelineSource, max: number = TIMELINE_MAX_EVENTS): Timeline {
  const titles = new Map(source.sales.map((sale) => [sale.id, sale.title]));
  const all = [
    ...source.communications.map((c) => toCommunicationEvent(c, source.sales)),
    ...source.history.map((entry) => toStageEvent(entry, titles)),
  ].sort(compareEvents);
  return { events: all.slice(0, max), truncated: Boolean(source.truncated) || all.length > max };
}

/** Eventos que cumplen el filtro "Tipo de evento". */
export function filterTimeline(events: TimelineEvent[], filter: TimelineFilter): TimelineEvent[] {
  if (filter === 'comunicaciones') return events.filter((e) => e.kind === 'comunicacion');
  if (filter === 'etapas') return events.filter((e) => e.kind === 'etapa');
  return events;
}

/** Valor de la URL → filtro (cualquier otro valor es "Todos"). */
export function timelineFilterFromParam(value: string | null): TimelineFilter {
  return TIMELINE_FILTER_OPTIONS.find((o) => o.value === value)?.value ?? 'todos';
}
