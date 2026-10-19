import { useCallback, useEffect, useState } from 'react';
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
import { ChangeStageDialog } from './ChangeStageDialog';
import { loadSaleDetail } from './saleDetailApi';
import { EDIT_MESSAGES } from './saleEdit';
import { canChangeStage, STAGE_CHANGE_MESSAGES } from './stageChange';
import { SaleEditForm } from './SaleEditForm';
import { TimedNotice } from './TimedNotice';

type LoadState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error' }
  | { status: 'ready'; detail: SaleDetailData };

/** HU-308: detalle de una posible venta con su historial de etapas. HU-309: botón "Editar". */
export function SaleDetailPage() {
  const { saleId } = useParams();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [editing, setEditing] = useState(false);
  const [changingStage, setChangingStage] = useState(false);
  // Cada guardado cambia la clave para que la confirmación de 5 segundos vuelva a mostrarse.
  const [saved, setSaved] = useState(0);

  const load = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      try {
        const detail = await loadSaleDetail(saleId ?? '');
        if (!isCancelled()) setState(detail ? { status: 'ready', detail } : { status: 'notFound' });
      } catch {
        if (!isCancelled()) setState({ status: 'error' });
      }
    },
    [saleId],
  );

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    setEditing(false);
    setChangingStage(false);
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function handleSaved() {
    await load();
    setEditing(false);
    setSaved((n) => n + 1);
  }

  // HU-310: la etapa ya se cambió y quedó en el historial; se vuelve a leer para mostrarla.
  async function handleStageChanged() {
    await load();
    setChangingStage(false);
  }

  return (
    <main className="page">
      {saved > 0 && <TimedNotice key={saved} message={EDIT_MESSAGES.saved} />}
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
      {state.status === 'ready' && (
        <SaleDetail
          detail={state.detail}
          editing={editing}
          onEdit={() => setEditing(true)}
          changingStage={changingStage}
          onChangeStage={() => setChangingStage(true)}
          onCancelChangeStage={() => setChangingStage(false)}
          onStageChanged={handleStageChanged}
          onCancel={() => setEditing(false)}
          onSaved={handleSaved}
        />
      )}
    </main>
  );
}

interface SaleDetailProps {
  detail: SaleDetailData;
  editing: boolean;
  onEdit: () => void;
  changingStage: boolean;
  onChangeStage: () => void;
  onCancelChangeStage: () => void;
  onStageChanged: () => void;
  onCancel: () => void;
  onSaved: () => void;
}

function SaleDetail({
  detail,
  editing,
  onEdit,
  changingStage,
  onChangeStage,
  onCancelChangeStage,
  onStageChanged,
  onCancel,
  onSaved,
}: SaleDetailProps) {
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
      <div className="page-header">
        <h1>{sale.title}</h1>
        {!editing && (
          <div className="page-header-actions">
            {/* HU-310: solo las posibles ventas abiertas se pueden mover de etapa. */}
            {canChangeStage(sale) && (
              <button type="button" className="button-secondary" onClick={onChangeStage}>
                {STAGE_CHANGE_MESSAGES.button}
              </button>
            )}
            <button type="button" onClick={onEdit}>
              Editar
            </button>
          </div>
        )}
      </div>
      <p className="detail-contact">
        {contactName ? <Link to={contactPath(sale.contactId)}>{contactName}</Link> : '—'}
      </p>

      {changingStage && (
        <ChangeStageDialog saleId={sale.id} currentStage={sale.stage} onSaved={onStageChanged} onCancel={onCancelChangeStage} />
      )}

      {editing ? (
        <SaleEditForm detail={detail} onSaved={onSaved} onCancel={onCancel} />
      ) : (
        <>
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
      )}
    </>
  );
}
