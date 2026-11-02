import { Link } from 'react-router';
import { usePageTitle } from '../components/usePageTitle';
import { COMO_COMPRAR, PRESENTACION, QUIENES_SOMOS, TITULOS_PESTANA } from '../contenido';

export function InicioPage() {
  usePageTitle(TITULOS_PESTANA.inicio);
  return (
    <main className="pub-main">
      <section className="pub-hero" aria-labelledby="pub-hero-titulo">
        <h1 id="pub-hero-titulo" className="pub-title">
          {PRESENTACION.titulo}
        </h1>
        <p className="pub-lead">{PRESENTACION.subtitulo}</p>
        <div className="pub-actions">
          <Link to="/catalogo" className="pub-button">
            {PRESENTACION.botonCatalogo}
          </Link>
          <Link to="/contactenos" className="pub-button pub-button-secondary">
            {PRESENTACION.botonContacto}
          </Link>
        </div>
      </section>

      <section className="pub-section" aria-labelledby="pub-quienes-titulo">
        <h2 id="pub-quienes-titulo" className="pub-heading">
          {QUIENES_SOMOS.titulo}
        </h2>
        <div className="pub-prose">
          <p>{QUIENES_SOMOS.parrafo1}</p>
          <blockquote className="pub-quote">{QUIENES_SOMOS.cita}</blockquote>
          <p>{QUIENES_SOMOS.parrafo2}</p>
          <p>{QUIENES_SOMOS.parrafo3}</p>
        </div>
      </section>

      <section className="pub-section" aria-labelledby="pub-comprar-titulo">
        <h2 id="pub-comprar-titulo" className="pub-heading">
          {COMO_COMPRAR.titulo}
        </h2>
        <div className="pub-prose">
          <p>{COMO_COMPRAR.texto}</p>
        </div>
      </section>
    </main>
  );
}
