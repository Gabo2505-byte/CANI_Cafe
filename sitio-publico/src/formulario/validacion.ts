// Validación del formulario "Envíenos su consulta" (HU-403 y HU-501). Vive aquí porque el sitio público no puede
// importar el código del sistema interno. Lógica pura: sin pantalla ni Firestore.
import { normalizePhoneDigits, validatePhoneNumber } from '../../../src/shared/phone/phone';
import { isValidEmail, normalizeEmail } from '../../../src/shared/validation/email';
import { parseQuantity } from '../../../src/shared/validation/quantity';

export const LIMITES = { nombre: 100, correo: 100, mensaje: 1000 } as const;

/** Mensajes literales de HU-501 (los del teléfono salen de src/shared/phone/phone.ts, que ya son los de la HU). */
export const MENSAJES = {
  obligatorio: 'Este campo es obligatorio.',
  correoInvalido: 'Ingrese un correo electrónico válido.',
  sinProductos: 'Seleccione al menos un producto.',
  cantidad: 'Ingrese una cantidad entre 1 y 9999.',
  revisar: 'Revise los campos marcados en rojo.',
} as const;

export interface ValoresFormulario {
  nombre: string;
  correo: string;
  /** Código ISO del país del teléfono ("CR"). */
  paisTelefono: string;
  telefono: string;
  /** Productos marcados: id del producto → cantidad tal como se escribió. Un producto sin marcar no aparece. */
  intereses: Record<string, string>;
  mensaje: string;
}

/** Campos que se revisan al salir de ellos. El mensaje no tiene errores: solo su tope de 1000 caracteres. */
export type CampoFormulario = 'nombre' | 'correo' | 'telefono' | 'intereses';

export interface ErroresFormulario {
  nombre?: string;
  correo?: string;
  telefono?: string;
  intereses?: string;
  /** Error de la cantidad de cada producto marcado, por id de producto. */
  cantidades: Record<string, string>;
}

/** Valores con que empieza el formulario: Costa Rica elegido de forma automática. */
export function valoresIniciales(parcial: Partial<ValoresFormulario> = {}): ValoresFormulario {
  return { nombre: '', correo: '', paisTelefono: 'CR', telefono: '', intereses: {}, mensaje: '', ...parcial };
}

/**
 * Revisa todos los datos y devuelve solo los errores que hay. Nombre y correo no pasan de 100 caracteres y el mensaje
 * de 1000 porque el propio campo no deja escribir más (ver LIMITES), así que no tienen mensaje de "demasiado largo".
 */
export function validarFormulario(valores: ValoresFormulario): ErroresFormulario {
  const errores: ErroresFormulario = { cantidades: {} };

  if (valores.nombre.trim() === '') errores.nombre = MENSAJES.obligatorio;

  const correo = normalizeEmail(valores.correo);
  if (correo === '') errores.correo = MENSAJES.obligatorio;
  else if (!isValidEmail(correo)) errores.correo = MENSAJES.correoInvalido;

  // El teléfono es opcional; si se escribe algo (aunque no sean números), se revisa su cantidad de dígitos.
  if (valores.telefono.trim() !== '') {
    const error = validatePhoneNumber(valores.paisTelefono, normalizePhoneDigits(valores.telefono));
    if (error) errores.telefono = error;
  }

  const marcados = Object.entries(valores.intereses);
  if (marcados.length === 0) errores.intereses = MENSAJES.sinProductos;
  for (const [id, cantidad] of marcados) {
    if (parseQuantity(cantidad) === null) errores.cantidades[id] = MENSAJES.cantidad;
  }

  return errores;
}

export function hayErrores(errores: ErroresFormulario): boolean {
  return (
    Boolean(errores.nombre || errores.correo || errores.telefono || errores.intereses) ||
    Object.keys(errores.cantidades).length > 0
  );
}
