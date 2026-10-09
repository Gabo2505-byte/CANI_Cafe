import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../shared/firebase/config';
import { COLLECTIONS } from '../shared/constants/collections';
import type { User } from '../shared/types';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** Autenticado en Firebase Auth pero sin users/{uid} o con active == false. */
  | { status: 'inactive'; firebaseUser: FirebaseUser }
  | { status: 'active'; firebaseUser: FirebaseUser; profile: User };

async function loadProfile(firebaseUser: FirebaseUser): Promise<AuthState> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.users, firebaseUser.uid));
    const data = snap.data() as Omit<User, 'id'> | undefined;
    if (data?.active) {
      return { status: 'active', firebaseUser, profile: { id: snap.id, ...data } };
    }
  } catch (error) {
    // Las reglas niegan la lectura a usuarios inactivos o sin perfil.
    if ((error as { code?: string }).code !== 'permission-denied') throw error;
  }
  return { status: 'inactive', firebaseUser };
}

export function useAuthUser(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setState({ status: 'signedOut' });
        return;
      }
      setState({ status: 'loading' });
      loadProfile(firebaseUser).then((next) => {
        if (!cancelled) setState(next);
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return state;
}
