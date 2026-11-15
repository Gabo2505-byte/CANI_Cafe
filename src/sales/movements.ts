// Tabla de movimientos: historial de cambios de etapa de todas las oportunidades (funciones puras, sin Firebase).
// Reutiliza las etiquetas de etapa y el motivo de pérdida del "Historial de etapas" del detalle (HU-308).
import { SALES_LABELS } from '../shared/constants/labels';
import { SALE_STAGE_LABELS, type Sale, type StageHistory } from '../shared/types';
import { DETAIL_MESSAGES, lossReasonText } from './saleDetail';

/** Registros de `stageHistory` por página. Cada página lee a lo sumo esta cantidad (+1 para saber si hay más). */
export const MOVEMENTS_PAGE_SIZE = 25;

export const MOVEMENTS_MESSAGES = {
  title: SALES_LABELS.movements,
  back: SALES_LABELS.backToBoard,
  loading: DETAIL_MESSAGES.loading,
  empty: 'No hay movimientos registrados.',
  loadError: 'No se pudieron cargar los movimientos. Intente de nuevo.',
  loadMore: 'Cargar más',
  loadMoreError: 'No se pudieron cargar más movimientos. Intente de nuevo.',
  /** Etapa anterior de la entrada inicial y nombre de una venta o contacto que ya no existe (igual que en el detalle). */
  none: '—',
} as const;

/** Un registro de `stageHistory` con el id de su documento (sirve de clave de la fila). */
export interface StageHistoryEntry extends StageHistory {
  id: string;
}

export interface MovementRow {
  id: string;
  saleId: string;
  changedAt: StageHistory['changedAt'];
  /** Título de la oportunidad; null si la venta ya no existe (entonces la fila no lleva enlace). */
  saleTitle: string | null;
  /** Nombre del contacto de la venta; "—" si la venta o el contacto ya no existen. */
  contactName: string;
  previousStageLabel: string;
  newStageLabel: string;
  /** Solo en los cambios a "Venta perdida"; cadena vacía en los demás. */
  reason: string;
}

/**
 * Filas de la tabla, del cambio más reciente al más antiguo. La entrada inicial (sin etapa anterior) muestra "—" y el
 * motivo solo aparece en los cambios a "Venta perdida". Con la misma fecha, se respeta el orden de llegada (el de la consulta).
 */
export function buildMovementRows(
  entries: StageHistoryEntry[],
  sales: ReadonlyMap<string, Pick<Sale, 'title' | 'contactId'> | null>,
  contactNames: ReadonlyMap<string, string | null>,
): MovementRow[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.changedAt.toMillis() - a.entry.changedAt.toMillis() || a.index - b.index)
    .map(({ entry }) => {
      const sale = sales.get(entry.saleId) ?? null;
      const contactName = sale ? contactNames.get(sale.contactId) ?? null : null;
      return {
        id: entry.id,
        saleId: entry.saleId,
        changedAt: entry.changedAt,
        saleTitle: sale?.title ?? null,
        contactName: contactName ?? MOVEMENTS_MESSAGES.none,
        previousStageLabel: entry.previousStage ? SALE_STAGE_LABELS[entry.previousStage] : MOVEMENTS_MESSAGES.none,
        newStageLabel: SALE_STAGE_LABELS[entry.newStage],
        reason: lossReasonText(entry) ?? '',
      };
    });
}
