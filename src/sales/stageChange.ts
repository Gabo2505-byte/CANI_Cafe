// HU-310 y HU-311: cambiar la etapa de una posible venta (funciones puras, sin Firebase).
import { isOpenSaleStage, SALE_STAGES, SALE_STAGE_LABELS, type SaleStage } from '../shared/types';

/** HU-311: el motivo de la pérdida es opcional y acepta como máximo 250 caracteres. */
export const LOSS_REASON_MAX = 250;

export const STAGE_CHANGE_MESSAGES = {
  button: 'Cambiar etapa',
  title: 'Cambiar etapa',
  current: 'Etapa actual',
  /** Franja verde tras cambiar de etapa (el PDF no da un texto para HU-310). */
  changed: 'Etapa actualizada correctamente.',
  saveError: 'No se pudo cambiar la etapa. Intente de nuevo.',
  conflict: 'La etapa de esta posible venta cambió. Cierre esta ventana y vuelva a intentarlo.',
  /** HU-311: pregunta al elegir "Venta perdida". */
  lossQuestion: '¿Está seguro de que desea marcar esta venta como perdida?',
  lossReasonLabel: 'Motivo de la pérdida',
  /** HU-311: botón que confirma la pérdida ("Al aceptar..."). */
  accept: 'Aceptar',
  /** Franja verde tras marcar como perdida (el PDF no da un texto para HU-311). */
  lost: 'Posible venta marcada como perdida.',
  lossReasonTooLong: `El motivo acepta como máximo ${LOSS_REASON_MAX} caracteres.`,
  /** Provisional: se quita cuando exista "Marcar ganada" (HU-313). */
  closingSoon: 'Marcar una posible venta como ganada estará disponible pronto.',
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

/** ¿Es una etapa a la que se puede ir hoy? Las cuatro abiertas y "Venta perdida" (HU-311). "Venta ganada" llega con HU-313. */
function isAvailableTarget(stage: SaleStage): boolean {
  return isOpenSaleStage(stage) || stage === 'perdida';
}

/**
 * Las seis etapas en el orden del tablero, con la actual marcada. Desde una etapa abierta se puede ir a
 * cualquier otra, hacia adelante o hacia atrás. "Venta perdida" pide confirmación (HU-311). "Venta ganada"
 * aparece pero todavía no se puede elegir: lleva la conversión a cliente (HU-313).
 */
export function stageOptions(current: SaleStage): StageOption[] {
  return SALE_STAGES.map((stage) => ({
    stage,
    label: SALE_STAGE_LABELS[stage],
    current: stage === current,
    selectable: stage !== current && isAvailableTarget(stage),
  }));
}

/** ¿Es un cambio válido hoy? Desde una etapa abierta a otra etapa abierta distinta o a "Venta perdida". */
export function isValidStageChange(from: SaleStage, to: SaleStage): boolean {
  return isOpenSaleStage(from) && isAvailableTarget(to) && from !== to;
}

/** Motivo de la pérdida tal como se guarda: sin espacios a los lados, o null si no se escribió nada. */
export function normalizeLossReason(text: string): string | null {
  return text.trim() || null;
}

/** Mensaje de error del motivo, o null si es válido (vacío o de hasta 250 caracteres). */
export function lossReasonError(text: string): string | null {
  return text.trim().length > LOSS_REASON_MAX ? STAGE_CHANGE_MESSAGES.lossReasonTooLong : null;
}
