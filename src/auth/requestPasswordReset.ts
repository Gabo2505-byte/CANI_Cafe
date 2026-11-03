import { auth, db } from '../shared/firebase/config';
import { requestPasswordResetIn, type RecoveryResult } from './passwordRecovery';

/** HU-106 con las instancias de la app. El enlace del correo lleva a este mismo sitio. */
export function requestPasswordReset(username: string): Promise<RecoveryResult> {
  return requestPasswordResetIn(auth, db, username, window.location.origin);
}
