import { Navigate, Route, Routes, useParams } from 'react-router';
import { LoginPage } from '../auth/LoginPage';
import { ContactDetailPage } from '../contacts/ContactDetailPage';
import { ContactsPage } from '../contacts/ContactsPage';
import { NewContactPage } from '../contacts/NewContactPage';
import { AlertsPage } from '../sales/AlertsPage';
import { SalesBoardPage } from '../sales/SalesBoardPage';
import { AppLayout } from './AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { DEFAULT_ROUTE, ROUTES } from './routes';

/** Una ficha nueva por contacto: al cambiar de contacto no queda estado (ni avisos) del anterior. */
function ContactDetailRoute() {
  const { contactId } = useParams();
  return <ContactDetailPage key={contactId} />;
}

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
        <Route path={ROUTES.newContact} element={<NewContactPage />} />
        <Route path={ROUTES.contactDetail} element={<ContactDetailRoute />} />
        <Route path={ROUTES.salesBoard} element={<SalesBoardPage />} />
        <Route path={ROUTES.alerts} element={<AlertsPage />} />
        <Route path="*" element={<Navigate to={DEFAULT_ROUTE} replace />} />
      </Route>
    </Routes>
  );
}
