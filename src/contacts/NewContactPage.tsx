import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { contactPath, ROUTES } from '../app/routes';
import type { NoticeState } from '../shared/hooks/useLocationNotice';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import { ContactFormFields } from './ContactFormFields';
import { createContact, findDuplicateContacts } from './contactsApi';
import {
  CONTACT_MESSAGES,
  duplicateErrors,
  EMPTY_CONTACT_FORM,
  isContactFormDirty,
  toNewContactInput,
  validateContactForm,
  type ContactDuplicates,
  type ContactFormErrors,
  type ContactFormValues,
} from './contactForm';

/** HU-201: registrar un nuevo contacto. HU-202: teléfono con país. HU-203: validaciones y repetidos. */
export function NewContactPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<ContactFormValues>(EMPTY_CONTACT_FORM);
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
      // HU-203: mientras haya un correo o teléfono repetido, el contacto no se guarda.
      const found = await findDuplicateContacts(input);
      if (found.email || found.phone) {
        setDuplicates(found);
        setErrors(duplicateErrors(found));
        setSaving(false);
        return;
      }
      const id = await createContact(input);
      const state: NoticeState = { notice: CONTACT_MESSAGES.created };
      // replace: "Atrás" desde la ficha no vuelve al formulario ya enviado.
      navigate(contactPath(id), { replace: true, state });
    } catch {
      setSaveError(CONTACT_MESSAGES.saveError);
      setSaving(false);
    }
  }

  function handleCancel() {
    if (isContactFormDirty(values)) setConfirmLeave(true);
    else navigate(ROUTES.contacts);
  }

  return (
    <main className="page">
      <h1>Nuevo contacto</h1>
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
          message={CONTACT_MESSAGES.leaveConfirm}
          confirmLabel="Salir sin guardar"
          cancelLabel="Seguir editando"
          onConfirm={() => navigate(ROUTES.contacts)}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </main>
  );
}
