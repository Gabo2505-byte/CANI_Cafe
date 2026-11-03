import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, NavigationType, useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router';
import { contactPath, ROUTES } from '../app/routes';
import { formatPhone } from '../shared/phone/phone';
import { CONTACT_CLASSIFICATION_LABELS, type Contact } from '../shared/types';
import { formatDateCR } from '../shared/utils/dates';
import { pageIndexFromParam, type FromListState } from './contactDetail';
import {
  CLASSIFICATION_FILTER_OPTIONS,
  classificationFilterFromParam,
  CONTACT_SEARCH_LABEL,
  filterContacts,
  foundContactsMessage,
  isFiltering,
} from './contactSearch';
import { countContacts, listAllContacts, listContactsPage } from './contactsApi';
import { CONTACTS_PAGE_SIZE, type ContactsCursor } from './contactsRepository';

export const CONTACTS_LIST_MESSAGES = {
  empty: 'Aún no hay contactos registrados.',
  loading: 'Cargando contactos…',
  error: 'No se pudieron cargar los contactos. Intente de nuevo.',
} as const;

type ListState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; contacts: Contact[]; nextCursor: ContactsCursor | null };

/** Marca de los cambios de URL que hace la propia lista (página, búsqueda y clasificación). */
interface ListWriteState {
  contactsListWrite?: boolean;
}
const LIST_WRITE: ListWriteState = { contactsListWrite: true };

/** Lo que se dibuja: la página actual y cuántos contactos se encontraron (null si aún no se sabe). */
type ListView =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; contacts: Contact[]; hasNext: boolean; totalPages: number; found: number | null };

