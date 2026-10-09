import { Navigate, Route, Routes } from 'react-router';
import { LoginPage } from '../auth/LoginPage';
import { ContactsPage } from '../contacts/ContactsPage';
import { AlertsPage } from '../sales/AlertsPage';
import { SalesBoardPage } from '../sales/SalesBoardPage';
import { AppLayout } from './AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { DEFAULT_ROUTE, ROUTES } from './routes';

export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginPage />} />

      {/* Pantallas internas: requieren sesión y llevan la barra superior. */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path={ROUTES.contacts} element={<ContactsPage />} />
        <Route path={ROUTES.salesBoard} element={<SalesBoardPage />} />
        <Route path={ROUTES.alerts} element={<AlertsPage />} />
        <Route path="*" element={<Navigate to={DEFAULT_ROUTE} replace />} />
      </Route>
    </Routes>
  );
}
