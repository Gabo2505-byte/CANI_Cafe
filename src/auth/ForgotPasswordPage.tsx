import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { DEFAULT_ROUTE, ROUTES } from '../app/routes';
import { Logo } from '../shared/ui/Logo';
import { useAuth } from './AuthContext';
import { RESEND_WAIT_SECONDS, sentMessage } from './passwordRecovery';
import { requestPasswordReset } from './requestPasswordReset';

/** Segundos que faltan para poder reenviar (0 = ya se puede). */
function secondsLeft(sentAt: number, now: number): number {
  return Math.max(0, Math.ceil(RESEND_WAIT_SECONDS - (now - sentAt) / 1000));
}

/** HU-106: pantalla "Recuperar contraseña". */
export function ForgotPasswordPage() {
  const auth = useAuth();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Después del envío: a qué usuario y correo (enmascarado) se envió, y cuándo. */
  const [sent, setSent] = useState<{ username: string; maskedEmail: string; at: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const remaining = sent ? secondsLeft(sent.at, now) : 0;

  // Cuenta regresiva de "Reenviar enlace": se actualiza cada segundo hasta llegar a 0.
  useEffect(() => {
    if (!sent || remaining === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [sent, remaining]);

  // Con sesión activa no tiene sentido recuperar la contraseña: se pasa al sistema.
  if (auth.status === 'active') return <Navigate to={DEFAULT_ROUTE} replace />;

  async function send(target: string) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await requestPasswordReset(target);
      if (result.ok) {
        const at = Date.now();
        setSent({ username: target, maskedEmail: result.maskedEmail, at });
        setNow(at);
      } else {
        setError(result.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send(username);
  }

  return (
    <main className="login">
      <form className="card" onSubmit={handleSubmit} noValidate>
        <Logo variant="login" />
        <h2 className="recovery-title">Recuperar contraseña</h2>

        {sent ? (
          <>
            <p className="notice-success" role="status">
              {sentMessage(sent.maskedEmail)}
            </p>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <button type="button" disabled={remaining > 0 || submitting} onClick={() => void send(sent.username)}>
              {remaining > 0 ? `Reenviar enlace (${remaining} s)` : 'Reenviar enlace'}
            </button>
          </>
        ) : (
          <>
            <label htmlFor="recovery-username">Usuario</label>
            <input
              id="recovery-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'recovery-username-error' : undefined}
            />
            {error && (
              <p id="recovery-username-error" className="field-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={submitting}>
              Enviar enlace
            </button>
          </>
        )}

        <Link to={ROUTES.login} className="forgot-link">
          Volver al inicio de sesión
        </Link>
      </form>
    </main>
  );
}
