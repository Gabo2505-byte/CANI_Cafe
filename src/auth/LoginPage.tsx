import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { ROUTES, safeRedirect } from '../app/routes';
import { useAuth } from './AuthContext';
import { loginErrorFromAuth, validateLoginInput, type LoginErrors } from './loginErrors';
import { PasswordInput } from './PasswordInput';
import { signInWithUsername } from './signInWithUsername';

/** HU-101: pantalla de ingreso. HU-102: mensajes de qué dato está mal. */
export function LoginPage() {
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Con sesión activa se pasa a la pantalla pedida o a Contactos.
  if (auth.status === 'active') {
    return <Navigate to={safeRedirect(searchParams.get('redirect'))} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const inputErrors = validateLoginInput(username, password);
    setErrors(inputErrors);
    if (Object.keys(inputErrors).length > 0) return;

    setSubmitting(true);
    try {
      await signInWithUsername(username, password);
    } catch (error) {
      const authErrors = loginErrorFromAuth(error);
      if (authErrors) setErrors(authErrors);
      if (authErrors?.password) {
        // Contraseña incorrecta: se borra la contraseña y se mantiene el usuario.
        setPassword('');
        passwordRef.current?.focus();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login">
      <form className="card" onSubmit={handleSubmit} noValidate>
        <h1>CRM CANI Café</h1>
        <label htmlFor="username">Usuario</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          aria-invalid={errors.username ? true : undefined}
          aria-describedby={errors.username ? 'username-error' : undefined}
        />
        {errors.username && (
          <p id="username-error" className="field-error" role="alert">
            {errors.username}
          </p>
        )}
        <label htmlFor="password">Contraseña</label>
        <PasswordInput
          id="password"
          value={password}
          onChange={setPassword}
          inputRef={passwordRef}
          errorId={errors.password ? 'password-error' : undefined}
        />
        {errors.password && (
          <p id="password-error" className="field-error" role="alert">
            {errors.password}
          </p>
        )}
        <button type="submit" disabled={submitting}>
          Ingresar
        </button>
        <Link to={ROUTES.forgotPassword} className="forgot-link">
          ¿Olvidó su contraseña?
        </Link>
      </form>
    </main>
  );
}
