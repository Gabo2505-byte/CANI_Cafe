import { auth } from '../shared/firebase/config';
import { signInWithUsernameOn } from './signInWithUsernameOn';

export function signInWithUsername(username: string, password: string): Promise<void> {
  return signInWithUsernameOn(auth, username, password);
}
