import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { toCostaRicaDateKey } from '../shared/utils/dates';
import {
  COMMUNICATION_LIMITS,
  COMMUNICATION_MESSAGES as MSG,
  emptyCommunicationForm,
  MEDIUM_OPTIONS,
  saleOptions,
  toNewCommunication,
  type OpenSaleOption,
  validateCommunicationForm,
  type CommunicationFormErrors,
  type CommunicationFormValues,
} from './communicationForm';
import { createCommunication } from './communicationsApi';
import { SaleNotOpenError } from './communicationsRepository';

interface RegisterCommunicationDialogProps {
  contactId: string;
  /** HU-212: posibles ventas del contacto que no están ganadas ni perdidas (de la más reciente a la más antigua). */
  openSales: OpenSaleOption[];
  /** Se guardó: la ficha cierra la ventana, recarga el historial y muestra la confirmación. */
  onSaved: () => void;
  onCancel: () => void;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  );
}

/** Contador "37/1000" (mismo patrón que HU-203). Llegar al máximo es válido; solo se informa. */
function CharCounter({ id, length, max }: { id: string; length: number; max: number }) {
  const atLimit = length >= max;
  return (
    <p id={id} className={atLimit ? 'char-counter at-limit' : 'char-counter'} aria-live="polite">
      {atLimit && <span className="char-counter-message">{MSG.atLimit(max)} </span>}
      <span>
        {length}/{max}
      </span>
    </p>
  );
}

/** HU-211: ventana "Registrar comunicación" con fecha, medio y nota (los tres obligatorios). */
export function RegisterCommunicationDialog({ contactId, openSales, onSaved, onCancel }: RegisterCommunicationDialogProps) {
  const auth = useAuth();
  const titleId = useId();
  const dateRef = useRef<HTMLInputElement>(null);
  // "Hoy" en Costa Rica, fijo mientras la ventana está abierta.
  const [today] = useState(() => toCostaRicaDateKey(new Date()));
  const [values, setValues] = useState<CommunicationFormValues>(() => emptyCommunicationForm(today));
  const [errors, setErrors] = useState<CommunicationFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<CommunicationFormValues>) => setValues((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    dateRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, saving]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const formErrors = validateCommunicationForm(
      values,
      today,
      openSales.map((sale) => sale.id),
    );
    setErrors(formErrors);
    setSaveError(null);
    if (Object.keys(formErrors).length > 0) return;
    const userId = auth.status === 'active' ? auth.firebaseUser.uid : null;
    if (!userId) {
      setSaveError(MSG.saveError);
      return;
    }
    setSaving(true);
    try {
      await createCommunication(toNewCommunication(contactId, values), userId);
      onSaved();
    } catch (error) {
      if (error instanceof SaleNotOpenError) setErrors({ sale: MSG.saleNotOpen });
      else setSaveError(MSG.saveError);
      setSaving(false);
    }
  }

  const describedBy = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;

  return (
    <div className="dialog-backdrop">
      <div className="dialog dialog-form" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="dialog-title">
          {MSG.title}
        </h2>
        <form className="form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="communication-date">Fecha</label>
          <input
            ref={dateRef}
            id="communication-date"
            type="date"
            value={values.date}
            max={today}
            required
            onChange={(e) => set({ date: e.target.value })}
            aria-invalid={errors.date ? true : undefined}
            aria-describedby={describedBy(errors.date && 'communication-date-error')}
          />
          <FieldError id="communication-date-error" message={errors.date} />

          <label htmlFor="communication-medium">Medio</label>
          <select
            id="communication-medium"
            value={values.medium}
            required
            onChange={(e) => set({ medium: e.target.value as CommunicationFormValues['medium'] })}
            aria-invalid={errors.medium ? true : undefined}
            aria-describedby={describedBy(errors.medium && 'communication-medium-error')}
          >
            <option value="" disabled>
              Seleccione…
            </option>
            {MEDIUM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <FieldError id="communication-medium-error" message={errors.medium} />

          {values.medium === 'otro' && (
            <>
              <label htmlFor="communication-other">¿Cuál fue el medio?</label>
              <input
                id="communication-other"
                type="text"
                placeholder="Por ejemplo: Instagram"
                value={values.otherMedium}
                maxLength={COMMUNICATION_LIMITS.otherMedium}
                required
                onChange={(e) => set({ otherMedium: e.target.value })}
                aria-invalid={errors.otherMedium ? true : undefined}
                aria-describedby={describedBy(errors.otherMedium && 'communication-other-error')}
              />
              <FieldError id="communication-other-error" message={errors.otherMedium} />
            </>
          )}

          <label htmlFor="communication-sale">Posible venta</label>
          <select
            id="communication-sale"
            value={values.sale}
            required
            onChange={(e) => set({ sale: e.target.value })}
            aria-invalid={errors.sale ? true : undefined}
            aria-describedby={describedBy('communication-sale-help', errors.sale && 'communication-sale-error')}
          >
            {saleOptions(openSales).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p id="communication-sale-help" className="field-help">
            Elija "Todas sus posibles ventas" si la conversación no fue sobre una en particular.
          </p>
          <FieldError id="communication-sale-error" message={errors.sale} />

          <label htmlFor="communication-note">Nota</label>
          <textarea
            id="communication-note"
            rows={6}
            placeholder="Qué se conversó, qué pidió la persona y qué se le respondió."
            value={values.note}
            maxLength={COMMUNICATION_LIMITS.note}
            required
            onChange={(e) => set({ note: e.target.value })}
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={describedBy(errors.note && 'communication-note-error', 'communication-note-count')}
          />
          <CharCounter id="communication-note-count" length={values.note.length} max={COMMUNICATION_LIMITS.note} />
          <FieldError id="communication-note-error" message={errors.note} />

          {saveError && (
            <p className="field-error" role="alert">
              {saveError}
            </p>
          )}

          <div className="dialog-actions">
            <button type="button" className="button-secondary" onClick={onCancel} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
