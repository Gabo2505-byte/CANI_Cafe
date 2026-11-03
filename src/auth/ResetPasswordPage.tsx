import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ROUTES } from '../app/routes';
import { Logo } from '../shared/ui/Logo';
import { NEW_PASSWORD_MESSAGES, validateNewPassword, type NewPasswordErrors } from './newPassword';
import { parseResetLink, RESET_LINK_MESSAGES, type ResetLinkCheck, type ResetLinkParams } from './passwordResetLinks';
import { PasswordInput } from './PasswordInput';
import { checkResetLink, saveNewPassword } from './resetLinkApi';
import type { LoginLocationState } from './sessionMessages';

/**
 * Adonde lleva el botón "Crear nueva contraseña" del correo (HU-107).
 * Primero revisa que el enlace siga sirviendo; si no, muestra "El enlace ya no es válido. Solicite uno nuevo.".
 * Si sirve, muestra el formulario "Crear nueva contraseña" (HU-108).
 */
export function ResetPasswordPage() {
  const { search } = useLocation();
  const link = useMemo(() => parseResetLink(search), [search]);
  const [check, setCheck] = useState<ResetLinkCheck | 'checking'>(link ? 'checking' : { ok: false });

  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    checkResetLink(link).then((result) => {
      if (!cancelled) setCheck(result);
    });
    return () => {
      cancelled = true;
    };
  }, [link]);

  if (check !== 'checking' && check.ok && link) {
    // HU-108: si Firebase rechaza el código al guardar (venció o ya se usó), se pasa a "enlace no válido".
    return <NewPasswordForm link={link} onInvalidLink={() => setCheck({ ok: false })} />;
  }

  return (
    <main className="login">
      <div className="card">
        <Logo variant="login" />
        {check === 'checking' ? (
          <p className="loading" role="status">
            Revisando el enlace…
          </p>
        ) : (
          <>
            <p className="field-error" role="alert">
              {RESET_LINK_MESSAGES.invalid}
            </p>
            <Link to={ROUTES.forgotPassword} className="forgot-link">
              Solicitar un enlace nuevo
            </Link>
            <Link to={ROUTES.login} className="forgot-link">
              Volver al inicio de sesión
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

/** HU-108: pantalla "Crear nueva contraseña". */
function NewPasswordForm({ link, onInvalidLink }: { link: ResetLinkParams; onInvalidLink: () => void }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<NewPasswordErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const inputErrors = validateNewPassword(password, confirm);
    setErrors(inputErrors);
    setSaveError(null);
    if (Object.keys(inputErrors).length > 0) return;

    setSubmitting(true);
    const result = await saveNewPassword(link, password);
    if (result.ok) {
      // HU-108: vuelve al ingreso con el aviso. replace: "Atrás" no regresa a un enlace ya usado.
      const state: LoginLocationState = { notice: NEW_PASSWORD_MESSAGES.saved };
      navigate(ROUTES.login, { replace: true, state });
      return;
    }
    setSubmitting(false);
    if (result.message === RESET_LINK_MESSAGES.invalid) onInvalidLink();
    else setSaveError(result.message);
  }

  return (
    <main className="login">
      <form className="card" onSubmit={handleSubmit} noValidate>
        <Logo variant="login" />
        <h2 className="recovery-title">Crear nueva contraseña</h2>

        <label htmlFor="new-password">Nueva contraseña</label>
        <PasswordInput
          id="new-password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hintId="new-password-rule"
          errorId={errors.password ? 'new-password-error' : undefined}
        />
        <p id="new-password-rule" className="form-hint">
          {NEW_PASSWORD_MESSAGES.rule}
        </p>
        {errors.password && (
          <p id="new-password-error" className="field-error" role="alert">
            {errors.password}
          </p>
        )}

        <label htmlFor="confirm-password">Confirmar contraseña</label>
        <PasswordInput
          id="confirm-password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          errorId={errors.confirm ? 'confirm-password-error' : undefined}
        />
        {errors.confirm && (
          <p id="confirm-password-error" className="field-error" role="alert">
            {errors.confirm}
          </p>
        )}

        {saveError && (
          <p className="field-error" role="alert">
            {saveError}
          </p>
        )}
        <button type="submit" disabled={submitting}>
          Guardar
        </button>
        <Link to={ROUTES.login} className="forgot-link">
          Volver al inicio de sesión
        </Link>
      </form>
    </main>
  );
}
