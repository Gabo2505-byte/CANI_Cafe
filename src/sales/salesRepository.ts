// Lectura de `sales` para los formularios de posibles ventas.
import { collection, getDocs, query, where, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '../shared/constants/collections';
import { isOpenSaleStage, type Sale } from '../shared/types';

/**
 * HU-303: títulos de las posibles ventas abiertas de un contacto (todas menos ganadas y perdidas).
 * Al editar (HU-309) se excluye la propia venta con `excludeSaleId`.
 * Consulta solo por contactId (índice simple); las etapas se filtran aquí.
 */
export async function listOpenSaleTitlesIn(db: Firestore, contactId: string, excludeSaleId?: string): Promise<string[]> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.sales), where('contactId', '==', contactId)));
  return snap.docs
    .filter((d) => d.id !== excludeSaleId && isOpenSaleStage(d.get('stage') as Sale['stage']))
    .map((d) => d.get('title') as string);
}
