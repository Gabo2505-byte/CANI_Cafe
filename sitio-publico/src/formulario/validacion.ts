// Validación del formulario "Envíenos su consulta" (HU-403 y HU-501). Vive aquí porque el sitio público no puede
// importar el código del sistema interno. Lógica pura: sin pantalla ni Firestore.
import { normalizePhoneDigits, validatePhoneNumber } from '../../../src/shared/phone/phone';
import { isValidEmail, normalizeEmail } from '../../../src/shared/validation/email';
import { parseQuantity } from '../../../src/shared/validation/quantity';

export const LIMITES = { nombre: 100, correo: 100, mensaje: 1000 } as const;

/** Mensajes de HU-501 (los del teléfono salen de src/shared/phone/phone.ts, que ya son los de la HU). */
export const MENSAJES = {
  obligatorio: 'Este campo es obligatorio.',
  correoInvalido: 'Ingrese un correo electrónico válido.',
  sinProductos: 'Seleccione al menos un producto.',
  cantidad: 'Ingrese una cantidad entre 1 y 9999.',
  revisar: 'Revise los campos marcados en rojo.',
  // PROVISIONALES (no están en HU-501): los mismos textos que usa el sistema interno para sus filas de productos.
  filaVacia: 'Seleccione un producto o elimine la fila.',
  repetido: 'Este producto ya fue agregado.',
} as const;

/** Una fila de productos de interés (HU-404): el producto se elige en dos pasos, variedad y presentación. */
export interface FilaProducto {
  /** Solo identifica la fila en pantalla. */
  clave: string;
  /** Variedad elegida (`Product.name`); puede haber variedad sin presentación todavía. */
  variedad: string;
  /** Producto completo (variedad + presentación); vacío mientras no se elige la presentación. */
  productoId: string;
  /** Cantidad tal como se escribió. */
  cantidad: string;
}

let siguienteClave = 0;

/** Fila nueva, sin producto ni cantidad (la cantidad empieza en 1 al elegir la presentación). */
export function nuevaFila(parcial: Partial<Omit<FilaProducto, 'clave'>> = {}): FilaProducto {
  siguienteClave += 1;
  return { clave: `fila-${siguienteClave}`, variedad: '', productoId: '', cantidad: '', ...parcial };
}

export interface ValoresFormulario {
  nombre: string;
  correo: string;
  /** Código ISO del país del teléfono ("CR"). */
  paisTelefono: string;
  telefono: string;
  /** Filas de productos de interés, en el orden en que se agregaron. */
  filas: FilaProducto[];
  mensaje: string;
}

/** Campos que se revisan al salir de ellos. El mensaje no tiene errores: solo su tope de 1000 caracteres. */
export type CampoFormulario = 'nombre' | 'correo' | 'telefono' | 'intereses';

export interface ErroresFila {
  /** Fila sin producto completo, o con un producto que ya está en una fila anterior. */
  producto?: string;
  cantidad?: string;
}

export interface ErroresFormulario {
  nombre?: string;
  correo?: string;
  telefono?: string;
  /** "Seleccione al menos un producto.": ninguna fila tiene un producto elegido. */
  intereses?: string;
  /** Errores de cada fila, por su clave. */
  filas: Record<string, ErroresFila>;
}

/** Valores con que empieza el formulario: Costa Rica elegido y una fila de productos lista para llenar. */
export function valoresIniciales(parcial: Partial<ValoresFormulario> = {}): ValoresFormulario {
  return { nombre: '', correo: '', paisTelefono: 'CR', telefono: '', filas: [nuevaFila()], mensaje: '', ...parcial };
}

/**
 * Revisa todos los datos y devuelve solo los errores que hay. Nombre y correo no pasan de 100 caracteres y el mensaje
 * de 1000 porque el propio campo no deja escribir más (ver LIMITES), así que no tienen mensaje de "demasiado largo".
 */
export function validarFormulario(valores: ValoresFormulario): ErroresFormulario {
  const errores: ErroresFormulario = { filas: {} };

  if (valores.nombre.trim() === '') errores.nombre = MENSAJES.obligatorio;

  const correo = normalizeEmail(valores.correo);
  if (correo === '') errores.correo = MENSAJES.obligatorio;
  else if (!isValidEmail(correo)) errores.correo = MENSAJES.correoInvalido;

  // El teléfono es opcional; si se escribe algo (aunque no sean números), se revisa su cantidad de dígitos.
  if (valores.telefono.trim() !== '') {
    const error = validatePhoneNumber(valores.paisTelefono, normalizePhoneDigits(valores.telefono));
    if (error) errores.telefono = error;
  }

  // Sin ningún producto elegido, el aviso es uno solo para todo el campo (no uno por cada fila vacía).
  const conProducto = valores.filas.filter((f) => f.productoId);
  if (conProducto.length === 0) {
    errores.intereses = MENSAJES.sinProductos;
    return errores;
  }

  const vistos = new Set<string>();
  for (const fila of valores.filas) {
    const deLaFila: ErroresFila = {};
    if (!fila.productoId) deLaFila.producto = MENSAJES.filaVacia;
    else if (vistos.has(fila.productoId)) deLaFila.producto = MENSAJES.repetido;
    else vistos.add(fila.productoId);
    if (fila.productoId && parseQuantity(fila.cantidad) === null) deLaFila.cantidad = MENSAJES.cantidad;
    if (deLaFila.producto || deLaFila.cantidad) errores.filas[fila.clave] = deLaFila;
  }
  return errores;
}

export function hayErrores(errores: ErroresFormulario): boolean {
  return (
    Boolean(errores.nombre || errores.correo || errores.telefono || errores.intereses) ||
    Object.keys(errores.filas).length > 0
  );
}
