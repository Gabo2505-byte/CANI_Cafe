// HU-504: etiquetas del formulario ligadas a la instancia de Firestore de la app. Aparte de contactsApi porque la barra
// superior lo usa en todas las pantallas internas (se mockea en tests/setup.ts).
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../shared/firebase/config';
import { clearFormBadgeIn, listenFormBadgeCountIn } from './contactsRepository';

export function listenFormBadgeCount(onCount: (count: number) => void, onError?: (error: unknown) => void): Unsubscribe {
  return listenFormBadgeCountIn(db, onCount, onError);
}

export function clearFormBadge(contactId: string): Promise<void> {
  return clearFormBadgeIn(db, contactId);
}
