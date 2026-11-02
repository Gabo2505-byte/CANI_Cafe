// HU-405: solicitud que se guarda y reglas de reintento del envío (lógica pura, sin red).
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  aSolicitud,
  clasificarFallo,
  crearEnviador,
  LIMITE_ENVIO_MS,
  TiempoAgotado,
} from '../../sitio-publico/src/formulario/envio';
import { valoresIniciales } from '../../sitio-publico/src/formulario/validacion';
import { FORM_REQUEST_LIMITS, FORM_REQUESTS_COLLECTION, type FormRequestData } from '../../src/shared/types/formRequest';

const rechazoReglas = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
const sinConexion = () => Object.assign(new Error('Request failed with error: Failed to fetch'), { code: 'unknown' });

const solicitud = (cambios: Partial<FormRequestData> = {}): FormRequestData => ({
  fullName: 'Ana Prueba',
  email: 'ana@example.com',
  phoneCountry: null,
  phoneNumber: null,
  interests: [{ productId: 'prod-01-villa-sarchi-0250-grano', quantity: 1 }],
  message: null,
  ...cambios,
});

/** Enviador con un guardado simulado que responde, en orden, lo que se le indique. */
function enviadorCon(...respuestas: (Error | 'ok')[]) {
  let n = 0;
  const guardar = vi.fn(async (_id: string, _datos: FormRequestData) => {
    const r = respuestas[Math.min(n++, respuestas.length - 1)];
    if (r !== 'ok') throw r;
  });
  const nuevoId = vi.fn(() => `id-${nuevoId.mock.calls.length}`);
  return { enviar: crearEnviador({ nuevoId, guardar }), guardar, nuevoId };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('contrato de formRequests (PROVISIONAL)', () => {
  it('nombre de la colección y topes, definidos en un solo lugar', () => {
    expect(FORM_REQUESTS_COLLECTION).toBe('formRequests');
    expect(FORM_REQUEST_LIMITS).toEqual({
      fullName: 100, email: 100, message: 1000, minInterests: 1, maxInterests: 72, minQuantity: 1, maxQuantity: 9999,
    });
  });
});

describe('aSolicitud: lo que se guarda', () => {
  it('nombre sin espacios alrededor, correo en minúsculas, teléfono solo con dígitos y cantidades como números', () => {
    const datos = aSolicitud(
      valoresIniciales({
        nombre: '  Ana Pérez ',
        correo: ' Ana.Perez@Example.COM ',
        paisTelefono: 'CR',
        telefono: '8888-1234',
        intereses: { 'prod-02-caturra-0340-grano': ' 12 ' },
        mensaje: '  Hola  ',
      }),
    );
    expect(datos).toEqual({
      fullName: 'Ana Pérez',
      email: 'ana.perez@example.com',
      phoneCountry: 'CR',
      phoneNumber: '88881234',
      interests: [{ productId: 'prod-02-caturra-0340-grano', quantity: 12 }],
      message: 'Hola',
    });
  });

  it('sin teléfono ni mensaje guarda null (no textos vacíos), aunque haya un país elegido', () => {
    const datos = aSolicitud(valoresIniciales({ nombre: 'Ana', correo: 'ana@example.com', intereses: { a: '1' }, mensaje: '   ' }));
    expect(datos.phoneCountry).toBeNull();
    expect(datos.phoneNumber).toBeNull();
    expect(datos.message).toBeNull();
  });

  it('los productos van en el orden del catálogo (variedad, peso, formato), no en el orden en que se marcaron', () => {
    const datos = aSolicitud(
      valoresIniciales({
        intereses: {
          'prod-09-geisha-0250-grano': '1',
          'prod-01-villa-sarchi-1000-molido': '2',
          'prod-01-villa-sarchi-0250-molido': '3',
          'prod-01-villa-sarchi-0250-grano': '4',
          'prod-04-kenia-0500-grano': '5',
        },
      }),
    );
    expect(datos.interests.map((i) => i.productId)).toEqual([
      'prod-01-villa-sarchi-0250-grano',
      'prod-01-villa-sarchi-0250-molido',
      'prod-01-villa-sarchi-1000-molido',
      'prod-04-kenia-0500-grano',
      'prod-09-geisha-0250-grano',
    ]);
  });
});

describe('clasificarFallo: dos grupos', () => {
  it('permission-denied es "reglas"; todo lo demás, incluido el tiempo límite, es "conexion"', () => {
    expect(clasificarFallo(rechazoReglas())).toBe('reglas');
    expect(clasificarFallo(sinConexion())).toBe('conexion');
    expect(clasificarFallo(Object.assign(new Error(), { code: 'unavailable' }))).toBe('conexion');
    expect(clasificarFallo(new TiempoAgotado())).toBe('conexion');
    expect(clasificarFallo(new TypeError('Failed to fetch'))).toBe('conexion');
    expect(clasificarFallo(null)).toBe('conexion');
  });
});

describe('crearEnviador: reglas de reintento (decisión 7 actualizada)', () => {
  it('un envío que sale bien devuelve "ok" con un id nuevo', async () => {
    const { enviar, guardar } = enviadorCon('ok');
    expect(await enviar(solicitud())).toBe('ok');
    expect(guardar).toHaveBeenCalledWith('id-1', solicitud());
  });

  it('regla a: en el primer intento, permission-denied es SIEMPRE error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { enviar } = enviadorCon(rechazoReglas());
    expect(await enviar(solicitud())).toBe('error');
  });

  it('regla b: reintento con el mismo id tras un fallo de conexión: permission-denied cuenta como éxito', async () => {
    const { enviar, guardar } = enviadorCon(sinConexion(), rechazoReglas());
    expect(await enviar(solicitud())).toBe('error');
    expect(await enviar(solicitud())).toBe('ok');
    expect(guardar.mock.calls.map((c) => c[0])).toEqual(['id-1', 'id-1']);
  });

  it('regla b: reintento tras un rechazo de las reglas (no de conexión): permission-denied sigue siendo error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { enviar, guardar } = enviadorCon(rechazoReglas(), rechazoReglas());
    expect(await enviar(solicitud())).toBe('error');
    expect(await enviar(solicitud())).toBe('error');
    expect(guardar.mock.calls.map((c) => c[0])).toEqual(['id-1', 'id-1']);
  });

  it('regla b: tras varios fallos de conexión seguidos, el siguiente permission-denied cuenta como éxito', async () => {
    const { enviar, nuevoId } = enviadorCon(sinConexion(), sinConexion(), rechazoReglas());
    expect(await enviar(solicitud())).toBe('error');
    expect(await enviar(solicitud())).toBe('error');
    expect(await enviar(solicitud())).toBe('ok');
    expect(nuevoId).toHaveBeenCalledTimes(1);
  });

  it('regla c: si cambió cualquier dato después del error, se usa un id nuevo y permission-denied vuelve a ser error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { enviar, guardar } = enviadorCon(sinConexion(), rechazoReglas());
    expect(await enviar(solicitud())).toBe('error');
    expect(await enviar(solicitud({ message: 'Otro mensaje' }))).toBe('error');
    expect(guardar.mock.calls.map((c) => c[0])).toEqual(['id-1', 'id-2']);
  });

  it('regla c: mientras no cambie nada, reutiliza el mismo id; tras un éxito, el siguiente envío usa uno nuevo', async () => {
    const { enviar, guardar } = enviadorCon(sinConexion(), 'ok', 'ok');
    await enviar(solicitud());
    await enviar(solicitud());
    await enviar(solicitud());
    expect(guardar.mock.calls.map((c) => c[0])).toEqual(['id-1', 'id-1', 'id-2']);
  });

  it(`si el guardado no responde en ${LIMITE_ENVIO_MS / 1000} s, devuelve "error" (conexión) y el reintento usa el mismo id`, async () => {
    vi.useFakeTimers();
    const guardar = vi
      .fn<(id: string, d: FormRequestData) => Promise<void>>()
      .mockImplementationOnce(() => new Promise(() => {})) // nunca responde
      .mockRejectedValueOnce(rechazoReglas()); // el primero sí se había guardado
    const enviar = crearEnviador({ nuevoId: () => 'id-unico', guardar });
    const resultado = enviar(solicitud());
    await vi.advanceTimersByTimeAsync(LIMITE_ENVIO_MS - 1);
    let terminado = false;
    void resultado.then(() => (terminado = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(terminado).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await resultado).toBe('error');
    expect(await enviar(solicitud())).toBe('ok');
    expect(guardar.mock.calls.map((c) => c[0])).toEqual(['id-unico', 'id-unico']);
  });
});
