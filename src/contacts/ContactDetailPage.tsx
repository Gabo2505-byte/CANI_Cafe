import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { newSalePath, saleDetailPath } from '../app/routes';
import { useLocationNotice } from '../shared/hooks/useLocationNotice';
import {
  CONTACT_CLASSIFICATION_LABELS,
  type Communication,
  type Contact,
} from '../shared/types';
import { COMMUNICATION_MESSAGES, mediumLabel } from '../communications/communicationForm';
import { listCommunicationsPage } from '../communications/communicationsApi';
import type { CommunicationsCursor } from '../communications/communicationsRepository';
import { RegisterCommunicationDialog } from '../communications/RegisterCommunicationDialog';
import { SALES_LABELS } from '../shared/constants/labels';
import { AddButtonLabel } from '../shared/ui/AddButtonLabel';
import { TimedNotice } from '../sales/TimedNotice';
import { formatDateNumericCR } from '../shared/utils/dates';
import {
  backToListPath,
  communicationSaleLabel,
  registeredByLabel,
  openSaleOptions,
  CONTACT_DETAIL_MESSAGES as MSG,
  CONTACT_SALES_COLUMNS,
  CONTACT_TABS,
  contactDataRows,
  contactSaleCells,
  tabLabel,
  type ContactRecords,
  type ContactTabId,
} from './contactDetail';
import { loadContactRecords } from './contactDetailApi';
import { getContact } from './contactsApi';

type LoadState = { status: 'loading' } | { status: 'notFound' } | { status: 'error' } | { status: 'ready'; contact: Contact };
type RecordsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; records: ContactRecords };

