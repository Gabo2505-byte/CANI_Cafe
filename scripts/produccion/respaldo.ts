// Script E: copia de la base de datos de producción a archivos JSON (RT-06: entregar a CANI Café una copia de su base de
// datos). La lógica está aquí para poder probarla; el punto de entrada de la terminal es respaldarBd.ts.
//
// SOLO LECTURA: este archivo no llama a ninguna operación de escritura de Firestore ni de Authentication (set, update,
// delete, create, batch, commit...). Lo vigila tests/unit/produccionRespaldo.test.ts. La restauración vive en las
// pruebas (tests/helpers/restaurarRespaldo.ts) y se documenta a mano en docs/CARGA_PRODUCCION.md, sección 11.
//
// Igual que limpiarPruebas.ts usa el Admin SDK con las credenciales de gcloud (sin archivos de clave) y las mismas
// salvaguardas: --project, el archivo --env y las credenciales deben ser cani-cafe, y se aborta si hay variables de emulador.
//
// Qué exporta:
// - TODAS las colecciones y subcolecciones, descubiertas con listCollections (no hay una lista fija);
// - un archivo JSON por colección (respaldo-colecciones/), con los tipos de Firestore conservados (ver respaldoFormato.ts);
// - las cuentas de Authentication (uid, correo, fecha de creación...). Nunca contraseñas ni hashes;
// - un manifiesto con el proyecto, la fecha y hora, y el conteo de documentos y el checksum de cada archivo.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { deleteApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { CollectionReference, Firestore } from 'firebase-admin/firestore';
import { AbortoError, comprobarDestino, leerConfigWeb, type ConfigWeb, type Terminal } from './comun';
import {
  comprobarCredenciales,
  crearAppAdmin,
  leerOpciones,
  mensajeAdmin,
  proyectoDeGcloud,
  type Comprobacion,
} from './limpieza';
import { FORMATO_RESPALDO, canonico, checksumDatos, codificar, sha256, type Json } from './respaldoFormato';

export const ARCHIVO_MANIFIESTO = 'respaldo-manifiesto.json';
export const ARCHIVO_AUTHENTICATION = 'respaldo-authentication.json';
export const CARPETA_COLECCIONES = 'respaldo-colecciones';
const ZONA_HORARIA = 'America/Costa_Rica';
/** Cuántos ejemplos de documentos distintos se muestran por colección. */
const MAX_EJEMPLOS = 5;

// ---------------------------------------------------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------------------------------------------------

export interface ArgumentosRespaldo {
  project: string;
  env: string;
  /** Carpeta de salida; null = la que se calcula por defecto (..\respaldos\<proyecto>-AAAAMMDD-HHMM). */
  salida: string | null;
  /** Carpeta de un respaldo para compararlo con la base viva; null = exportar. */
  verificar: string | null;
  emulador: boolean;
}

