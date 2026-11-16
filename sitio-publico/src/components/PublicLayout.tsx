import { Link, NavLink, Outlet } from 'react-router';
import escudo from '../../../src/assets/logo-cani-escudo.png';
import frase from '../../../src/assets/logo-cani-frase.png';
import nombre from '../../../src/assets/logo-cani-nombre.png';
import { MENU } from '../contenido';
import { SiteFooter } from './SiteFooter';

/** Encabezado (logo a la izquierda, menú a la derecha), contenido de la página y pie, igual en todo el sitio. */
export function PublicLayout() {
  return (
    <div className="pub-shell">
      <header className="pub-header">
        <div className="pub-header-inner">
          {/* Logo oficial como en la web de CANI: escudo y, a su lado, el nombre con la frase debajo. Las imágenes son
              decorativas; el nombre accesible del enlace es "CANI Café". */}
          <Link to="/" className="pub-logo">
            <img className="pub-logo-escudo" src={escudo} alt="" width={337} height={395} />
            <span className="pub-logo-texto">
              <img className="pub-logo-nombre" src={nombre} alt="" width={802} height={155} />
              <img className="pub-logo-frase" src={frase} alt="" width={586} height={146} />
            </span>
            <span className="sr-only">CANI Café</span>
          </Link>
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
