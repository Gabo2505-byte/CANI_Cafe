// Formato del respaldo de la base de datos (RT-06): conversión entre los valores de Firestore y JSON, sin pérdida de tipos.
// Código puro (no escribe en Firestore): lo usan respaldo.ts para exportar y verificar y la función de restauración de las
// pruebas. El formato completo está documentado en docs/CARGA_PRODUCCION.md, sección 11.
//
// Regla general: lo que JSON ya representa sin ambigüedad se guarda tal cual (null, texto, booleano, arreglo, mapa y
// números enteros o con decimales). Lo demás se guarda como un objeto con la clave "__tipo":
//   { "__tipo": "timestamp", "segundos": n, "nanosegundos": n, "iso": "..." }   (iso es solo informativo)
//   { "__tipo": "geopoint", "latitud": n, "longitud": n }
//   { "__tipo": "referencia", "ruta": "coleccion/id" }
//   { "__tipo": "bytes", "base64": "..." }
//   { "__tipo": "vector", "valor": [n, ...] }
//   { "__tipo": "entero", "valor": "texto" }     entero de Firestore fuera del rango seguro de JSON (más de 2^53)
//   { "__tipo": "decimal", "valor": "texto" }    decimal de Firestore con valor entero, NaN, Infinity o -0 ("2", "NaN", "-0")
//   { "__tipo": "mapa", "valor": { ... } }       mapa real que tiene una clave llamada "__tipo" (se envuelve para no confundirlo)
import { createHash } from 'node:crypto';
import { DocumentReference, FieldValue, GeoPoint, Timestamp, type Firestore } from 'firebase-admin/firestore';

export type Json = null | boolean | number | string | Json[] | { [clave: string]: Json };

/** Versión del formato de los archivos. Si cambia, cambia este texto y la sección 11 de la documentación. */
export const FORMATO_RESPALDO = 'cani-firestore-respaldo/1';

const CLAVE_TIPO = '__tipo';

export class TipoNoSoportadoError extends Error {
  constructor(descripcion: string) {
    super(`Valor de Firestore no soportado por el formato de respaldo: ${descripcion}.`);
    this.name = 'TipoNoSoportadoError';
  }
}

function esObjetoPlano(valor: object): boolean {
  const prototipo = Object.getPrototypeOf(valor);
  return prototipo === Object.prototype || prototipo === null;
}

/**
 * Convierte un valor leído con el Admin SDK (con useBigInt: true, para distinguir enteros de decimales) en JSON.
 * Nunca descarta nada: un tipo desconocido es un error, no un valor omitido.
 */
export function codificar(valor: unknown): Json {
  if (valor === null) return null;
  switch (typeof valor) {
    case 'string':
    case 'boolean':
      return valor;
    case 'bigint': {
      const n = Number(valor);
      return Number.isSafeInteger(n) ? n : { [CLAVE_TIPO]: 'entero', valor: valor.toString() };
    }
    case 'number': {
      // Con useBigInt los enteros llegan como bigint: un number es siempre un decimal de Firestore.
      if (!Number.isFinite(valor) || Number.isInteger(valor)) {
        return { [CLAVE_TIPO]: 'decimal', valor: Object.is(valor, -0) ? '-0' : String(valor) };
      }
      return valor;
    }
    case 'object':
      break;
    default:
      throw new TipoNoSoportadoError(typeof valor);
  }

  const objeto = valor as object;
  if (objeto instanceof Timestamp) {
    return {
      [CLAVE_TIPO]: 'timestamp',
      segundos: objeto.seconds,
      nanosegundos: objeto.nanoseconds,
      iso: objeto.toDate().toISOString(),
    };
  }
  if (objeto instanceof GeoPoint) return { [CLAVE_TIPO]: 'geopoint', latitud: objeto.latitude, longitud: objeto.longitude };
  if (objeto instanceof DocumentReference) return { [CLAVE_TIPO]: 'referencia', ruta: objeto.path };
  // VectorValue no se exporta desde firebase-admin/firestore: se reconoce por su nombre y su método toArray.
  if (objeto.constructor?.name === 'VectorValue' && typeof (objeto as { toArray?: unknown }).toArray === 'function') {
    return { [CLAVE_TIPO]: 'vector', valor: (objeto as { toArray(): number[] }).toArray() };
  }
  if (objeto instanceof Uint8Array) return { [CLAVE_TIPO]: 'bytes', base64: Buffer.from(objeto).toString('base64') };
  if (Array.isArray(objeto)) return objeto.map(codificar);
  if (!esObjetoPlano(objeto)) throw new TipoNoSoportadoError(objeto.constructor?.name ?? 'objeto');

  const mapa: { [clave: string]: Json } = {};
  for (const [clave, interno] of Object.entries(objeto)) mapa[clave] = codificar(interno);
  return CLAVE_TIPO in mapa ? { [CLAVE_TIPO]: 'mapa', valor: mapa } : mapa;
}

