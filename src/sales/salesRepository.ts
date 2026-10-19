// Lectura y escritura de `sales` para los formularios de posibles ventas.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  Timestamp,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { closedSalesCutoff } from './board';
import { isValidStageChange } from './stageChange';
import { COLLECTIONS } from '../shared/constants/collections';
import {
  isOpenSaleStage,
  OPEN_SALE_STAGES,
  type OpenSaleStage,
  type Sale,
  type SaleProduct,
  type SaleStage,
  type StageHistory,
} from '../shared/types';

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

/**
 * HU-305: las posibles ventas del tablero. Todas las abiertas, más las ganadas y perdidas que
 * llegaron a esa etapa en los últimos 30 días (por `stageChangedAt`). Son dos consultas; la
 * segunda necesita el índice (stage, stageChangedAt) de firestore.indexes.json.
 */
export async function listBoardSalesIn(db: Firestore, now: Date = new Date()): Promise<Sale[]> {
  const sales = collection(db, COLLECTIONS.sales);
  const [open, closed] = await Promise.all([
    getDocs(query(sales, where('stage', 'in', [...OPEN_SALE_STAGES]))),
    getDocs(
      query(
        sales,
        where('stage', 'in', ['ganada', 'perdida']),
        where('stageChangedAt', '>=', Timestamp.fromDate(closedSalesCutoff(now))),
      ),
    ),
  ]);
  return [...open.docs, ...closed.docs].map((d) => ({ ...(d.data() as Omit<Sale, 'id'>), id: d.id }));
}

export interface SaleUpdateInput {
  title: string;
  estimatedAmount: number;
  nextFollowUpAt: Date | null;
  notes: string;
  products: { productId: string; quantity: number }[];
}

/**
 * HU-309: guarda los cambios de una posible venta (título, monto, seguimiento, notas y productos) en una
 * sola escritura atómica. La etapa, el historial y la última comunicación no se tocan.
 * Una venta ganada es definitiva: aunque se pidan otros cambios, solo se guardan las notas.
 * Los productos se reemplazan: se borran los que ya no están y se guardan los demás con su cantidad.
 */
export async function updateSaleIn(db: Firestore, saleId: string, input: SaleUpdateInput): Promise<void> {
  const saleRef = doc(db, COLLECTIONS.sales, saleId);
  const [saleSnap, existing] = await Promise.all([
    getDoc(saleRef),
    getDocs(query(collection(db, COLLECTIONS.saleProducts), where('saleId', '==', saleId))),
  ]);
  if (!saleSnap.exists()) throw new Error(`La posible venta ${saleId} no existe.`);

  const batch = writeBatch(db);
  if (saleSnap.get('stage') === 'ganada') {
    batch.update(saleRef, { notes: input.notes });
    await batch.commit();
    return;
  }

  batch.update(saleRef, {
    title: input.title.trim(),
    estimatedAmount: input.estimatedAmount,
    nextFollowUpAt: input.nextFollowUpAt ? Timestamp.fromDate(input.nextFollowUpAt) : null,
    notes: input.notes,
  });
  const wanted = new Map(input.products.map((p) => [`${saleId}_${p.productId}`, p]));
  for (const d of existing.docs) if (!wanted.has(d.id)) batch.delete(d.ref);
  for (const [id, { productId, quantity }] of wanted) {
    const row: SaleProduct = { saleId, productId, quantity };
    batch.set(doc(db, COLLECTIONS.saleProducts, id), row);
  }
  await batch.commit();
}

/** HU-310: la etapa de la posible venta ya no es la que se esperaba (alguien la cambió entre tanto). */
export class SaleStageConflictError extends Error {
  constructor() {
    super('sale-stage-conflict');
    this.name = 'SaleStageConflictError';
  }
}

/**
 * HU-310: mueve una posible venta abierta a otra etapa abierta. En una sola transacción actualiza
 * `sales.stage` y `sales.stageChangedAt` y agrega un registro a `stageHistory` (los anteriores no se tocan).
 * Solo se toca esa venta: las demás del contacto no cambian. Si la etapa guardada ya no es `expectedStage`
 * (otra pestaña la cambió), no escribe nada y lanza SaleStageConflictError.
 */
export async function changeSaleStageIn(db: Firestore, saleId: string, expectedStage: SaleStage, newStage: SaleStage): Promise<void> {
  if (!isValidStageChange(expectedStage, newStage)) throw new Error(`Cambio de etapa no permitido: ${expectedStage} → ${newStage}.`);
  const saleRef = doc(db, COLLECTIONS.sales, saleId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(saleRef);
    if (!snap.exists()) throw new Error(`La posible venta ${saleId} no existe.`);
    if (snap.get('stage') !== expectedStage) throw new SaleStageConflictError();

    const now = Timestamp.now();
    const entry: StageHistory = { saleId, previousStage: expectedStage, newStage, changedAt: now, lossReason: null };
    tx.update(saleRef, { stage: newStage, stageChangedAt: now });
    tx.set(doc(collection(db, COLLECTIONS.stageHistory)), entry);
  });
}
