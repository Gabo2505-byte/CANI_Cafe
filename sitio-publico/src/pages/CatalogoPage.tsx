import { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { groupByVariety, type VarietyGroup } from '../../../src/products/catalog';
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

  // Solo llegan productos activos: una variedad sin presentaciones activas no forma grupo y no tiene tarjeta.
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

      {grupos.length > 0 && (
        <ul className="pub-cards">
          {grupos.map((grupo) => (
            <TarjetaVariedad key={grupo.name} grupo={grupo} />
          ))}
        </ul>
      )}
    </main>
  );
}

/**
 * HU-402 (catálogo por variedad): una tarjeta por variedad con su descripción y un selector con sus presentaciones
 * activas, en el orden del catálogo y con la primera elegida. "Me interesa" lleva a Contáctenos la presentación elegida.
 */
function TarjetaVariedad({ grupo }: { grupo: VarietyGroup }) {
  const idSelector = useId();
  const [elegidoId, setElegidoId] = useState(grupo.products[0].id);
  // Si la presentación elegida deja de estar (por ejemplo, al recargar el catálogo), se vuelve a la primera.
  const elegido = grupo.products.find((p) => p.id === elegidoId) ?? grupo.products[0];

  return (
    <li className="pub-card">
      <h2 className="pub-card-name">{grupo.name}</h2>
      <p className="pub-card-description">{publicDescription(elegido.description)}</p>
      <div className="pub-card-field">
        <label htmlFor={idSelector}>{CATALOGO.presentacion}</label>
        <select
          id={idSelector}
          aria-label={`${CATALOGO.presentacion} de ${grupo.name}`}
          value={elegido.id}
          onChange={(e) => setElegidoId(e.target.value)}
        >
          {grupo.products.map((producto) => (
            <option key={producto.id} value={producto.id}>
              {producto.presentation}
            </option>
          ))}
        </select>
      </div>
      <Link
        to={`/contactenos?producto=${encodeURIComponent(elegido.id)}`}
        className="pub-button pub-card-button"
        aria-label={`${CATALOGO.boton}: ${grupo.name}, ${elegido.presentation}`}
      >
        {CATALOGO.boton}
      </Link>
    </li>
  );
}
