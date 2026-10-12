import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { signOutUser } from './signOutUser';

interface SessionActions {
  /** true desde que la persona pidió cerrar sesión hasta que el ingreso muestra el aviso. */
  signedOutByUser: boolean;
  /** HU-104: cierra la sesión. Si falla, lanza el error y la sesión sigue abierta. */
  signOut: () => Promise<void>;
  /** El ingreso ya mostró el aviso de cierre: no repetirlo (ej. al usar "Atrás"). */
  acknowledgeSignOut: () => void;
}

const SessionContext = createContext<SessionActions | null>(null);

/**
 * Marca la salida como voluntaria ANTES de llamar a signOut. Así, cuando onAuthStateChanged
 * deja la sesión en "signedOut", ProtectedRoute sabe que debe llevar al ingreso con el aviso
 * (y no como si la sesión hubiera expirado).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [signedOutByUser, setSignedOutByUser] = useState(false);

  // Al iniciar sesión de nuevo, el aviso anterior ya no aplica.
  useEffect(() => {
    if (auth.status === 'active') setSignedOutByUser(false);
  }, [auth.status]);

  const signOut = useCallback(async () => {
    setSignedOutByUser(true);
    try {
      await signOutUser();
    } catch (error) {
      setSignedOutByUser(false);
      throw error;
    }
  }, []);

  const acknowledgeSignOut = useCallback(() => setSignedOutByUser(false), []);

  const value = useMemo(
    () => ({ signedOutByUser, signOut, acknowledgeSignOut }),
    [signedOutByUser, signOut, acknowledgeSignOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionActions {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession debe usarse dentro de <SessionProvider>.');
  return session;
}
