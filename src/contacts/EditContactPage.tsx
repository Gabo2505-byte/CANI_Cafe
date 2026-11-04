import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { contactPath, ROUTES } from '../app/routes';
import type { NoticeState } from '../shared/hooks/useLocationNotice';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import { CONTACT_DETAIL_MESSAGES, type FromListState } from './contactDetail';
import { ContactFormFields } from './ContactFormFields';
import { findDuplicateContacts, getContact, updateContact } from './contactsApi';
import {
  CONTACT_MESSAGES,
  contactToFormValues,
  duplicateErrors,
  isContactEditDirty,
  toNewContactInput,
  validateContactForm,
  type ContactDuplicates,
  type ContactFormErrors,
  type ContactFormValues,
} from './contactForm';

type LoadState = { status: 'loading' } | { status: 'notFound' } | { status: 'error' } | { status: 'ready'; initial: ContactFormValues };

/**
 * HU-210: editar un contacto. Mismos campos y validaciones que al registrarlo (HU-201 a HU-203). La clasificación,
 * el origen y la fecha de registro no están en el formulario y no se cambian.
 * Al guardar o cancelar se vuelve a la ficha; se le devuelve `from` para que "Volver a contactos" siga llevando a la
 * lista como estaba (HU-207).
 */
export function EditContactPage() {
  const { contactId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [from] = useState(() => (location.state as FromListState | null)?.from);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getContact(contactId)
      .then((contact) => {
        if (cancelled) return;
        setLoad(contact ? { status: 'ready', initial: contactToFormValues(contact) } : { status: 'notFound' });
      })
      .catch(() => !cancelled && setLoad({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const backToDetail = (notice?: string) => {
    const state: NoticeState & FromListState = { ...(notice && { notice }), ...(from && { from }) };
    // replace: "Atrás" desde la ficha no vuelve al formulario.
    navigate(contactPath(contactId), { replace: true, state });
  };

  return (
    <main className="page">
      <h1>{CONTACT_MESSAGES.editTitle}</h1>
      {load.status === 'loading' && <p>{CONTACT_DETAIL_MESSAGES.loading}</p>}
      {load.status === 'notFound' && (
        <p role="alert">
          {CONTACT_DETAIL_MESSAGES.notFound} <Link to={ROUTES.contacts}>{CONTACT_DETAIL_MESSAGES.back}</Link>
        </p>
      )}
      {load.status === 'error' && (
        <p className="field-error" role="alert">
          {CONTACT_DETAIL_MESSAGES.loadError}
        </p>
      )}
      {load.status === 'ready' && (
        <EditContactForm contactId={contactId} initial={load.initial} onDone={backToDetail} />
      )}
    </main>
  );
}

interface EditContactFormProps {
  contactId: string;
  initial: ContactFormValues;
  /** Vuelve a la ficha, con el aviso si se guardó. */
  onDone: (notice?: string) => void;
}

function EditContactForm({ contactId, initial, onDone }: EditContactFormProps) {
  const [values, setValues] = useState<ContactFormValues>(initial);
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [duplicates, setDuplicates] = useState<ContactDuplicates>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const formErrors = validateContactForm(values);
    setErrors(formErrors);
    setDuplicates({});
    setSaveError(null);
    if (Object.keys(formErrors).length > 0) return;

    setSaving(true);
    try {
      const input = toNewContactInput(values);
      // HU-210 (criterio 4) y HU-203: si el correo o el teléfono ya es de OTRO contacto, no se guarda.
      const found = await findDuplicateContacts(input, contactId);
      if (found.email || found.phone) {
        setDuplicates(found);
        setErrors(duplicateErrors(found));
        setSaving(false);
        return;
      }
      await updateContact(contactId, input);
      onDone(CONTACT_MESSAGES.edited);
    } catch {
      setSaveError(CONTACT_MESSAGES.editSaveError);
      setSaving(false);
    }
  }

  function handleCancel() {
    if (isContactEditDirty(values, initial)) setConfirmLeave(true);
    else onDone();
  }

  return (
    <>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <ContactFormFields values={values} onChange={setValues} errors={errors} duplicates={duplicates} />

        {saveError && (
          <p className="field-error" role="alert">
            {saveError}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="button-secondary" onClick={handleCancel}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}>
            Guardar
          </button>
        </div>
      </form>

      {confirmLeave && (
        <ConfirmDialog
          message={CONTACT_MESSAGES.editLeaveConfirm}
          confirmLabel="Salir sin guardar"
          cancelLabel="Seguir editando"
          onConfirm={() => onDone()}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </>
  );
}