/**
 * Pantalla "Contactos". HU-201: botón "Nuevo contacto". HU-204: lista paginada en orden alfabético.
 * HU-205: buscador y lista "Clasificación" (ver la decisión de buscar en el navegador en contactSearch.ts).
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
  const filtering = isFiltering(search, classification);
  // cursors[i] = desde dónde empieza la página i (null para la primera).
  const cursors = useRef<(ContactsCursor | null)[]>([null]);
  const [total, setTotal] = useState<number | null>(null);
  const [state, setState] = useState<ListState>({ status: 'loading' });
  // HU-205: todos los contactos, se piden una sola vez al empezar a buscar o filtrar.
  const [allContacts, setAllContacts] = useState<Contact[] | 'loading' | 'error' | null>(null);
  const allRequested = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
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

  useEffect(() => {
    let cancelled = false;
    countContacts()
      .then((count) => !cancelled && setTotal(count))
      .catch(() => !cancelled && setState({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, []);

  // HU-204: sin búsqueda ni filtro, cada página se pide a Firestore.
  useEffect(() => {
    if (filtering) return;
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      const known = cursors.current;
      // Página más cercana (sin pasarse) cuyo inicio ya se conoce. Al volver a "?pagina=3" sin
      // cursores (recarga, enlace directo) se recorren las páginas anteriores desde la primera.
      let index = pageIndex;
      while (index > 0 && known[index] === undefined) index -= 1;
      let page = await listContactsPage(known[index] ?? null);
      while (index < pageIndex && page.nextCursor) {
        index += 1;
        known[index] = page.nextCursor;
        page = await listContactsPage(page.nextCursor);
      }
      if (cancelled) return;
      if (page.nextCursor) known[index + 1] = page.nextCursor;
      if (index !== pageIndex) {
        // Se pidió una página que ya no existe: se queda en la última.
        goToPage(index);
        return;
      }
      setState({ status: 'ready', contacts: page.contacts, nextCursor: page.nextCursor });
    })().catch(() => !cancelled && setState({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [pageIndex, goToPage, filtering]);

  // HU-205: al empezar a buscar o filtrar se traen todos los contactos (una vez; si falla, se reintenta al cambiar
  // la búsqueda). No se cancela al borrar la búsqueda: la lista queda lista para la próxima.
  useEffect(() => {
    if (!filtering || allRequested.current) return;
    allRequested.current = true;
    setAllContacts('loading');
    listAllContacts()
      .then((contacts) => mounted.current && setAllContacts(contacts))
      .catch(() => {
        allRequested.current = false;
        if (mounted.current) setAllContacts('error');
      });
  }, [filtering, search, classification]);

  const filtered = useMemo(
    () => (Array.isArray(allContacts) ? filterContacts(allContacts, search, classification) : []),
    [allContacts, search, classification],
  );

  let view: ListView;
  if (filtering) {
    if (allContacts === 'error') view = { status: 'error' };
    else if (!Array.isArray(allContacts)) view = { status: 'loading' };
    else {
      const totalPages = Math.max(1, Math.ceil(filtered.length / CONTACTS_PAGE_SIZE));
      const index = Math.min(pageIndex, totalPages - 1);
      view = {
        status: 'ready',
        contacts: filtered.slice(index * CONTACTS_PAGE_SIZE, (index + 1) * CONTACTS_PAGE_SIZE),
        hasNext: index < totalPages - 1,
        totalPages,
        found: filtered.length,
      };
    }
  } else if (state.status === 'ready') {
    view = {
      status: 'ready',
      contacts: state.contacts,
      hasNext: state.nextCursor !== null,
      totalPages: Math.max(1, Math.ceil((total ?? 0) / CONTACTS_PAGE_SIZE)),
      found: total,
    };
  } else {
    view = state;
  }

  // HU-205: si la búsqueda deja menos páginas que la que estaba abierta, se pasa a la última.
  const lastFilteredPage = view.status === 'ready' && filtering ? view.totalPages - 1 : null;
  useEffect(() => {
    if (lastFilteredPage !== null && pageIndex > lastFilteredPage) goToPage(lastFilteredPage);
  }, [lastFilteredPage, pageIndex, goToPage]);

  const fromList = { from: location.pathname + location.search };
  // HU-204: sin ningún contacto registrado (y sin buscar) se mantiene "Aún no hay contactos registrados.".
  const isEmpty = !filtering && view.status === 'ready' && view.contacts.length === 0 && pageIndex === 0;
  const noResults = filtering && view.status === 'ready' && view.found === 0;

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
        {view.status === 'ready' && !isEmpty && view.found !== null ? foundContactsMessage(view.found) : ''}
      </p>

      {view.status === 'loading' && <p>{CONTACTS_LIST_MESSAGES.loading}</p>}
      {view.status === 'error' && (
        <p className="field-error" role="alert">
          {CONTACTS_LIST_MESSAGES.error}
        </p>
      )}
      {isEmpty && <p className="empty-state">{CONTACTS_LIST_MESSAGES.empty}</p>}

      {view.status === 'ready' && !isEmpty && !noResults && (
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
                {view.contacts.map((contact) => (
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
              onClick={() => goToPage(pageIndex - 1)}
              disabled={pageIndex === 0}
            >
              Anterior
            </button>
            <span aria-live="polite">
              Página {Math.min(pageIndex, view.totalPages - 1) + 1} de {view.totalPages}
            </span>
            <button
              type="button"
              className="button-secondary"
              onClick={() => goToPage(pageIndex + 1)}
              disabled={!view.hasNext}
            >
              Siguiente
            </button>
          </nav>
        </>
      )}
    </main>
  );
}

/** Fila clickeable: clic (o Enter) en cualquier parte abre la ficha. El nombre también es un enlace. */
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
      </td>
      <td>{contact.email ?? '—'}</td>
      <td className="nowrap">{phone ?? '—'}</td>
      <td>{CONTACT_CLASSIFICATION_LABELS[contact.classification] ?? contact.classification}</td>
      <td className="nowrap">{contact.createdAt ? formatDateCR(contact.createdAt) : '—'}</td>
    </tr>
  );
}
