import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ROUTES } from '../app/routes';
import { useLocationNotice } from '../shared/hooks/useLocationNotice';
import { formatColones } from '../shared/utils/money';
import { BOARD_MESSAGES, buildBoard, type BoardSale } from './board';
import { SALE_MESSAGES } from './saleForm';
import { getContactNames } from './contactSearchApi';
import { listAlerts } from './alertsApi';
import { SaleCard } from './SaleCard';
import { listBoardSales } from './salesApi';
import { TimedNotice } from './TimedNotice';

type BoardState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: BoardSale[]; alertSaleIds: Set<string>; overdueSaleIds: Set<string> };

/**
 * Pantalla "Posibles ventas". HU-301: botón "Nueva posible venta" y confirmación al registrar una.
 * HU-305: tablero de seis columnas, una por etapa, con conteo, suma de montos y tarjetas.
 * HU-314/315: la tarjeta muestra la campana si la venta tiene un aviso pendiente, y la fecha de seguimiento en rojo
 * si tiene el aviso "Seguimiento vencido" (el mismo cálculo de día calendario de Costa Rica de HU-314).
 */
export function SalesBoardPage() {
  const navigate = useNavigate();
  const notice = useLocationNotice();
  const [state, setState] = useState<BoardState>({ status: 'loading' });
  // "Hoy" se fija al abrir la pantalla para que los 30 días no cambien mientras se mira.
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    // Si fallan los avisos el tablero se muestra igual, sin campanas.
    const alerts = listAlerts(now).catch(() => []);
    listBoardSales(now)
      .then(async (sales) => {
        const names = await getContactNames(sales.map((sale) => sale.contactId));
        const pending = await alerts;
        if (cancelled) return;
        setState({
          status: 'ready',
          items: sales.map((sale) => ({ sale, contactName: names.get(sale.contactId) ?? '—' })),
          alertSaleIds: new Set(pending.map((alert) => alert.saleId)),
          overdueSaleIds: new Set(pending.filter((alert) => alert.kind === 'seguimiento_vencido').map((alert) => alert.saleId)),
        });
      })
      .catch(() => !cancelled && setState({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [now]);

  const columns = useMemo(() => (state.status === 'ready' ? buildBoard(state.items, now) : []), [state, now]);

  return (
    <main className="page page-wide">
      <TimedNotice message={notice} />
      <div className="page-header">
        <h1>Posibles ventas</h1>
        <button type="button" onClick={() => navigate(ROUTES.newSale)}>
          {SALE_MESSAGES.newSale}
        </button>
      </div>

      {state.status === 'loading' && <p>{BOARD_MESSAGES.loading}</p>}
      {state.status === 'error' && (
        <p className="field-error" role="alert">
          {BOARD_MESSAGES.loadError}
        </p>
      )}
      {state.status === 'ready' && (
        <div className="board">
          {columns.map((column) => (
            <section key={column.stage} className={`board-column board-column-${column.stage}`} aria-label={column.label}>
              <h2 className="board-column-header">
                {/* El texto sigue siendo "En negociación · 4 · ₡ 820 000"; los span solo lo reparten en dos líneas. */}
                <span className="board-column-title">{column.label}</span>
                {' · '}
                <span className="board-column-summary">
                  {column.count} · <span className="board-column-total">{formatColones(column.total)}</span>
                </span>
              </h2>
              {column.sales.length === 0 ? (
                <p className="board-empty">{BOARD_MESSAGES.empty}</p>
              ) : (
                <ul className="board-cards">
                  {column.sales.map((item) => (
                    <SaleCard
                      key={item.sale.id}
                      item={item}
                      hasAlert={state.alertSaleIds.has(item.sale.id)}
                      followUpOverdue={state.overdueSaleIds.has(item.sale.id)}
                    />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
