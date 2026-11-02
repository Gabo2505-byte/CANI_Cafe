import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { groupByVariety } from '../../../src/products/catalog';
import { listPublicProductsIn, publicDescription } from '../../../src/products/publicCatalog';
import type { Product } from '../../../src/shared/types';
import { usePageTitle } from '../components/usePageTitle';
import { CATALOGO, TITULOS_PESTANA } from '../contenido';
import { db } from '../firebase';

type Estado = { fase: 'cargando' } | { fase: 'error' } | { fase: 'listo'; productos: Product[] };

export function CatalogoPage() {
  usePageTitle(TITULOS_PESTANA.catalogo);
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' });

  useEffect(() => {
    let vigente = true;
    listPublicProductsIn(db)
      .then((productos) => vigente && setEstado({ fase: 'listo', productos }))
      .catch(() => vigente && setEstado({ fase: 'error' }));
    return () => {
      vigente = false;
    };
  }, []);

  const grupos = useMemo(() => (estado.fase === 'listo' ? groupByVariety(estado.productos) : []), [estado]);

  return (
    <main className="pub-main">
      <h1 className="pub-title">{CATALOGO.titulo}</h1>
      <p className="pub-lead">{CATALOGO.texto}</p>

      {estado.fase === 'cargando' && <p className="pub-status">{CATALOGO.cargando}</p>}
      {estado.fase === 'error' && (
        <p className="pub-status pub-status-error" role="alert">
          {CATALOGO.error}
        </p>
      )}
      {estado.fase === 'listo' && grupos.length === 0 && <p className="pub-status">{CATALOGO.vacio}</p>}

      {grupos.map((grupo) => (
        <section key={grupo.name} className="pub-variety" aria-labelledby={`pub-var-${grupo.products[0].id}`}>
          <h2 id={`pub-var-${grupo.products[0].id}`} className="pub-heading">
            {grupo.name}
          </h2>
          <ul className="pub-cards">
            {grupo.products.map((producto) => (
              <li key={producto.id} className="pub-card">
                <h3 className="pub-card-name">{producto.name}</h3>
                <p className="pub-card-presentation">{producto.presentation}</p>
                <p className="pub-card-description">{publicDescription(producto.description)}</p>
                <Link
                  to={`/contactenos?producto=${encodeURIComponent(producto.id)}`}
                  className="pub-button pub-card-button"
                  aria-label={`${CATALOGO.boton}: ${producto.name}, ${producto.presentation}`}
                >
                  {CATALOGO.boton}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
