import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

/** Estado de navegación para pasar un aviso a la pantalla destino. */
export interface NoticeState {
  notice?: string;
}

/**
 * Toma el aviso que llega en `location.state` (ej. "Contacto registrado correctamente.") y lo
 * borra del historial para que no reaparezca al recargar ni al usar "Atrás".
 */
export function useLocationNotice(): string | null {
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const incoming = (location.state as NoticeState | null)?.notice;
    if (!incoming) return;
    setNotice(incoming);
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, navigate]);

  return notice;
}
