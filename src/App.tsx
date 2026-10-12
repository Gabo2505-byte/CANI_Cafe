import { BrowserRouter } from 'react-router';
import { AppRoutes } from './app/AppRoutes';
import { AuthProvider, SessionProvider } from './auth';
import { usingEmulators } from './shared/firebase/config';

export function App() {
  return (
    <AuthProvider>
      <SessionProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SessionProvider>
      {usingEmulators && <p className="badge">Emuladores locales</p>}
    </AuthProvider>
  );
}
