import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { contactPath, ROUTES } from '../app/routes';
import { SALE_STAGE_LABELS } from '../shared/types';
import { formatDateNumericCR } from '../shared/utils/dates';
import { formatColones } from '../shared/utils/money';
import {
  DETAIL_MESSAGES,
  formatProductLine,
  lossReasonText,
  sortHistory,
  type SaleDetailData,
} from './saleDetail';
import { loadSaleDetail } from './saleDetailApi';

type LoadState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error' }
  | { status: 'ready'; detail: SaleDetailData };

/** HU-308: detalle de una posible venta con su historial de etapas. */
export function SaleDetailPage() {
  const { saleId } = useParams();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    loadSaleDetail(saleId ?? '').then(
      (detail) => {
        if (!cancelled) setState(detail ? { status: 'ready', detail } : { status: 'notFound' });
      },
      () => !cancelled && setState({ status: 'error' }),
    );
    return () => {
      cancelled = true;
    };
  }, [saleId]);

  return (
    <main className="page">
      <p className="detail-back">
        <Link to={ROUTES.salesBoard}>{DETAIL_MESSAGES.back}</Link>
      </p>
      {state.status === 'loading' && <p>{DETAIL_MESSAGES.loading}</p>}
      {state.status === 'notFound' && <p role="alert">{DETAIL_MESSAGES.notFound}</p>}
      {state.status === 'error' && (
        <p className="field-error" role="alert">
          {DETAIL_MESSAGES.loadError}
        </p>
      )}
      {state.status === 'ready' && <SaleDetail detail={state.detail} />}
    </main>
  );
}

function SaleDetail({ detail }: { detail: SaleDetailData }) {
  const { sale, contactName, products, history } = detail;
  const rows: [string, React.ReactNode][] = [
    ['Etapa', SALE_STAGE_LABELS[sale.stage]],
    ['Monto estimado', formatColones(sale.estimatedAmount)],
    [
      'Productos',
      products.length === 0 ? (
        DETAIL_MESSAGES.noProducts
      ) : (
        <ul className="detail-products">
          {products.map((product) => (
            <li key={product.productId}>{formatProductLine(product)}</li>
          ))}
        </ul>
      ),
    ],
    ['Próximo seguimiento', sale.nextFollowUpAt ? formatDateNumericCR(sale.nextFollowUpAt) : DETAIL_MESSAGES.noFollowUp],
    ['Notas', sale.notes.trim() ? <span className="detail-notes">{sale.notes}</span> : DETAIL_MESSAGES.noNotes],
    ['Fecha de creación', formatDateNumericCR(sale.createdAt)],
    [
      'Última comunicación',
      sale.lastCommunicationAt ? formatDateNumericCR(sale.lastCommunicationAt) : DETAIL_MESSAGES.noCommunications,
    ],
  ];

  return (
    <>
      <h1>{sale.title}</h1>
      <p className="detail-contact">
        {contactName ? <Link to={contactPath(sale.contactId)}>{contactName}</Link> : '—'}
      </p>

      <dl className="detail-list detail-list-wide">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="stage-history-title">
        <h2 id="stage-history-title">{DETAIL_MESSAGES.historyTitle}</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Etapa anterior</th>
                <th>Etapa nueva</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {sortHistory(history).map((entry, index) => (
                <tr key={`${entry.changedAt.toMillis()}-${index}`}>
                  <td>{formatDateNumericCR(entry.changedAt)}</td>
                  <td>{entry.previousStage ? SALE_STAGE_LABELS[entry.previousStage] : '—'}</td>
                  <td>{SALE_STAGE_LABELS[entry.newStage]}</td>
                  <td>{lossReasonText(entry) ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
