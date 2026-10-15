// HU-308: datos y textos del detalle de una posible venta (funciones puras, sin Firebase).
import type { Sale, StageHistory } from '../shared/types';

export const DETAIL_MESSAGES = {
  back: '← Volver a posibles ventas',
  loading: 'Cargando…',
  notFound: 'No se encontró la posible venta.',
  loadError: 'No se pudo cargar la posible venta. Intente de nuevo.',
  noFollowUp: 'Sin seguimiento programado',
  noCommunications: 'Sin comunicaciones',
  noProducts: 'Sin productos',
  noNotes: 'Sin notas',
  noLossReason: 'Sin motivo registrado',
  historyTitle: 'Historial de etapas',
} as const;

/** Producto de la venta ya con su nombre (el catálogo es la fuente; `saleProducts` solo guarda el id). */
export interface DetailProduct {
  productId: string;
  name: string;
  presentation: string;
  quantity: number;
}

export interface SaleDetailData {
  sale: Sale;
  /** null si el contacto ya no existe. */
  contactName: string | null;
  products: DetailProduct[];
  history: StageHistory[];
}

/** Del cambio más reciente al más antiguo. */
export function sortHistory(history: StageHistory[]): StageHistory[] {
  return [...history].sort((a, b) => b.changedAt.toMillis() - a.changedAt.toMillis());
}

/** Motivo de pérdida, solo para cambios a "Venta perdida": el escrito o "Sin motivo registrado". */
export function lossReasonText(entry: Pick<StageHistory, 'newStage' | 'lossReason'>): string | null {
  if (entry.newStage !== 'perdida') return null;
  return entry.lossReason?.trim() || DETAIL_MESSAGES.noLossReason;
}

/** Ej.: "Café en grano · Bolsa de 340 g — 20 unidades" */
export function formatProductLine(product: DetailProduct): string {
  const units = product.quantity === 1 ? '1 unidad' : `${product.quantity} unidades`;
  return `${product.name} · ${product.presentation} — ${units}`;
}
