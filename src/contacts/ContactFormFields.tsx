// Campos del formulario de contacto, compartidos por "Nuevo contacto" (HU-201 a HU-203) y "Editar contacto" (HU-210).
import { Link } from 'react-router';
import { contactPath } from '../app/routes';
import { PhoneField } from '../shared/phone/PhoneField';
import {
  CONTACT_LIMITS,
  CONTACT_MESSAGES,
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

interface ContactFormFieldsProps {
  values: ContactFormValues;
  onChange: (update: (prev: ContactFormValues) => ContactFormValues) => void;
  errors: ContactFormErrors;
  duplicates: ContactDuplicates;
}

/** Nombre, correo, teléfono con país y dirección, con sus contadores y mensajes. */
export function ContactFormFields({ values, onChange, errors, duplicates }: ContactFormFieldsProps) {
  const set = (field: keyof ContactFormValues) => (event: { target: { value: string } }) =>
    onChange((prev) => ({ ...prev, [field]: event.target.value }));

  return (
    <>
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
      <CharCounter id="fullName-count" length={values.fullName.length} max={CONTACT_LIMITS.fullName} />
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
      <CharCounter id="email-count" length={values.email.length} max={CONTACT_LIMITS.email} />
      <FieldError id="email-error" message={errors.email} duplicateOf={duplicates.email} />

      <label htmlFor="phone">Teléfono</label>
      <PhoneField
        id="phone"
        country={values.phoneCountry}
        number={values.phone}
        onCountryChange={(phoneCountry) => onChange((prev) => ({ ...prev, phoneCountry }))}
        onNumberChange={(phone) => onChange((prev) => ({ ...prev, phone }))}
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
      <CharCounter id="address-count" length={values.address.length} max={CONTACT_LIMITS.address} />
      <FieldError id="address-error" message={errors.address} />
    </>
  );
}
