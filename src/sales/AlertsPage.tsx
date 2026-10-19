import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { saleDetailPath } from '../app/routes';
import { ALERT_MESSAGES, type SaleAlert } from './alerts';
import { listAlerts } from './alertsApi';

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; alerts: SaleAlert[] };

/**
 * Pantalla "Avisos". HU-314: avisos de seguimiento. La tabla con tipo, etapa, colores y el círculo de la barra
 * son de HU-316; los avisos de falta de comunicación, de HU-315.
 */
export function AlertsPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    listAlerts()
      .then((alerts) => {
        if (!cancelled) setState({ status: 'ready', alerts });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="page">
      <h1>{ALERT_MESSAGES.title}</h1>
      {state.status === 'loading' && <p>{ALERT_MESSAGES.loading}</p>}
      {state.status === 'error' && (
        <p className="field-error" role="alert">
          {ALERT_MESSAGES.loadError}
        </p>
      )}
      {state.status === 'ready' && state.alerts.length === 0 && <p>{ALERT_MESSAGES.empty}</p>}
      {state.status === 'ready' && state.alerts.length > 0 && (
        <ul className="alert-list">
          {state.alerts.map((alert) => (
            <li key={alert.id}>
              <Link to={saleDetailPath(alert.saleId)}>{alert.message}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
