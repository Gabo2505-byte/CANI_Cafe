import { useEffect, useMemo, useRef, type FocusEvent } from 'react';
import { groupByVariety } from '../../../src/products/catalog';
import type { Product } from '../../../src/shared/types';
import { CATALOGO, SELECTOR_PRODUCTOS } from '../contenido';
import { type ErroresFila, type FilaProducto, nuevaFila } from '../formulario/validacion';

export type EstadoProductos = 'cargando' | 'error' | 'listo';

interface ProductosFieldProps {
  productos: Product[];
  estado: EstadoProductos;
  filas: FilaProducto[];
  onChange: (filas: FilaProducto[]) => void;
  /** Errores de una fila, ya filtrados por lo que se debe mostrar (al salir del campo o al enviar). */
  erroresFila: (clave: string) => ErroresFila;
  /** Se llama al salir de la variedad y la presentación de una fila (para revisar que tenga producto). */
  onProductoSalida: (clave: string) => void;
  /** Se llama al salir de la cantidad de una fila. */
  onCantidadSalida: (clave: string) => void;
  /** Se llama al salir de todo el campo de productos (para revisar que haya al menos uno). */
  onSalir: () => void;
  /** "Seleccione al menos un producto." (ya filtrado). */
  error?: string;
  errorId: string;
}

/**
 * HU-404: productos de interés con el mismo funcionamiento que el selector del sistema interno, pero propio del sitio
 * público (no puede importar src/sales). "Agregar producto" suma una fila donde el producto se elige en dos pasos
 * (variedad y, ya elegida, su presentación) y se escribe la cantidad; la "X" quita la fila. Al elegir la presentación
 * la cantidad empieza en 1.
 */
export function ProductosField({
  productos,
  estado,
  filas,
  onChange,
  erroresFila,
  onProductoSalida,
  onCantidadSalida,
  onSalir,
  error,
  errorId,
}: ProductosFieldProps) {
  const variedades = useMemo(() => groupByVariety(productos), [productos]);
  const presentacionesDe = (variedad: string): Product[] => variedades.find((v) => v.name === variedad)?.products ?? [];
  const actualizar = (clave: string, cambios: Partial<FilaProducto>) =>
    onChange(filas.map((fila) => (fila.clave === clave ? { ...fila, ...cambios } : fila)));

  // Al agregar una fila, el foco pasa a su variedad.
  const enfocarClave = useRef<string | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enfocarClave.current) return;
    contenedorRef.current?.querySelector<HTMLSelectElement>(`[data-fila="${enfocarClave.current}"] select`)?.focus();
    enfocarClave.current = null;
  }, [filas]);

  const agregar = () => {
    const fila = nuevaFila();
    enfocarClave.current = fila.clave;
    onChange([...filas, fila]);
  };

  // Se revisa al salir del conjunto, no al pasar de un control a otro dentro de él.
  const alSalirDe = (accion: () => void) => (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) accion();
  };

  const mensajeError = error && (
    <p className="field-error" id={errorId}>
      {error}
    </p>
  );

  // Mientras no hay catálogo (cargando, con error o sin productos) también se avisa si se intentó enviar sin productos.
  if (estado !== 'listo' || variedades.length === 0) {
    return (
      <>
        {estado === 'cargando' && <p className="pub-status pub-products-status">{CATALOGO.cargando}</p>}
        {estado === 'error' && (
          <p className="pub-status pub-status-error pub-products-status" role="alert">
            {CATALOGO.error}
          </p>
        )}
        {estado === 'listo' && <p className="pub-status pub-products-status">{CATALOGO.vacio}</p>}
        {mensajeError}
      </>
    );
  }

  return (
    <div ref={contenedorRef} className="pub-product-rows" onBlur={alSalirDe(onSalir)}>
      {filas.map((fila, indice) => {
        const n = indice + 1;
        const errores = erroresFila(fila.clave);
        const idErrorProducto = `${fila.clave}-producto-error`;
        const idErrorCantidad = `${fila.clave}-cantidad-error`;
        // Como en el sistema interno: el error del producto se marca en la variedad si falta, si no en la presentación.
        const errorEnVariedad = Boolean(errores.producto) && !fila.variedad;
        const errorEnPresentacion = Boolean(errores.producto) && Boolean(fila.variedad);
        return (
          <div key={fila.clave} className="pub-product-row" data-fila={fila.clave}>
            <div className="pub-product-controls">
              <div className="pub-product-choice" onBlur={alSalirDe(() => onProductoSalida(fila.clave))}>
                <select
                  aria-label={`Variedad del producto ${n}`}
                  value={fila.variedad}
                  // Al cambiar la variedad se borra la presentación: era de otra variedad.
                  onChange={(e) => actualizar(fila.clave, { variedad: e.target.value, productoId: '' })}
                  aria-invalid={errorEnVariedad ? true : undefined}
                  aria-describedby={errorEnVariedad ? idErrorProducto : undefined}
                >
                  <option value="">{SELECTOR_PRODUCTOS.variedad}</option>
                  {variedades.map((variedad) => (
                    <option key={variedad.name} value={variedad.name}>
                      {variedad.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Presentación del producto ${n}`}
                  value={fila.productoId}
                  disabled={!fila.variedad}
                  onChange={(e) => {
                    const productoId = e.target.value;
                    // HU-404: al elegir la presentación, la cantidad empieza en 1 (si todavía no se escribió una).
                    const cantidad = productoId && fila.cantidad.trim() === '' ? '1' : fila.cantidad;
                    actualizar(fila.clave, { productoId, cantidad });
                  }}
                  aria-invalid={errorEnPresentacion ? true : undefined}
                  aria-describedby={errorEnPresentacion ? idErrorProducto : undefined}
                >
                  <option value="">
                    {fila.variedad ? SELECTOR_PRODUCTOS.presentacion : SELECTOR_PRODUCTOS.presentacionSinVariedad}
                  </option>
                  {presentacionesDe(fila.variedad).map((producto) => (
                    <option key={producto.id} value={producto.id}>
                      {producto.presentation}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pub-product-quantity">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  aria-label={`Cantidad aproximada del producto ${n}`}
                  placeholder={SELECTOR_PRODUCTOS.cantidad}
                  value={fila.cantidad}
                  onChange={(e) => actualizar(fila.clave, { cantidad: e.target.value })}
                  onBlur={() => onCantidadSalida(fila.clave)}
                  aria-invalid={errores.cantidad ? true : undefined}
                  aria-describedby={errores.cantidad ? idErrorCantidad : undefined}
                />
                <span className="pub-product-unit">{SELECTOR_PRODUCTOS.unidades}</span>
              </div>
              <button
                type="button"
                className="pub-button pub-button-secondary pub-product-remove"
                aria-label={`Quitar producto ${n}`}
                onClick={() => onChange(filas.filter((f) => f.clave !== fila.clave))}
              >
                {SELECTOR_PRODUCTOS.quitar}
              </button>
            </div>
            {errores.producto && (
              <p id={idErrorProducto} className="field-error pub-product-error">
                {errores.producto}
              </p>
            )}
            {errores.cantidad && (
              <p id={idErrorCantidad} className="field-error pub-product-error">
                {errores.cantidad}
              </p>
            )}
          </div>
        );
      })}
      <button type="button" className="pub-button pub-button-secondary pub-product-add" onClick={agregar}>
        {SELECTOR_PRODUCTOS.agregar}
      </button>
      {mensajeError}
    </div>
  );
}
