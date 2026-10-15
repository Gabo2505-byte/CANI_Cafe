// Lectura y escritura de `sales` para los formularios de posibles ventas.
import { collection, doc, getDocs, query, Timestamp, where, writeBatch, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '../shared/constants/collections';
import { isOpenSaleStage, type OpenSaleStage, type Sale, type SaleProduct, type StageHistory } from '../shared/types';

/**
 * HU-303: títulos de las posibles ventas abiertas de un contacto (todas menos ganadas y perdidas).
 * Al editar (HU-309) se excluye la propia venta con `excludeSaleId`.
 * Consulta solo por contactId (índice simple); las etapas se filtran aquí.
 */
export async function listOpenSaleTitlesIn(db: Firestore, contactId: string, excludeSaleId?: string): Promise<string[]> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.sales), where('contactId', '==', contactId)));
  return snap.docs
    .filter((d) => d.id !== excludeSaleId && isOpenSaleStage(d.get('stage') as Sale['stage']))
    .map((d) => d.get('title') as string);
}

export interface NewSaleInput {
  contactId: string;
  title: string;
  stage: OpenSaleStage;
  estimatedAmount: number;
  nextFollowUpAt: Date | null;
  notes: string;
  products: { productId: string; quantity: number }[];
}

/**
 * HU-301: crea la posible venta, sus productos (`saleProducts`, id `${saleId}_${productId}`) y el
 * primer registro de `stageHistory`, todo en una sola escritura atómica: o se guarda todo o nada.
 * `createdAt`, `stageChangedAt` y el primer `changedAt` son el mismo instante.
 */
export async function createSaleIn(db: Firestore, input: NewSaleInput): Promise<string> {
  const now = Timestamp.now();
  const saleRef = doc(collection(db, COLLECTIONS.sales));
  const batch = writeBatch(db);

  const sale: Omit<Sale, 'id'> = {
    contactId: input.contactId,
    title: input.title.trim(),
    stage: input.stage,
    estimatedAmount: input.estimatedAmount,
    nextFollowUpAt: input.nextFollowUpAt ? Timestamp.fromDate(input.nextFollowUpAt) : null,
    notes: input.notes,
    createdAt: now,
    stageChangedAt: now,
    lastCommunicationAt: null,
  };
  batch.set(saleRef, sale);

  for (const { productId, quantity } of input.products) {
    const row: SaleProduct = { saleId: saleRef.id, productId, quantity };
    batch.set(doc(db, COLLECTIONS.saleProducts, `${saleRef.id}_${productId}`), row);
  }

  const first: StageHistory = {
    saleId: saleRef.id,
    previousStage: null,
    newStage: input.stage,
    changedAt: now,
    lossReason: null,
  };
  batch.set(doc(collection(db, COLLECTIONS.stageHistory)), first);

  await batch.commit();
  return saleRef.id;
}
