import { useState } from 'react';
import { NavLink } from 'react-router';
import { useSession } from '../auth/SessionContext';
import { LOGOUT_ERROR_MESSAGE } from '../auth/sessionMessages';
import { contactsNavLabel, useFormBadgeCount } from '../contacts/useFormBadgeCount';
import { useAlertCount } from '../sales/useAlertCount';
import { NAV_LABELS } from '../shared/constants/labels';
import { Logo } from '../shared/ui/Logo';
import { ROUTES } from './routes';

const NAV_ITEMS = [
  { to: ROUTES.contacts, label: NAV_LABELS.contacts },
  { to: ROUTES.salesBoard, label: NAV_LABELS.sales },
  { to: ROUTES.alerts, label: NAV_LABELS.alerts },
] as const;

/** HU-103: barra superior de todas las pantallas internas. HU-104: cerrar sesión. HU-504: "Contactos (2)". */
export function TopBar() {
  const session = useSession();
  const alertCount = useAlertCount();
  const badgedContacts = useFormBadgeCount();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      // Sin confirmación. Al cerrarse la sesión, ProtectedRoute lleva al ingreso (replace) con el aviso.
      await session.signOut();
    } catch {
      // La sesión sigue abierta: se informa y no se navega.
      setError(LOGOUT_ERROR_MESSAGE);
      setSigningOut(false);
    }
  }

  return (
    <header className="topbar">
      <Logo variant="bar" to={ROUTES.contacts} />
      <nav aria-label="Principal">
        <ul className="topbar-nav">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              {/* NavLink marca la opción activa con la clase "active" y aria-current="page". */}
              <NavLink to={item.to} className="topbar-link">
                {/* HU-504: cuántos contactos tienen etiqueta del formulario, entre paréntesis. */}
                {item.to === ROUTES.contacts ? contactsNavLabel(item.label, badgedContacts) : item.label}
                {/* HU-316: círculo rojo con los avisos pendientes; sin avisos no aparece. */}
                {item.to === ROUTES.alerts && alertCount > 0 && (
                  <span className="topbar-count" aria-label={`${alertCount} avisos pendientes`}>
                    {alertCount}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {error && (
        <p className="topbar-error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="topbar-logout" onClick={handleSignOut} disabled={signingOut}>
        Cerrar sesión
      </button>
    </header>
  );
}
