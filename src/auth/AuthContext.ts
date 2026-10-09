import { createContext, useContext } from 'react';
import type { AuthState } from './useAuthUser';

// Separado de AuthProvider para que las pantallas no dependan de Firebase (y se puedan probar).
export const AuthContext = createContext<AuthState>({ status: 'loading' });

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
