import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../shared/firebase/config';
import { usernameToAuthEmail } from './username';

export async function signInWithUsername(username: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, usernameToAuthEmail(username), password);
}
