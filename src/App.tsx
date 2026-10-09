import { BrowserRouter } from 'react-router';
import { AppRoutes } from './app/AppRoutes';
import { AuthProvider } from './auth';
import { auth, usingEmulators } from './shared/firebase/config';

export function App() {
  return (
    <AuthProvider>
      {usingEmulators && <p className="badge">Emuladores locales · {auth.app.options.projectId}</p>}
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
