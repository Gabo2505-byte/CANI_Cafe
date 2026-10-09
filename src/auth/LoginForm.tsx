import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState, type FormEvent } from 'react';
import { auth } from '../shared/firebase/config';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError('Correo o contraseña incorrectos.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h1>CRM CANI Café</h1>
      <label>
        Correo
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
      </label>
      <label>
        Contraseña
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  );
}
