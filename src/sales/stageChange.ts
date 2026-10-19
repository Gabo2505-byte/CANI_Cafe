// HU-310: cambiar la etapa de una posible venta (funciones puras, sin Firebase).
import { isOpenSaleStage, SALE_STAGES, SALE_STAGE_LABELS, type SaleStage } from '../shared/types';

export const STAGE_CHANGE_MESSAGES = {
  button: 'Cambiar etapa',
  title: 'Cambiar etapa',
  current: 'Etapa actual',
  /** Franja verde tras cambiar de etapa (el PDF no da un texto para HU-310). */
  changed: 'Etapa actualizada correctamente.',
  saveError: 'No se pudo cambiar la etapa. Intente de nuevo.',
  conflict: 'La etapa de esta posible venta cambió. Cierre esta ventana y vuelva a intentarlo.',
  /** Provisional: se quita cuando existan "Marcar perdida" (HU-311) y "Marcar ganada" (HU-313). */
  closingSoon: 'Marcar una posible venta como ganada o perdida estará disponible pronto.',
} as const;

export interface StageOption {
  stage: SaleStage;
  label: string;
  /** Es la etapa en la que está hoy la posible venta. */
  current: boolean;
  /** Se puede elegir como nueva etapa. */
  selectable: boolean;
}

/** Solo las posibles ventas abiertas se pueden mover de etapa (una ganada es definitiva; una perdida se reabre, HU-312). */
export function canChangeStage(sale: { stage: SaleStage }): boolean {
  return isOpenSaleStage(sale.stage);
}

/**
 * Las seis etapas en el orden del tablero, con la actual marcada. Desde una etapa abierta se puede ir a
 * cualquier otra abierta, hacia adelante o hacia atrás. "Venta ganada" y "Venta perdida" aparecen pero
 * todavía no se pueden elegir: llevan su propia confirmación (HU-311) y la conversión a cliente (HU-313).
 */
export function stageOptions(current: SaleStage): StageOption[] {
  return SALE_STAGES.map((stage) => ({
    stage,
    label: SALE_STAGE_LABELS[stage],
    current: stage === current,
    selectable: stage !== current && isOpenSaleStage(stage),
  }));
}

/** ¿Es un cambio válido hoy? Desde una etapa abierta a otra etapa abierta distinta. */
export function isValidStageChange(from: SaleStage, to: SaleStage): boolean {
  return isOpenSaleStage(from) && isOpenSaleStage(to) && from !== to;
}
