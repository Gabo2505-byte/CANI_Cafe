import { auth, db } from '../shared/firebase/config';
import { checkResetLinkIn, markResetLinkUsedIn, type ResetLinkCheck, type ResetLinkParams } from './passwordResetLinks';

/** HU-107 con las instancias de la app. */
export function checkResetLink(link: ResetLinkParams): Promise<ResetLinkCheck> {
  return checkResetLinkIn(auth, db, link);
}

/** HU-107 con las instancias de la app. */
export function markResetLinkUsed(link: Pick<ResetLinkParams, 'username' | 'rid'>): Promise<void> {
  return markResetLinkUsedIn(db, link);
}
