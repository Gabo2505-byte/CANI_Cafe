import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ROUTES, saleDetailPath } from '../app/routes';
import { formatDateNumericCR } from '../shared/utils/dates';
import { MOVEMENTS_MESSAGES as MSG, type MovementRow } from './movements';
import { createMovementsLoader } from './movementsApi';
import type { MovementsCursor, MovementsLoader } from './movementsRepository';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; rows: MovementRow[]; cursor: MovementsCursor | null };

const COLUMNS = ['Fecha', 'Oportunidad', 'Etapa anterior', 'Etapa nueva', 'Motivo'] as const;

/**
 * Tabla de movimientos (pedido del profesor): los cambios de etapa de todas las oportunidades, del más reciente al
 * más antiguo, de 25 en 25 con "Cargar más". Solo lectura. Las columnas y textos son los del "Historial de etapas"
 * del detalle (HU-308), más "Oportunidad", con el nombre del contacto como enlace al detalle de la venta.
 */
export function MovementsPage() {
  // Un cargador por visita a la pantalla: su caché evita volver a leer ventas y contactos ya vistos.
  const [loader] = useState<MovementsLoader>(() => createMovementsLoader());
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loader
      .loadPage(null)
      .then((page) => !cancelled && setState({ status: 'ready', rows: page.rows, cursor: page.nextCursor }))
      .catch(() => !cancelled && setState({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [loader]);

  async function loadMore() {
    if (state.status !== 'ready' || !state.cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await loader.loadPage(state.cursor);
      setState({ status: 'ready', rows: [...state.rows, ...page.rows], cursor: page.nextCursor });
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="page movements-page">
      <p className="detail-back">
        <Link to={ROUTES.salesBoard}>{MSG.back}</Link>
      </p>
      <h1>{MSG.title}</h1>

      {state.status === 'loading' && <p>{MSG.loading}</p>}
      {state.status === 'error' && (
        <p className="field-error" role="alert">
          {MSG.loadError}
        </p>
      )}
      {state.status === 'ready' && state.rows.length === 0 && <p className="empty-state">{MSG.empty}</p>}
      {state.status === 'ready' && state.rows.length > 0 && (
        <>
          <div className="table-wrapper">
            <table className="data-table movements-table">
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label={COLUMNS[0]}>{formatDateNumericCR(row.changedAt)}</td>
                    <td data-label={COLUMNS[1]}>
                      {row.saleTitle === null ? (
                        row.contactName
                      ) : (
                        <span>
                          <Link to={saleDetailPath(row.saleId)}>{row.contactName}</Link>
                          <span className="movements-sale-title">{row.saleTitle}</span>
                        </span>
                      )}
                    </td>
                    <td data-label={COLUMNS[2]}>{row.previousStageLabel}</td>
                    <td data-label={COLUMNS[3]}>{row.newStageLabel}</td>
                    <td data-label={COLUMNS[4]}>{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {moreError && (
            <p className="field-error" role="alert">
              {MSG.loadMoreError}
            </p>
          )}
          {state.cursor && (
            <div className="load-more">
              <button type="button" className="button-secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? MSG.loading : MSG.loadMore}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
