// Avisos ligados a la instancia de Firestore de la app (se mockea en las pruebas de pantallas).
import { db } from '../shared/firebase/config';
import type { SaleAlert } from './alerts';
import { listAlertsIn } from './alertsRepository';

export function listAlerts(now?: Date): Promise<SaleAlert[]> {
  return listAlertsIn(db, now);
}