function textoDe(valor: Json | undefined, campo: string): string {
  if (typeof valor !== 'string') throw new TipoNoSoportadoError(`el campo "${campo}" debe ser texto`);
  return valor;
}

function numeroDe(valor: Json | undefined, campo: string): number {
  if (typeof valor !== 'number') throw new TipoNoSoportadoError(`el campo "${campo}" debe ser un número`);
  return valor;
}

/**
 * Inversa de codificar(): devuelve los valores que el Admin SDK escribe como el tipo original. Un número entero de JSON
 * se escribe como entero (bigint) y uno con decimales como decimal.
 * Límite del SDK: un decimal con valor entero (2.0) se escribe como entero, porque el SDK no tiene forma de pedir un
 * decimal con valor entero. Para Firestore ambos son el mismo número.
 */
export function decodificar(valor: Json, db: Firestore): unknown {
  if (valor === null || typeof valor === 'string' || typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return Number.isInteger(valor) ? BigInt(valor) : valor;
  if (Array.isArray(valor)) return valor.map((v) => decodificar(v, db));

  const tipo = valor[CLAVE_TIPO];
  if (tipo === undefined) {
    const mapa: Record<string, unknown> = {};
    for (const [clave, interno] of Object.entries(valor)) mapa[clave] = decodificar(interno, db);
    return mapa;
  }
  switch (tipo) {
    case 'timestamp':
      return new Timestamp(numeroDe(valor.segundos, 'segundos'), numeroDe(valor.nanosegundos, 'nanosegundos'));
    case 'geopoint':
      return new GeoPoint(numeroDe(valor.latitud, 'latitud'), numeroDe(valor.longitud, 'longitud'));
    case 'referencia':
      return db.doc(textoDe(valor.ruta, 'ruta'));
    case 'bytes':
      return Buffer.from(textoDe(valor.base64, 'base64'), 'base64');
    case 'vector': {
      const lista = valor.valor;
      if (!Array.isArray(lista) || lista.some((n) => typeof n !== 'number')) throw new TipoNoSoportadoError('vector inválido');
      return FieldValue.vector(lista as number[]);
    }
    case 'entero':
      return BigInt(textoDe(valor.valor, 'valor'));
    case 'decimal':
      return Number(textoDe(valor.valor, 'valor'));
    case 'mapa': {
      const interno = valor.valor;
      if (interno === null || typeof interno !== 'object' || Array.isArray(interno)) throw new TipoNoSoportadoError('mapa inválido');
      const mapa: Record<string, unknown> = {};
      for (const [clave, v] of Object.entries(interno)) mapa[clave] = decodificar(v, db);
      return mapa;
    }
    default:
      throw new TipoNoSoportadoError(`__tipo "${String(tipo)}" desconocido`);
  }
}

/** JSON con las claves de cada mapa ordenadas: el mismo dato siempre da el mismo texto. */
export function canonico(valor: Json): string {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor);
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;
  const claves = Object.keys(valor).sort();
  return `{${claves.map((c) => `${JSON.stringify(c)}:${canonico(valor[c])}`).join(',')}}`;
}

export function sha256(texto: string | Uint8Array): string {
  return createHash('sha256').update(texto).digest('hex');
}

/** Checksum de un documento: SHA-256 del JSON canónico de sus datos ya codificados. */
export function checksumDatos(datos: Json): string {
  return sha256(canonico(datos));
}
