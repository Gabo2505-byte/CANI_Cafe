// HU-207: registros de un contacto para las pestañas de su ficha. Recibe la instancia de Firestore
// (se prueba contra el emulador).
import { collection, doc, getDoc, getDocs, query, where, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '../shared/constants/collections';
import { countCommunicationsIn, listCommunicationsPageIn } from '../communications/communicationsRepository';
import type { Contact, Product, Sale } from '../shared/types';
import { interestProducts, sortSales, type ContactRecords } from './contactDetail';

/**
 * Comunicaciones (HU-213: la primera página y el total), posibles ventas (HU-208) y productos de interés (HU-209)
 * del contacto. Las ventas usan solo igualdad por `contactId`; el orden se hace aquí.
 * HU-209: los productos de interés son los del último formulario (`interests` del contacto). Solo se leen los
 * productos indicados, no todo el catálogo.
 */
export async function loadContactRecordsIn(db: Firestore, contactId: string): Promise<ContactRecords> {
  const [firstPage, communicationsTotal, salesSnap, contactSnap] = await Promise.all([
    listCommunicationsPageIn(db, contactId, null),
    countCommunicationsIn(db, contactId),
    getDocs(query(collection(db, COLLECTIONS.sales), where('contactId', '==', contactId))),
    getDoc(doc(db, COLLECTIONS.contacts, contactId)),
  ]);
  const sales = salesSnap.docs.map((d) => ({ ...(d.data() as Omit<Sale, 'id'>), id: d.id }));

  const contact = contactSnap.exists() ? (contactSnap.data() as Omit<Contact, 'id'>) : null;
  const interests = contact?.interests ?? [];
  const productIds = [...new Set(interests.map((interest) => interest.productId))];
  const productSnaps = await Promise.all(productIds.map((id) => getDoc(doc(db, COLLECTIONS.products, id))));
  const catalog = productSnaps
    .filter((snap) => snap.exists())
    .map((snap) => ({ ...(snap.data() as Omit<Product, 'id'>), id: snap.id }));

  return {
    communications: firstPage.communications,
    communicationsTotal,
    communicationsCursor: firstPage.nextCursor,
    userNames: firstPage.userNames,
    sales: sortSales(sales),
    products: interestProducts(interests, catalog),
    productsUpdatedAt: contact?.interestsUpdatedAt ?? null,
  };
}
