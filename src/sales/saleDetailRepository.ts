// HU-308: lectura de una posible venta con sus productos, su contacto y su historial de etapas.
import { collection, doc, getDoc, getDocs, orderBy, query, where, type Firestore } from 'firebase/firestore';
import { listProductsIn } from '../products/productsRepository';
import { COLLECTIONS } from '../shared/constants/collections';
import type { Sale, SaleProduct, StageHistory } from '../shared/types';
import { getContactNamesIn } from './contactSearchRepository';
import type { DetailProduct, SaleDetailData } from './saleDetail';

/** Nombre que se muestra si un producto de una venta ya no está en el catálogo. */
const UNKNOWN_PRODUCT = { name: 'Producto no disponible', presentation: '—' } as const;

/**
 * Todo lo que muestra el detalle. null si la venta no existe.
 * Los productos se muestran aunque estén inactivos (una venta antigua puede incluirlos).
 * El historial viene del más reciente al más antiguo (índice saleId + changedAt de firestore.indexes.json).
 */
export async function loadSaleDetailIn(db: Firestore, saleId: string): Promise<SaleDetailData | null> {
  const saleSnap = await getDoc(doc(db, COLLECTIONS.sales, saleId));
  if (!saleSnap.exists()) return null;
  const sale: Sale = { ...(saleSnap.data() as Omit<Sale, 'id'>), id: saleSnap.id };

  const [names, saleProducts, catalog, history] = await Promise.all([
    getContactNamesIn(db, [sale.contactId]),
    getDocs(query(collection(db, COLLECTIONS.saleProducts), where('saleId', '==', saleId))),
    listProductsIn(db),
    getDocs(query(collection(db, COLLECTIONS.stageHistory), where('saleId', '==', saleId), orderBy('changedAt', 'desc'))),
  ]);

  const byId = new Map(catalog.map((product) => [product.id, product]));
  const products: DetailProduct[] = saleProducts.docs
    .map((d) => d.data() as SaleProduct)
    .map(({ productId, quantity }) => {
      const product = byId.get(productId);
      return {
        productId,
        name: product?.name ?? UNKNOWN_PRODUCT.name,
        presentation: product?.presentation ?? UNKNOWN_PRODUCT.presentation,
        quantity,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es') || a.presentation.localeCompare(b.presentation, 'es'));

  return {
    sale,
    contactName: names.get(sale.contactId) ?? null,
    products,
    history: history.docs.map((d) => d.data() as StageHistory),
  };
}
