import { signInWithEmailAndPassword, type Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { findAccountByUsernameIn } from './usernameDirectory';

/** Error con el mismo código que usa Firebase Auth, para que loginErrorFromAuth lo traduzca igual. */
export class UserNotFoundError extends Error {
  readonly code = 'auth/user-not-found';
  constructor() {
    super('El usuario no existe.');
  }
}

/**
 * Inicia sesión con usuario y contraseña sobre instancias dadas de Auth y Firestore (sin depender de config).
 * HU-102: si el usuario no está en el índice se responde "no existe" sin consultar a Auth; así el mensaje es correcto
 * aunque el proyecto tenga activada la protección contra la enumeración de correos.
 */
export async function signInWithUsernameOn(auth: Auth, db: Firestore, username: string, password: string): Promise<void> {
  const account = await findAccountByUsernameIn(db, username);
  if (!account) throw new UserNotFoundError();
  await signInWithEmailAndPassword(auth, account.email, password);
}
