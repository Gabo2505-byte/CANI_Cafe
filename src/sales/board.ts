// HU-305: columnas del tablero de posibles ventas (funciones puras, sin Firebase).
import { SALE_STAGES, SALE_STAGE_LABELS, type Sale, type SaleStage } from '../shared/types';
import { formatColones } from '../shared/utils/money';
import { ALLOWED_STAGE_TRANSITIONS, isValidStageChange } from './stageChange';

export const BOARD_MESSAGES = {
  empty: 'Sin oportunidades de venta.',
  noFollowUp: 'Sin seguimiento programado',
  loading: 'Cargando oportunidades de venta…',
  loadError: 'No se pudieron cargar las oportunidades de venta. Intente de nuevo.',
} as const;

/** Las ganadas y perdidas solo se muestran si llegaron a esa etapa en los últimos 30 días. */
export const CLOSED_SALES_VISIBLE_DAYS = 30;

export interface BoardSale {
  sale: Sale;
  /** Nombre del contacto (se busca por id; no se guarda copiado en la venta). */
  contactName: string;
}

export interface BoardColumn {
  stage: SaleStage;
  label: string;
  sales: BoardSale[];
  count: number;
  /** Suma de los montos estimados, en colones. */
  total: number;
}

/** Momento desde el cual una venta ganada o perdida sigue visible en el tablero. */
export function closedSalesCutoff(now: Date): Date {
  return new Date(now.getTime() - CLOSED_SALES_VISIBLE_DAYS * 24 * 60 * 60 * 1000);
}

/** ¿Debe mostrarse en el tablero? Las abiertas siempre; las ganadas/perdidas, solo las recientes. */
export function isVisibleOnBoard(sale: Sale, now: Date): boolean {
  if (sale.stage !== 'ganada' && sale.stage !== 'perdida') return true;
  return sale.stageChangedAt.toDate().getTime() >= closedSalesCutoff(now).getTime();
}

/** Seis columnas, una por etapa, con su conteo y la suma de montos. Dentro de cada una, la más nueva primero. */
export function buildBoard(items: BoardSale[], now: Date): BoardColumn[] {
  return SALE_STAGES.map((stage) => {
    const sales = items
      .filter((item) => item.sale.stage === stage && isVisibleOnBoard(item.sale, now))
      .sort((a, b) => b.sale.createdAt.toMillis() - a.sale.createdAt.toMillis());
    return {
      stage,
      label: SALE_STAGE_LABELS[stage],
      sales,
      count: sales.length,
      total: sales.reduce((sum, item) => sum + item.sale.estimatedAmount, 0),
    };
  });
}

/** Ej.: "En negociación · 4 · ₡ 820 000" */
export function formatColumnHeader(column: Pick<BoardColumn, 'label' | 'count' | 'total'>): string {
  return `${column.label} · ${column.count} · ${formatColones(column.total)}`;
}

/**
 * Arrastrar tarjetas en el tablero: qué pasa al soltar una oportunidad de venta en una columna.
 * - `no_permitido`: el mapa de transiciones (ALLOWED_STAGE_TRANSITIONS) no lo deja, o es su misma columna.
 * - `cambio_directo`: una etapa abierta permitida (también reabrir una perdida, HU-312, que no pide confirmación).
 * - `ventana_ganada` / `ventana_perdida`: se abre la ventana "Cambiar etapa" con esa etapa ya elegida, para
 *   conservar la confirmación de HU-313 y la pregunta con el motivo de HU-311.
 */
export type DropDecision = 'no_permitido' | 'cambio_directo' | 'ventana_ganada' | 'ventana_perdida';

export function dropDecision(sale: { stage: SaleStage }, target: SaleStage): DropDecision {
  if (!isValidStageChange(sale.stage, target)) return 'no_permitido';
  if (target === 'ganada') return 'ventana_ganada';
  if (target === 'perdida') return 'ventana_perdida';
  return 'cambio_directo';
}

/** ¿Se puede arrastrar su tarjeta? Solo si tiene al menos un destino ("Venta ganada" no tiene ninguno). */
export function canDragSale(sale: { stage: SaleStage }): boolean {
  return ALLOWED_STAGE_TRANSITIONS[sale.stage].length > 0;
}

/** Cómo se ve una columna mientras se arrastra una tarjeta. */
export type DropZoneState = 'origen' | 'permitida' | 'bloqueada';

export function dropZoneState(from: SaleStage, column: SaleStage): DropZoneState {
  if (from === column) return 'origen';
  return dropDecision({ stage: from }, column) === 'no_permitido' ? 'bloqueada' : 'permitida';
}

/** Textos para lector de pantalla del arrastre (no se ven en pantalla). */
export const BOARD_DRAG_MESSAGES = {
  instructions:
    'Para mover esta oportunidad de venta a otra etapa, presione la barra espaciadora, use las flechas izquierda y derecha para cambiar de columna y presione la barra espaciadora o Enter para soltarla. Presione Escape para cancelar. Presione Enter sin arrastrar para abrir el detalle.',
  start: (title: string, stage: string) => `Se tomó la oportunidad de venta "${title}" de la columna ${stage}.`,
  overOrigin: (stage: string) => `Sobre su columna de origen, ${stage}.`,
  overAllowed: (stage: string) => `Sobre la columna ${stage}. Se puede soltar aquí.`,
  overBlocked: (stage: string) => `Sobre la columna ${stage}. No se puede pasar a esta etapa.`,
  dropped: (title: string, stage: string) => `Se soltó la oportunidad de venta "${title}" en la columna ${stage}.`,
  returned: (title: string, stage: string) => `La oportunidad de venta "${title}" volvió a la columna ${stage}.`,
  cancelled: (title: string, stage: string) => `Se canceló el movimiento. La oportunidad de venta "${title}" volvió a la columna ${stage}.`,
} as const;
