import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { contactPath, ROUTES } from '../app/routes';
import { formatPhone } from '../shared/phone/phone';
import { CONTACT_CLASSIFICATION_LABELS, type Contact } from '../shared/types';
import { formatDateCR } from '../shared/utils/dates';
import { pageIndexFromParam, type FromListState } from './contactDetail';
import { countContacts, listContactsPage } from './contactsApi';
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

/**
 * Pantalla "Contactos". HU-201: botón "Nuevo contacto". HU-204: lista paginada en orden alfabético.
 * HU-207: la página vive en la URL ("?pagina=2"); al abrir una ficha se le pasa esa URL para que
 * "Volver a contactos" regrese a la lista tal como estaba. La búsqueda y los filtros, cuando existan,
 * deben guardarse también en la URL para conservarse de la misma forma.
 */
export function ContactsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageIndex = pageIndexFromParam(searchParams.get('pagina'));
  // cursors[i] = desde dónde empieza la página i (null para la primera).
  const cursors = useRef<(ContactsCursor | null)[]>([null]);
  const [total, setTotal] = useState<number | null>(null);
  const [state, setState] = useState<ListState>({ status: 'loading' });

  const goToPage = useCallback(
    (index: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (index <= 0) next.delete('pagina');
          else next.set('pagina', String(index + 1));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    let cancelled = false;
    countContacts()
      .then((count) => !cancelled && setTotal(count))
      .catch(() => !cancelled && setState({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
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
  }, [pageIndex, goToPage]);

  const fromList = { from: location.pathname + location.search };
  const totalPages = Math.max(1, Math.ceil((total ?? 0) / CONTACTS_PAGE_SIZE));
  const isEmpty = state.status === 'ready' && state.contacts.length === 0 && pageIndex === 0;

  return (
    <main className="page">
      <div className="page-header">
        <h1>Contactos</h1>
        <button type="button" onClick={() => navigate(ROUTES.newContact)}>
          Nuevo contacto
        </button>
      </div>

      {state.status === 'loading' && <p>{CONTACTS_LIST_MESSAGES.loading}</p>}
      {state.status === 'error' && (
        <p className="field-error" role="alert">
          {CONTACTS_LIST_MESSAGES.error}
        </p>
      )}
      {isEmpty && <p className="empty-state">{CONTACTS_LIST_MESSAGES.empty}</p>}

      {state.status === 'ready' && !isEmpty && (
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
                {state.contacts.map((contact) => (
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
              Página {pageIndex + 1} de {totalPages}
            </span>
            <button
              type="button"
              className="button-secondary"
              onClick={() => goToPage(pageIndex + 1)}
              disabled={!state.nextCursor}
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
