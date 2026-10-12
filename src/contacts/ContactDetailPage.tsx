import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useLocationNotice } from '../shared/hooks/useLocationNotice';
import { formatPhone } from '../shared/phone/phone';
import { CONTACT_CLASSIFICATION_LABELS, type Contact } from '../shared/types';
import { formatDateTimeCR } from '../shared/utils/dates';
import { getContact } from './contactsApi';

type LoadState = { status: 'loading' } | { status: 'notFound' } | { status: 'error' } | { status: 'ready'; contact: Contact };

/** Ficha del contacto. Versión mínima para HU-201; la ficha completa es HU-207. */
export function ContactDetailPage() {
  const { contactId } = useParams();
  const notice = useLocationNotice();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getContact(contactId ?? '')
      .then((contact) => {
        if (!cancelled) setState(contact ? { status: 'ready', contact } : { status: 'notFound' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  return (
    <main className="page">
      {notice && (
        <p className="notice-success" role="status">
          {notice}
        </p>
      )}
      {state.status === 'loading' && <p>Cargando…</p>}
      {state.status === 'notFound' && <p>El contacto no existe.</p>}
      {state.status === 'error' && <p className="field-error">No se pudo cargar el contacto.</p>}
      {state.status === 'ready' && <ContactCard contact={state.contact} />}
    </main>
  );
}

function ContactCard({ contact }: { contact: Contact }) {
  // HU-202: "+506 8888-8888" para Costa Rica, "+1 3055551234" para otros países.
  const phone = contact.phoneNumber ? formatPhone(contact.phoneCountry ?? 'CR', contact.phoneNumber) : null;
  const rows: [string, string | null][] = [
    ['Correo electrónico', contact.email],
    ['Teléfono', phone],
    ['Dirección', contact.address],
    ['Clasificación', CONTACT_CLASSIFICATION_LABELS[contact.classification]],
    ['Registrado', contact.createdAt ? formatDateTimeCR(contact.createdAt) : null],
  ];
  return (
    <>
      <h1>{contact.fullName}</h1>
      <dl className="detail-list">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
