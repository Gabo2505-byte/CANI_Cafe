import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { contactPath, saleDetailPath } from '../app/routes';
import { badgedFirst, CONTACT_SEARCH_LABEL, filterContacts, foundContactsMessage } from '../contacts/contactSearch';
import { CONTACTS_LIST_MESSAGES } from '../contacts/ContactsPage';
import { CONTACTS_PAGE_SIZE } from '../contacts/contactsRepository';
import { SALE_STAGE_LABELS, type Contact } from '../shared/types';
import { contactSecondaryLine } from './contactSearch';
import {
  filterTimeline,
  isCreationEvent,
  TIMELINE_FILTER_OPTIONS,
  TIMELINE_MESSAGES as MSG,
  truncatedMessage,
  type CommunicationEvent,
  type StageEvent,
  type Timeline,
  type TimelineFilter,
} from './timeline';
import { listTimelineContacts, loadContactTimeline } from './timelineApi';

type ContactsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; contacts: Contact[] };
type TimelineState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; timeline: Timeline };

interface ContactTimelineProps {
  /** Contacto elegido (vive en la URL), o null. */
  contactId: string | null;
  filter: TimelineFilter;
  onSelectContact: (contactId: string) => void;
  onClearContact: () => void;
  onFilterChange: (filter: TimelineFilter) => void;
}

/** Teléfono primero y correo después, separados por " · "; con un solo dato, solo ese. */
function contactSummary(contact: Contact): string {
  return contactSecondaryLine(contact) ?? '';
}

/**
 * Bitácora del contacto (pestaña de la pantalla "Avisos"). Sin contacto elegido muestra la lista de contactos con
 * el mismo orden de la lista de contactos (HU-204 y HU-504: todos, activos e inactivos, en orden alfabético y con
 * etiqueta primero, de 20 en 20), con el teléfono antes del correo en cada fila, y un buscador por nombre, correo o
 * teléfono (la misma búsqueda de HU-205). Al elegir uno se ve su línea de tiempo, del evento más reciente al más antiguo, con "Cambiar contacto"
 * para volver a la lista. Solo lectura; no se muestra quién hizo cada acción.
 */
