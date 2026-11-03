import { auth, db } from '../shared/firebase/config';
import { saveNewPasswordIn, type SaveNewPasswordResult } from './newPassword';
import { checkResetLinkIn, type ResetLinkCheck, type ResetLinkParams } from './passwordResetLinks';

/** HU-107 con las instancias de la app. */
export function checkResetLink(link: ResetLinkParams): Promise<ResetLinkCheck> {
  return checkResetLinkIn(auth, db, link);
}

/** HU-108 con las instancias de la app (incluye marcar el enlace como usado, HU-107). */
export function saveNewPassword(link: ResetLinkParams, password: string): Promise<SaveNewPasswordResult> {
  return saveNewPasswordIn(auth, db, link, password);
}
