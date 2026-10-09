import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { loginPathFor } from './routes';

/** Sin sesión activa → pantalla de ingreso, recordando la pantalla pedida. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') return <p className="loading">Cargando…</p>;
  if (auth.status !== 'active') {
    return <Navigate to={loginPathFor(location.pathname + location.search)} replace />;
  }
  return <>{children}</>;
}
