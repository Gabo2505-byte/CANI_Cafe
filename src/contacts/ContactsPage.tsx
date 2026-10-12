import { useEffect, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { contactPath, ROUTES } from '../app/routes';
import { formatPhone } from '../shared/phone/phone';
import { CONTACT_CLASSIFICATION_LABELS, type Contact } from '../shared/types';
import { formatDateCR } from '../shared/utils/dates';
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

/** Pantalla "Contactos". HU-201: botón "Nuevo contacto". HU-204: lista paginada en orden alfabético. */
export function ContactsPage() {
  const navigate = useNavigate();
  const [pageIndex, setPageIndex] = useState(0);
  // cursors[i] = desde dónde empieza la página i (null para la primera).
  const [cursors, setCursors] = useState<(ContactsCursor | null)[]>([null]);
  const [total, setTotal] = useState<number | null>(null);
  const [state, setState] = useState<ListState>({ status: 'loading' });

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
    listContactsPage(cursors[pageIndex] ?? null)
      .then((page) => {
        if (cancelled) return;
        setState({ status: 'ready', contacts: page.contacts, nextCursor: page.nextCursor });
        if (page.nextCursor) {
          setCursors((prev) => {
            const next = [...prev];
            next[pageIndex + 1] = page.nextCursor;
            return next;
          });
        }
      })
      .catch(() => !cancelled && setState({ status: 'error' }));
    return () => {
      cancelled = true;
    };
    // Solo al cambiar de página: el cursor de esa página ya se guardó al cargar la anterior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex]);

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
                  <ContactRow key={contact.id} contact={contact} onOpen={() => navigate(contactPath(contact.id))} />
                ))}
              </tbody>
            </table>
          </div>

          <nav className="pagination" aria-label="Paginación de contactos">
            <button
              type="button"
              className="button-secondary"
              onClick={() => setPageIndex((i) => i - 1)}
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
              onClick={() => setPageIndex((i) => i + 1)}
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
function ContactRow({ contact, onOpen }: { contact: Contact; onOpen: () => void }) {
  const phone = contact.phoneNumber ? formatPhone(contact.phoneCountry ?? 'CR', contact.phoneNumber) : null;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') onOpen();
  };
  return (
    <tr className="clickable-row" onClick={onOpen} onKeyDown={onKeyDown}>
      <td>
        <Link to={contactPath(contact.id)} onClick={(e) => e.stopPropagation()}>
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
