// HU-207: registros de un contacto para las pestañas de su ficha. Recibe la instancia de Firestore
// (se prueba contra el emulador).
import { collection, getDocs, query, where, type Firestore } from 'firebase/firestore';
import { listProductsIn } from '../products/productsRepository';
import { COLLECTIONS } from '../shared/constants/collections';
import { countCommunicationsIn, listCommunicationsPageIn } from '../communications/communicationsRepository';
import type { Sale, SaleProduct } from '../shared/types';
import { interestProducts, sortSales, type ContactRecords } from './contactDetail';

/** Firestore acepta hasta 30 valores en un `in`. */
const IN_LIMIT = 30;

/**
 * Comunicaciones (HU-213: la primera página y el total), posibles ventas y productos de interés del contacto.
 * Ventas y productos usan solo igualdad por `contactId` / `in` por `saleId`; el orden se hace aquí.
 */
export async function loadContactRecordsIn(db: Firestore, contactId: string): Promise<ContactRecords> {
  const [firstPage, communicationsTotal, salesSnap] = await Promise.all([
    listCommunicationsPageIn(db, contactId, null),
    countCommunicationsIn(db, contactId),
    getDocs(query(collection(db, COLLECTIONS.sales), where('contactId', '==', contactId))),
  ]);
  const sales = salesSnap.docs.map((d) => ({ ...(d.data() as Omit<Sale, 'id'>), id: d.id }));

  const saleIds = sales.map((sale) => sale.id);
  const chunks: string[][] = [];
  for (let i = 0; i < saleIds.length; i += IN_LIMIT) chunks.push(saleIds.slice(i, i + IN_LIMIT));

  const [saleProductSnaps, catalog] = await Promise.all([
    Promise.all(chunks.map((ids) => getDocs(query(collection(db, COLLECTIONS.saleProducts), where('saleId', 'in', ids))))),
    saleIds.length > 0 ? listProductsIn(db) : Promise.resolve([]),
  ]);
  const saleProducts = saleProductSnaps.flatMap((snap) => snap.docs.map((d) => d.data() as SaleProduct));

  return {
    communications: firstPage.communications,
    communicationsTotal,
    communicationsCursor: firstPage.nextCursor,
    userNames: firstPage.userNames,
    sales: sortSales(sales),
    products: interestProducts(saleProducts, catalog),
  };
}
