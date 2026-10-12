import { signOut } from 'firebase/auth';
import { auth } from '../shared/firebase/config';

/**
 * Cierra la sesión en Firebase Auth. Al hacerlo, onAuthStateChanged deja el estado en
 * "signedOut" y se descarta el perfil cargado (ver useAuthUser).
 * Firestore usa caché solo en memoria (sin persistencia offline), así que no queda nada en disco.
 */
export function signOutUser(): Promise<void> {
  return signOut(auth);
}
