// HU-314 y HU-315: lectura de lo necesario para calcular los avisos. Solo lectura; no se guarda ningún aviso.
import { collection, documentId, getDocs, query, where, type Firestore } from 'firebase/firestore';
import { buildAlerts, type AlertContact, type SaleAlert } from './alerts';
import { COLLECTIONS } from '../shared/constants/collections';
import { OPEN_SALE_STAGES, type Sale } from '../shared/types';

/** Firestore acepta hasta 30 valores en una consulta "in". */
const IN_QUERY_LIMIT = 30;

/** Estado y nombre de cada contacto por id (activo o no). */
async function getAlertContactsIn(db: Firestore, ids: string[]): Promise<Map<string, AlertContact>> {
  const unique = [...new Set(ids)];
  const contacts = new Map<string, AlertContact>();
  for (let i = 0; i < unique.length; i += IN_QUERY_LIMIT) {
    const chunk = unique.slice(i, i + IN_QUERY_LIMIT);
    const snap = await getDocs(query(collection(db, COLLECTIONS.contacts), where(documentId(), 'in', chunk)));
    for (const d of snap.docs) contacts.set(d.id, { fullName: d.get('fullName') as string, status: d.get('status') as string });
  }
  return contacts;
}

/**
 * Avisos pendientes de las posibles ventas (seguimiento, HU-314, y falta de comunicación, HU-315), los más antiguos primero.
 * Lee las ventas abiertas y el estado de sus contactos; el aviso se calcula con `now`
 * (inyectable para las pruebas).
 */
export async function listAlertsIn(db: Firestore, now: Date = new Date()): Promise<SaleAlert[]> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.sales), where('stage', 'in', [...OPEN_SALE_STAGES])));
  const sales = snap.docs.map((d) => ({ ...(d.data() as Omit<Sale, 'id'>), id: d.id }));
  const contacts = await getAlertContactsIn(
    db,
    sales.map((s) => s.contactId),
  );
  return buildAlerts(sales, contacts, now);
}
