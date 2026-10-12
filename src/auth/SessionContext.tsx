import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { readStoredSignOutReason, storeSignOutReason, type SignOutReason } from './inactivity';
import { signOutUser } from './signOutUser';
import { useInactivityTimeout } from './useInactivityTimeout';

interface SessionActions {
  /**
   * Por qué se cerró la sesión, hasta que el ingreso muestra el aviso:
   * 'user' (HU-104, botón "Cerrar sesión") o 'inactivity' (HU-105, 30 min sin actividad).
   */
  signOutReason: SignOutReason | null;
  /** HU-104: cierra la sesión. Si falla, lanza el error y la sesión sigue abierta. */
  signOut: () => Promise<void>;
  /** El ingreso ya mostró el aviso: no repetirlo (ej. al usar "Atrás" o recargar). */
  acknowledgeSignOut: () => void;
}

const SessionContext = createContext<SessionActions | null>(null);

/**
 * Marca el motivo de salida ANTES de llamar a signOut. Así, cuando onAuthStateChanged deja la
 * sesión en "signedOut", ProtectedRoute sabe qué aviso mostrar en el ingreso.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [reason, setReason] = useState<SignOutReason | null>(null);

  // Al iniciar sesión de nuevo, el aviso anterior ya no aplica.
  useEffect(() => {
    if (auth.status === 'active') {
      setReason(null);
      storeSignOutReason(null);
    }
  }, [auth.status]);

  const signOut = useCallback(async () => {
    setReason('user');
    try {
      await signOutUser();
    } catch (error) {
      setReason(null);
      throw error;
    }
  }, []);

  // HU-105: a los 30 minutos sin clic ni teclado, la sesión se cierra sola.
  const signOutForInactivity = useCallback(() => {
    setReason('inactivity');
    storeSignOutReason('inactivity');
    signOutUser().catch(() => {
      // Si falla, la próxima revisión lo vuelve a intentar.
      setReason(null);
      storeSignOutReason(null);
    });
  }, []);
  useInactivityTimeout(auth.status === 'active', signOutForInactivity);

  const acknowledgeSignOut = useCallback(() => {
    setReason(null);
    storeSignOutReason(null);
  }, []);

  // El motivo "inactividad" también puede venir de otra pestaña o de antes de recargar.
  const signOutReason = auth.status === 'active' ? null : (reason ?? readStoredSignOutReason());

  const value = useMemo(
    () => ({ signOutReason, signOut, acknowledgeSignOut }),
    [signOutReason, signOut, acknowledgeSignOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionActions {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession debe usarse dentro de <SessionProvider>.');
  return session;
}
