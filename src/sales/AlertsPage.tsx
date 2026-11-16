import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { saleDetailPath } from '../app/routes';
import { SALE_STAGE_LABELS } from '../shared/types';
import { formatDateNumericCR } from '../shared/utils/dates';
import { ALERT_KIND_LABELS, ALERT_MESSAGES, type AlertKind, type SaleAlert } from './alerts';
import { listAlerts } from './alertsApi';
import { ContactTimeline } from './ContactTimeline';
import { TIMELINE_MESSAGES, timelineFilterFromParam, type TimelineFilter } from './timeline';

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; alerts: SaleAlert[] };

const KIND_CLASS: Record<AlertKind, string> = {
  seguimiento_vencido: 'alert-type-overdue',
  seguimiento_hoy: 'alert-type-today',
  sin_comunicacion: 'alert-type-silent',
};

/** Pestañas de la pantalla. La primera (los avisos de HU-316) es la que se ve al abrirla. */
const ALERTS_TABS = [
  { id: 'avisos', label: TIMELINE_MESSAGES.tabAlerts },
  { id: 'bitacora', label: TIMELINE_MESSAGES.tabTimeline },
] as const;
type AlertsTabId = (typeof ALERTS_TABS)[number]['id'];

/** Parámetros de la URL: la pestaña, el contacto elegido en la bitácora y su filtro (se conservan al volver). */
const PARAMS = { tab: 'vista', contact: 'contacto', filter: 'tipo' } as const;

/**
 * HU-316: pantalla "Avisos" con todos los avisos pendientes (seguimiento de HU-314 y falta de comunicación de
 * HU-315) en una tabla, los más antiguos primero. El tipo se distingue por color (y por su texto). Al dar clic
 * en un aviso se abre el detalle de la posible venta.
 * Bitácora (decisión del grupo, idea del mentor): segunda pestaña con la línea de tiempo de un contacto. La tabla
 * de avisos no cambia y sigue siendo lo primero que se ve.
 */
export function AlertsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const tabRefs = useRef<Partial<Record<AlertsTabId, HTMLButtonElement | null>>>({});

  const active: AlertsTabId = params.get(PARAMS.tab) === 'bitacora' ? 'bitacora' : 'avisos';
  const contactId = params.get(PARAMS.contact);
  const filter = timelineFilterFromParam(params.get(PARAMS.filter));

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

  const showTab = (id: AlertsTabId) => {
    const next = new URLSearchParams(params);
    if (id === 'bitacora') next.set(PARAMS.tab, 'bitacora');
    else next.delete(PARAMS.tab);
    setParams(next, { replace: true });
  };

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const index = ALERTS_TABS.findIndex((tab) => tab.id === active);
    const next = ALERTS_TABS[(index + (e.key === 'ArrowRight' ? 1 : -1) + ALERTS_TABS.length) % ALERTS_TABS.length].id;
    showTab(next);
    tabRefs.current[next]?.focus();
  };

  const selectContact = (id: string) => {
    const next = new URLSearchParams(params);
    next.set(PARAMS.tab, 'bitacora');
    next.set(PARAMS.contact, id);
    setParams(next);
  };

  const changeFilter = (value: TimelineFilter) => {
    const next = new URLSearchParams(params);
    if (value === 'todos') next.delete(PARAMS.filter);
    else next.set(PARAMS.filter, value);
    setParams(next, { replace: true });
  };

  return (
    <main className="page page-wide">
      <h1>{ALERT_MESSAGES.title}</h1>
      <div role="tablist" aria-label={TIMELINE_MESSAGES.tabsLabel} className="tab-list alerts-tabs" onKeyDown={onTabKeyDown}>
        {ALERTS_TABS.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            className="tab"
            onClick={() => showTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="tab-panel">
        {active === 'avisos' && (
          <>
            {state.status === 'loading' && <p>{ALERT_MESSAGES.loading}</p>}
            {state.status === 'error' && (
              <p className="field-error" role="alert">
                {ALERT_MESSAGES.loadError}
              </p>
            )}
            {state.status === 'ready' && state.alerts.length === 0 && <p className="empty-state">{ALERT_MESSAGES.empty}</p>}
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
          </>
        )}
        {active === 'bitacora' && (
          <ContactTimeline contactId={contactId} filter={filter} onSelectContact={selectContact} onFilterChange={changeFilter} />
        )}
      </div>
    </main>
  );
}
