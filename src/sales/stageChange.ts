// HU-310, HU-311, HU-312 y HU-313: cambiar la etapa de una posible venta (funciones puras, sin Firebase).
import { SALE_STAGES, SALE_STAGE_LABELS, type ContactClassification, type SaleStage } from '../shared/types';

/** HU-311: el motivo de la pérdida es opcional y acepta como máximo 250 caracteres. */
export const LOSS_REASON_MAX = 250;

export const STAGE_CHANGE_MESSAGES = {
  button: 'Cambiar etapa',
  title: 'Cambiar etapa',
  current: 'Etapa actual',
  /** Franja verde tras cambiar de etapa (el PDF no da un texto para HU-310). */
  changed: 'Etapa actualizada correctamente.',
  saveError: 'No se pudo cambiar la etapa. Intente de nuevo.',
  conflict: 'La etapa de esta oportunidad de venta cambió. Cierre esta ventana y vuelva a intentarlo.',
  /** HU-311: pregunta al elegir "Venta perdida". */
  lossQuestion: '¿Está seguro de que desea marcar esta venta como perdida?',
  lossReasonLabel: 'Motivo de la pérdida',
  /** Franja verde tras marcar como perdida (el PDF no da un texto para HU-311). */
  lost: 'Oportunidad de venta marcada como perdida.',
  lossReasonTooLong: `El motivo acepta como máximo ${LOSS_REASON_MAX} caracteres.`,
  /** HU-313: pregunta al elegir "Venta ganada". */
  winQuestion: '¿Confirma que esta venta fue ganada? El contacto pasará a ser cliente y la venta ya no podrá cambiar de etapa.',
  /** HU-313: Venta ganada de alguien que ya era cliente (o que no cambia de clasificación). */
  won: 'Venta ganada correctamente.',
  /** HU-312: franja verde al reabrir una posible venta perdida. */
  reopened: 'Oportunidad de venta reabierta correctamente.',
  /** HU-312: ya hay otra posible venta abierta del contacto con el mismo título. */
  reopenDuplicateTitle: 'Este contacto ya tiene una oportunidad de venta abierta con este título. Cambie el título antes de reabrirla.',
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

/** Las abiertas se mueven de etapa y la perdida se reabre (HU-312). Una ganada es definitiva (HU-313). */
export function canChangeStage(sale: { stage: SaleStage }): boolean {
  return sale.stage !== 'ganada';
}

/**
 * HU-310 (mapa de transiciones): a qué etapas se puede pasar desde cada una. Es el único lugar donde se declara.
 * - Las abiertas avanzan a la siguiente, retroceden a la anterior o se marcan como perdidas (HU-311).
 * - "Venta ganada" (HU-313) solo se alcanza desde "Precio o cotización enviada" o "En negociación".
 * - "Venta ganada" es definitiva: no sale a ninguna (HU-313).
 * - "Venta perdida" se reabre a cualquiera de las cuatro abiertas (HU-312).
 * Una etapa nunca pasa a sí misma.
 */
export const ALLOWED_STAGE_TRANSITIONS: Readonly<Record<SaleStage, readonly SaleStage[]>> = {
  nuevo_interesado: ['contactado', 'perdida'],
  contactado: ['cotizacion_enviada', 'nuevo_interesado', 'perdida'],
  cotizacion_enviada: ['en_negociacion', 'ganada', 'contactado', 'perdida'],
  en_negociacion: ['ganada', 'cotizacion_enviada', 'perdida'],
  ganada: [],
  perdida: ['nuevo_interesado', 'contactado', 'cotizacion_enviada', 'en_negociacion'],
};

/**
 * Las seis etapas en el orden del tablero, con la actual marcada. Solo se pueden elegir las que permite el mapa
 * de transiciones (ALLOWED_STAGE_TRANSITIONS); las demás aparecen pero no se pueden elegir. "Venta perdida"
 * (HU-311) y "Venta ganada" (HU-313) piden confirmación en la misma ventana. Desde "Venta perdida" solo se pueden
 * elegir las cuatro abiertas (HU-312).
 */
export function stageOptions(current: SaleStage): StageOption[] {
  return SALE_STAGES.map((stage) => ({
    stage,
    label: SALE_STAGE_LABELS[stage],
    current: stage === current,
    selectable: isValidStageChange(current, stage),
  }));
}

/** ¿Es un cambio válido? Solo si el mapa de transiciones (ALLOWED_STAGE_TRANSITIONS) lo permite. */
export function isValidStageChange(from: SaleStage, to: SaleStage): boolean {
  if (from === to) return false;
  return ALLOWED_STAGE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Texto del error cuando se intenta un cambio que el mapa no permite (no se muestra en pantalla). */
export function invalidStageChangeMessage(from: SaleStage, to: SaleStage): string {
  const label = (stage: SaleStage) => SALE_STAGE_LABELS[stage] ?? String(stage);
  return `Cambio de etapa no permitido: de "${label(from)}" (${from}) a "${label(to)}" (${to}).`;
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
 * siéndolo.
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

/** Franja verde que corresponde a un cambio de etapa ya hecho (`previousStage`: la etapa de la que venía). */
export function stageChangeNotice(newStage: SaleStage, result: StageChangeResult, previousStage?: SaleStage): string {
  if (previousStage === 'perdida') return STAGE_CHANGE_MESSAGES.reopened;
  if (newStage === 'perdida') return STAGE_CHANGE_MESSAGES.lost;
  if (newStage === 'ganada') {
    return result.contactBecameClient && result.contactName
      ? wonAndConvertedMessage(result.contactName)
      : STAGE_CHANGE_MESSAGES.won;
  }
  return STAGE_CHANGE_MESSAGES.changed;
}
