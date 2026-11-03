import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ROUTES } from '../app/routes';
import { Logo } from '../shared/ui/Logo';
import { parseResetLink, RESET_LINK_MESSAGES, type ResetLinkCheck } from './passwordResetLinks';
import { checkResetLink } from './resetLinkApi';

/**
 * Adonde lleva el botón "Crear nueva contraseña" del correo (HU-107).
 * Primero revisa que el enlace siga sirviendo; si no, muestra "El enlace ya no es válido. Solicite uno nuevo.".
 * El formulario de la nueva contraseña es HU-108 (va donde dice PENDIENTE HU-108).
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

  return (
    <main className="login">
      <div className="card">
        <Logo variant="login" />
        {check === 'checking' && (
          <p className="loading" role="status">
            Revisando el enlace…
          </p>
        )}
        {check !== 'checking' && !check.ok && (
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
        {check !== 'checking' && check.ok && link && (
          // PENDIENTE HU-108: formulario "Crear nueva contraseña". Al guardar con éxito: confirmPasswordReset(auth,
          // link.oobCode, nueva) y después markResetLinkUsed(link) (HU-107: el enlace solo se usa una vez).
          <h2 className="recovery-title">Crear nueva contraseña</h2>
        )}
      </div>
    </main>
  );
}
