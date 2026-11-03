// Envío del formulario (HU-405): arma la solicitud y decide qué hacer ante un error. Lógica pura: guardar en Firestore
// se recibe como función (ver guardarSolicitud.ts), así se prueba sin red.
import { normalizePhoneDigits } from '../../../src/shared/phone/phone';
import type { FormRequestData } from '../../../src/shared/types/formRequest';
import { normalizeEmail } from '../../../src/shared/validation/email';
import { parseQuantity } from '../../../src/shared/validation/quantity';
import type { ValoresFormulario } from './validacion';

/** Tiempo máximo de espera de un envío antes de mostrar el error de conexión (HU-405.4). */
export const LIMITE_ENVIO_MS = 10_000;

export type ResultadoEnvio = 'ok' | 'error';

/** "reglas": Firestore rechazó la escritura (permission-denied). "conexion": cualquier otro fallo, incluido el tiempo límite. */
export type TipoFallo = 'reglas' | 'conexion';

/**
 * Convierte el formulario (ya validado) en la solicitud que se guarda. Los productos van en el orden del catálogo
 * (variedad, peso, formato): el id lleva ese orden, como en groupByVariety.
 */
export function aSolicitud(valores: ValoresFormulario): FormRequestData {
  const telefono = normalizePhoneDigits(valores.telefono);
  const mensaje = valores.mensaje.trim();
  return {
    fullName: valores.nombre.trim(),
    email: normalizeEmail(valores.correo),
    phoneCountry: telefono ? valores.paisTelefono : null,
    phoneNumber: telefono || null,
    // Las filas ya validadas no tienen productos vacíos ni repetidos; aun así se omiten las que no tengan producto.
    interests: valores.filas
      .filter((fila) => fila.productoId)
      .map((fila) => ({ productId: fila.productoId, quantity: parseQuantity(fila.cantidad) ?? 0 }))
      .sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0)),
    message: mensaje || null,
  };
}

export class TiempoAgotado extends Error {
  constructor() {
    super(`El envío no terminó en ${LIMITE_ENVIO_MS / 1000} s.`);
  }
}

export function clasificarFallo(error: unknown): TipoFallo {
  return (error as { code?: unknown } | null)?.code === 'permission-denied' ? 'reglas' : 'conexion';
}

function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new TiempoAgotado()), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

interface DependenciasEnvio {
  /** Id nuevo para la solicitud (generado en el navegador). */
  nuevoId: () => string;
  /** Crea el documento con ese id. */
  guardar: (id: string, datos: FormRequestData) => Promise<void>;
  limiteMs?: number;
}

/**
 * Devuelve la función que envía una solicitud y recuerda el último intento fallido para los reintentos
 * (decisión 7 actualizada, ver docs/evidencia/HU-405):
 * a) En el primer intento, permission-denied es SIEMPRE error.
 * b) Solo en un reintento con el mismo id, y solo si el intento anterior falló por tiempo límite o por conexión,
 *    permission-denied cuenta como éxito: el primer intento sí se guardó y el reintento choca con él (no hay update
 *    público).
 * c) Si cambió cualquier dato de la solicitud después de un error, se usa un id nuevo; si no cambió nada, el mismo id.
 */
export function crearEnviador({ nuevoId, guardar, limiteMs = LIMITE_ENVIO_MS }: DependenciasEnvio) {
  let ultimoFallido: { id: string; firma: string; fallo: TipoFallo } | null = null;

  return async function enviar(datos: FormRequestData): Promise<ResultadoEnvio> {
    const firma = JSON.stringify(datos);
    const reintento = ultimoFallido !== null && ultimoFallido.firma === firma;
    const id = reintento ? ultimoFallido!.id : nuevoId();
    const anteriorPorConexion = reintento && ultimoFallido!.fallo === 'conexion';
    try {
      await conLimite(guardar(id, datos), limiteMs);
      ultimoFallido = null;
      return 'ok';
    } catch (error) {
      const fallo = clasificarFallo(error);
      if (fallo === 'reglas' && anteriorPorConexion) {
        ultimoFallido = null;
        return 'ok';
      }
      if (fallo === 'reglas') console.error('El formulario fue rechazado por las reglas de Firestore.', error);
      ultimoFallido = { id, firma, fallo };
      return 'error';
    }
  };
}
