// HU-310, HU-311 y HU-313: cambiar la etapa de una posible venta (funciones puras, sin Firebase).
import { isOpenSaleStage, SALE_STAGES, SALE_STAGE_LABELS, type ContactClassification, type SaleStage } from '../shared/types';

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
  /** Franja verde tras marcar como perdida (el PDF no da un texto para HU-311). */
  lost: 'Posible venta marcada como perdida.',
  lossReasonTooLong: `El motivo acepta como máximo ${LOSS_REASON_MAX} caracteres.`,
  /** HU-313: pregunta al elegir "Venta ganada". */
  winQuestion: '¿Confirma que esta venta fue ganada? El contacto pasará a ser cliente y la venta ya no podrá cambiar de etapa.',
  /** HU-313: Venta ganada de alguien que ya era cliente (o que no cambia de clasificación). */
  won: 'Venta ganada correctamente.',
  /** Botón que confirma la pérdida o la venta ganada ("Al aceptar..."). */
  accept: 'Aceptar',
} as const;

/** HU-313: "Venta ganada. [Nombre] ahora es cliente." */
export function wonAndConvertedMessage(contactName: string): string {
  return `Venta ganada. ${contactName} ahora es cliente.`;
}

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
 * cualquier otra, hacia adelante o hacia atrás. "Venta perdida" (HU-311) y "Venta ganada" (HU-313) piden
 * confirmación en la misma ventana.
 */
export function stageOptions(current: SaleStage): StageOption[] {
  return SALE_STAGES.map((stage) => ({
    stage,
    label: SALE_STAGE_LABELS[stage],
    current: stage === current,
    selectable: stage !== current,
  }));
}

/** ¿Es un cambio válido? Desde una etapa abierta a cualquier otra etapa distinta. */
export function isValidStageChange(from: SaleStage, to: SaleStage): boolean {
  return isOpenSaleStage(from) && SALE_STAGES.includes(to) && from !== to;
}

/** Motivo de la pérdida tal como se guarda: sin espacios a los lados, o null si no se escribió nada. */
export function normalizeLossReason(text: string): string | null {
  return text.trim() || null;
}

/** Mensaje de error del motivo, o null si es válido (vacío o de hasta 250 caracteres). */
export function lossReasonError(text: string): string | null {
  return text.trim().length > LOSS_REASON_MAX ? STAGE_CHANGE_MESSAGES.lossReasonTooLong : null;
}

/**
 * HU-313: al ganar una posible venta, una "Persona interesada" pasa a "Cliente". Quien ya es cliente sigue
 * siéndolo. El PDF no dice nada de "Distribuidor" ni "Otro": su clasificación no se toca.
 */
export function classificationAfterWin(current: ContactClassification): ContactClassification {
  return current === 'persona_interesada' ? 'cliente' : current;
}

/** Lo que pasó con el contacto al cambiar de etapa (para elegir el mensaje de confirmación). */
export interface StageChangeResult {
  /** La posible venta pasó a "Venta ganada" y el contacto pasó de "Persona interesada" a "Cliente". */
  contactBecameClient: boolean;
  /** Nombre del contacto, solo cuando se convirtió en cliente. */
  contactName: string | null;
}

/** Franja verde que corresponde a un cambio de etapa ya hecho. */
export function stageChangeNotice(newStage: SaleStage, result: StageChangeResult): string {
  if (newStage === 'perdida') return STAGE_CHANGE_MESSAGES.lost;
  if (newStage === 'ganada') {
    return result.contactBecameClient && result.contactName
      ? wonAndConvertedMessage(result.contactName)
      : STAGE_CHANGE_MESSAGES.won;
  }
  return STAGE_CHANGE_MESSAGES.changed;
}
