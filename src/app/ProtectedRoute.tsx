import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { isInactive, readLastActivity } from '../auth/inactivity';
import { useSession } from '../auth/SessionContext';
import {
  INACTIVITY_MESSAGE,
  LOGIN_REQUIRED_MESSAGE,
  LOGOUT_SUCCESS_MESSAGE,
  type LoginLocationState,
} from '../auth/sessionMessages';
import { loginPathFor, ROUTES } from './routes';

/**
 * Las pantallas internas dependen del estado real de Firebase Auth (onAuthStateChanged):
 * - mientras se resuelve la sesión, solo "Cargando…" (nunca datos del sistema);
 * - sin sesión → ingreso con replace (el botón "Atrás" no puede volver a mostrarlas), con el aviso:
 *     HU-104 cerró la persona       → "Sesión cerrada correctamente."
 *     HU-105 cierre por inactividad → "Su sesión se cerró por inactividad. Ingrese de nuevo."
 *     HU-105 se abrió sin sesión    → "Debe iniciar sesión para acceder al sistema."
 *            (excepto la dirección raíz "/", que simplemente muestra el ingreso: HU-101)
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const session = useSession();
  const location = useLocation();

  if (auth.status === 'loading') return <p className="loading">Cargando…</p>;
  if (auth.status === 'active') {
    // Sesión recordada por Firebase pero vencida por inactividad: no mostrar nada mientras se cierra.
    const last = readLastActivity();
    if (last !== null && isInactive(last)) return <p className="loading">Cargando…</p>;
    return <>{children}</>;
  }

  if (session.signOutReason === 'user' || session.signOutReason === 'inactivity') {
    const notice = session.signOutReason === 'user' ? LOGOUT_SUCCESS_MESSAGE : INACTIVITY_MESSAGE;
    const state: LoginLocationState = { notice };
    return <Navigate to={ROUTES.login} replace state={state} />;
  }

  const isRoot = location.pathname === '/';
  const state: LoginLocationState | undefined = isRoot ? undefined : { notice: LOGIN_REQUIRED_MESSAGE };
  return <Navigate to={loginPathFor(location.pathname + location.search)} replace state={state} />;
}
