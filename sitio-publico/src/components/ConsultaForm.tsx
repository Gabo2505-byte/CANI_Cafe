import { useEffect, useId, useMemo, useRef, useState, type FocusEvent, type FormEvent } from 'react';
import { PhoneField } from '../../../src/shared/phone/PhoneField';
import type { Product } from '../../../src/shared/types';
import { ENVIO, FORMULARIO } from '../contenido';
import type { ResultadoEnvio } from '../formulario/envio';
import {
  type CampoFormulario,
  hayErrores,
  LIMITES,
  MENSAJES,
  valoresIniciales as crearValores,
  type ValoresFormulario,
  validarFormulario,
} from '../formulario/validacion';
import { type EstadoProductos, ProductosField } from './ProductosField';

interface ConsultaFormProps {
  /** Productos activos del catálogo, para la lista de productos de interés (HU-404). */
  productos?: Product[];
  estadoProductos?: EstadoProductos;
  /** Producto elegido en el catálogo ("Me interesa"): empieza marcado y a la vista. Si no existe, se ignora. */
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
  const [cantidadesTocadas, setCantidadesTocadas] = useState<Record<string, boolean>>({});
  const [mostrarId, setMostrarId] = useState<string | null>(null);
  const preseleccionAplicada = useRef(false);
  const [envio, setEnvio] = useState<EstadoEnvio>('inactivo');
  const agradecimientoRef = useRef<HTMLDivElement>(null);

  // Al terminar bien, el foco pasa al agradecimiento (que reemplaza al formulario) para que se anuncie.
  useEffect(() => {
    if (envio === 'enviado') agradecimientoRef.current?.focus();
  }, [envio]);

  // HU-402 criterio 4: el producto elegido en el catálogo llega marcado (una sola vez, cuando ya se conoce la lista).
  useEffect(() => {
    if (!productoInicial || preseleccionAplicada.current) return;
    if (!productos.some((p) => p.id === productoInicial)) return;
    preseleccionAplicada.current = true;
    setValores((v) =>
      Object.hasOwn(v.intereses, productoInicial) ? v : { ...v, intereses: { ...v.intereses, [productoInicial]: '1' } },
    );
    setMostrarId(productoInicial);
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

  const marcarProducto = (productoId: string, marcado: boolean) => {
    setValores((v) => {
      const { [productoId]: _quitado, ...resto } = v.intereses;
      // Al marcarlo, la cantidad empieza en 1; al desmarcarlo, se borra.
      return { ...v, intereses: marcado ? { ...v.intereses, [productoId]: '1' } : resto };
    });
    if (!marcado) setCantidadesTocadas(({ [productoId]: _quitada, ...resto }) => resto);
  };
  const escribirCantidad = (productoId: string, texto: string) =>
    setValores((v) => (Object.hasOwn(v.intereses, productoId) ? { ...v, intereses: { ...v.intereses, [productoId]: texto } } : v));
  const errorCantidad = (productoId: string) =>
    cantidadesTocadas[productoId] || intentado ? errores.cantidades[productoId] : undefined;

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
    setCantidadesTocadas({});
    setMostrarId(null);
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

  return (
    <form className="pub-form" noValidate onSubmit={enviar} aria-labelledby={id('titulo')} aria-busy={enviando}>
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

      <div className="pub-field">
        <label htmlFor={id('correo')}>
          {FORMULARIO.correo}{' '}
          <span className="pub-required" aria-hidden="true">
            *
          </span>
        </label>
        <input
          id={id('correo')}
          type="email"
          autoComplete="email"
          maxLength={LIMITES.correo}
          value={valores.correo}
          onChange={(e) => cambiar({ correo: e.target.value })}
          onBlur={() => marcar('correo')}
          aria-required="true"
          aria-invalid={errorCorreo ? true : undefined}
          aria-describedby={errorCorreo ? errorId('correo') : undefined}
        />
        {errorCorreo && (
          <p id={errorId('correo')} className="field-error">
            {errorCorreo}
          </p>
        )}
      </div>

      <div className="pub-field">
        <label htmlFor={id('telefono')}>
          {FORMULARIO.telefono} <span className="optional">{FORMULARIO.opcional}</span>
        </label>
        <div onBlur={salioDelTelefono}>
          <PhoneField
            id={id('telefono')}
            country={valores.paisTelefono}
            number={valores.telefono}
            onCountryChange={(paisTelefono) => cambiar({ paisTelefono })}
            onNumberChange={(telefono) => cambiar({ telefono })}
            invalid={Boolean(errorTelefono)}
            describedBy={errorTelefono ? errorId('telefono') : undefined}
          />
        </div>
        {errorTelefono && (
          <p id={errorId('telefono')} className="field-error">
            {errorTelefono}
          </p>
        )}
      </div>

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
          intereses={valores.intereses}
          onMarcar={marcarProducto}
          onCantidad={escribirCantidad}
          onCantidadSalida={(productoId) => setCantidadesTocadas((t) => ({ ...t, [productoId]: true }))}
          onSalir={() => marcar('intereses')}
          errorCantidad={errorCantidad}
          error={errorIntereses}
          errorId={errorId('intereses')}
          mostrarId={mostrarId}
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
        <button type="submit" className="pub-button" disabled={enviando}>
          {enviando ? ENVIO.enviando : FORMULARIO.enviar}
        </button>
      </div>
    </form>
  );
}
