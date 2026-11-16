import { useEffect, useId, useMemo, useRef, useState, type FocusEvent, type FormEvent } from 'react';
import { PhoneField } from '../../../src/shared/phone/PhoneField';
import type { Product } from '../../../src/shared/types';
import { ENVIO, FORMULARIO } from '../contenido';
import type { ResultadoEnvio } from '../formulario/envio';
import {
  type CampoFormulario,
  type ErroresFila,
  type FilaProducto,
  hayErrores,
  LIMITES,
  MENSAJES,
  nuevaFila,
  valoresIniciales as crearValores,
  type ValoresFormulario,
  validarFormulario,
} from '../formulario/validacion';
import { type EstadoProductos, ProductosField } from './ProductosField';

interface ConsultaFormProps {
  /** Productos activos del catálogo, para la lista de productos de interés (HU-404). */
  productos?: Product[];
  estadoProductos?: EstadoProductos;
  /** Producto elegido en el catálogo ("Me interesa"): llega como una fila ya llena. Si no existe o no está activo, se ignora. */
  productoInicial?: string | null;
  /** Valores con que empieza el formulario (por ejemplo, un producto preseleccionado). */
  valoresIniciales?: Partial<ValoresFormulario>;
  /**
   * Se llama con los datos cuando todo está bien. Si devuelve una promesa, es el envío (HU-405): mientras dura, el botón
   * dice "Enviando..." y no se puede presionar; al terminar se muestra el agradecimiento o el error.
   */
  onValido?: (valores: ValoresFormulario) => Promise<ResultadoEnvio> | void;
  /** Se llama al pulsar "Enviar otra consulta" (el formulario ya quedó vacío). */
  onOtraConsulta?: () => void;
}

type EstadoEnvio = 'inactivo' | 'enviando' | 'enviado' | 'error';

