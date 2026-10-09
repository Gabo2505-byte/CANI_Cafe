import type { ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import { useAuthUser } from './useAuthUser';

export function AuthProvider({ children }: { children: ReactNode }) {
  const state = useAuthUser();
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
