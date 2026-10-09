import { signInWithEmailAndPassword, type Auth } from 'firebase/auth';
import { usernameToAuthEmail } from './username';

/** Inicia sesión con usuario y contraseña sobre una instancia de Auth dada (sin depender de config). */
export async function signInWithUsernameOn(auth: Auth, username: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, usernameToAuthEmail(username), password);
}
