import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { contactPath, ROUTES } from '../app/routes';
import type { NoticeState } from '../shared/hooks/useLocationNotice';
import { PhoneField } from '../shared/phone/PhoneField';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import { createContact, findDuplicateContacts } from './contactsApi';
import {
  CONTACT_LIMITS,
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

/** Mensaje de un campo; si es un dato repetido, con el enlace "Ver contacto" (HU-203). */
function FieldError({ id, message, duplicateOf }: { id: string; message?: string; duplicateOf?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error" role="alert">
      {message}
      {duplicateOf && (
        <>
          {' '}
          <Link to={contactPath(duplicateOf)} className="field-error-link">
            {CONTACT_MESSAGES.viewContact}
          </Link>
        </>
      )}
    </p>
  );
}

/**
 * HU-203: contador "37/100" debajo del campo. Llegar al máximo es válido (se puede guardar);
 * solo se informa que no se pueden escribir más caracteres. No es un error.
 */
function CharCounter({ id, length, max }: { id: string; length: number; max: number }) {
  const atLimit = length >= max;
  return (
    <p id={id} className={atLimit ? 'char-counter at-limit' : 'char-counter'} aria-live="polite">
      {atLimit && <span className="char-counter-message">{CONTACT_MESSAGES.atLimit(max)} </span>}
      <span>
        {length}/{max}
      </span>
    </p>
  );
}

/** HU-201: registrar un nuevo contacto. HU-202: teléfono con país. HU-203: validaciones y repetidos. */
export function NewContactPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<ContactFormValues>(EMPTY_CONTACT_FORM);
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [duplicates, setDuplicates] = useState<ContactDuplicates>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const set = (field: keyof ContactFormValues) => (event: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [field]: event.target.value }));

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
        <label htmlFor="fullName">
          Nombre completo <span className="required" aria-hidden="true">*</span>
        </label>
        <input
          id="fullName"
          value={values.fullName}
          onChange={set('fullName')}
          maxLength={CONTACT_LIMITS.fullName}
          autoComplete="off"
          aria-required="true"
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={errors.fullName ? 'fullName-error fullName-count' : 'fullName-count'}
        />
        <CharCounter
          id="fullName-count"
          length={values.fullName.length}
          max={CONTACT_LIMITS.fullName}
        />
        <FieldError id="fullName-error" message={errors.fullName} />

        <p className="form-hint" id="contact-method-hint">
          Ingrese al menos uno: correo electrónico o teléfono.
        </p>
        <label htmlFor="email">Correo electrónico</label>
        <input
          id="email"
          type="email"
          value={values.email}
          onChange={set('email')}
          maxLength={CONTACT_LIMITS.email}
          placeholder="nombre@dominio.com"
          autoComplete="off"
          aria-describedby={errors.email ? 'email-error email-count' : 'contact-method-hint email-count'}
          aria-invalid={errors.email || errors.emailOrPhone ? true : undefined}
        />
        <CharCounter
          id="email-count"
          length={values.email.length}
          max={CONTACT_LIMITS.email}
        />
        <FieldError id="email-error" message={errors.email} duplicateOf={duplicates.email} />

        <label htmlFor="phone">Teléfono</label>
        <PhoneField
          id="phone"
          country={values.phoneCountry}
          number={values.phone}
          onCountryChange={(phoneCountry) => setValues((prev) => ({ ...prev, phoneCountry }))}
          onNumberChange={(phone) => setValues((prev) => ({ ...prev, phone }))}
          invalid={Boolean(errors.emailOrPhone || errors.phone)}
          describedBy={errors.phone ? 'phone-error' : 'contact-method-hint'}
        />
        <FieldError id="phone-error" message={errors.phone} duplicateOf={duplicates.phone} />
        <FieldError id="emailOrPhone-error" message={errors.emailOrPhone} />

        <label htmlFor="address">
          Dirección <span className="optional">(opcional)</span>
        </label>
        <textarea
          id="address"
          rows={2}
          value={values.address}
          onChange={set('address')}
          maxLength={CONTACT_LIMITS.address}
          aria-invalid={errors.address ? true : undefined}
          aria-describedby={errors.address ? 'address-error address-count' : 'address-count'}
        />
        <CharCounter
          id="address-count"
          length={values.address.length}
          max={CONTACT_LIMITS.address}
        />
        <FieldError id="address-error" message={errors.address} />

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
