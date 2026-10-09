import { Link, NavLink } from 'react-router';
import { ROUTES } from './routes';

const NAV_ITEMS = [
  { to: ROUTES.contacts, label: 'Contactos' },
  { to: ROUTES.salesBoard, label: 'Posibles ventas' },
  { to: ROUTES.alerts, label: 'Avisos' },
] as const;

/** HU-103: barra superior de todas las pantallas internas. */
export function TopBar() {
  return (
    <header className="topbar">
      <Link to={ROUTES.contacts} className="topbar-brand">
        CANI Café
      </Link>
      <nav aria-label="Principal">
        <ul className="topbar-nav">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              {/* NavLink marca la opción activa con la clase "active" y aria-current="page". */}
              <NavLink to={item.to} className="topbar-link">
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {/* La acción de cerrar sesión se implementa en HU-104. */}
      <button type="button" className="topbar-logout">
        Cerrar sesión
      </button>
    </header>
  );
}
