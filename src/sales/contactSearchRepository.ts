// HU-302: lectura de contactos activos para elegir el de una posible venta.
// Solo lectura sobre `contacts` (dominio de Gabriel): no se modifica nada ahí.
import { collection, doc, documentId, getDoc, getDocs, query, where, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '../shared/constants/collections';
import type { Contact } from '../shared/types';

/**
 * Todos los contactos activos. La búsqueda por "contiene", sin tildes y por nombre o correo se
 * hace en el cliente (searchContacts): Firestore solo sabe buscar por prefijo.
 * Si algún día hay miles de contactos activos, se reemplaza esta función sin tocar el componente.
 */
export async function listActiveContactsIn(db: Firestore): Promise<Contact[]> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.contacts), where('status', '==', 'activo')));
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Contact, 'id'>), id: d.id }));
}

/** Un contacto por id (HU-301: venta creada desde la ficha). null si no existe. */
export async function getContactForSaleIn(db: Firestore, id: string): Promise<Contact | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.contacts, id));
  return snap.exists() ? { ...(snap.data() as Omit<Contact, 'id'>), id: snap.id } : null;
}

/** Firestore acepta hasta 30 valores en una consulta "in". */
const IN_QUERY_LIMIT = 30;

/**
 * HU-305: nombre de cada contacto por id (activos o no), para mostrarlo en las tarjetas.
 * Las ventas guardan solo el id del contacto; el nombre se busca aquí.
 */
export async function getContactNamesIn(db: Firestore, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  const names = new Map<string, string>();
  for (let i = 0; i < unique.length; i += IN_QUERY_LIMIT) {
    const chunk = unique.slice(i, i + IN_QUERY_LIMIT);
    const snap = await getDocs(query(collection(db, COLLECTIONS.contacts), where(documentId(), 'in', chunk)));
    for (const d of snap.docs) names.set(d.id, d.get('fullName') as string);
  }
  return names;
}
