import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { listAlerts } from './alertsApi';

/**
 * HU-316: cantidad de avisos pendientes para el círculo rojo de la barra. Se recalcula al abrir cada pantalla
 * (los avisos se calculan al consultar). Si no se puede calcular, no se muestra el círculo (0).
 */
export function useAlertCount(): number {
  const { pathname } = useLocation();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Promise.resolve().then: un fallo al empezar la consulta también cuenta como "no se pudo", sin romper la barra.
    Promise.resolve()
      .then(() => listAlerts())
      .then((alerts) => !cancelled && setCount(alerts.length))
      .catch(() => !cancelled && setCount(0));
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return count;
}
