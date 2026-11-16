// Script D: limpieza única de los datos de prueba del proyecto de producción (RT-01). Borra los contactos cuyo nombre
// empieza por "PRUEBA" (sin distinguir mayúsculas) y todo lo que cuelga de ellos. La lógica está aquí para poder
// probarla; el punto de entrada de la terminal es limpiarPruebas.ts.
//
// A diferencia de los otros scripts de producción, usa el Admin SDK: las reglas desplegadas no permiten borrar
// `communications` (HU-211) ni `formRequests`, y no se cambian para esto. El Admin SDK IGNORA las reglas, así que las
// protecciones viven aquí:
// - credenciales de gcloud (Application Default Credentials) cuyo projectId debe ser cani-cafe, igual que --project y
//   que el archivo --env; nunca archivos de clave en el repo;
// - se aborta si algún contacto seleccionado no empieza por "PRUEBA", si alguno tiene origen "carga_inicial" o si son
//   más de 10;
// - modo prueba por defecto; con --borrar hay que teclear el projectId exacto.
//
// Qué cuelga de un contacto (revisado en src/, sitio-publico/ y scripts/; no hay subcolecciones):
// - sales (contactId) → saleProducts y stageHistory (saleId);
// - communications (contactId, y saleId de sus ventas);
// - formRequests (contactId, lo pone el procesamiento) y las solicitudes con nombre "PRUEBA..." aunque no tengan contacto;
// - la bitácora y los avisos NO se guardan: se calculan al consultar a partir de las colecciones de arriba. Los avisos
//   se muestran solo como conteo y desaparecen al borrar las ventas.
import { applicationDefault, deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type DocumentReference, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { GoogleAuth } from 'google-auth-library';
import { buildAlerts, type AlertContact } from '../../src/sales/alerts';
import { COLLECTIONS } from '../../src/shared/constants/collections';
import type { Sale } from '../../src/shared/types';
import { FORM_REQUESTS_COLLECTION } from '../../src/shared/types/formRequest';
import { AbortoError, comprobarDestino, leerConfigWeb, type ConfigWeb, type Terminal } from './comun';

/** Único proyecto real en el que se permite borrar. */
export const PROYECTO_PRODUCCION = 'cani-cafe';
/** Más contactos que esto no es una limpieza de pruebas: se aborta. */
export const MAX_CONTACTOS = 10;
/** Contactos de la carga inicial (RT-02) que deben seguir ahí antes y después de borrar. */
export const CARGA_INICIAL_ESPERADOS = 18;
const ORIGEN_CARGA_INICIAL = 'carga_inicial';

/** Firestore acepta hasta 30 valores en una consulta "in". */
const IN_QUERY_LIMIT = 30;
/** Un lote admite 500 escrituras; se deja margen. */
const TAMANO_LOTE = 400;

// ---------------------------------------------------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------------------------------------------------

export interface ArgumentosLimpieza {
  project: string;
  env: string;
  borrar: boolean;
  emulador: boolean;
}

const OPCIONES = ['project', 'env'] as const;
const BANDERAS = ['borrar', 'emulador'] as const;

/** Igual que analizarArgumentos de comun.ts, pero sin --email (no hay inicio de sesión) y con --borrar. */
export function analizarArgumentosLimpieza(argv: readonly string[]): ArgumentosLimpieza {
  const valores = new Map<string, string>();
  const vistas = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new AbortoError(`Argumento inesperado: "${arg}". Cada valor va después de su opción.`);
    const nombre = arg.slice(2);
    if (nombre.includes('=')) {
      throw new AbortoError(`Use "--${nombre.split('=')[0]} <valor>" (con espacio), no "${arg.split('=')[0]}=...".`);
    }
    if (vistas.has(nombre)) throw new AbortoError(`La opción --${nombre} está repetida.`);
    vistas.add(nombre);
    if ((BANDERAS as readonly string[]).includes(nombre)) continue;
    if (nombre === 'email') {
      throw new AbortoError('Este script no usa --email: trabaja con las credenciales de gcloud (gcloud auth application-default login).');
    }
    if (nombre === 'escribir') throw new AbortoError('Este script usa --borrar, no --escribir.');
    if (!(OPCIONES as readonly string[]).includes(nombre)) throw new AbortoError(`Opción desconocida: --${nombre}.`);
    const valor = argv[i + 1];
    if (valor === undefined || valor.startsWith('--') || valor.trim() === '') {
      throw new AbortoError(`Falta el valor de --${nombre}.`);
    }
    valores.set(nombre, valor.trim());
    i++;
  }
  for (const nombre of OPCIONES) {
    if (!valores.has(nombre)) throw new AbortoError(`Falta la opción obligatoria --${nombre}.`);
  }
  return {
    project: valores.get('project')!,
    env: valores.get('env')!,
    borrar: vistas.has('borrar'),
    emulador: vistas.has('emulador'),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Selección y protecciones (puras)
// ---------------------------------------------------------------------------------------------------------------------

/** "PRUEBA Uno", "prueba-2" o "Pruebas" sí; "Ana Prueba" no. */
export function empiezaPorPrueba(nombre: unknown): boolean {
  return typeof nombre === 'string' && nombre.trim().toLowerCase().startsWith('prueba');
}

export interface ContactoLeido {
  id: string;
  fullName: unknown;
  origin: unknown;
}

export function seleccionarContactos(contactos: readonly ContactoLeido[]): ContactoLeido[] {
  return contactos.filter((c) => empiezaPorPrueba(c.fullName));
}

/**
 * Segunda revisión, independiente de la selección: si algo no cuadra se aborta todo, sin borrar nada.
 * Un contacto de la carga inicial nunca se borra, aunque su nombre empiece por "PRUEBA".
 */
export function comprobarSeleccion(seleccion: readonly ContactoLeido[]): void {
  const ajenos = seleccion.filter((c) => !empiezaPorPrueba(c.fullName));
  if (ajenos.length > 0) {
    throw new AbortoError(`Hay contactos seleccionados cuyo nombre no empieza por "PRUEBA" (${ajenos.map((c) => c.id).join(', ')}).`);
  }
  const cargaInicial = seleccion.filter((c) => c.origin === ORIGEN_CARGA_INICIAL);
  if (cargaInicial.length > 0) {
    throw new AbortoError(
      `Hay contactos seleccionados con origen "carga_inicial": ${cargaInicial.map((c) => `${String(c.fullName)} (${c.id})`).join(', ')}. ` +
        'Esos contactos son reales y nunca se borran. No se hizo nada.',
    );
  }
  if (seleccion.length > MAX_CONTACTOS) {
    throw new AbortoError(`Se seleccionaron ${seleccion.length} contactos y el máximo es ${MAX_CONTACTOS}. No se hizo nada.`);
  }
}

/**
 * Contra un proyecto real: --project debe ser cani-cafe y el projectId de las credenciales de gcloud también.
 * (Que el archivo --env sea del mismo proyecto ya lo revisa leerConfigWeb.) En los emuladores no hay credenciales.
 */
export function comprobarCredenciales(proyectoCredenciales: string | null, args: ArgumentosLimpieza): void {
  if (args.emulador) return;
  if (args.project !== PROYECTO_PRODUCCION) {
    throw new AbortoError(`Este script solo borra en "${PROYECTO_PRODUCCION}" y se pidió --project "${args.project}".`);
  }
  if (!proyectoCredenciales) {
    throw new AbortoError(
      'No se pudo saber el projectId de las credenciales de gcloud. Ejecute "gcloud auth application-default login" y ' +
        `"gcloud config set project ${PROYECTO_PRODUCCION}".`,
    );
  }
  if (proyectoCredenciales !== args.project) {
    throw new AbortoError(
      `Las credenciales de gcloud son del proyecto "${proyectoCredenciales}" y se pidió --project "${args.project}". No se hace nada.`,
    );
  }
}

/** Proyecto de las Application Default Credentials (variable GOOGLE_CLOUD_PROJECT, archivo de credenciales o gcloud config). */
export async function proyectoDeGcloud(): Promise<string | null> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  try {
    await auth.getClient();
  } catch {
    throw new AbortoError('No hay credenciales de gcloud. Ejecute "gcloud auth application-default login" y vuelva a intentarlo.');
  }
  try {
    return (await auth.getProjectId()) || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Lectura del plan (Firestore, Admin SDK)
// ---------------------------------------------------------------------------------------------------------------------

/** Colecciones que se cuentan por contacto, en el orden en que se muestran. */
export const COLECCIONES_PLAN = ['sales', 'saleProducts', 'stageHistory', 'communications', 'formRequests'] as const;
export type ColeccionPlan = (typeof COLECCIONES_PLAN)[number];

export interface PlanContacto {
  id: string;
  ref: DocumentReference;
  fullName: string;
  refs: Record<ColeccionPlan, DocumentReference[]>;
  /** Avisos calculados hoy para sus ventas (no se guardan). */
  avisos: number;
}

export interface SolicitudSuelta {
  ref: DocumentReference;
  fullName: string;
  contactId: string | null;
}

export interface PlanLimpieza {
  contactos: PlanContacto[];
  /** formRequests con nombre "PRUEBA..." que no pertenecen a ningún contacto seleccionado. */
  solicitudesSueltas: SolicitudSuelta[];
  cargaInicial: number;
}

function trozos<T>(lista: readonly T[]): T[][] {
  const resultado: T[][] = [];
  for (let i = 0; i < lista.length; i += IN_QUERY_LIMIT) resultado.push(lista.slice(i, i + IN_QUERY_LIMIT));
  return resultado;
}

async function porCampoEn(db: Firestore, coleccion: string, campo: string, valores: readonly string[]): Promise<QueryDocumentSnapshot[]> {
  const snaps = await Promise.all(trozos(valores).map((t) => db.collection(coleccion).where(campo, 'in', t).get()));
  return snaps.flatMap((s) => s.docs);
}

/** Sin repetidos (una comunicación puede salir por contactId y por saleId). */
function unicos(docs: readonly QueryDocumentSnapshot[]): DocumentReference[] {
  const vistos = new Map<string, DocumentReference>();
  for (const d of docs) vistos.set(d.ref.path, d.ref);
  return [...vistos.values()];
}

async function leerPlanContacto(db: Firestore, contacto: ContactoLeido, status: string, ahora: Date): Promise<PlanContacto> {
  const fullName = String(contacto.fullName);
  const [ventasSnap, comunicacionesSnap, solicitudesSnap] = await Promise.all([
    db.collection(COLLECTIONS.sales).where('contactId', '==', contacto.id).get(),
    db.collection(COLLECTIONS.communications).where('contactId', '==', contacto.id).get(),
    db.collection(FORM_REQUESTS_COLLECTION).where('contactId', '==', contacto.id).get(),
  ]);
  const saleIds = ventasSnap.docs.map((d) => d.id);
  const [productos, historial, comunicacionesDeVentas] = await Promise.all([
    porCampoEn(db, COLLECTIONS.saleProducts, 'saleId', saleIds),
    porCampoEn(db, COLLECTIONS.stageHistory, 'saleId', saleIds),
    porCampoEn(db, COLLECTIONS.communications, 'saleId', saleIds),
  ]);

  const ventas = ventasSnap.docs.map((d) => ({ ...(d.data() as Omit<Sale, 'id'>), id: d.id }) as Sale);
  const contactos = new Map<string, AlertContact>([[contacto.id, { fullName, status }]]);
  const avisos = buildAlerts(ventas, contactos, ahora).length;

  return {
    id: contacto.id,
    ref: db.collection(COLLECTIONS.contacts).doc(contacto.id),
    fullName,
    refs: {
      sales: unicos(ventasSnap.docs),
      saleProducts: unicos(productos),
      stageHistory: unicos(historial),
      communications: unicos([...comunicacionesSnap.docs, ...comunicacionesDeVentas]),
      formRequests: unicos(solicitudesSnap.docs),
    },
    avisos,
  };
}

/** Lee todos los contactos, aplica las protecciones y arma el plan. No escribe nada. */
export async function leerPlan(db: Firestore, ahora: Date): Promise<PlanLimpieza> {
  const contactosSnap = await db.collection(COLLECTIONS.contacts).get();
  const leidos: ContactoLeido[] = contactosSnap.docs.map((d) => ({ id: d.id, fullName: d.get('fullName'), origin: d.get('origin') }));
  const seleccion = seleccionarContactos(leidos);
  comprobarSeleccion(seleccion);
  const cargaInicial = leidos.filter((c) => c.origin === ORIGEN_CARGA_INICIAL).length;

  const estados = new Map(contactosSnap.docs.map((d) => [d.id, String(d.get('status'))]));
  const contactos = await Promise.all(seleccion.map((c) => leerPlanContacto(db, c, estados.get(c.id)!, ahora)));

  const yaIncluidas = new Set(contactos.flatMap((c) => c.refs.formRequests.map((r) => r.path)));
  const solicitudesSnap = await db.collection(FORM_REQUESTS_COLLECTION).get();
  const solicitudesSueltas = solicitudesSnap.docs
    .filter((d) => empiezaPorPrueba(d.get('fullName')) && !yaIncluidas.has(d.ref.path))
    .map((d) => ({ ref: d.ref, fullName: String(d.get('fullName')), contactId: (d.get('contactId') as string | undefined) ?? null }));

  return { contactos, solicitudesSueltas, cargaInicial };
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

export function describirPlan(plan: PlanLimpieza, borrar: boolean): string[] {
  const lineas: string[] = [];
  const verbo = borrar ? 'Se borrarán' : 'Se borrarían';
  lineas.push(`Contactos con origen "carga_inicial": ${plan.cargaInicial} (se esperan ${CARGA_INICIAL_ESPERADOS}; no se tocan)`);
  lineas.push(`${verbo}: ${plural(plan.contactos.length, 'contacto con nombre PRUEBA', 'contactos con nombre PRUEBA')}`);
  for (const c of plan.contactos) {
    const conteos = COLECCIONES_PLAN.map((col) => `${col} ${c.refs[col].length}`).join(' | ');
    lineas.push(`  ${c.fullName} (${c.id})`);
    lineas.push(`    ${conteos} | avisos ${c.avisos} (calculados, no se guardan)`);
  }
  lineas.push(`${verbo} además: ${plural(plan.solicitudesSueltas.length, 'formRequest con nombre PRUEBA sin contacto seleccionado', 'formRequests con nombre PRUEBA sin contacto seleccionado')}`);
  for (const s of plan.solicitudesSueltas) {
    const vinculo = s.contactId ? `vinculada al contacto ${s.contactId}, que NO se borra` : 'sin contacto';
    lineas.push(`  ${s.fullName} (${s.ref.id}, ${vinculo})`);
  }
  const totales = COLECCIONES_PLAN.map((col) => {
    const n = plan.contactos.reduce((suma, c) => suma + c.refs[col].length, 0) + (col === 'formRequests' ? plan.solicitudesSueltas.length : 0);
    return `${col} ${n}`;
  });
  lineas.push(`Total: contacts ${plan.contactos.length} | ${totales.join(' | ')}`);
  lineas.push('Bitácora y avisos: se calculan al consultar (no hay colecciones propias); desaparecen con lo de arriba.');
  return lineas;
}

/**
 * En qué orden se borra: primero lo que cuelga, después las ventas y al final los contactos. Si se corta a la mitad,
 * repetir el comando es seguro: el contacto sigue ahí y lo que quedó se vuelve a encontrar.
 */
export function referenciasEnOrden(plan: PlanLimpieza): DocumentReference[] {
  const hijos: ColeccionPlan[] = ['saleProducts', 'stageHistory', 'communications', 'formRequests'];
  return [
    ...hijos.flatMap((col) => plan.contactos.flatMap((c) => c.refs[col])),
    ...plan.solicitudesSueltas.map((s) => s.ref),
    ...plan.contactos.flatMap((c) => c.refs.sales),
    ...plan.contactos.map((c) => c.ref),
  ];
}

// ---------------------------------------------------------------------------------------------------------------------
// Borrado y verificación
// ---------------------------------------------------------------------------------------------------------------------

async function borrarEnLotes(db: Firestore, refs: readonly DocumentReference[], terminal: Terminal): Promise<number> {
  let borrados = 0;
  for (let i = 0; i < refs.length; i += TAMANO_LOTE) {
    const lote = db.batch();
    const trozo = refs.slice(i, i + TAMANO_LOTE);
    for (const ref of trozo) lote.delete(ref);
    try {
      await lote.commit();
    } catch (error) {
      throw new AbortoError(
        `Falló un lote de borrado: ${mensajeAdmin(error)}. Se borraron ${borrados} de ${refs.length}; puede repetir el comando.`,
      );
    }
    borrados += trozo.length;
    terminal.log(`  borrados ${borrados}/${refs.length}`);
  }
  return borrados;
}

export interface Comprobacion {
  texto: string;
  ok: boolean;
}

/**
 * Comprobaciones finales: quedan los contactos de la carga inicial, no queda ningún contacto ni formRequest "PRUEBA"
 * y nada apunta a un contacto o a una venta borrados (sin huérfanos).
 */
export async function verificar(db: Firestore, contactIds: readonly string[], saleIds: readonly string[]): Promise<Comprobacion[]> {
  const contactosSnap = await db.collection(COLLECTIONS.contacts).get();
  const cargaInicial = contactosSnap.docs.filter((d) => d.get('origin') === ORIGEN_CARGA_INICIAL).length;
  const prueba = contactosSnap.docs.filter((d) => empiezaPorPrueba(d.get('fullName'))).length;
  const solicitudesPrueba = (await db.collection(FORM_REQUESTS_COLLECTION).get()).docs.filter((d) =>
    empiezaPorPrueba(d.get('fullName')),
  ).length;
  const existentes = new Set(contactosSnap.docs.map((d) => d.id));
  const contactosQueSiguen = contactIds.filter((id) => existentes.has(id)).length;

  const [ventas, comunicacionesPorContacto, solicitudes, productos, historial, comunicacionesPorVenta] = await Promise.all([
    porCampoEn(db, COLLECTIONS.sales, 'contactId', contactIds),
    porCampoEn(db, COLLECTIONS.communications, 'contactId', contactIds),
    porCampoEn(db, FORM_REQUESTS_COLLECTION, 'contactId', contactIds),
    porCampoEn(db, COLLECTIONS.saleProducts, 'saleId', saleIds),
    porCampoEn(db, COLLECTIONS.stageHistory, 'saleId', saleIds),
    porCampoEn(db, COLLECTIONS.communications, 'saleId', saleIds),
  ]);
  const huerfanos = unicos([...ventas, ...comunicacionesPorContacto, ...solicitudes, ...productos, ...historial, ...comunicacionesPorVenta]).length;

  return [
    { texto: `Contactos con origen "carga_inicial": ${cargaInicial} (se esperan ${CARGA_INICIAL_ESPERADOS})`, ok: cargaInicial === CARGA_INICIAL_ESPERADOS },
    { texto: `Contactos con nombre PRUEBA: ${prueba} (se espera 0)`, ok: prueba === 0 },
    { texto: `formRequests con nombre PRUEBA: ${solicitudesPrueba} (se espera 0)`, ok: solicitudesPrueba === 0 },
    { texto: `Contactos del plan que siguen existiendo: ${contactosQueSiguen} (se espera 0)`, ok: contactosQueSiguen === 0 },
    { texto: `Documentos que apuntan a un contacto o venta borrados: ${huerfanos} (se espera 0)`, ok: huerfanos === 0 },
  ];
}

// ---------------------------------------------------------------------------------------------------------------------
// Firebase (Admin SDK)
// ---------------------------------------------------------------------------------------------------------------------

let contadorApps = 0;

/** Contra un proyecto real usa las credenciales de gcloud; con --emulador, el emulador de Firestore (sin credenciales). */
function crearAppAdmin(config: ConfigWeb, args: ArgumentosLimpieza, entorno: Record<string, string | undefined>) {
  const nombre = `limpieza-${Date.now()}-${++contadorApps}`;
  if (!args.emulador) {
    const app = initializeApp({ credential: applicationDefault(), projectId: config.projectId }, nombre);
    return { app, db: getFirestore(app) };
  }
  const app = initializeApp({ projectId: config.projectId }, nombre);
  const db = getFirestore(app);
  const host = entorno.FIRESTORE_EMULATOR_HOST || config.hostFirestoreEmulador || '127.0.0.1:8080';
  // ssl: false hace que el Admin SDK se presente como administrador del emulador.
  db.settings({ host, ssl: false });
  return { app, db };
}

/** Errores del Admin SDK (códigos gRPC numéricos) en un mensaje útil. */
export function mensajeAdmin(error: unknown): string {
  const code = (error as { code?: number | string }).code;
  if (code === 7 || code === 'permission-denied') {
    return 'Permiso denegado: la cuenta de gcloud no tiene acceso a Firestore de este proyecto.';
  }
  if (code === 16 || code === 'unauthenticated') {
    return 'Credenciales de gcloud vencidas o inválidas: ejecute "gcloud auth application-default login".';
  }
  if (code === 14 || code === 'unavailable') return 'Firestore no responde (sin conexión o emulador apagado).';
  return error instanceof Error ? error.message : String(error);
}

async function confirmarBorrado(terminal: Terminal, projectId: string): Promise<void> {
  const respuesta = await terminal.pedirLinea(`Para BORRAR en "${projectId}", escriba el projectId exacto: `);
  if (respuesta.trim() !== projectId) {
    throw new AbortoError('La confirmación no coincide con el projectId. No se borró nada.');
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Flujo completo
// ---------------------------------------------------------------------------------------------------------------------

export interface DependenciasLimpieza {
  /** projectId de las credenciales de gcloud (las pruebas pasan uno falso). */
  proyectoDeCredenciales?: () => Promise<string | null>;
  /** Fecha para calcular los avisos (las pruebas la fijan). */
  ahora?: Date;
}

export interface ResultadoLimpieza {
  codigo: 0 | 1;
  plan?: PlanLimpieza;
  borrados: number;
  comprobaciones?: Comprobacion[];
}

/** Flujo completo del script D. Nunca lanza: devuelve el código de salida y lo que hizo. */
export async function ejecutarLimpieza(
  argv: readonly string[],
  terminal: Terminal,
  deps: DependenciasLimpieza = {},
): Promise<ResultadoLimpieza> {
  let app: App | undefined;
  let plan: PlanLimpieza | undefined;
  let borrados = 0;
  try {
    const args = analizarArgumentosLimpieza(argv);
    const config = leerConfigWeb(args.env, args.project, terminal.leerArchivo);
    comprobarDestino(config, { emulador: args.emulador }, terminal.entorno);
    if (!args.emulador) {
      comprobarCredenciales(await (deps.proyectoDeCredenciales ?? proyectoDeGcloud)(), args);
    }
    terminal.log(`Proyecto:      ${config.projectId}`);
    terminal.log(`Destino:       ${args.emulador ? 'EMULADORES locales' : 'FIREBASE REAL'}`);
    terminal.log(`Credenciales:  ${args.emulador ? 'emulador (sin credenciales)' : `gcloud, proyecto ${config.projectId}`}`);
    terminal.log(`Modo:          ${args.borrar ? 'BORRADO (--borrar)' : 'prueba (no borra nada)'}`);

    const conexion = crearAppAdmin(config, args, terminal.entorno);
    app = conexion.app;
    const { db } = conexion;

    try {
      plan = await leerPlan(db, deps.ahora ?? new Date());
    } catch (error) {
      if (error instanceof AbortoError) throw error;
      throw new AbortoError(`No se pudieron leer los datos: ${mensajeAdmin(error)}`);
    }
    terminal.log('');
    for (const linea of describirPlan(plan, args.borrar)) terminal.log(linea);
    terminal.log('');

    const refs = referenciasEnOrden(plan);
    if (!args.borrar) {
      terminal.log(`Modo prueba: no se borró nada. Para borrar ${plural(refs.length, 'documento', 'documentos')}, repita con --borrar.`);
      return { codigo: 0, plan, borrados };
    }
    if (refs.length === 0) {
      terminal.log('No hay datos de prueba que borrar.');
    } else {
      if (plan.cargaInicial !== CARGA_INICIAL_ESPERADOS) {
        throw new AbortoError(
          `Hay ${plan.cargaInicial} contactos con origen "carga_inicial" y se esperan ${CARGA_INICIAL_ESPERADOS}. ` +
            'Revise el proyecto antes de borrar. No se borró nada.',
        );
      }
      await confirmarBorrado(terminal, config.projectId);
      borrados = await borrarEnLotes(db, refs, terminal);
      terminal.log(`Borrado terminado: ${plural(borrados, 'documento borrado', 'documentos borrados')}.`);
    }

    terminal.log('');
    terminal.log('Verificación:');
    const comprobaciones = await verificar(
      db,
      plan.contactos.map((c) => c.id),
      plan.contactos.flatMap((c) => c.refs.sales.map((r) => r.id)),
    );
    for (const c of comprobaciones) terminal.log(`  [${c.ok ? 'OK' : 'FALLA'}] ${c.texto}`);
    const todoBien = comprobaciones.every((c) => c.ok);
    if (!todoBien) terminal.error('La verificación encontró diferencias: revise las líneas FALLA.');
    return { codigo: todoBien ? 0 : 1, plan, borrados, comprobaciones };
  } catch (error) {
    terminal.error(error instanceof AbortoError ? `ABORTADO: ${error.message}` : `ERROR: ${mensajeAdmin(error)}`);
    return { codigo: 1, plan, borrados };
  } finally {
    if (app) await deleteApp(app);
  }
}
