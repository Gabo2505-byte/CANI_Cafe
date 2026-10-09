import type { Timestamp } from 'firebase/firestore';
import type { SaleStage } from './sale';

/** Colección `stageHistory` (dominio de Dylan). */
export interface StageHistory {
  /** → sales.id */
  saleId: string;
  /** null en el primer registro de la venta. */
  previousStage: SaleStage | null;
  newStage: SaleStage;
  changedAt: Timestamp;
  /** Solo cuando newStage === 'perdida'. */
  lossReason: string | null;
}
