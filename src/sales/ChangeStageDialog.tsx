import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { SaleStage } from '../shared/types';
import { changeSaleStage } from './salesApi';
import { SaleStageConflictError } from './salesRepository';
import { STAGE_CHANGE_MESSAGES, stageOptions } from './stageChange';

interface ChangeStageDialogProps {
  saleId: string;
  /** Etapa en la que está hoy (la que se marca como actual). */
  currentStage: SaleStage;
  /** La etapa ya se cambió y quedó en el historial. */
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * HU-310: ventana "Cambiar etapa" con las seis etapas y la actual marcada. Al guardar, la posible venta pasa
 * a la nueva etapa y el cambio queda en el historial. "Venta ganada" y "Venta perdida" aún no se pueden elegir.
 */
export function ChangeStageDialog({ saleId, currentStage, onSaved, onCancel }: ChangeStageDialogProps) {
  const titleId = useId();
  const firstRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<SaleStage>(currentStage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = stageOptions(currentStage);

  useEffect(() => {
    firstRef.current?.focus();
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
    if (selected === currentStage) return;
    setSaving(true);
    setError(null);
    try {
      await changeSaleStage(saleId, currentStage, selected);
      onSaved();
    } catch (e) {
      setError(e instanceof SaleStageConflictError ? STAGE_CHANGE_MESSAGES.conflict : STAGE_CHANGE_MESSAGES.saveError);
      setSaving(false);
    }
  }

  const hasClosingOptions = options.some((o) => !o.selectable && !o.current);
  return (
    <div className="dialog-backdrop">
      <div className="dialog dialog-form" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="dialog-title">
          {STAGE_CHANGE_MESSAGES.title}
        </h2>
        <form className="form" onSubmit={handleSubmit} noValidate>
          <fieldset className="stage-options">
            <legend className="sr-only">Etapa</legend>
            {options.map((option, index) => (
              <label key={option.stage} className={option.selectable || option.current ? 'stage-option' : 'stage-option is-disabled'}>
                <input
                  ref={index === 0 ? firstRef : undefined}
                  type="radio"
                  name="stage"
                  value={option.stage}
                  checked={selected === option.stage}
                  disabled={!option.selectable && !option.current}
                  onChange={() => setSelected(option.stage)}
                />
                <span>{option.label}</span>
                {option.current && (
                  <>
                    {' '}
                    <span className="stage-option-current">{STAGE_CHANGE_MESSAGES.current}</span>
                  </>
                )}
              </label>
            ))}
          </fieldset>
          {hasClosingOptions && <p className="field-help">{STAGE_CHANGE_MESSAGES.closingSoon}</p>}

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}

          <div className="dialog-actions">
            <button type="button" className="button-secondary" onClick={onCancel} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" disabled={saving || selected === currentStage}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
