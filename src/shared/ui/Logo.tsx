import { Link } from 'react-router';
import escudo from '../../assets/logo-cani-escudo.png';
import frase from '../../assets/logo-cani-frase.png';
import nombre from '../../assets/logo-cani-nombre.png';

interface LogoProps {
  /** "bar": barra superior (escudo y nombre en una fila, sin la frase; es un enlace). "login": composición vertical (h1). */
  variant: 'bar' | 'login';
  /** Destino del enlace en la barra superior. */
  to?: string;
}

/**
 * Logo oficial de CANI Café, compuesto por tres piezas (escudo, "CANI CAFÉ" y "Café de Especialidad") sacadas del
 * archivo del cliente y procesadas para el fondo oscuro (ver docs-local/PROGRESO.md). Las imágenes son decorativas:
 * el nombre accesible del enlace y del título sigue siendo exactamente "CANI Café", con texto visualmente oculto.
 */
export function Logo({ variant, to = '/' }: LogoProps) {
  if (variant === 'bar') {
    return (
      <div className="logo logo-bar">
        <Link to={to} className="topbar-brand logo-link">
          <img className="logo-escudo" src={escudo} alt="" width={337} height={395} />
          {/* La frase manuscrita no se lee a la altura de la barra (≈19 px en pantallas 1×): solo va en el ingreso. */}
          <img className="logo-nombre" src={nombre} alt="" width={802} height={155} />
          <span className="sr-only">CANI Café</span>
        </Link>
      </div>
    );
  }
  return (
    <div className="logo logo-login">
      <img className="logo-escudo" src={escudo} alt="" width={337} height={395} />
      <h1 className="logo-heading">
        <img className="logo-nombre" src={nombre} alt="" width={802} height={155} />
        <span className="sr-only">CANI Café</span>
      </h1>
      <img className="logo-frase" src={frase} alt="" width={586} height={146} />
    </div>
  );
}
