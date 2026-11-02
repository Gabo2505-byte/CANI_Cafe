import { useEffect, useId, useMemo, useRef, type FocusEvent } from 'react';
import { groupByVariety } from '../../../src/products/catalog';
import type { Product } from '../../../src/shared/types';
import { CATALOGO, FORMULARIO } from '../contenido';

export type EstadoProductos = 'cargando' | 'error' | 'listo';

interface ProductosFieldProps {
  productos: Product[];
  estado: EstadoProductos;
  /** Productos marcados: id → cantidad escrita. */
  intereses: Record<string, string>;
  onMarcar: (id: string, marcado: boolean) => void;
  onCantidad: (id: string, texto: string) => void;
  /** Se llama al salir de la cantidad de un producto (para revisarla). */
  onCantidadSalida: (id: string) => void;
  /** Se llama al salir de toda la lista de productos (para revisar que haya al menos uno). */
  onSalir: () => void;
  /** Error de la cantidad de un producto, ya filtrado por lo que se debe mostrar. */
  errorCantidad: (id: string) => string | undefined;
  /** "Seleccione al menos un producto." (ya filtrado). */
  error?: string;
  errorId: string;
  /** Producto cuya fila debe quedar a la vista dentro de la lista (por ejemplo, el elegido en el catálogo). */
  mostrarId?: string | null;
}

/**
 * HU-404: los productos del catálogo, uno por fila y agrupados por variedad, dentro de una lista con desplazamiento
 * propio. Cada fila tiene una casilla, el nombre con la presentación y la cantidad aproximada (solo se puede escribir
 * si el producto está marcado; al marcarlo empieza en 1 y al desmarcarlo se borra).
 */
export function ProductosField({
  productos,
  estado,
  intereses,
  onMarcar,
  onCantidad,
  onCantidadSalida,
  onSalir,
  errorCantidad,
  error,
  errorId,
  mostrarId,
}: ProductosFieldProps) {
  const uid = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const grupos = useMemo(() => groupByVariety(productos), [productos]);

  // Deja a la vista la fila pedida desplazando solo la lista (no la página).
  useEffect(() => {
    const panel = panelRef.current;
    if (!mostrarId || !panel) return;
    const fila = Array.from(panel.querySelectorAll<HTMLElement>('[data-producto]')).find((f) => f.dataset.producto === mostrarId);
    if (!fila) return;
    const arriba = fila.getBoundingClientRect().top - panel.getBoundingClientRect().top;
    panel.scrollTop += arriba - (panel.clientHeight - fila.offsetHeight) / 2;
  }, [mostrarId, grupos]);

  const salioDeLaLista = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) onSalir();
  };

  const mensajeError = error && (
    <p className="field-error" id={errorId}>
      {error}
    </p>
  );

  // Mientras no hay lista (cargando, con error o sin productos) también se avisa si se intentó enviar sin productos.
  if (estado === 'cargando') {
    return (
      <>
        <p className="pub-status pub-products-status">{CATALOGO.cargando}</p>
        {mensajeError}
      </>
    );
  }
  if (estado === 'error') {
    return (
      <>
        <p className="pub-status pub-status-error pub-products-status" role="alert">
          {CATALOGO.error}
        </p>
        {mensajeError}
      </>
    );
  }
  if (grupos.length === 0) {
    return (
      <>
        <p className="pub-status pub-products-status">{CATALOGO.vacio}</p>
        {mensajeError}
      </>
    );
  }

  return (
    <>
      <p className="pub-products-head" aria-hidden="true">
        {FORMULARIO.cantidadAproximada}
      </p>
      {/* Lista con desplazamiento propio: se puede recorrer con el teclado (tabulador y flechas arriba/abajo). */}
      <div
        ref={panelRef}
        className="pub-products"
        role="region"
        aria-label="Lista de productos"
        tabIndex={0}
        onBlur={salioDeLaLista}
      >
        {grupos.map((grupo) => (
          <div key={grupo.name} className="pub-products-group">
            <h3 className="pub-products-variety">{grupo.name}</h3>
            {grupo.products.map((producto) => {
              const marcado = Object.hasOwn(intereses, producto.id);
              const errorFila = marcado ? errorCantidad(producto.id) : undefined;
              const idCheck = `${uid}-${producto.id}`;
              const idError = `${uid}-${producto.id}-error`;
              return (
                <div key={producto.id} className="pub-product-row" data-producto={producto.id}>
                  <label className="pub-product-check" htmlFor={idCheck}>
                    <input
                      id={idCheck}
                      type="checkbox"
                      checked={marcado}
                      onChange={(e) => onMarcar(producto.id, e.target.checked)}
                    />
                    <span>
                      <span className="pub-product-name">{producto.name}</span>{' '}
                      <span className="pub-product-presentation">{producto.presentation}</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    className="pub-quantity"
                    aria-label={`Cantidad aproximada de ${producto.name}, ${producto.presentation}`}
                    disabled={!marcado}
                    value={marcado ? intereses[producto.id] : ''}
                    onChange={(e) => onCantidad(producto.id, e.target.value)}
                    onBlur={() => onCantidadSalida(producto.id)}
                    aria-invalid={errorFila ? true : undefined}
                    aria-describedby={errorFila ? idError : undefined}
                  />
                  {errorFila && (
                    <p id={idError} className="field-error pub-product-error">
                      {errorFila}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {mensajeError}
    </>
  );
}