/** HU-207: ficha del contacto (HU-201 mostró la primera versión, con el aviso de registro). */
export function ContactDetailPage() {
  const { contactId } = useParams();
  const location = useLocation();
  const notice = useLocationNotice();
  // Se calcula una sola vez: useLocationNotice puede limpiar location.state después.
  const [backTo] = useState(() => backToListPath(location.state));
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [records, setRecords] = useState<RecordsState>({ status: 'loading' });

  // HU-211: ventana "Registrar comunicación" y confirmación (cada guardado cambia la clave para reiniciar los 5 s).
  const [registering, setRegistering] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [showSaved, setShowSaved] = useState(false);

  const loadRecords = useCallback(
    (isCancelled: () => boolean = () => false) =>
      loadContactRecords(contactId ?? '')
        .then((loaded) => {
          if (!isCancelled()) setRecords({ status: 'ready', records: loaded });
        })
        .catch(() => {
          if (!isCancelled()) setRecords({ status: 'error' });
        }),
    [contactId],
  );

  useEffect(() => {
    let cancelled = false;
    getContact(contactId ?? '')
      .then((contact) => {
        if (!cancelled) setState(contact ? { status: 'ready', contact } : { status: 'notFound' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    void loadRecords(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [contactId, loadRecords]);

  async function handleCommunicationSaved() {
    setRegistering(false);
    setSavedCount((n) => n + 1);
    setShowSaved(true);
    await loadRecords();
  }

  return (
    <main className="page">
      {notice && (
        <p className="notice-success" role="status">
          {notice}
        </p>
      )}
      <p className="detail-back">
        <Link to={backTo}>{MSG.back}</Link>
      </p>
      {state.status === 'loading' && <p>{MSG.loading}</p>}
      {state.status === 'notFound' && <p role="alert">{MSG.notFound}</p>}
      {state.status === 'error' && (
        <p className="field-error" role="alert">
          {MSG.loadError}
        </p>
      )}
      {state.status === 'ready' && (
        <>
          <ContactHeader contact={state.contact} />
          <ContactData contact={state.contact} />
          <ContactTabs
            contactId={state.contact.id}
            records={records}
            savedCount={showSaved ? savedCount : 0}
            onTabChange={() => setShowSaved(false)}
            onRegisterCommunication={() => setRegistering(true)}
          />
          {registering && (
            <RegisterCommunicationDialog
              contactId={state.contact.id}
              openSales={records.status === 'ready' ? openSaleOptions(records.records.sales) : []}
              onSaved={handleCommunicationSaved}
              onCancel={() => setRegistering(false)}
            />
          )}
        </>
      )}
    </main>
  );
}

function ContactHeader({ contact }: { contact: Contact }) {
  return (
    <div className="contact-title">
      <h1>{contact.fullName}</h1>
      <span className={`classification-badge classification-${contact.classification}`}>
        {CONTACT_CLASSIFICATION_LABELS[contact.classification] ?? contact.classification}
      </span>
    </div>
  );
}

function ContactData({ contact }: { contact: Contact }) {
  return (
    <section className="contact-data" aria-labelledby="contact-data-title">
      <h2 id="contact-data-title">{MSG.dataTitle}</h2>
      <dl className="detail-list">
        {contactDataRows(contact).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={value === MSG.missing ? 'value-missing' : undefined}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

interface ContactTabsProps {
  contactId: string;
  records: RecordsState;
  /** HU-211: cuántas comunicaciones se han guardado (cada una vuelve a mostrar la confirmación). */
  savedCount: number;
  /** Al cambiar de pestaña la confirmación ya no se vuelve a mostrar. */
  onTabChange: () => void;
  onRegisterCommunication: () => void;
}

function ContactTabs({ contactId, records, savedCount, onTabChange, onRegisterCommunication }: ContactTabsProps) {
  const navigate = useNavigate();
  const [active, setActiveTab] = useState<ContactTabId>('comunicaciones');
  const setActive = (id: ContactTabId) => {
    if (id !== active) onTabChange();
    setActiveTab(id);
  };
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const ready = records.status === 'ready' ? records.records : null;
  const counts: Record<ContactTabId, number | null> = {
    comunicaciones: ready ? (ready.communicationsTotal ?? ready.communications.length) : null,
    ventas: ready ? ready.sales.length : null,
    productos: ready ? ready.products.length : null,
  };

  // Flechas izquierda/derecha, Inicio y Fin cambian de pestaña (patrón de pestañas de WAI-ARIA).
  function onKeyDown(event: KeyboardEvent) {
    const index = CONTACT_TABS.findIndex((tab) => tab.id === active);
    const last = CONTACT_TABS.length - 1;
    const next =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    const id = CONTACT_TABS[next].id;
    setActive(id);
    tabRefs.current[id]?.focus();
  }

  return (
    <section className="contact-tabs">
      <div role="tablist" aria-label="Registros del contacto" className="tab-list" onKeyDown={onKeyDown}>
        {CONTACT_TABS.map((tab) => (
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
            onClick={() => setActive(tab.id)}
          >
            {tabLabel(tab.label, counts[tab.id])}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="tab-panel" tabIndex={0}>
        {active === 'comunicaciones' && (
          <>
            <div className="tab-panel-actions">
              <button type="button" onClick={onRegisterCommunication}>
                {COMMUNICATION_MESSAGES.button}
              </button>
            </div>
            {/* HU-211: la confirmación va junto al historial, donde se está mirando (no arriba de la página). */}
            {savedCount > 0 && <SavedNotice key={savedCount} message={COMMUNICATION_MESSAGES.saved} />}
          </>
        )}
        {/* HU-301: botón "+ Nuevo registro" para crear una venta de este contacto (el formulario lo trae ya elegido). */}
        {active === 'ventas' && (
          <div className="tab-panel-actions">
            <button type="button" onClick={() => navigate(newSalePath(contactId))}>
              <AddButtonLabel>{SALES_LABELS.newRecord}</AddButtonLabel>
            </button>
          </div>
        )}
        {records.status === 'loading' && <p>{MSG.recordsLoading}</p>}
        {records.status === 'error' && (
          <p className="field-error" role="alert">
            {MSG.recordsError}
          </p>
        )}
        {ready && active === 'comunicaciones' && <CommunicationsPanel key={recordsKey(ready)} contactId={contactId} records={ready} />}
        {ready && active === 'ventas' && <SalesPanel records={ready} />}
        {ready && active === 'productos' && <ProductsPanel records={ready} />}
      </div>
    </section>
  );
}

/**
 * HU-211: confirmación "Comunicación registrada correctamente." (franja verde de 5 s) que además
 * se asegura de quedar a la vista si la página estaba desplazada.
 */
function SavedNotice({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, []);
  return (
    <div ref={ref} className="saved-notice">
      <TimedNotice message={message} />
    </div>
  );
}

/** Cada recarga de los registros (p. ej. tras registrar una, HU-211) vuelve a mostrar solo la primera página. */
const recordsKeys = new WeakMap<ContactRecords, number>();
let nextRecordsKey = 0;
function recordsKey(records: ContactRecords): number {
  if (!recordsKeys.has(records)) recordsKeys.set(records, (nextRecordsKey += 1));
  return recordsKeys.get(records)!;
}

/**
 * HU-213: historial de comunicaciones, de la más reciente a la más antigua, en recuadros.
 * Muestra las 10 más recientes; "Ver más" trae 10 más debajo y desaparece cuando ya se ven todas.
 */
function CommunicationsPanel({ contactId, records }: { contactId: string; records: ContactRecords }) {
  const [items, setItems] = useState<Communication[]>(records.communications);
  const [cursor, setCursor] = useState<CommunicationsCursor | null>(records.communicationsCursor ?? null);
  const [userNames, setUserNames] = useState<Record<string, string>>(records.userNames ?? {});
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await listCommunicationsPage(contactId, cursor);
      setItems((prev) => [...prev, ...page.communications]);
      setUserNames((prev) => ({ ...prev, ...page.userNames }));
      setCursor(page.nextCursor);
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (items.length === 0) return <p className="empty-state">{MSG.noCommunications}</p>;
  return (
    <>
      <ul className="record-list communication-list">
        {items.map((c) => {
          const sale = communicationSaleLabel(c, records.sales);
          return (
            <li key={c.id} className="communication-card">
              <p className="record-meta">
                <span className="communication-date">{formatDateNumericCR(c.date)}</span> · <span>{mediumLabel(c)}</span>
              </p>
              {sale && <p className="communication-sale">Posible venta: {sale}</p>}
              <p className="record-note">{c.note}</p>
              <p className="communication-by">{registeredByLabel(c, userNames)}</p>
            </li>
          );
        })}
      </ul>
      {moreError && (
        <p className="field-error" role="alert">
          {MSG.loadMoreError}
        </p>
      )}
      {cursor && (
        <div className="load-more">
          <button type="button" className="button-secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Cargando…' : MSG.loadMore}
          </button>
        </div>
      )}
    </>
  );
}

/** HU-208: tabla con todas las posibles ventas del contacto; clic (o Enter) en la fila abre su detalle. */
function SalesPanel({ records }: { records: ContactRecords }) {
  const navigate = useNavigate();
  if (records.sales.length === 0) return <p className="empty-state">{MSG.noSales}</p>;
  return (
    <div className="table-wrapper">
      <table className="data-table contact-sales-table">
        <thead>
          <tr>
            {CONTACT_SALES_COLUMNS.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.sales.map((sale) => {
            const [title, stage, amount, followUp, lastCommunication] = contactSaleCells(sale);
            const open = () => navigate(saleDetailPath(sale.id));
            return (
              <tr
                key={sale.id}
                className="clickable-row"
                onClick={open}
                onKeyDown={(event) => event.key === 'Enter' && open()}
              >
                <td>
                  <Link to={saleDetailPath(sale.id)} onClick={(e) => e.stopPropagation()}>
                    {title}
                  </Link>
                </td>
                <td>{stage}</td>
                <td className="nowrap">{amount}</td>
                <td className="nowrap">{followUp}</td>
                <td className="nowrap">{lastCommunication}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProductsPanel({ records }: { records: ContactRecords }) {
  if (records.products.length === 0) return <p className="empty-state">{MSG.noProducts}</p>;
  return (
    <ul className="record-list">
      {records.products.map((p) => (
        <li key={p.productId}>
          {p.name} · {p.presentation}
        </li>
      ))}
    </ul>
  );
}
