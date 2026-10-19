import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { SaleStage } from '../shared/types';
import { changeSaleStage } from './salesApi';
import { SaleReopenDuplicateTitleError, SaleStageConflictError } from './salesRepository';
import { LOSS_REASON_MAX, lossReasonError, STAGE_CHANGE_MESSAGES, stageOptions, type StageChangeResult } from './stageChange';

interface ChangeStageDialogProps {
  saleId: string;
  /** Etapa en la que está hoy (la que se marca como actual). */
  currentStage: SaleStage;
  /** La etapa ya se cambió y quedó en el historial. Recibe la nueva etapa y lo que pasó con el contacto. */
  onSaved: (newStage: SaleStage, result: StageChangeResult, previousStage: SaleStage) => void;
  onCancel: () => void;
}

/**
 * HU-310: ventana "Cambiar etapa" con las seis etapas y la actual marcada. Al guardar, la posible venta pasa
 * a la nueva etapa y el cambio queda en el historial.
 * HU-311: al elegir "Venta perdida" la misma ventana pregunta si está seguro y deja escribir el motivo
 * (opcional, hasta 250 caracteres).
 * HU-313: al elegir "Venta ganada" pregunta si confirma que fue ganada (el contacto pasa a cliente y la venta ya
 * no podrá cambiar de etapa).
 * HU-312: desde "Venta perdida" solo se pueden elegir las cuatro etapas abiertas (reabrir).
 */
export function ChangeStageDialog({ saleId, currentStage, onSaved, onCancel }: ChangeStageDialogProps) {
  const titleId = useId();
  const questionId = useId();
  const firstRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [selected, setSelected] = useState<SaleStage>(currentStage);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = stageOptions(currentStage);
  // En una venta perdida (HU-312) "Venta perdida" es la etapa actual: no hay nada que confirmar.
  const isLoss = selected === 'perdida' && currentStage !== 'perdida';
  const isWin = selected === 'ganada';
  const reasonProblem = isLoss ? lossReasonError(reason) : null;

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    // Al elegir "Venta perdida" el cursor pasa al motivo.
    if (isLoss) reasonRef.current?.focus();
  }, [isLoss]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, saving]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (selected === currentStage || reasonProblem) return;
    setSaving(true);
    setError(null);
    try {
      const result = await changeSaleStage(saleId, currentStage, selected, isLoss ? reason : undefined);
      onSaved(selected, result, currentStage);
    } catch (e) {
      setError(
        e instanceof SaleReopenDuplicateTitleError
          ? STAGE_CHANGE_MESSAGES.reopenDuplicateTitle
          : e instanceof SaleStageConflictError
            ? STAGE_CHANGE_MESSAGES.conflict
            : STAGE_CHANGE_MESSAGES.saveError,
      );
      setSaving(false);
    }
  }

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
          {isWin && (
            <div className="win-confirm">
              <p id={questionId} className="win-question">
                {STAGE_CHANGE_MESSAGES.winQuestion}
              </p>
            </div>
          )}

          {isLoss && (
            <div className="loss-confirm">
              <p id={questionId} className="loss-question">
                {STAGE_CHANGE_MESSAGES.lossQuestion}
              </p>
              <label htmlFor="loss-reason">
                {STAGE_CHANGE_MESSAGES.lossReasonLabel} <span className="optional">(opcional)</span>
              </label>
              <textarea
                id="loss-reason"
                ref={reasonRef}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={LOSS_REASON_MAX}
                aria-invalid={reasonProblem ? true : undefined}
                aria-describedby={reasonProblem ? 'loss-reason-error loss-reason-count' : 'loss-reason-count'}
              />
              <p
                id="loss-reason-count"
                className={reason.length >= LOSS_REASON_MAX ? 'char-counter at-limit' : 'char-counter'}
                aria-live="polite"
              >
                {reason.length}/{LOSS_REASON_MAX}
              </p>
              {reasonProblem && (
                <p id="loss-reason-error" className="field-error" role="alert">
                  {reasonProblem}
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}

          <div className="dialog-actions">
            <button type="button" className="button-secondary" onClick={onCancel} disabled={saving}>
              Cancelar
            </button>
            <button
              type="submit"
              className={isLoss ? 'button-danger' : undefined}
              aria-describedby={isLoss || isWin ? questionId : undefined}
              disabled={saving || selected === currentStage}
            >
              {saving ? 'Guardando…' : isLoss || isWin ? STAGE_CHANGE_MESSAGES.accept : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
