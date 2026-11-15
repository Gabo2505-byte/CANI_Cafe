// Tabla de movimientos ligada a la instancia de Firestore de la app (se mockea en las pruebas de pantallas).
import { db } from '../shared/firebase/config';
import { createMovementsLoaderIn, type MovementsLoader } from './movementsRepository';

export function createMovementsLoader(): MovementsLoader {
  return createMovementsLoaderIn(db);
}