/** Formulario "Envíenos su consulta" (HU-403) con la revisión de datos de HU-501. */
export function ConsultaForm({
  productos = [],
  estadoProductos = 'listo',
  productoInicial,
  valoresIniciales,
  onValido,
  onOtraConsulta,
}: ConsultaFormProps) {
  const uid = useId();
  const [valores, setValores] = useState<ValoresFormulario>(() => crearValores(valoresIniciales));
  const [tocados, setTocados] = useState<Partial<Record<CampoFormulario, boolean>>>({});
  const [intentado, setIntentado] = useState(false);
  // Partes de cada fila de productos de las que ya se salió (para mostrar sus errores).
  const [filasTocadas, setFilasTocadas] = useState<Record<string, { producto?: boolean; cantidad?: boolean }>>({});
  const preseleccionAplicada = useRef(false);
  const [envio, setEnvio] = useState<EstadoEnvio>('inactivo');
  const agradecimientoRef = useRef<HTMLDivElement>(null);

  // Al terminar bien, el foco pasa al agradecimiento (que reemplaza al formulario) para que se anuncie.
  useEffect(() => {
    if (envio === 'enviado') agradecimientoRef.current?.focus();
  }, [envio]);

  // HU-402 criterio 4: el producto elegido en el catálogo llega como una fila ya llena (variedad, presentación y
  // cantidad 1). Se aplica una sola vez, cuando ya se conoce el catálogo.
  useEffect(() => {
    if (!productoInicial || preseleccionAplicada.current) return;
    const producto = productos.find((p) => p.id === productoInicial);
    if (!producto) return;
    preseleccionAplicada.current = true;
    setValores((v) => {
      if (v.filas.some((f) => f.productoId === producto.id)) return v;
      const llena = nuevaFila({ variedad: producto.name, productoId: producto.id, cantidad: '1' });
      // Si solo están las filas vacías del inicio, la fila llena las reemplaza; si no, se agrega al final.
      const vacias = v.filas.every((f) => !f.variedad && !f.productoId && !f.cantidad.trim());
      return { ...v, filas: vacias ? [llena] : [...v.filas, llena] };
    });
  }, [productos, productoInicial]);

  const errores = useMemo(() => validarFormulario(valores), [valores]);
  // Un error se ve cuando la persona ya salió del campo o ya intentó enviar.
  const visible = (campo: CampoFormulario) => (tocados[campo] || intentado ? errores[campo] : undefined);
  const marcar = (campo: CampoFormulario) => setTocados((t) => (t[campo] ? t : { ...t, [campo]: true }));
  const cambiar = (parcial: Partial<ValoresFormulario>) => setValores((v) => ({ ...v, ...parcial }));

  const id = (campo: string) => `${uid}-${campo}`;
  const errorId = (campo: string) => `${uid}-${campo}-error`;
  const errorNombre = visible('nombre');
  const errorCorreo = visible('correo');
  const errorTelefono = visible('telefono');
  const errorIntereses = visible('intereses');
  // Contrato v4: "Ingrese un correo electrónico o un teléfono." se ve cuando ya se salió de los dos (si solo se salió
  // del correo, quizá va a escribir el teléfono) o al intentar enviar. Marca los dos campos en rojo.
  const errorCorreoOTelefono =
    (tocados.correo && tocados.telefono) || intentado ? errores.correoOTelefono : undefined;
  // Lo que describe cada campo: su propio error, si no el del grupo, si no la ayuda "Ingrese al menos uno...".
  const descripcionContacto = (error: string | undefined, campo: 'correo' | 'telefono') =>
    error ? errorId(campo) : errorCorreoOTelefono ? errorId('correo-o-telefono') : id('correo-o-telefono-ayuda');

  const cambiarFilas = (filas: FilaProducto[]) => {
    setValores((v) => ({ ...v, filas }));
    // Las filas quitadas dejan de contar como tocadas.
    setFilasTocadas((t) => Object.fromEntries(Object.entries(t).filter(([clave]) => filas.some((f) => f.clave === clave))));
  };
  const tocarFila = (clave: string, parte: 'producto' | 'cantidad') =>
    setFilasTocadas((t) => ({ ...t, [clave]: { ...t[clave], [parte]: true } }));
  const erroresFila = (clave: string): ErroresFila => {
    const deLaFila = errores.filas[clave] ?? {};
    const tocada = filasTocadas[clave] ?? {};
    return {
      producto: tocada.producto || intentado ? deLaFila.producto : undefined,
      cantidad: tocada.cantidad || intentado ? deLaFila.cantidad : undefined,
    };
  };

  const salioDelTelefono = (e: FocusEvent<HTMLDivElement>) => {
    // El teléfono tiene dos controles (país y número): se revisa al salir del conjunto, no de cada uno.
    if (!e.currentTarget.contains(e.relatedTarget)) marcar('telefono');
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (envio === 'enviando') return;
    setIntentado(true);
    if (hayErrores(errores)) return;
    const envioEnCurso = onValido?.(valores);
    if (!envioEnCurso) return;
    setEnvio('enviando');
    // Si falla, los datos escritos se quedan como están (HU-405.4).
    setEnvio((await envioEnCurso) === 'ok' ? 'enviado' : 'error');
  };

  const otraConsulta = () => {
    setValores(crearValores());
    setTocados({});
    setIntentado(false);
    setFilasTocadas({});
    setEnvio('inactivo');
    onOtraConsulta?.();
  };

  // HU-405.3: si el envío sale bien, el formulario se reemplaza por el agradecimiento.
  if (envio === 'enviado') {
    return (
      <div ref={agradecimientoRef} className="pub-form-success" role="status" tabIndex={-1}>
        <p>{ENVIO.gracias}</p>
        <button type="button" className="pub-button" onClick={otraConsulta}>
          {ENVIO.otraConsulta}
        </button>
      </div>
    );
  }

  const enviando = envio === 'enviando';
  // Solo aspecto: "Enviar" se ve apagado mientras falten datos o haya errores. Se puede presionar igual y entonces
  // marca lo que falta (HU-501).
  const completo = !hayErrores(errores);

  return (
    <form className={completo ? 'pub-form' : 'pub-form pub-form-incompleto'} noValidate onSubmit={enviar} aria-labelledby={id('titulo')} aria-busy={enviando}>
      <h2 id={id('titulo')} className="pub-heading">
        {FORMULARIO.titulo}
      </h2>

      {intentado && hayErrores(errores) && (
        <p className="pub-form-error" role="alert">
          {MENSAJES.revisar}
        </p>
      )}

      <div className="pub-field">
        <label htmlFor={id('nombre')}>
          {FORMULARIO.nombre}{' '}
          <span className="pub-required" aria-hidden="true">
            *
          </span>
        </label>
        <input
          id={id('nombre')}
          type="text"
          autoComplete="name"
          maxLength={LIMITES.nombre}
          value={valores.nombre}
          onChange={(e) => cambiar({ nombre: e.target.value })}
          onBlur={() => marcar('nombre')}
          aria-required="true"
          aria-invalid={errorNombre ? true : undefined}
          aria-describedby={errorNombre ? errorId('nombre') : undefined}
        />
        {errorNombre && (
          <p id={errorId('nombre')} className="field-error">
            {errorNombre}
          </p>
        )}
      </div>

      {/* Contrato v4 (HU-403.3 y HU-501.2): correo y teléfono en un grupo obligatorio; basta con uno de los dos. En una
          fila (en móvil, uno debajo del otro), con la ayuda arriba y el aviso de "ninguno de los dos" abajo. */}
      <fieldset className="pub-fieldset pub-contacto">
        <legend>
          {FORMULARIO.correoOTelefono}{' '}
          <span className="pub-required" aria-hidden="true">
            *
          </span>
        </legend>
        <p id={id('correo-o-telefono-ayuda')} className="pub-product-hint pub-contacto-ayuda">
          {FORMULARIO.ayudaCorreoOTelefono}
        </p>
        <div className="pub-form-row">
          <div className="pub-field">
            <label htmlFor={id('correo')}>{FORMULARIO.correo}</label>
            <input
              id={id('correo')}
              type="email"
              autoComplete="email"
              maxLength={LIMITES.correo}
              value={valores.correo}
              onChange={(e) => cambiar({ correo: e.target.value })}
              onBlur={() => marcar('correo')}
              aria-invalid={errorCorreo || errorCorreoOTelefono ? true : undefined}
              aria-describedby={descripcionContacto(errorCorreo, 'correo')}
            />
            {errorCorreo && (
              <p id={errorId('correo')} className="field-error">
                {errorCorreo}
              </p>
            )}
          </div>

          <div className="pub-field">
            <label htmlFor={id('telefono')}>{FORMULARIO.telefono}</label>
            <div onBlur={salioDelTelefono}>
              <PhoneField
                id={id('telefono')}
                country={valores.paisTelefono}
                number={valores.telefono}
                onCountryChange={(paisTelefono) => cambiar({ paisTelefono })}
                onNumberChange={(telefono) => cambiar({ telefono })}
                invalid={Boolean(errorTelefono || errorCorreoOTelefono)}
                describedBy={descripcionContacto(errorTelefono, 'telefono')}
              />
            </div>
            {errorTelefono && (
              <p id={errorId('telefono')} className="field-error">
                {errorTelefono}
              </p>
            )}
          </div>
        </div>
        {errorCorreoOTelefono && (
          <p id={errorId('correo-o-telefono')} className="field-error">
            {errorCorreoOTelefono}
          </p>
        )}
      </fieldset>

      <fieldset className="pub-fieldset">
        <legend>
          {FORMULARIO.productos}{' '}
          <span className="pub-required" aria-hidden="true">
            *
          </span>
        </legend>
        <ProductosField
          productos={productos}
          estado={estadoProductos}
          filas={valores.filas}
          onChange={cambiarFilas}
          erroresFila={erroresFila}
          onProductoSalida={(clave) => tocarFila(clave, 'producto')}
          onCantidadSalida={(clave) => tocarFila(clave, 'cantidad')}
          onSalir={() => marcar('intereses')}
          error={errorIntereses}
          errorId={errorId('intereses')}
        />
      </fieldset>

      <div className="pub-field">
        <label htmlFor={id('mensaje')}>
          {FORMULARIO.mensaje} <span className="optional">{FORMULARIO.opcional}</span>
        </label>
        <textarea
          id={id('mensaje')}
          rows={5}
          maxLength={LIMITES.mensaje}
          value={valores.mensaje}
          onChange={(e) => cambiar({ mensaje: e.target.value })}
          aria-describedby={id('contador')}
        />
        <p id={id('contador')} className="char-counter">
          {valores.mensaje.length}/{LIMITES.mensaje}
        </p>
      </div>

      <div className="pub-form-actions">
        {envio === 'error' && (
          <p className="pub-form-error pub-send-error" role="alert">
            {ENVIO.error}
          </p>
        )}
        <p className="pub-privacy">{ENVIO.privacidad}</p>
        <div className="pub-send">
          <button
            type="submit"
            className="pub-button"
            disabled={enviando}
            aria-describedby={completo ? undefined : id('faltan')}
            // Mismo motivo en un globito al pasar el mouse por encima mientras está bloqueado
            data-tip={completo ? undefined : FORMULARIO.faltanDatos}
            // Al presionar con el mouse no se le quita el foco al campo: si no, los errores que aparecen al salir de él
            // empujan el botón hacia abajo antes de soltar y el clic se pierde. "Enviar" revisa todo igualmente.
            onMouseDown={(e) => e.preventDefault()}
          >
            {enviando ? ENVIO.enviando : FORMULARIO.enviar}
          </button>
          {/* Solo aspecto: explica por qué "Enviar" se ve bloqueado. Si se presiona igual, marca lo que falta (HU-501). */}
          {!completo && (
            <p id={id('faltan')} className="pub-send-hint">
              {FORMULARIO.faltanDatos}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
