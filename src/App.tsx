import { BrowserRouter } from 'react-router';
import { AppRoutes } from './app/AppRoutes';
import { AuthProvider } from './auth';
import { usingEmulators } from './shared/firebase/config';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      {usingEmulators && <p className="badge">Emuladores locales</p>}
    </AuthProvider>
  );
}
