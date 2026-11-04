// HU-502 y HU-503: procesamiento ligado a la instancia de Firestore de la app (se mockea en las pruebas de pantallas,
// ver tests/setup.ts).
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../shared/firebase/config';
import { listenPendingRequestsIn, processRequestIn, type ProcessResult } from './formRequestsRepository';

export function listenPendingFormRequests(onPending: (ids: string[]) => void, onError?: (error: unknown) => void): Unsubscribe {
  return listenPendingRequestsIn(db, onPending, onError);
}

export function processFormRequest(requestId: string, uid: string): Promise<ProcessResult> {
  return processRequestIn(db, requestId, uid);
}
