// Detalle de una posible venta ligado a la instancia de Firestore de la app (se mockea en las pruebas de pantallas).
import { db } from '../shared/firebase/config';
import type { SaleDetailData } from './saleDetail';
import { loadSaleDetailIn } from './saleDetailRepository';

export function loadSaleDetail(saleId: string): Promise<SaleDetailData | null> {
  return loadSaleDetailIn(db, saleId);
}
