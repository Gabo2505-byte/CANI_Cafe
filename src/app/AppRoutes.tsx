import { Navigate, Route, Routes, useParams } from 'react-router';
import { ForgotPasswordPage } from '../auth/ForgotPasswordPage';
import { LoginPage } from '../auth/LoginPage';
import { ResetPasswordPage } from '../auth/ResetPasswordPage';
import { ContactDetailPage } from '../contacts/ContactDetailPage';
import { ContactsPage } from '../contacts/ContactsPage';
import { NewContactPage } from '../contacts/NewContactPage';
import { AlertsPage } from '../sales/AlertsPage';
import { NewSalePage } from '../sales/NewSalePage';
import { SaleDetailPage } from '../sales/SaleDetailPage';
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
      {/* HU-106: pública, como el ingreso. */}
      <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
      {/* HU-107 y HU-108: adonde lleva el botón del correo. Pública: se llega sin sesión. */}
      <Route path={ROUTES.resetPassword} element={<ResetPasswordPage />} />

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
        <Route path={ROUTES.newSale} element={<NewSalePage />} />
        <Route path={ROUTES.saleDetail} element={<SaleDetailPage />} />
        <Route path={ROUTES.alerts} element={<AlertsPage />} />
        <Route path="*" element={<Navigate to={DEFAULT_ROUTE} replace />} />
      </Route>
    </Routes>
  );
}
