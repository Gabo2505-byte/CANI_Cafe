import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { ROUTES, safeRedirect } from '../app/routes';
import { useAuth } from './AuthContext';
import { PasswordInput } from './PasswordInput';
import { signInWithUsername } from './signInWithUsername';

/** HU-101: pantalla de ingreso. */
export function LoginPage() {
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Con sesión activa se pasa a la pantalla pedida o a Contactos.
  if (auth.status === 'active') {
    return <Navigate to={safeRedirect(searchParams.get('redirect'))} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await signInWithUsername(username, password);
    } catch {
      // Los mensajes de error del ingreso se cubren en otra HU.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login">
      <form className="card" onSubmit={handleSubmit}>
        <h1>CRM CANI Café</h1>
        <label htmlFor="username">Usuario</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          required
        />
        <label htmlFor="password">Contraseña</label>
        <PasswordInput id="password" value={password} onChange={setPassword} />
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
