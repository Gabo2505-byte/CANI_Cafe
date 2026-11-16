import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { contactPath, saleDetailPath } from '../app/routes';
import { CONTACT_SEARCH_LABEL, matchesContactSearch } from '../contacts/contactSearch';
import { formatPhone } from '../shared/phone/phone';
import { SALE_STAGE_LABELS, type Contact } from '../shared/types';
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

/** Cuántos contactos se ofrecen mientras se escribe. */
const MAX_RESULTS = 10;

type ContactsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; contacts: Contact[] };
type TimelineState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; timeline: Timeline };

interface ContactTimelineProps {
  /** Contacto elegido (vive en la URL), o null. */
  contactId: string | null;
  filter: TimelineFilter;
  onSelectContact: (contactId: string) => void;
  onFilterChange: (filter: TimelineFilter) => void;
}

function contactSummary(contact: Contact): string {
  const phone = contact.phoneNumber ? formatPhone(contact.phoneCountry ?? 'CR', contact.phoneNumber) : null;
  return [contact.email, phone].filter(Boolean).join(' · ');
}

/**
 * Bitácora del contacto (pestaña de la pantalla "Avisos"): buscador por nombre, correo o teléfono (la misma búsqueda
 * de la lista de contactos, HU-205) y, al elegir uno, su línea de tiempo del evento más reciente al más antiguo.
 * Solo lectura; no se muestra quién hizo cada acción.
 */
export function ContactTimeline({ contactId, filter, onSelectContact, onFilterChange }: ContactTimelineProps) {
  const [contacts, setContacts] = useState<ContactsState>({ status: 'loading' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    listTimelineContacts()
      .then((list) => !cancelled && setContacts({ status: 'ready', contacts: list }))
      .catch(() => !cancelled && setContacts({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    if (contacts.status !== 'ready' || search.trim() === '') return null;
    return contacts.contacts.filter((c) => matchesContactSearch(c, search)).slice(0, MAX_RESULTS);
  }, [contacts, search]);

  const selected = contacts.status === 'ready' && contactId ? contacts.contacts.find((c) => c.id === contactId) : undefined;

  const choose = (id: string) => {
    setSearch('');
    onSelectContact(id);
  };

  return (
    <div className="timeline">
      <p className="timeline-intro">{MSG.intro}</p>
      <div className="list-toolbar">
        <input
          type="search"
          className="list-search"
          aria-label={CONTACT_SEARCH_LABEL}
          placeholder={CONTACT_SEARCH_LABEL}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
          disabled={contacts.status !== 'ready'}
        />
      </div>
      {contacts.status === 'loading' && <p>{MSG.contactsLoading}</p>}
      {contacts.status === 'error' && (
        <p className="field-error" role="alert">
          {MSG.contactsError}
        </p>
      )}
      {results && results.length === 0 && <p className="empty-state">{MSG.noContacts}</p>}
      {results && results.length > 0 && (
        <ul className="timeline-results" aria-label={MSG.resultsLabel}>
          {results.map((contact) => (
            <li key={contact.id}>
              <button type="button" className="timeline-result" onClick={() => choose(contact.id)}>
                <span className="timeline-result-name">{contact.fullName}</span>
                <span className="timeline-result-data">{contactSummary(contact)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && !results && (
        <ContactEvents key={selected.id} contact={selected} filter={filter} onFilterChange={onFilterChange} />
      )}
    </div>
  );
}

function ContactEvents({
  contact,
  filter,
  onFilterChange,
}: {
  contact: Contact;
  filter: TimelineFilter;
  onFilterChange: (filter: TimelineFilter) => void;
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
      <div className="timeline-contact-header">
        <h2 id="timeline-contact-name">{contact.fullName}</h2>
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
