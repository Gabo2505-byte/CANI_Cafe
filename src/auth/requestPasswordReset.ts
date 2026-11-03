import { auth, db } from '../shared/firebase/config';
import { requestPasswordResetIn, type RecoveryResult } from './passwordRecovery';

/** HU-106 con las instancias de la app. */
export function requestPasswordReset(username: string): Promise<RecoveryResult> {
  return requestPasswordResetIn(auth, db, username);
}
