import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { useSession } from '../auth/SessionContext';
import { LOGOUT_SUCCESS_MESSAGE, type LoginLocationState } from '../auth/sessionMessages';
import { loginPathFor, ROUTES } from './routes';

/**
 * Las pantallas internas dependen del estado real de Firebase Auth (onAuthStateChanged):
 * - mientras se resuelve la sesión, solo "Cargando…" (nunca datos del sistema);
 * - sin sesión → ingreso con replace (el botón "Atrás" no puede volver a mostrarlas);
 * - si la persona cerró sesión (HU-104), el ingreso recibe el aviso de éxito.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const session = useSession();
  const location = useLocation();

  if (auth.status === 'loading') return <p className="loading">Cargando…</p>;
  if (auth.status !== 'active') {
    if (session.signedOutByUser) {
      const state: LoginLocationState = { notice: LOGOUT_SUCCESS_MESSAGE };
      return <Navigate to={ROUTES.login} replace state={state} />;
    }
    return <Navigate to={loginPathFor(location.pathname + location.search)} replace />;
  }
  return <>{children}</>;
}