export function ContactTimeline({ contactId, filter, onSelectContact, onClearContact, onFilterChange }: ContactTimelineProps) {
  const [contacts, setContacts] = useState<ContactsState>({ status: 'loading' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const shownContactId = useRef<string | null | undefined>(undefined);

  // Foco y scroll al cambiar de contacto (no al abrir la pestaña): al elegir uno, el foco va al título de su
  // bitácora; al volver a la lista, el buscador queda vacío y con el foco.
  useEffect(() => {
    const previous = shownContactId.current;
    shownContactId.current = contactId;
    if (previous === undefined || previous === contactId) return;
    window.scrollTo(0, 0);
    if (contactId) {
      document.getElementById('timeline-contact-name')?.focus({ preventScroll: true });
    } else {
      setSearch('');
      setPage(0);
      searchRef.current?.focus({ preventScroll: true });
    }
  }, [contactId]);

  useEffect(() => {
    let cancelled = false;
    listTimelineContacts()
      .then((list) => !cancelled && setContacts({ status: 'ready', contacts: list }))
      .catch(() => !cancelled && setContacts({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, []);

  const found = useMemo(
    () => (contacts.status === 'ready' ? badgedFirst(filterContacts(contacts.contacts, search, 'todos')) : []),
    [contacts, search],
  );

  const selected = contacts.status === 'ready' && contactId ? contacts.contacts.find((c) => c.id === contactId) : undefined;
  if (selected) {
    return (
      <div className="timeline">
        <ContactEvents
          key={selected.id}
          contact={selected}
          filter={filter}
          onFilterChange={onFilterChange}
          onClearContact={onClearContact}
        />
      </div>
    );
  }

  const ready = contacts.status === 'ready';
  const isEmpty = ready && contacts.contacts.length === 0;
  const totalPages = Math.max(1, Math.ceil(found.length / CONTACTS_PAGE_SIZE));
  const shownPage = Math.min(page, totalPages - 1);
  const pageContacts = found.slice(shownPage * CONTACTS_PAGE_SIZE, (shownPage + 1) * CONTACTS_PAGE_SIZE);

  return (
    <div className="timeline">
      <p className="timeline-intro">{MSG.intro}</p>
      <div className="list-toolbar">
        <input
          ref={searchRef}
          type="search"
          className="list-search"
          aria-label={CONTACT_SEARCH_LABEL}
          placeholder={CONTACT_SEARCH_LABEL}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          autoComplete="off"
          disabled={!ready}
        />
      </div>
      <p className="list-count" role="status">
        {ready && !isEmpty ? foundContactsMessage(found.length) : ''}
      </p>
      {contacts.status === 'loading' && <p>{MSG.contactsLoading}</p>}
      {contacts.status === 'error' && (
        <p className="field-error" role="alert">
          {MSG.contactsError}
        </p>
      )}
      {isEmpty && <p className="empty-state">{CONTACTS_LIST_MESSAGES.empty}</p>}
      {ready && !isEmpty && found.length === 0 && <p className="empty-state">{MSG.noContacts}</p>}
      {found.length > 0 && (
        <>
          <ul className="timeline-results" aria-label={MSG.resultsLabel}>
            {pageContacts.map((contact) => (
              <li key={contact.id}>
                <button type="button" className="timeline-result" onClick={() => onSelectContact(contact.id)}>
                  <span className="timeline-result-name">
                    {contact.fullName}
                    {contact.formBadge && <span className="form-badge">{contact.formBadge}</span>}
                  </span>
                  <span className="timeline-result-data">{contactSummary(contact)}</span>
                </button>
              </li>
            ))}
          </ul>
          <nav className="pagination" aria-label="Paginación de contactos">
            <button type="button" className="button-secondary" onClick={() => setPage(shownPage - 1)} disabled={shownPage === 0}>
              Anterior
            </button>
            <span aria-live="polite">
              Página {shownPage + 1} de {totalPages}
            </span>
            <button
              type="button"
              className="button-secondary"
              onClick={() => setPage(shownPage + 1)}
              disabled={shownPage >= totalPages - 1}
            >
              Siguiente
            </button>
          </nav>
        </>
      )}
    </div>
  );
}

function ContactEvents({
  contact,
  filter,
  onFilterChange,
  onClearContact,
}: {
  contact: Contact;
  filter: TimelineFilter;
  onFilterChange: (filter: TimelineFilter) => void;
  onClearContact: () => void;
}) {
  const [state, setState] = useState<TimelineState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadContactTimeline(contact.id)
      .then((timeline) => !cancelled && setState({ status: 'ready', timeline }))
      .catch(() => !cancelled && setState({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [contact.id]);

  const events = state.status === 'ready' ? filterTimeline(state.timeline.events, filter) : [];

  return (
    <section className="timeline-contact" aria-labelledby="timeline-contact-name">
      <button type="button" className="button-secondary timeline-change" onClick={onClearContact}>
        {MSG.changeContact}
      </button>
      <div className="timeline-contact-header">
        <h2 id="timeline-contact-name" tabIndex={-1}>{contact.fullName}</h2>
        <Link to={contactPath(contact.id)}>{MSG.openContact}</Link>
      </div>
      <p className="timeline-contact-data">{contactSummary(contact)}</p>
      <div className="list-toolbar">
        <div className="list-filter">
          <label htmlFor="timeline-filter">{MSG.filterLabel}</label>
          <select id="timeline-filter" value={filter} onChange={(e) => onFilterChange(e.target.value as TimelineFilter)}>
            {TIMELINE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {state.status === 'loading' && <p>{MSG.loading}</p>}
      {state.status === 'error' && (
        <p className="field-error" role="alert">
          {MSG.loadError}
        </p>
      )}
      {state.status === 'ready' && state.timeline.events.length === 0 && <p className="empty-state">{MSG.empty}</p>}
      {state.status === 'ready' && state.timeline.events.length > 0 && events.length === 0 && (
        <p className="empty-state">{MSG.emptyFiltered}</p>
      )}
      {state.status === 'ready' && state.timeline.truncated && <p className="list-count">{truncatedMessage()}</p>}
      {events.length > 0 && (
        <ol className="record-list timeline-list" aria-label={MSG.eventsLabel}>
          {events.map((event) =>
            event.kind === 'comunicacion' ? (
              <CommunicationItem key={event.id} event={event} />
            ) : (
              <StageItem key={event.id} event={event} />
            ),
          )}
        </ol>
      )}
    </section>
  );
}

function CommunicationItem({ event }: { event: CommunicationEvent }) {
  return (
    <li className="communication-card timeline-event timeline-event-communication">
      <p className="record-meta">
        <span className="communication-date">{event.dateLabel}</span> · <span className="timeline-kind">{MSG.communication}</span> ·{' '}
        <span>{event.medium}</span>{' '}
        <span className={`timeline-origin${event.fromWebForm ? ' timeline-origin-form' : ''}`}>
          {event.fromWebForm ? MSG.originForm : MSG.originManual}
        </span>
      </p>
      {event.saleLabel && (
        <p className="communication-sale">
          {MSG.saleLabel}: {event.saleId ? <Link to={saleDetailPath(event.saleId)}>{event.saleLabel}</Link> : event.saleLabel}
        </p>
      )}
      <p className="record-note">{event.note}</p>
    </li>
  );
}

function StageItem({ event }: { event: StageEvent }) {
  const creation = isCreationEvent(event);
  return (
    <li className={`communication-card timeline-event timeline-event-stage${creation ? ' timeline-event-creation' : ''}`}>
      <p className="record-meta">
        <span className="communication-date">{event.dateLabel}</span> ·{' '}
        <span className="timeline-kind">{creation ? MSG.creation : MSG.stageChange}</span>
      </p>
      <p className="communication-sale">
        {MSG.saleLabel}: <Link to={saleDetailPath(event.saleId)}>{event.saleTitle}</Link>
      </p>
      <p>
        {event.previousStage === null
          ? `${MSG.initialStage}: ${SALE_STAGE_LABELS[event.newStage]}`
          : `${MSG.stage}: ${SALE_STAGE_LABELS[event.previousStage]} → ${SALE_STAGE_LABELS[event.newStage]}`}
      </p>
      {event.lossReason && (
        <p className="timeline-loss">
          {MSG.lossReason}: {event.lossReason}
        </p>
      )}
    </li>
  );
}
