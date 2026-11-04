import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, NavigationType, useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router';
import { contactPath, ROUTES } from '../app/routes';
import { formatPhone } from '../shared/phone/phone';
import { CONTACT_CLASSIFICATION_LABELS, type Contact } from '../shared/types';
import { formatDateCR } from '../shared/utils/dates';
import { pageIndexFromParam, type FromListState } from './contactDetail';
import {
  badgedFirst,
  CLASSIFICATION_FILTER_OPTIONS,
  classificationFilterFromParam,
  CONTACT_SEARCH_LABEL,
  filterContacts,
  foundContactsMessage,
} from './contactSearch';
import { listAllContacts } from './contactsApi';
import { CONTACTS_PAGE_SIZE } from './contactsRepository';

export const CONTACTS_LIST_MESSAGES = {
  empty: 'Aún no hay contactos registrados.',
  loading: 'Cargando contactos…',
  error: 'No se pudieron cargar los contactos. Intente de nuevo.',
} as const;

/** Marca de los cambios de URL que hace la propia lista (página, búsqueda y clasificación). */
interface ListWriteState {
  contactsListWrite?: boolean;
}
const LIST_WRITE: ListWriteState = { contactsListWrite: true };

/**
 * Pantalla "Contactos". HU-201: botón "Nuevo contacto". HU-204: lista de 20 en 20 en orden alfabético.
 * HU-205: buscador y lista "Clasificación". HU-504: etiqueta "Nuevo"/"Nuevo mensaje" y esos contactos de primeros.
 * Todo se arma en el navegador sobre la lista completa (ver la decisión en contactSearch.ts).
 * HU-207: la página, la búsqueda y la clasificación viven en la URL ("?buscar=mar&clasificacion=cliente&pagina=2");
 * al abrir una ficha se le pasa esa URL para que "Volver a contactos" regrese a la lista tal como estaba.
 */
