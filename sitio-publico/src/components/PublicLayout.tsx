import { NavLink, Outlet } from 'react-router';
import { Logo } from '../../../src/shared/ui/Logo';
import { MENU } from '../contenido';
import { SiteFooter } from './SiteFooter';

/** Encabezado (nombre a la izquierda, menú a la derecha), contenido de la página y pie, igual en todo el sitio. */
export function PublicLayout() {
  return (
    <div className="pub-shell">
      <header className="pub-header">
        <div className="pub-header-inner">
          <Logo variant="bar" to="/" />
          <nav aria-label="Menú principal">
            <ul className="pub-menu">
              {MENU.map((item) => (
                <li key={item.to}>
                  {/* "end" evita que Inicio quede subrayado en las demás páginas. NavLink marca la actual con aria-current="page". */}
                  <NavLink to={item.to} end className="pub-menu-link">
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <Outlet />
      <SiteFooter />
    </div>
  );
}
