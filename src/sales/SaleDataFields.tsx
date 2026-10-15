import { OPEN_SALE_STAGES, SALE_STAGE_LABELS, type OpenSaleStage } from '../shared/types';
import { SALE_LIMITS, SALE_MESSAGES, type SaleFormErrors, type SaleFormValues } from './saleForm';

interface SaleDataFieldsProps {
  values: SaleFormValues;
  onChange: (patch: Partial<SaleFormValues>) => void;
  /** Errores calculados por el formulario al guardar (validateSaleForm). */
  errors?: SaleFormErrors;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  );
}

function CharCounter({ id, length, max }: { id: string; length: number; max: number }) {
  const atLimit = length >= max;
  return (
    <p id={id} className={atLimit ? 'char-counter at-limit' : 'char-counter'} aria-live="polite">
      {atLimit && <span className="char-counter-message">{SALE_MESSAGES.atLimit(max)} </span>}
      <span>
        {length}/{max}
      </span>
    </p>
  );
}

/**
 * HU-303: título, etapa, monto estimado, fecha del próximo seguimiento y notas de una posible venta.
 * El contacto (HU-302) y los productos (HU-304) son componentes aparte; el formulario de HU-301 los une.
 */
export function SaleDataFields({ values, onChange, errors = {} }: SaleDataFieldsProps) {
  return (
    <>
      <label htmlFor="sale-title">
        Título <span className="required" aria-hidden="true">*</span>
      </label>
      <input
        id="sale-title"
        value={values.title}
        onChange={(e) => onChange({ title: e.target.value })}
        maxLength={SALE_LIMITS.title}
        placeholder="Ej.: Café en grano para su cafetería"
        autoComplete="off"
        aria-required="true"
        aria-invalid={errors.title ? true : undefined}
        aria-describedby={errors.title ? 'sale-title-error sale-title-count' : 'sale-title-count'}
      />
      <CharCounter id="sale-title-count" length={values.title.length} max={SALE_LIMITS.title} />
      <FieldError id="sale-title-error" message={errors.title} />

      <label htmlFor="sale-stage">
        Etapa <span className="required" aria-hidden="true">*</span>
      </label>
      <select
        id="sale-stage"
        value={values.stage}
        onChange={(e) => onChange({ stage: e.target.value as OpenSaleStage })}
        aria-required="true"
      >
        {OPEN_SALE_STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {SALE_STAGE_LABELS[stage]}
          </option>
        ))}
      </select>

      <label htmlFor="sale-amount">
        Monto estimado (₡) <span className="required" aria-hidden="true">*</span>
      </label>
      <input
        id="sale-amount"
        inputMode="numeric"
        value={values.amount}
        onChange={(e) => onChange({ amount: e.target.value })}
        placeholder="0 significa que todavía no se estima"
        autoComplete="off"
        aria-required="true"
        aria-invalid={errors.amount ? true : undefined}
        aria-describedby={errors.amount ? 'sale-amount-error' : undefined}
      />
      <FieldError id="sale-amount-error" message={errors.amount} />

      <label htmlFor="sale-follow-up">
        Fecha del próximo seguimiento <span className="optional">(opcional)</span>
      </label>
      <input
        id="sale-follow-up"
        type="date"
        value={values.followUpDate}
        onChange={(e) => onChange({ followUpDate: e.target.value })}
        aria-invalid={errors.followUpDate ? true : undefined}
        aria-describedby={errors.followUpDate ? 'sale-follow-up-error' : undefined}
      />
      <FieldError id="sale-follow-up-error" message={errors.followUpDate} />

      <label htmlFor="sale-notes">
        Notas <span className="optional">(opcional)</span>
      </label>
      <textarea
        id="sale-notes"
        rows={3}
        value={values.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
        maxLength={SALE_LIMITS.notes}
        aria-invalid={errors.notes ? true : undefined}
        aria-describedby={errors.notes ? 'sale-notes-error sale-notes-count' : 'sale-notes-count'}
      />
      <CharCounter id="sale-notes-count" length={values.notes.length} max={SALE_LIMITS.notes} />
      <FieldError id="sale-notes-error" message={errors.notes} />
    </>
  );
}
