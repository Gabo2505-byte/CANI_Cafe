// Índice usuario → cuenta (colección `usernames`). Recibe la instancia de Firestore (se prueba contra el emulador).
import { doc, getDoc, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '../shared/constants/collections';
import type { UsernameEntry } from '../shared/types';
import { normalizeUsername } from './username';

/**
 * Busca la cuenta de un usuario. null si no existe.
 * Es una lectura por id exacto (get), lo único que las reglas permiten sin sesión: no se pueden listar usuarios.
 */
export async function findAccountByUsernameIn(db: Firestore, username: string): Promise<UsernameEntry | null> {
  const key = normalizeUsername(username);
  // Un id de documento no puede estar vacío ni contener "/" (y "." / ".." no son ids válidos).
  if (key === '' || key.includes('/') || key === '.' || key === '..') return null;
  const snap = await getDoc(doc(db, COLLECTIONS.usernames, key));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<UsernameEntry>;
  return typeof data.uid === 'string' && typeof data.email === 'string' ? { uid: data.uid, email: data.email } : null;
}
