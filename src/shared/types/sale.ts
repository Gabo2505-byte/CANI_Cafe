import type { Timestamp } from 'firebase/firestore';

export const SALE_STAGES = [
  'nuevo_interesado',
  'contactado',
  'cotizacion_enviada',
  'en_negociacion',
  'ganada',
  'perdida',
] as const;
export type SaleStage = (typeof SALE_STAGES)[number];

/** Texto que se muestra en pantalla para cada etapa (tablero, formularios, historial). */
export const SALE_STAGE_LABELS: Record<SaleStage, string> = {
  nuevo_interesado: 'Nuevo interesado',
  contactado: 'Contactado',
  cotizacion_enviada: 'Precio o cotización enviada',
  en_negociacion: 'En negociación',
  ganada: 'Venta ganada',
  perdida: 'Venta perdida',
};

/** Las cuatro etapas abiertas: las únicas que se pueden elegir al crear o al reabrir una venta. */
export const OPEN_SALE_STAGES = ['nuevo_interesado', 'contactado', 'cotizacion_enviada', 'en_negociacion'] as const;
export type OpenSaleStage = (typeof OPEN_SALE_STAGES)[number];

export function isOpenSaleStage(stage: SaleStage): stage is OpenSaleStage {
  return (OPEN_SALE_STAGES as readonly SaleStage[]).includes(stage);
}

/** Colección `sales` (dominio de Dylan). */
export interface Sale {
  id: string;
  /** → contacts.id */
  contactId: string;
  title: string;
  stage: SaleStage;
  /** Monto estimado en colones (CRC). */
  estimatedAmount: number;
  nextFollowUpAt: Timestamp | null;
  notes: string;
  createdAt: Timestamp;
  /**
   * Cuándo llegó la venta a su etapa actual. Al crearla es igual a `createdAt`; cada cambio de
   * etapa lo actualiza en la misma transacción que escribe `stageHistory`. Sirve para mostrar solo
   * las ganadas/perdidas de los últimos 30 días (HU-305) sin consultar el historial.
   */
  stageChangedAt: Timestamp;
  lastCommunicationAt: Timestamp | null;
}
