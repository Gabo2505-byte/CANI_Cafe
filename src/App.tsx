import { signOut } from 'firebase/auth';
import { LoginForm, useAuthUser } from './auth';
import { auth, usingEmulators } from './shared/firebase/config';

export function App() {
  const state = useAuthUser();

  return (
    <main>
      {usingEmulators && <p className="badge">Emuladores locales · {auth.app.options.projectId}</p>}

      {state.status === 'loading' && <p>Cargando…</p>}

      {state.status === 'signedOut' && <LoginForm />}

      {state.status === 'inactive' && (
        <div className="card">
          <p>Tu usuario no está activo en el CRM. Pedile acceso a un administrador.</p>
          <button onClick={() => signOut(auth)}>Salir</button>
        </div>
      )}

      {state.status === 'active' && (
        <div className="card">
          <p>
            Conectado como <strong>{state.profile.username}</strong> ({state.profile.email})
          </p>
          <button onClick={() => signOut(auth)}>Salir</button>
        </div>
      )}
    </main>
  );
}
