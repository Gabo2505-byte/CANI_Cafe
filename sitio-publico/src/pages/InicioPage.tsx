import { Link } from 'react-router';
import { SelloCafe } from '../components/SelloCafe';
import { usePageTitle } from '../components/usePageTitle';
import { COMO_COMPRAR, PRESENTACION, QUIENES_SOMOS, TITULOS_PESTANA } from '../contenido';

/** Grano de café dorado: adorno de la línea de la portada y de los títulos de la franja crema. */
function Grano({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <ellipse cx="12" cy="12" rx="7.5" ry="10.5" transform="rotate(35 12 12)" />
      <path className="pub-grano-surco" d="M8.5 5.5c3.5 3 0.5 8 4.5 13" transform="rotate(35 12 12)" />
    </svg>
  );
}

export function InicioPage() {
  usePageTitle(TITULOS_PESTANA.inicio);
  return (
    <main className="pub-main pub-main-full">
      {/* Portada a todo el alto con la foto de fondo oscurecida hacia la izquierda, donde va el texto */}
      <section className="pub-hero" aria-labelledby="pub-hero-titulo">
        <div className="pub-hero-content">
          <h1 id="pub-hero-titulo" className="pub-title">
            {PRESENTACION.titulo}
          </h1>
          <p className="pub-lead">{PRESENTACION.subtitulo}</p>
          <div className="pub-hero-line" aria-hidden="true">
            <Grano className="pub-grano" />
          </div>
          <div className="pub-actions">
            <Link to="/catalogo" className="pub-button">
              {PRESENTACION.botonCatalogo}
            </Link>
            <Link to="/contactenos" className="pub-button pub-button-ghost">
              {PRESENTACION.botonContacto}
            </Link>
          </div>
        </div>
      </section>

      {/* Borde de papel rasgado entre la portada y la franja crema */}
      <div className="pub-torn" aria-hidden="true">
        <svg viewBox="0 0 1440 48" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,0 C80,12 160,8 240,24 C320,40 400,28 480,16 C560,4 640,36 720,28 C800,20 880,16 960,32 C1040,48 1120,32 1200,12 C1280,-8 1360,20 1440,0 L1440,48 L0,48 Z" />
        </svg>
      </div>

      <div className="pub-cream">
        {/* "Quiénes somos": título centrado y el texto en dos columnas */}
        <section className="pub-section pub-nosotros" aria-labelledby="pub-quienes-titulo">
          <h2 id="pub-quienes-titulo" className="pub-heading">
            {QUIENES_SOMOS.titulo}
          </h2>
          <div className="pub-ornament" aria-hidden="true">
            <Grano className="pub-grano" />
          </div>
          <div className="pub-prose pub-prose-columnas">
            <p>{QUIENES_SOMOS.parrafo1}</p>
            <blockquote className="pub-quote">{QUIENES_SOMOS.cita}</blockquote>
            <p>{QUIENES_SOMOS.parrafo2}</p>
            <p>{QUIENES_SOMOS.parrafo3}</p>
          </div>
        </section>

        {/* "¿Cómo comprar?": tarjeta crema con el texto a la izquierda y la foto de la taza con el sello a la derecha */}
        <section className="pub-section pub-banner" aria-labelledby="pub-comprar-titulo">
          <div className="pub-banner-text">
            <h2 id="pub-comprar-titulo" className="pub-heading">
              {COMO_COMPRAR.titulo}
            </h2>
            <div className="pub-prose">
              <p>{COMO_COMPRAR.texto}</p>
            </div>
          </div>
          <div className="pub-banner-foto">
            <SelloCafe />
          </div>
        </section>
      </div>
    </main>
  );
}
