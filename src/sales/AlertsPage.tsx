import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { saleDetailPath } from '../app/routes';
import { SALE_STAGE_LABELS } from '../shared/types';
import { formatDateNumericCR } from '../shared/utils/dates';
import { ALERT_KIND_LABELS, ALERT_MESSAGES, type AlertKind, type SaleAlert } from './alerts';
import { listAlerts } from './alertsApi';

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; alerts: SaleAlert[] };

const KIND_CLASS: Record<AlertKind, string> = {
  seguimiento_vencido: 'alert-type-overdue',
  seguimiento_hoy: 'alert-type-today',
  sin_comunicacion: 'alert-type-silent',
};

/**
 * HU-316: pantalla "Avisos" con todos los avisos pendientes (seguimiento de HU-314 y falta de comunicación de
 * HU-315) en una tabla, los más antiguos primero. El tipo se distingue por color (y por su texto). Al dar clic
 * en un aviso se abre el detalle de la posible venta.
 */
export function AlertsPage() {
  const navigate = useNavigate();
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
    <main className="page page-wide">
      <h1>{ALERT_MESSAGES.title}</h1>
      {state.status === 'loading' && <p>{ALERT_MESSAGES.loading}</p>}
      {state.status === 'error' && (
        <p className="field-error" role="alert">
          {ALERT_MESSAGES.loadError}
        </p>
      )}
      {state.status === 'ready' && state.alerts.length === 0 && <p>{ALERT_MESSAGES.empty}</p>}
      {state.status === 'ready' && state.alerts.length > 0 && (
        <div className="table-wrapper">
          <table className="data-table alerts-table">
            <thead>
              <tr>
                {ALERT_MESSAGES.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.alerts.map((alert) => (
                <tr key={alert.id} className="clickable-row" onClick={() => navigate(saleDetailPath(alert.saleId))}>
                  <td>
                    <span className={`alert-type ${KIND_CLASS[alert.kind]}`}>{ALERT_KIND_LABELS[alert.kind]}</span>
                  </td>
                  <td>{alert.contactName}</td>
                  <td>
                    <Link to={saleDetailPath(alert.saleId)}>{alert.saleTitle}</Link>
                  </td>
                  <td>{SALE_STAGE_LABELS[alert.stage]}</td>
                  <td>{alert.message}</td>
                  <td>{formatDateNumericCR(alert.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
