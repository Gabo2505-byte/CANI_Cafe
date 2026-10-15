// HU-302: lectura de contactos activos para elegir el de una posible venta.
// Solo lectura sobre `contacts` (dominio de Gabriel): no se modifica nada ahí.
import { collection, getDocs, query, where, type Firestore } from 'firebase/firestore';
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
