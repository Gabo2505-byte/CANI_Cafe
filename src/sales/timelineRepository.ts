// Bitácora del contacto (pantalla "Avisos"): lecturas por contacto. Solo lectura; no se escribe nada.
// Recibe la instancia de Firestore (se prueba contra el emulador).
import { collection, getDocs, limit, orderBy, query, where, type Firestore } from 'firebase/firestore';
import { listAllContactsIn } from '../contacts/contactsRepository';
import { COLLECTIONS } from '../shared/constants/collections';
import type { Communication, Contact, Sale, StageHistory } from '../shared/types';
import { buildTimeline, TIMELINE_MAX_EVENTS, type Timeline } from './timeline';

/** Firestore acepta hasta 30 valores en una consulta "in". */
const IN_QUERY_LIMIT = 30;

/**
 * Contactos para el buscador de la bitácora: todos (activos e inactivos), en orden alfabético. Es la misma lectura
 * de la lista de contactos (HU-204/HU-205); la búsqueda por nombre, correo o teléfono se hace en el navegador.
 */
export function listTimelineContactsIn(db: Firestore): Promise<Contact[]> {
  return listAllContactsIn(db);
}

/**
 * Línea de tiempo de un contacto, del evento más reciente al más antiguo:
 * 1. sus comunicaciones (contactId ==, date desc, createdAt desc; el mismo índice del historial de la ficha, HU-213),
 *    como máximo el tope + 1 (para saber si hay más);
 * 2. sus oportunidades (contactId ==, sin orden: no necesita índice compuesto), para los títulos;
 * 3. el historial de etapas de esas oportunidades, en lotes de 30 ids (saleId in, changedAt desc; el índice del
 *    detalle de la venta, HU-308), cada lote con el mismo tope + 1.
 * Las consultas 1 y 2 van en paralelo, y los lotes de la 3 también.
 */
export async function loadContactTimelineIn(db: Firestore, contactId: string, max: number = TIMELINE_MAX_EVENTS): Promise<Timeline> {
  const [communicationsSnap, salesSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, COLLECTIONS.communications),
        where('contactId', '==', contactId),
        orderBy('date', 'desc'),
        orderBy('createdAt', 'desc'),
        limit(max + 1),
      ),
    ),
    getDocs(query(collection(db, COLLECTIONS.sales), where('contactId', '==', contactId))),
  ]);
  const communications = communicationsSnap.docs
    .slice(0, max)
    .map((d) => ({ ...(d.data() as Omit<Communication, 'id'>), id: d.id }));
  const sales = salesSnap.docs.map((d) => ({ ...(d.data() as Omit<Sale, 'id'>), id: d.id }));

  const saleIds = sales.map((sale) => sale.id);
  const chunks: string[][] = [];
  for (let i = 0; i < saleIds.length; i += IN_QUERY_LIMIT) chunks.push(saleIds.slice(i, i + IN_QUERY_LIMIT));
  const historySnaps = await Promise.all(
    chunks.map((chunk) =>
      getDocs(
        query(collection(db, COLLECTIONS.stageHistory), where('saleId', 'in', chunk), orderBy('changedAt', 'desc'), limit(max + 1)),
      ),
    ),
  );
  const history = historySnaps.flatMap((snap) =>
    snap.docs.slice(0, max).map((d) => ({ ...(d.data() as StageHistory), id: d.id })),
  );

  const truncated = communicationsSnap.size > max || historySnaps.some((snap) => snap.size > max);
  return buildTimeline({ communications, sales, history, truncated }, max);
}
