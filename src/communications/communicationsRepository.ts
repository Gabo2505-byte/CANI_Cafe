// Acceso a la colección `communications`. Recibe la instancia de Firestore (se prueba contra el emulador).
import {
  collection,
  doc,
  documentId,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  startAfter,
  serverTimestamp,
  Timestamp,
  where,
  type DocumentSnapshot,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '../shared/constants/collections';
import { isOpenSaleStage, type Communication, type SaleStage } from '../shared/types';
import type { NewCommunicationInput } from './communicationForm';

/** HU-212: la posible venta elegida ya no existe, es de otro contacto o ya está ganada o perdida. */
export class SaleNotOpenError extends Error {
  constructor() {
    super('sale-not-open');
    this.name = 'SaleNotOpenError';
  }
}

function isOpenSaleOf(snap: DocumentSnapshot, contactId: string): boolean {
  return snap.exists() && snap.get('contactId') === contactId && isOpenSaleStage(snap.get('stage') as SaleStage);
}

/**
 * HU-211: registra una comunicación del contacto, hecha por `userId` (el usuario con sesión).
 * Las reglas no permiten editarla ni eliminarla.
 *
 * HU-212: corresponde a una posible venta abierta (`saleId`) o a "Todas sus posibles ventas" (`saleId`
 * null o sin indicar, como lo que llega del formulario del sitio web). En la misma transacción se
 * actualiza `lastCommunicationAt` de esa venta, o de todas las abiertas del contacto. Nunca se retrocede:
 * si la venta ya tiene una comunicación más reciente, se queda con esa.
 * Devuelve el id de la comunicación.
 */
export async function createCommunicationIn(db: Firestore, input: NewCommunicationInput, userId: string): Promise<string> {
  const saleId = input.saleId ?? null;
  const date = Timestamp.fromDate(input.date);
  const salesRef = collection(db, COLLECTIONS.sales);

  // Ventas a actualizar. Para "Todas" se buscan las del contacto (las transacciones del SDK web no consultan).
  const saleIds = saleId
    ? [saleId]
    : (await getDocs(query(salesRef, where('contactId', '==', input.contactId))))
        .docs.filter((d) => isOpenSaleOf(d, input.contactId))
        .map((d) => d.id);

  const communicationRef = doc(collection(db, COLLECTIONS.communications));
  await runTransaction(db, async (tx) => {
    const sales = await Promise.all(saleIds.map((id) => tx.get(doc(salesRef, id))));
    if (saleId && !isOpenSaleOf(sales[0], input.contactId)) throw new SaleNotOpenError();

    tx.set(communicationRef, {
      contactId: input.contactId,
      saleId,
      appliesToAllSales: saleId === null,
      date,
      medium: input.medium,
      otherMedium: input.otherMedium,
      note: input.note,
      source: 'usuario',
      userId,
      createdAt: serverTimestamp(),
    });
    for (const sale of sales) {
      // Entre la consulta y la transacción pudo cerrarse: solo se tocan las que siguen abiertas.
      if (!isOpenSaleOf(sale, input.contactId)) continue;
      const current = sale.get('lastCommunicationAt') as Timestamp | null | undefined;
      if (!current || current.toMillis() < date.toMillis()) tx.update(sale.ref, { lastCommunicationAt: date });
    }
  });
  return communicationRef.id;
}

/** HU-213: comunicaciones por "página" del historial (la primera al abrir la pestaña y cada "Ver más"). */
export const COMMUNICATIONS_PAGE_SIZE = 10;

/** Cursor opaco: la última comunicación ya mostrada. */
export type CommunicationsCursor = DocumentSnapshot;

export interface CommunicationsPage {
  communications: Communication[];
  /** Para pedir las siguientes; null si ya no hay más. */
  nextCursor: CommunicationsCursor | null;
  /** Nombre de usuario de quien registró cada una (users.id → username). */
  userNames: Record<string, string>;
}

/**
 * HU-213: una página del historial de un contacto, de la más reciente a la más antigua
 * (por día y, el mismo día, por cuándo se registró). Trae solo `pageSize` documentos (+1 para saber si hay más).
 * Índice compuesto: contactId + date desc + createdAt desc (firestore.indexes.json).
 */
export async function listCommunicationsPageIn(
  db: Firestore,
  contactId: string,
  after: CommunicationsCursor | null,
  pageSize: number = COMMUNICATIONS_PAGE_SIZE,
): Promise<CommunicationsPage> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.communications),
      where('contactId', '==', contactId),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc'),
      ...(after ? [startAfter(after)] : []),
      limit(pageSize + 1),
    ),
  );
  const docs = snap.docs.slice(0, pageSize);
  const communications = docs.map((d) => ({ ...(d.data() as Omit<Communication, 'id'>), id: d.id }));
  const userNames = await getUserNamesIn(
    db,
    communications.map((c) => c.userId).filter((id): id is string => Boolean(id)),
  );
  return {
    communications,
    nextCursor: snap.docs.length > pageSize ? docs[docs.length - 1] : null,
    userNames,
  };
}

/** HU-213: total de comunicaciones del contacto (conteo en el servidor, para "Comunicaciones (N)"). */
export async function countCommunicationsIn(db: Firestore, contactId: string): Promise<number> {
  const snap = await getCountFromServer(query(collection(db, COLLECTIONS.communications), where('contactId', '==', contactId)));
  return snap.data().count;
}

/** Firestore acepta hasta 30 valores en un `in`. */
const IN_LIMIT = 30;

/** HU-213: nombre de usuario de cada id (para "Registrado por: …"). Los que no existan no aparecen. */
export async function getUserNamesIn(db: Firestore, ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids)];
  const names: Record<string, string> = {};
  for (let i = 0; i < unique.length; i += IN_LIMIT) {
    const chunk = unique.slice(i, i + IN_LIMIT);
    const snap = await getDocs(query(collection(db, COLLECTIONS.users), where(documentId(), 'in', chunk)));
    for (const d of snap.docs) names[d.id] = d.get('username') as string;
  }
  return names;
}
