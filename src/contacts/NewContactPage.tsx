import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { contactPath, ROUTES } from '../app/routes';
import type { NoticeState } from '../shared/hooks/useLocationNotice';
import { PHONE_DIAL_CODES, DEFAULT_PHONE_COUNTRY } from '../shared/types';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import { createContact } from './contactsApi';
import {
  CONTACT_MESSAGES,
  EMPTY_CONTACT_FORM,
  isContactFormDirty,
  toNewContactInput,
  validateContactForm,
  type ContactFormErrors,
  type ContactFormValues,
} from './contactForm';

/** HU-201: registrar un nuevo contacto. */
export function NewContactPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<ContactFormValues>(EMPTY_CONTACT_FORM);
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const set = (field: keyof ContactFormValues) => (event: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [field]: event.target.value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const formErrors = validateContactForm(values);
    setErrors(formErrors);
    setSaveError(null);
    if (Object.keys(formErrors).length > 0) return;

    setSaving(true);
    try {
      const id = await createContact(toNewContactInput(values));
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

  const dialCode = PHONE_DIAL_CODES[DEFAULT_PHONE_COUNTRY];

  return (
    <main className="page">
      <h1>Nuevo contacto</h1>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="fullName">
          Nombre completo <span className="required" aria-hidden="true">*</span>
        </label>
        <input
          id="fullName"
          value={values.fullName}
          onChange={set('fullName')}
          autoComplete="off"
          aria-required="true"
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={errors.fullName ? 'fullName-error' : undefined}
        />
        {errors.fullName && (
          <p id="fullName-error" className="field-error" role="alert">
            {errors.fullName}
          </p>
        )}

        <p className="form-hint" id="contact-method-hint">
          Ingrese al menos uno: correo electrónico o teléfono.
        </p>
        <label htmlFor="email">Correo electrónico</label>
        <input
          id="email"
          type="email"
          value={values.email}
          onChange={set('email')}
          autoComplete="off"
          aria-describedby="contact-method-hint"
          aria-invalid={errors.emailOrPhone ? true : undefined}
        />

        <label htmlFor="phone">Teléfono</label>
        <div className="phone-field">
          <span className="phone-prefix" aria-label="Código de país Costa Rica">
            {dialCode}
          </span>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            value={values.phone}
            onChange={set('phone')}
            autoComplete="off"
            aria-describedby="contact-method-hint"
            aria-invalid={errors.emailOrPhone ? true : undefined}
          />
        </div>
        {errors.emailOrPhone && (
          <p className="field-error" role="alert">
            {errors.emailOrPhone}
          </p>
        )}

        <label htmlFor="address">
          Dirección <span className="optional">(opcional)</span>
        </label>
        <textarea id="address" rows={2} value={values.address} onChange={set('address')} />

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
