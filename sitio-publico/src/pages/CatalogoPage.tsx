import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import escudo from '../../../src/assets/logo-cani-escudo.png';
import { groupByVariety, type VarietyGroup } from '../../../src/products/catalog';
import { listPublicProductsIn, publicDescription } from '../../../src/products/publicCatalog';
import type { Product } from '../../../src/shared/types';
import { usePageTitle } from '../components/usePageTitle';
import { CATALOGO, FOTOS_VARIEDAD, TITULOS_PESTANA } from '../contenido';
import { db } from '../firebase';

type Estado = { fase: 'cargando' } | { fase: 'error' } | { fase: 'listo'; productos: Product[] };

/** Foto de una variedad abierta en grande (rediseño). */
interface FotoAbierta {
  src: string;
  variedad: string;
}

export function CatalogoPage() {
  usePageTitle(TITULOS_PESTANA.catalogo);
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' });
  const [fotoAbierta, setFotoAbierta] = useState<FotoAbierta | null>(null);

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
      <div className="pub-page-header">
        <h1 className="pub-title">{CATALOGO.titulo}</h1>
        <span className="pub-divider" aria-hidden="true" />
        <p className="pub-page-lead">{CATALOGO.texto}</p>
      </div>

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
            <TarjetaVariedad key={grupo.name} grupo={grupo} onVerFoto={setFotoAbierta} />
          ))}
        </ul>
      )}

      {fotoAbierta && <VisorFoto foto={fotoAbierta} onCerrar={() => setFotoAbierta(null)} />}
    </main>
  );
}

/**
 * HU-402 (catálogo por variedad): una tarjeta por variedad con su descripción y un selector con sus presentaciones
 * activas, en el orden del catálogo y con la primera elegida. "Me interesa" lleva a Contáctenos la presentación elegida.
 */
function TarjetaVariedad({ grupo, onVerFoto }: { grupo: VarietyGroup; onVerFoto: (foto: FotoAbierta) => void }) {
  const idSelector = useId();
  const [elegidoId, setElegidoId] = useState(grupo.products[0].id);
  // Si la presentación elegida deja de estar (por ejemplo, al recargar el catálogo), se vuelve a la primera.
  const elegido = grupo.products.find((p) => p.id === elegidoId) ?? grupo.products[0];
  const foto = FOTOS_VARIEDAD[grupo.name];

  return (
    <li className="pub-card">
      {/* Con foto del producto: la bolsa de cerca; al tocarla se abre la foto completa en grande para leer la etiqueta
          (es un enlace a la foto, así también funciona sin JavaScript). Sin foto: la taza con una bolsa dibujada al
          centro, con el escudo de CANI y la variedad (decorativa: el nombre ya es el h2). */}
      {foto ? (
        <a
          className="pub-card-foto pub-card-foto-real"
          href={foto.grande}
          aria-label={`${CATALOGO.verFoto} ${grupo.name}`}
          onClick={(e) => {
            e.preventDefault();
            onVerFoto({ src: foto.grande, variedad: grupo.name });
          }}
        >
          <img src={foto.tarjeta} alt="" loading="lazy" decoding="async" />
          <span className="pub-card-lupa" aria-hidden="true">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        </a>
      ) : (
        <div className="pub-card-foto" aria-hidden="true">
          <span className="pub-card-bolsa">
            <img src={escudo} alt="" width={337} height={395} />
            <span className="pub-card-etiqueta">{grupo.name}</span>
          </span>
        </div>
      )}
      <div className="pub-card-body">
        <h2 className="pub-card-name">{grupo.name}</h2>
        <p className="pub-card-description">{publicDescription(elegido.description)}</p>
        {/* Selector de presentación y "Me interesa", al pie de la tarjeta */}
        <div className="pub-card-actions">
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
        </div>
      </div>
    </li>
  );
}

/**
 * Foto del producto en grande, sobre la página (rediseño). Usa <dialog> nativo: se cierra con la X, con Esc o tocando
 * afuera de la foto, y el foco vuelve a la tarjeta.
 */
function VisorFoto({ foto, onCerrar }: { foto: FotoAbierta; onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo && !dialogo.open) dialogo.showModal?.();
  }, []);

  return (
    <dialog
      ref={ref}
      className="pub-visor"
      aria-label={`${CATALOGO.verFoto} ${foto.variedad}`}
      onClose={onCerrar}
      // Un clic en el fondo oscuro (fuera de la foto) también cierra
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
    >
      <img src={foto.src} alt={foto.variedad} />
      <button type="button" className="pub-visor-cerrar" aria-label={CATALOGO.cerrarFoto} onClick={() => ref.current?.close()}>
        ×
      </button>
    </dialog>
  );
}
