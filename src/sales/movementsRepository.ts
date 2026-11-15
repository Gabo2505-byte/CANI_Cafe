// Tabla de movimientos: lectura paginada de `stageHistory` (todas las ventas) con sus ventas y contactos en lotes.
// Solo lectura. Lecturas de Firestore por página (se cobra un documento leído por cada documento devuelto y, si una
// consulta no devuelve nada, una lectura mínima):
//   - stageHistory: hasta MOVEMENTS_PAGE_SIZE + 1 documentos (el extra solo dice si hay otra página).
//   - sales: una consulta "in" por cada 30 ventas que aún no estén en la caché (0 si todas lo están).
//   - contacts: una consulta "in" por cada 30 contactos que aún no estén en la caché (0 si todos lo están).
// Peor caso con 25 por página: 26 + 25 + 25 = 76 lecturas; las páginas siguientes no vuelven a leer ventas ni contactos ya vistos.
import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentSnapshot,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '../shared/constants/collections';
import type { Sale, StageHistory } from '../shared/types';
import { getContactNamesIn } from './contactSearchRepository';
import { buildMovementRows, MOVEMENTS_PAGE_SIZE, type MovementRow, type StageHistoryEntry } from './movements';

/** Cursor de la página siguiente: el último documento leído (startAfter desempata por id si dos fechas coinciden). */
export type MovementsCursor = DocumentSnapshot;

export interface StageHistoryPage {
  entries: StageHistoryEntry[];
  nextCursor: MovementsCursor | null;
}

/**
 * Una página de `stageHistory` de todas las ventas, del cambio más reciente al más antiguo. Ordena por un solo campo,
 * así que usa el índice simple automático de `changedAt` (no necesita índice compuesto).
 */
export async function listStageHistoryPageIn(
  db: Firestore,
  after: MovementsCursor | null,
  pageSize: number = MOVEMENTS_PAGE_SIZE,
): Promise<StageHistoryPage> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.stageHistory), orderBy('changedAt', 'desc'), ...(after ? [startAfter(after)] : []), limit(pageSize + 1)),
  );
  const docs = snap.docs.slice(0, pageSize);
  return {
    entries: docs.map((d) => ({ ...(d.data() as StageHistory), id: d.id })),
    nextCursor: snap.docs.length > pageSize ? docs[docs.length - 1] : null,
  };
}

/** Firestore acepta hasta 30 valores en una consulta "in". */
const IN_QUERY_LIMIT = 30;

/** Título y contacto de cada venta por id, en lotes de 30. Las que no existen no aparecen en el resultado. */
export async function getSaleSummariesIn(db: Firestore, ids: string[]): Promise<Map<string, Pick<Sale, 'title' | 'contactId'>>> {
  const unique = [...new Set(ids)];
  const sales = new Map<string, Pick<Sale, 'title' | 'contactId'>>();
  for (let i = 0; i < unique.length; i += IN_QUERY_LIMIT) {
    const chunk = unique.slice(i, i + IN_QUERY_LIMIT);
    const snap = await getDocs(query(collection(db, COLLECTIONS.sales), where(documentId(), 'in', chunk)));
    for (const d of snap.docs) sales.set(d.id, { title: d.get('title') as string, contactId: d.get('contactId') as string });
  }
  return sales;
}

export interface MovementsPage {
  rows: MovementRow[];
  nextCursor: MovementsCursor | null;
}

export interface MovementsLoader {
  loadPage(after: MovementsCursor | null): Promise<MovementsPage>;
}

/**
 * Cargador con caché en memoria: cada venta y cada contacto se lee una sola vez mientras la pantalla está abierta
 * (también se recuerda que una venta o un contacto no existe, para no volver a buscarlo).
 */
export function createMovementsLoaderIn(db: Firestore, pageSize: number = MOVEMENTS_PAGE_SIZE): MovementsLoader {
  const sales = new Map<string, Pick<Sale, 'title' | 'contactId'> | null>();
  const contactNames = new Map<string, string | null>();

  return {
    async loadPage(after) {
      const page = await listStageHistoryPageIn(db, after, pageSize);

      const missingSales = [...new Set(page.entries.map((e) => e.saleId))].filter((id) => !sales.has(id));
      if (missingSales.length > 0) {
        const found = await getSaleSummariesIn(db, missingSales);
        for (const id of missingSales) sales.set(id, found.get(id) ?? null);
      }

      const missingContacts = [
        ...new Set(page.entries.map((e) => sales.get(e.saleId)?.contactId).filter((id): id is string => Boolean(id))),
      ].filter((id) => !contactNames.has(id));
      if (missingContacts.length > 0) {
        const found = await getContactNamesIn(db, missingContacts);
        for (const id of missingContacts) contactNames.set(id, found.get(id) ?? null);
      }

      return { rows: buildMovementRows(page.entries, sales, contactNames), nextCursor: page.nextCursor };
    },
  };
}
