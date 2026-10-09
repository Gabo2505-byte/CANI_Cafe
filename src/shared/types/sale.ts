import type { Timestamp } from 'firebase/firestore';

// Etapas provisionales: las define Dylan.
export const SALE_STAGES = ['prospecto', 'contactado', 'propuesta', 'negociacion', 'ganada', 'perdida'] as const;
export type SaleStage = (typeof SALE_STAGES)[number];

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
  lastCommunicationAt: Timestamp | null;
}
