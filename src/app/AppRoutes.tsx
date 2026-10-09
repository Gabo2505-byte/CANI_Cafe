import { Navigate, Route, Routes } from 'react-router';
import { LoginPage } from '../auth/LoginPage';
import { ContactsPage } from '../contacts/ContactsPage';
import { ProtectedRoute } from './ProtectedRoute';
import { DEFAULT_ROUTE, ROUTES } from './routes';

export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route
        path={ROUTES.contacts}
        element={
          <ProtectedRoute>
            <ContactsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <Navigate to={DEFAULT_ROUTE} replace />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