export function analizarArgumentosRespaldo(argv: readonly string[]): ArgumentosRespaldo {
  const { valores, vistas } = leerOpciones(argv, {
    conValor: ['project', 'env', 'salida', 'verificar'],
    banderas: ['emulador'],
    rechazadas: {
      email: 'Este script no usa --email: trabaja con las credenciales de gcloud (gcloud auth application-default login).',
      escribir: 'Este script solo lee: no escribe nada en Firestore.',
      borrar: 'Este script solo lee: no borra nada.',
    },
  });
  for (const nombre of ['project', 'env'] as const) {
    if (!valores.has(nombre)) throw new AbortoError(`Falta la opción obligatoria --${nombre}.`);
  }
  if (valores.has('salida') && valores.has('verificar')) {
    throw new AbortoError('--salida es para exportar y --verificar para comparar un respaldo: use solo una.');
  }
  return {
    project: valores.get('project')!,
    env: valores.get('env')!,
    salida: valores.get('salida') ?? null,
    verificar: valores.get('verificar') ?? null,
    emulador: vistas.has('emulador'),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Carpeta de salida
// ---------------------------------------------------------------------------------------------------------------------

function partesEnCostaRica(fecha: Date): Record<string, string> {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
  return Object.fromEntries(partes.map((p) => [p.type, p.value]));
}

/** "20261116-0930", en hora de Costa Rica. */
export function sufijoFecha(fecha: Date): string {
  const p = partesEnCostaRica(fecha);
  return `${p.year}${p.month}${p.day}-${p.hour}${p.minute}`;
}

/** "2026-11-16 09:30 (America/Costa_Rica)". */
export function fechaLocal(fecha: Date): string {
  const p = partesEnCostaRica(fecha);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} (${ZONA_HORARIA})`;
}

/** Fuera del repositorio: ..\respaldos\cani-cafe-AAAAMMDD-HHMM, al lado de la carpeta del repo. */
export function carpetaPorDefecto(proyecto: string, ahora: Date, raizRepo: string): string {
  return resolve(raizRepo, '..', 'respaldos', `${proyecto}-${sufijoFecha(ahora)}`);
}

export function estaDentroDe(carpeta: string, raiz: string): boolean {
  const ruta = relative(resolve(raiz), resolve(carpeta));
  return ruta === '' || (ruta !== '..' && !ruta.startsWith(`..${sep}`) && !isAbsolute(ruta));
}

/** Nunca dentro del repositorio (un git add accidental subiría datos reales) y nunca sobre una carpeta con contenido. */
export function comprobarCarpetaSalida(carpeta: string, raizRepo: string): void {
  if (estaDentroDe(carpeta, raizRepo)) {
    throw new AbortoError(`La carpeta de salida "${carpeta}" está dentro del repositorio. Elija una fuera de él (por defecto ..\\respaldos\\).`);
  }
  let contenido: string[] = [];
  try {
    contenido = readdirSync(carpeta);
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') {
      throw new AbortoError(`No se puede usar la carpeta de salida "${carpeta}": ${(error as Error).message}`);
    }
  }
  if (contenido.length > 0) throw new AbortoError(`La carpeta de salida "${carpeta}" ya tiene archivos. No se sobrescribe nada.`);
}

// ---------------------------------------------------------------------------------------------------------------------
// Lectura de Firestore y Authentication (solo lectura)
// ---------------------------------------------------------------------------------------------------------------------

export interface DocumentoRespaldo {
  id: string;
  ruta: string;
  datos: Json;
  sha256: string;
}

export interface ColeccionRespaldo {
  /** Ruta completa: "contacts" o "sales/abc/notas". */
  ruta: string;
  documentos: DocumentoRespaldo[];
  /** Ids que no tienen campos pero sí subcolecciones (documentos "fantasma" de Firestore). Solo informativo. */
  sinCampos: string[];
}

export interface CuentaRespaldo {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  createdAt: string | null;
}

const porTexto = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

async function leerColeccion(coleccion: CollectionReference, acumulado: ColeccionRespaldo[]): Promise<void> {
  const [snap, refs] = await Promise.all([coleccion.get(), coleccion.listDocuments()]);
  const conCampos = new Set(snap.docs.map((d) => d.id));
  const documentos = snap.docs
    .map((d) => {
      const datos = codificar(d.data());
      return { id: d.id, ruta: d.ref.path, datos, sha256: checksumDatos(datos) };
    })
    .sort((a, b) => porTexto(a.id, b.id));
  const sinCampos = refs.map((r) => r.id).filter((id) => !conCampos.has(id)).sort(porTexto);
  acumulado.push({ ruta: coleccion.path, documentos, sinCampos });
  for (const ref of refs) {
    for (const subcoleccion of await ref.listCollections()) await leerColeccion(subcoleccion, acumulado);
  }
}

/** Todas las colecciones y subcolecciones, en orden de ruta. */
export async function leerColecciones(db: Firestore): Promise<ColeccionRespaldo[]> {
  const acumulado: ColeccionRespaldo[] = [];
  for (const raiz of await db.listCollections()) await leerColeccion(raiz, acumulado);
  return acumulado.sort((a, b) => porTexto(a.ruta, b.ruta));
}

/** Solo uid, correo, nombre, estado y fecha de creación. Nunca se copian contraseñas ni hashes de contraseña. */
export async function leerCuentas(app: App): Promise<CuentaRespaldo[]> {
  const auth = getAuth(app);
  const cuentas: CuentaRespaldo[] = [];
  let pagina: string | undefined;
  do {
    const resultado = await auth.listUsers(1000, pagina);
    for (const u of resultado.users) {
      const creada = u.metadata.creationTime ? new Date(u.metadata.creationTime) : null;
      cuentas.push({
        uid: u.uid,
        email: u.email ?? null,
        displayName: u.displayName ?? null,
        disabled: u.disabled,
        createdAt: creada && !Number.isNaN(creada.getTime()) ? creada.toISOString() : null,
      });
    }
    pagina = resultado.pageToken;
  } while (pagina);
  return cuentas.sort((a, b) => porTexto(a.uid, b.uid));
}

// ---------------------------------------------------------------------------------------------------------------------
// Escritura de los archivos del respaldo (solo en disco)
// ---------------------------------------------------------------------------------------------------------------------

interface EntradaManifiesto {
  ruta: string;
  archivo: string;
  documentos: number;
  sinCampos: number;
  sha256: string;
}

export interface Manifiesto {
  formato: string;
  proyecto: string;
  generadoEn: string;
  generadoEnLocal: string;
  colecciones: EntradaManifiesto[];
  totalDocumentos: number;
  authentication: { archivo: string; cuentas: number; sha256: string };
}

/** Un nombre de archivo seguro para Windows por colección; el manifiesto guarda la ruta real. */
export function nombreArchivoColeccion(ruta: string, usados: Set<string>): string {
  const base = ruta.replace(/\//g, '__').replace(/[^A-Za-z0-9._-]/g, '_') || 'coleccion';
  let nombre = `${base}.json`;
  for (let n = 2; usados.has(nombre.toLowerCase()); n++) nombre = `${base}-${n}.json`;
  usados.add(nombre.toLowerCase());
  return nombre;
}

function aTexto(valor: unknown): string {
  return `${JSON.stringify(valor, null, 2)}\n`;
}

export function escribirRespaldo(
  carpeta: string,
  proyecto: string,
  colecciones: readonly ColeccionRespaldo[],
  cuentas: readonly CuentaRespaldo[],
  ahora: Date,
): Manifiesto {
  mkdirSync(join(carpeta, CARPETA_COLECCIONES), { recursive: true });
  const usados = new Set<string>();
  const entradas: EntradaManifiesto[] = [];
  for (const c of colecciones) {
    const archivo = `${CARPETA_COLECCIONES}/${nombreArchivoColeccion(c.ruta, usados)}`;
    const texto = aTexto({ formato: FORMATO_RESPALDO, coleccion: c.ruta, documentos: c.documentos, documentosSinCampos: c.sinCampos });
    writeFileSync(join(carpeta, archivo), texto, 'utf8');
    entradas.push({ ruta: c.ruta, archivo, documentos: c.documentos.length, sinCampos: c.sinCampos.length, sha256: sha256(texto) });
  }
  const textoCuentas = aTexto({ formato: FORMATO_RESPALDO, proyecto, cuentas });
  writeFileSync(join(carpeta, ARCHIVO_AUTHENTICATION), textoCuentas, 'utf8');

  const manifiesto: Manifiesto = {
    formato: FORMATO_RESPALDO,
    proyecto,
    generadoEn: ahora.toISOString(),
    generadoEnLocal: fechaLocal(ahora),
    colecciones: entradas,
    totalDocumentos: entradas.reduce((suma, e) => suma + e.documentos, 0),
    authentication: { archivo: ARCHIVO_AUTHENTICATION, cuentas: cuentas.length, sha256: sha256(textoCuentas) },
  };
  // El manifiesto va al final: si existe, el respaldo se escribió completo.
  writeFileSync(join(carpeta, ARCHIVO_MANIFIESTO), aTexto(manifiesto), 'utf8');
  return manifiesto;
}

// ---------------------------------------------------------------------------------------------------------------------
// Lectura de un respaldo y verificación contra la base viva
// ---------------------------------------------------------------------------------------------------------------------

export interface RespaldoLeido {
  manifiesto: Manifiesto;
  colecciones: ColeccionRespaldo[];
  cuentas: CuentaRespaldo[];
  comprobaciones: Comprobacion[];
}

function leerJsonArchivo(ruta: string): { texto: string; json: unknown } {
  const texto = readFileSync(ruta, 'utf8');
  return { texto, json: JSON.parse(texto) as unknown };
}

const ok = (texto: string): Comprobacion => ({ texto, ok: true });
const falla = (texto: string): Comprobacion => ({ texto, ok: false });

/** Relee todos los archivos de un respaldo y comprueba que están íntegros (sin tocar la base viva). */
export function leerRespaldo(carpeta: string): RespaldoLeido {
  let manifiesto: Manifiesto;
  try {
    manifiesto = leerJsonArchivo(join(carpeta, ARCHIVO_MANIFIESTO)).json as Manifiesto;
  } catch {
    throw new AbortoError(`No se pudo leer ${ARCHIVO_MANIFIESTO} en "${carpeta}". ¿Es la carpeta de un respaldo completo?`);
  }
  if (manifiesto?.formato !== FORMATO_RESPALDO || !Array.isArray(manifiesto.colecciones)) {
    throw new AbortoError(`El manifiesto no tiene el formato "${FORMATO_RESPALDO}".`);
  }

  const comprobaciones: Comprobacion[] = [];
  const colecciones: ColeccionRespaldo[] = [];
  for (const entrada of manifiesto.colecciones) {
    try {
      const { texto, json } = leerJsonArchivo(join(carpeta, entrada.archivo));
      const archivo = json as { coleccion: string; documentos: DocumentoRespaldo[]; documentosSinCampos?: string[] };
      const problemas: string[] = [];
      if (sha256(texto) !== entrada.sha256) problemas.push('el checksum del archivo no coincide con el manifiesto');
      if (archivo.coleccion !== entrada.ruta) problemas.push(`el archivo es de la colección "${archivo.coleccion}"`);
      if (archivo.documentos.length !== entrada.documentos) {
        problemas.push(`tiene ${archivo.documentos.length} documentos y el manifiesto dice ${entrada.documentos}`);
      }
      const alterados = archivo.documentos.filter((d) => checksumDatos(d.datos) !== d.sha256).map((d) => d.id);
      if (alterados.length > 0) problemas.push(`documentos con checksum distinto: ${resumir(alterados)}`);
      comprobaciones.push(
        problemas.length === 0
          ? ok(`${entrada.archivo}: archivo íntegro (${entrada.documentos} documentos)`)
          : falla(`${entrada.archivo}: ${problemas.join('; ')}`),
      );
      // El checksum que se compara con la base viva se recalcula de los datos leídos, no se confía en el guardado.
      const documentos = archivo.documentos.map((d) => ({ ...d, sha256: checksumDatos(d.datos) }));
      colecciones.push({ ruta: entrada.ruta, documentos, sinCampos: archivo.documentosSinCampos ?? [] });
    } catch (error) {
      comprobaciones.push(falla(`${entrada.archivo}: no se pudo leer (${(error as Error).message})`));
    }
  }

  let cuentas: CuentaRespaldo[] = [];
  try {
    const { texto, json } = leerJsonArchivo(join(carpeta, manifiesto.authentication.archivo));
    cuentas = (json as { cuentas: CuentaRespaldo[] }).cuentas;
    const problemas: string[] = [];
    if (sha256(texto) !== manifiesto.authentication.sha256) problemas.push('el checksum del archivo no coincide con el manifiesto');
    if (cuentas.length !== manifiesto.authentication.cuentas) problemas.push(`tiene ${cuentas.length} cuentas y el manifiesto dice ${manifiesto.authentication.cuentas}`);
    comprobaciones.push(
      problemas.length === 0
        ? ok(`${manifiesto.authentication.archivo}: archivo íntegro (${cuentas.length} cuentas)`)
        : falla(`${manifiesto.authentication.archivo}: ${problemas.join('; ')}`),
    );
  } catch (error) {
    comprobaciones.push(falla(`${manifiesto.authentication.archivo}: no se pudo leer (${(error as Error).message})`));
  }
  return { manifiesto, colecciones, cuentas, comprobaciones };
}

function resumir(ids: readonly string[]): string {
  const mostrados = ids.slice(0, MAX_EJEMPLOS).join(', ');
  return ids.length > MAX_EJEMPLOS ? `${mostrados} y ${ids.length - MAX_EJEMPLOS} más` : mostrados;
}

/** Compara conteos por colección y el checksum de cada documento entre el respaldo y la base viva. */
export function compararColecciones(respaldo: readonly ColeccionRespaldo[], vivas: readonly ColeccionRespaldo[]): Comprobacion[] {
  const delRespaldo = new Map(respaldo.map((c) => [c.ruta, c]));
  const deLaBase = new Map(vivas.map((c) => [c.ruta, c]));
  const rutas = [...new Set([...delRespaldo.keys(), ...deLaBase.keys()])].sort(porTexto);
  const resultado: Comprobacion[] = [];
  for (const ruta of rutas) {
    const a = delRespaldo.get(ruta);
    const b = deLaBase.get(ruta);
    if (!a) {
      resultado.push(falla(`${ruta}: existe en la base viva (${b!.documentos.length} documentos) y no está en el respaldo`));
      continue;
    }
    if (!b) {
      resultado.push(falla(`${ruta}: está en el respaldo (${a.documentos.length} documentos) y ya no existe en la base viva`));
      continue;
    }
    const idsRespaldo = new Map(a.documentos.map((d) => [d.id, d.sha256]));
    const idsVivos = new Map(b.documentos.map((d) => [d.id, d.sha256]));
    const soloVivos = [...idsVivos.keys()].filter((id) => !idsRespaldo.has(id));
    const soloRespaldo = [...idsRespaldo.keys()].filter((id) => !idsVivos.has(id));
    const distintos = [...idsRespaldo].filter(([id, hash]) => idsVivos.has(id) && idsVivos.get(id) !== hash).map(([id]) => id);
    const conteos = `${a.documentos.length} en el respaldo y ${b.documentos.length} en la base viva`;
    if (soloVivos.length === 0 && soloRespaldo.length === 0 && distintos.length === 0) {
      resultado.push(ok(`${ruta}: ${conteos}; checksums iguales`));
      continue;
    }
    const detalles = [
      a.documentos.length !== b.documentos.length ? conteos : '',
      soloVivos.length > 0 ? `solo en la base viva: ${resumir(soloVivos)}` : '',
      soloRespaldo.length > 0 ? `solo en el respaldo: ${resumir(soloRespaldo)}` : '',
      distintos.length > 0 ? `contenido distinto: ${resumir(distintos)}` : '',
    ].filter(Boolean);
    resultado.push(falla(`${ruta}: ${detalles.join('; ')}`));
  }
  return resultado;
}

export function compararCuentas(respaldo: readonly CuentaRespaldo[], vivas: readonly CuentaRespaldo[]): Comprobacion {
  const huella = (c: CuentaRespaldo) => sha256(canonico(c as unknown as Json));
  const a = new Map(respaldo.map((c) => [c.uid, huella(c)]));
  const b = new Map(vivas.map((c) => [c.uid, huella(c)]));
  const soloVivas = [...b.keys()].filter((uid) => !a.has(uid));
  const soloRespaldo = [...a.keys()].filter((uid) => !b.has(uid));
  const distintas = [...a].filter(([uid, h]) => b.has(uid) && b.get(uid) !== h).map(([uid]) => uid);
  const conteos = `${a.size} en el respaldo y ${b.size} en la base viva`;
  if (soloVivas.length === 0 && soloRespaldo.length === 0 && distintas.length === 0) {
    return ok(`Authentication: ${conteos}; cuentas iguales`);
  }
  const detalles = [
    soloVivas.length > 0 ? `solo en la base viva: ${resumir(soloVivas)}` : '',
    soloRespaldo.length > 0 ? `solo en el respaldo: ${resumir(soloRespaldo)}` : '',
    distintas.length > 0 ? `datos distintos: ${resumir(distintas)}` : '',
  ].filter(Boolean);
  return falla(`Authentication: ${conteos}; ${detalles.join('; ')}`);
}

// ---------------------------------------------------------------------------------------------------------------------
// Flujo completo
// ---------------------------------------------------------------------------------------------------------------------

export interface DependenciasRespaldo {
  /** projectId de las credenciales de gcloud (las pruebas pasan uno falso). */
  proyectoDeCredenciales?: () => Promise<string | null>;
  /** Fecha y hora del respaldo (las pruebas la fijan). */
  ahora?: Date;
  /** Raíz del repositorio: la carpeta de salida no puede estar dentro. Por defecto, la carpeta actual. */
  raizRepo?: string;
}

export interface ResultadoRespaldo {
  codigo: 0 | 1;
  carpeta?: string;
  manifiesto?: Manifiesto;
  comprobaciones?: Comprobacion[];
}

/** Flujo completo del script E (exportar o --verificar). Nunca lanza: devuelve el código de salida. */
export async function ejecutarRespaldo(
  argv: readonly string[],
  terminal: Terminal,
  deps: DependenciasRespaldo = {},
): Promise<ResultadoRespaldo> {
  let app: App | undefined;
  try {
    const args = analizarArgumentosRespaldo(argv);
    const config = leerConfigWeb(args.env, args.project, terminal.leerArchivo);
    comprobarDestino(config, { emulador: args.emulador }, terminal.entorno);
    if (!args.emulador) {
      comprobarCredenciales(await (deps.proyectoDeCredenciales ?? proyectoDeGcloud)(), args, {
        accion: 'respalda',
        entorno: terminal.entorno,
      });
    }
    const ahora = deps.ahora ?? new Date();
    const raizRepo = deps.raizRepo ?? process.cwd();
    const carpeta = resolve(args.verificar ?? args.salida ?? carpetaPorDefecto(config.projectId, ahora, raizRepo));
    if (!args.verificar) comprobarCarpetaSalida(carpeta, raizRepo);

    terminal.log(`Proyecto:      ${config.projectId}`);
    terminal.log(`Destino:       ${args.emulador ? 'EMULADORES locales' : 'FIREBASE REAL'}`);
    terminal.log(`Credenciales:  ${args.emulador ? 'emulador (sin credenciales)' : `gcloud, proyecto ${config.projectId}`}`);
    terminal.log(`Modo:          ${args.verificar ? 'verificación (solo lectura)' : 'exportación (solo lectura)'}`);
    terminal.log(`Carpeta:       ${carpeta}`);

    // Antes de abrir la conexión: un respaldo ilegible no necesita red.
    const guardado = args.verificar ? leerRespaldo(carpeta) : undefined;
    if (guardado && guardado.manifiesto.proyecto !== config.projectId) {
      throw new AbortoError(`El respaldo es del proyecto "${guardado.manifiesto.proyecto}" y se pidió --project "${config.projectId}".`);
    }

    const conexion = crearAppAdmin(config, args, terminal.entorno, { prefijo: 'respaldo', useBigInt: true });
    app = conexion.app;
    prepararAuthEmulador(config, args.emulador, terminal.entorno);

    let colecciones: ColeccionRespaldo[];
    let cuentas: CuentaRespaldo[];
    try {
      colecciones = await leerColecciones(conexion.db);
      cuentas = await leerCuentas(app);
    } catch (error) {
      if (error instanceof AbortoError) throw error;
      throw new AbortoError(`No se pudieron leer los datos: ${mensajeAdmin(error)}`);
    }

    if (guardado) {
      terminal.log('');
      terminal.log('Verificación contra la base viva:');
      const comprobaciones = [...guardado.comprobaciones, ...compararColecciones(guardado.colecciones, colecciones), compararCuentas(guardado.cuentas, cuentas)];
      for (const c of comprobaciones) terminal.log(`  [${c.ok ? 'OK' : 'FALLA'}] ${c.texto}`);
      const todoBien = comprobaciones.every((c) => c.ok);
      if (todoBien) terminal.log('Todo coincide.');
      else terminal.error('La verificación encontró diferencias: revise las líneas FALLA.');
      return { codigo: todoBien ? 0 : 1, carpeta, manifiesto: guardado.manifiesto, comprobaciones };
    }

    let manifiesto: Manifiesto;
    try {
      manifiesto = escribirRespaldo(carpeta, config.projectId, colecciones, cuentas, ahora);
    } catch (error) {
      throw new AbortoError(`No se pudo escribir el respaldo en "${carpeta}": ${(error as Error).message}`);
    }
    terminal.log('');
    for (const c of manifiesto.colecciones) {
      const fantasmas = c.sinCampos > 0 ? ` (+${c.sinCampos} sin campos)` : '';
      terminal.log(`  ${c.ruta}: ${c.documentos} documentos${fantasmas}`);
    }
    terminal.log(`  Authentication: ${manifiesto.authentication.cuentas} cuentas`);
    terminal.log(`Respaldo terminado: ${manifiesto.colecciones.length} colecciones, ${manifiesto.totalDocumentos} documentos.`);
    terminal.log('');
    terminal.log('Siguiente paso: compare el respaldo con la base viva:');
    terminal.log(`  npm run bd:respaldar -- --project ${config.projectId} --env ${args.env} --verificar "${carpeta}"`);
    terminal.log('El respaldo contiene datos reales de clientes: guárdelo fuera del repositorio y entréguelo solo por un canal privado.');
    return { codigo: 0, carpeta, manifiesto };
  } catch (error) {
    terminal.error(error instanceof AbortoError ? `ABORTADO: ${error.message}` : `ERROR: ${mensajeAdmin(error)}`);
    return { codigo: 1 };
  } finally {
    if (app) await deleteApp(app);
  }
}

/** Con --emulador el Admin SDK de Authentication necesita saber dónde está el emulador (lo lee del entorno). */
function prepararAuthEmulador(config: ConfigWeb, emulador: boolean, entorno: Record<string, string | undefined>): void {
  if (!emulador || entorno.FIREBASE_AUTH_EMULATOR_HOST) return;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = config.hostAuthEmulador || '127.0.0.1:9099';
}