export function ContactsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageIndex = pageIndexFromParam(searchParams.get('pagina'));
  const urlSearch = searchParams.get('buscar') ?? '';
  const classification = classificationFilterFromParam(searchParams.get('clasificacion'));
  // HU-205: lo escrito vive aquí y se copia a la URL. React Router cambia la URL como transición: si el campo tomara
  // su valor de la URL, al escribir rápido se perderían letras ("8812" quedaba "82").
  const [search, setSearch] = useState(urlSearch);
  const searchRef = useRef(urlSearch);
  const [contacts, setContacts] = useState<Contact[] | 'loading' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    listAllContacts()
      .then((all) => !cancelled && setContacts(all))
      .catch(() => !cancelled && setContacts('error'));
    return () => {
      cancelled = true;
    };
  }, []);

  // Si la URL cambió por otro lado (menú "Contactos", "Atrás", "Volver a contactos"), el buscador la toma.
  // Los cambios que hace esta pantalla (REPLACE con LIST_WRITE en el state) no se vuelven a leer. "Atrás" y
  // "Adelante" (POP) siempre se leen, aunque el historial traiga ese mismo state.
  useEffect(() => {
    const ownWrite = (location.state as ListWriteState | null)?.contactsListWrite;
    if (ownWrite && navigationType === NavigationType.Replace) return;
    searchRef.current = urlSearch;
    setSearch(urlSearch);
    // Solo al cambiar de ubicación: location.state y urlSearch son de esa misma ubicación.
  }, [location.key]);

  const goToPage = useCallback(
    (index: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (index <= 0) next.delete('pagina');
          else next.set('pagina', String(index + 1));
          return next;
        },
        { replace: true, state: LIST_WRITE },
      );
    },
    [setSearchParams],
  );

  /** HU-205: guarda la búsqueda y la clasificación en la URL y vuelve a la primera página. */
  const writeFilters = useCallback(
    (nextSearch: string, nextClassification: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (nextSearch === '') next.delete('buscar');
          else next.set('buscar', nextSearch);
          if (nextClassification === 'todos') next.delete('clasificacion');
          else next.set('clasificacion', nextClassification);
          next.delete('pagina');
          return next;
        },
        { replace: true, state: LIST_WRITE },
      );
    },
    [setSearchParams],
  );

  const onSearchChange = (value: string) => {
    searchRef.current = value;
    setSearch(value);
    writeFilters(value, classification);
  };

  // Usa searchRef: la URL puede ir atrasada respecto de lo último que se escribió.
  const onClassificationChange = (value: string) => writeFilters(searchRef.current, value);

  // HU-205: búsqueda y clasificación; HU-504: con etiqueta, primero.
  const found = useMemo(
    () => (Array.isArray(contacts) ? badgedFirst(filterContacts(contacts, search, classification)) : []),
    [contacts, search, classification],
  );
  const totalPages = Math.max(1, Math.ceil(found.length / CONTACTS_PAGE_SIZE));
  const shownPage = Math.min(pageIndex, totalPages - 1);
  const pageContacts = found.slice(shownPage * CONTACTS_PAGE_SIZE, (shownPage + 1) * CONTACTS_PAGE_SIZE);

  // Si se pidió una página que ya no existe (recarga, búsqueda con menos resultados), se pasa a la última.
  const ready = Array.isArray(contacts);
  useEffect(() => {
    if (ready && pageIndex > totalPages - 1) goToPage(totalPages - 1);
  }, [ready, pageIndex, totalPages, goToPage]);

  const fromList = { from: location.pathname + location.search };
  // HU-204: sin ningún contacto registrado se mantiene "Aún no hay contactos registrados.".
  const isEmpty = ready && contacts.length === 0;

  return (
    <main className="page">
      <div className="page-header">
        <h1>Contactos</h1>
        <button type="button" onClick={() => navigate(ROUTES.newContact)}>
          Nuevo contacto
        </button>
      </div>

      <div className="list-toolbar">
        <input
          type="search"
          className="list-search"
          aria-label={CONTACT_SEARCH_LABEL}
          placeholder={CONTACT_SEARCH_LABEL}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          autoComplete="off"
        />
        <div className="list-filter">
          <label htmlFor="contacts-classification">Clasificación</label>
          <select
            id="contacts-classification"
            value={classification}
            onChange={(e) => onClassificationChange(e.target.value)}
          >
            {CLASSIFICATION_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* HU-205: cuántos se encontraron; se anuncia al cambiar mientras se escribe. */}
      <p className="list-count" role="status">
        {ready && !isEmpty ? foundContactsMessage(found.length) : ''}
      </p>

      {contacts === 'loading' && <p>{CONTACTS_LIST_MESSAGES.loading}</p>}
      {contacts === 'error' && (
        <p className="field-error" role="alert">
          {CONTACTS_LIST_MESSAGES.error}
        </p>
      )}
      {isEmpty && <p className="empty-state">{CONTACTS_LIST_MESSAGES.empty}</p>}

      {ready && found.length > 0 && (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Nombre completo</th>
                  <th scope="col">Correo electrónico</th>
                  <th scope="col">Teléfono</th>
                  <th scope="col">Clasificación</th>
                  <th scope="col">Fecha de registro</th>
                </tr>
              </thead>
              <tbody>
                {pageContacts.map((contact) => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    fromList={fromList}
                    onOpen={() => navigate(contactPath(contact.id), { state: fromList })}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <nav className="pagination" aria-label="Paginación de contactos">
            <button
              type="button"
              className="button-secondary"
              onClick={() => goToPage(shownPage - 1)}
              disabled={shownPage === 0}
            >
              Anterior
            </button>
            <span aria-live="polite">
              Página {shownPage + 1} de {totalPages}
            </span>
            <button
              type="button"
              className="button-secondary"
              onClick={() => goToPage(shownPage + 1)}
              disabled={shownPage >= totalPages - 1}
            >
              Siguiente
            </button>
          </nav>
        </>
      )}
    </main>
  );
}

/**
 * Fila clickeable: clic (o Enter) en cualquier parte abre la ficha. El nombre también es un enlace.
 * HU-504: junto al nombre, la etiqueta verde del formulario mientras no se abra la ficha.
 */
function ContactRow({ contact, fromList, onOpen }: { contact: Contact; fromList: FromListState; onOpen: () => void }) {
  const phone = contact.phoneNumber ? formatPhone(contact.phoneCountry ?? 'CR', contact.phoneNumber) : null;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') onOpen();
  };
  return (
    <tr className="clickable-row" onClick={onOpen} onKeyDown={onKeyDown}>
      <td>
        <Link to={contactPath(contact.id)} state={fromList} onClick={(e) => e.stopPropagation()}>
          {contact.fullName}
        </Link>
        {contact.formBadge && <span className="form-badge">{contact.formBadge}</span>}
      </td>
      <td>{contact.email ?? '—'}</td>
      <td className="nowrap">{phone ?? '—'}</td>
      <td>{CONTACT_CLASSIFICATION_LABELS[contact.classification] ?? contact.classification}</td>
      <td className="nowrap">{contact.createdAt ? formatDateCR(contact.createdAt) : '—'}</td>
    </tr>
  );
}
