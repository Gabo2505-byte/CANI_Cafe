// HU-305: columnas del tablero de posibles ventas (funciones puras, sin Firebase).
import { SALE_STAGES, SALE_STAGE_LABELS, type Sale, type SaleStage } from '../shared/types';
import { formatColones } from '../shared/utils/money';

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
