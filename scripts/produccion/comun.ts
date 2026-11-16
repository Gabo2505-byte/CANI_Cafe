// Código común de los scripts de publicación (scripts/produccion/). Usa el SDK de CLIENTE de Firebase con la sesión del
// administrador: las escrituras pasan por las reglas desplegadas, igual que desde el sistema interno. No usa Admin SDK
// ni claves de cuenta de servicio. No importa src/shared/firebase/config.ts (depende de import.meta.env de Vite): cada
// script arma su propia app con la configuración web del archivo que se le indica con --env.
//
// Estos archivos no los importa ninguna pantalla: no entran en el bundle del sistema interno ni en el del sitio público.
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut, type Auth, type User } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

/** Error esperado: el script se detiene sin escribir nada y muestra solo este mensaje. */
export class AbortoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AbortoError';
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------------------------------------------------

export interface ArgumentosBase {
  project: string;
  email: string;
  env: string;
  escribir: boolean;
  emulador: boolean;
}

export interface EspecArgumentos {
  /** Opciones con valor, además de --project, --email y --env (por ejemplo "usuario"). Todas son obligatorias. */
  extras?: readonly string[];
}

const OPCIONES_BASE = ['project', 'email', 'env'] as const;
const BANDERAS = ['escribir', 'emulador'] as const;
const OPCIONES_DE_CONTRASENA = ['password', 'contrasena', 'contraseña', 'pass', 'clave'];

/**
 * Analiza los argumentos. Todo es explícito: --project, --email y --env (y los extras) son obligatorios, no hay valores
 * por defecto, no se aceptan opciones desconocidas ni repetidas y la contraseña nunca va por argumento.
 */
export function analizarArgumentos(
  argv: readonly string[],
  espec: EspecArgumentos = {},
): ArgumentosBase & { extras: Record<string, string> } {
  const conValor = new Set<string>([...OPCIONES_BASE, ...(espec.extras ?? [])]);
  const banderas = new Set<string>(BANDERAS);
  const valores = new Map<string, string>();
  const vistas = new Set<string>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new AbortoError(`Argumento inesperado: "${arg}". Cada valor va después de su opción.`);
    const nombre = arg.slice(2);
    if (nombre.includes('=')) {
      throw new AbortoError(`Use "--${nombre.split('=')[0]} <valor>" (con espacio), no "${arg.split('=')[0]}=...".`);
    }
    if (OPCIONES_DE_CONTRASENA.includes(nombre.toLowerCase())) {
      throw new AbortoError('La contraseña no se pasa por argumento: el script la pide por la terminal, sin mostrarla.');
    }
    if (vistas.has(nombre)) throw new AbortoError(`La opción --${nombre} está repetida.`);
    vistas.add(nombre);
    if (banderas.has(nombre)) continue;
    if (!conValor.has(nombre)) throw new AbortoError(`Opción desconocida: --${nombre}.`);
    const valor = argv[i + 1];
    if (valor === undefined || valor.startsWith('--') || valor.trim() === '') {
      throw new AbortoError(`Falta el valor de --${nombre}.`);
    }
    valores.set(nombre, valor.trim());
    i++;
  }

  for (const nombre of conValor) {
    if (!valores.has(nombre)) throw new AbortoError(`Falta la opción obligatoria --${nombre}.`);
  }

  const extras: Record<string, string> = {};
  for (const nombre of espec.extras ?? []) extras[nombre] = valores.get(nombre)!;

  return {
    project: valores.get('project')!,
    email: valores.get('email')!,
    env: valores.get('env')!,
    escribir: vistas.has('escribir'),
    emulador: vistas.has('emulador'),
    extras,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Archivo de configuración web
// ---------------------------------------------------------------------------------------------------------------------

/** Las tres claves que se leen del archivo. Las demás se ignoran. */
export const CLAVES_CONFIG = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID'] as const;

/**
 * Lee un archivo KEY=VALUE (formato de los .env de Vite). Admite BOM y finales CRLF (PowerShell), comentarios con "#",
 * líneas en blanco, "export " al inicio y valores entre comillas. Una clave obligatoria repetida es un error: no se
 * adivina cuál de los dos valores era el bueno.
 */
export function analizarArchivoEnv(texto: string): Record<string, string> {
  const resultado: Record<string, string> = {};
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/);
  lineas.forEach((original, indice) => {
    let linea = original.trim();
    if (linea === '' || linea.startsWith('#')) return;
    if (linea.startsWith('export ')) linea = linea.slice(7).trim();
    const igual = linea.indexOf('=');
    if (igual <= 0) throw new AbortoError(`Línea ${indice + 1} del archivo de configuración no es CLAVE=valor.`);
    const clave = linea.slice(0, igual).trim();
    let valor = linea.slice(igual + 1).trim();
    const comilla = valor[0];
    if ((comilla === '"' || comilla === "'") && valor.length >= 2 && valor.endsWith(comilla)) {
      valor = valor.slice(1, -1);
    } else {
      // Comentario al final de un valor sin comillas: "valor # comentario".
      const comentario = valor.search(/\s#/);
      if (comentario >= 0) valor = valor.slice(0, comentario).trim();
    }
    if ((CLAVES_CONFIG as readonly string[]).includes(clave) && clave in resultado) {
      throw new AbortoError(`${clave} aparece más de una vez en el archivo de configuración.`);
    }
    resultado[clave] = valor;
  });
  return resultado;
}

export interface ConfigWeb {
  apiKey: string;
  authDomain: string;
  projectId: string;
  /** VITE_USE_EMULATORS del archivo (solo para avisar si contradice el modo). */
  usaEmuladores: boolean;
  /** Hosts de los emuladores según el archivo, si los trae. */
  hostFirestoreEmulador?: string;
  hostAuthEmulador?: string;
}

/** Extrae y valida la configuración web. Aborta si falta una clave o si el projectId del archivo no es --project. */
export function configDesdeEnv(variables: Record<string, string>, proyectoEsperado: string): ConfigWeb {
  for (const clave of CLAVES_CONFIG) {
    if (!variables[clave]) throw new AbortoError(`Falta ${clave} en el archivo de configuración.`);
  }
  const projectId = variables.VITE_FIREBASE_PROJECT_ID;
  if (projectId !== proyectoEsperado) {
    throw new AbortoError(
      `El archivo de configuración es del proyecto "${projectId}" y se pidió --project "${proyectoEsperado}". No se hace nada.`,
    );
  }
  return {
    apiKey: variables.VITE_FIREBASE_API_KEY,
    authDomain: variables.VITE_FIREBASE_AUTH_DOMAIN,
    projectId,
    usaEmuladores: variables.VITE_USE_EMULATORS === 'true',
    hostFirestoreEmulador: variables.VITE_FIRESTORE_EMULATOR_HOST || undefined,
    hostAuthEmulador: variables.VITE_AUTH_EMULATOR_HOST || undefined,
  };
}

export function leerConfigWeb(ruta: string, proyectoEsperado: string, leer: (ruta: string) => string = leerTexto): ConfigWeb {
  let texto: string;
  try {
    texto = leer(ruta);
  } catch {
    throw new AbortoError(`No se pudo leer el archivo de configuración "${ruta}".`);
  }
  return configDesdeEnv(analizarArchivoEnv(texto), proyectoEsperado);
}

function leerTexto(ruta: string): string {
  return readFileSync(ruta, 'utf8');
}

// ---------------------------------------------------------------------------------------------------------------------
// Protecciones de proyecto
// ---------------------------------------------------------------------------------------------------------------------

export const VARIABLES_EMULADOR = ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST'] as const;

/**
 * Reglas para no escribir donde no se debe:
 * - un proyecto demo-* solo existe en los emuladores: exige --emulador;
 * - --emulador solo con un proyecto demo-*: así nunca se mezcla un proyecto real con los emuladores;
 * - contra un proyecto real no puede haber variables de emulador definidas ni VITE_USE_EMULATORS=true en el archivo.
 */
export function comprobarDestino(
  config: ConfigWeb,
  opciones: { emulador: boolean },
  entorno: Record<string, string | undefined>,
): void {
  const { projectId } = config;
  if (!/^[a-z0-9][a-z0-9-]{4,}$/.test(projectId)) {
    throw new AbortoError(`El projectId "${projectId}" no tiene el formato de un proyecto de Firebase.`);
  }
  const esDemo = projectId.startsWith('demo-');
  if (esDemo && !opciones.emulador) {
    throw new AbortoError(`"${projectId}" es un proyecto demo-*: solo existe en los emuladores. Agregue --emulador.`);
  }
  if (!esDemo && opciones.emulador) {
    throw new AbortoError(`--emulador solo se usa con proyectos demo-*, y "${projectId}" es un proyecto real.`);
  }
  if (!esDemo) {
    const definidas = VARIABLES_EMULADOR.filter((nombre) => entorno[nombre]);
    if (definidas.length > 0) {
      throw new AbortoError(
        `Hay variables de emulador definidas (${definidas.join(', ')}) y el destino es el proyecto real "${projectId}". ` +
          'Ciérrelas en esta terminal (Remove-Item Env:NOMBRE) y vuelva a intentarlo.',
      );
    }
    if (config.usaEmuladores) {
      throw new AbortoError('El archivo de configuración dice VITE_USE_EMULATORS=true y el destino es un proyecto real.');
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Terminal
// ---------------------------------------------------------------------------------------------------------------------

/** Entrada y salida del script. Las pruebas pasan una versión falsa. */
export interface Terminal {
  log(mensaje: string): void;
  error(mensaje: string): void;
  /** Pide un dato sin mostrarlo (contraseña). */
  pedirOculto(pregunta: string): Promise<string>;
  /** Pide una línea visible (confirmación). */
  pedirLinea(pregunta: string): Promise<string>;
  entorno: Record<string, string | undefined>;
  leerArchivo?(ruta: string): string;
}

interface EntradaTty extends NodeJS.EventEmitter {
  isTTY?: boolean;
  setRawMode?(modo: boolean): unknown;
  setEncoding?(codificacion: BufferEncoding): unknown;
  resume(): unknown;
  pause(): unknown;
}

/**
 * Lee un dato sin eco: la terminal en modo crudo, sin escribir nada por cada tecla. Solo funciona en una terminal
 * interactiva: si la entrada viene de una tubería o de un archivo, aborta (la contraseña nunca sale de un archivo).
 * El valor no se guarda en ningún lado: solo se devuelve.
 */
export function pedirOcultoEn(
  pregunta: string,
  entrada: EntradaTty = process.stdin,
  salida: { write(texto: string): unknown } = process.stdout,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!entrada.isTTY || typeof entrada.setRawMode !== 'function') {
      reject(new AbortoError('La contraseña solo se pide en una terminal interactiva (no desde una tubería ni un archivo).'));
      return;
    }
    salida.write(pregunta);
    let valor: string[] = [];
    const terminar = () => {
      entrada.off('data', alRecibir);
      entrada.setRawMode!(false);
      entrada.pause();
      salida.write('\n');
    };
    const alRecibir = (trozo: Buffer | string) => {
      for (const caracter of String(trozo)) {
        if (caracter === '\r' || caracter === '\n') {
          terminar();
          const texto = valor.join('');
          valor = [];
          resolve(texto);
          return;
        }
        if (caracter === '\u0003' || caracter === '\u001b') {
          terminar();
          valor = [];
          reject(new AbortoError('Cancelado por el usuario. No se hizo nada.'));
          return;
        }
        if (caracter === '\u007f' || caracter === '\b') {
          valor.pop();
          continue;
        }
        if (caracter < ' ') continue;
        valor.push(caracter);
      }
    };
    entrada.setRawMode(true);
    entrada.setEncoding?.('utf8');
    entrada.on('data', alRecibir);
    entrada.resume();
  });
}

export function pedirLineaEn(pregunta: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(pregunta, (respuesta) => {
      rl.close();
      resolve(respuesta);
    });
  });
}

export function terminalReal(): Terminal {
  return {
    log: (m) => console.log(m),
    error: (m) => console.error(m),
    pedirOculto: (p) => pedirOcultoEn(p),
    pedirLinea: (p) => pedirLineaEn(p),
    entorno: process.env,
  };
}

/** Para escribir hay que teclear el projectId exacto. Cualquier otra cosa cancela. */
export async function confirmarProyecto(terminal: Terminal, projectId: string): Promise<void> {
  const respuesta = await terminal.pedirLinea(`Para escribir en "${projectId}", escriba el projectId exacto: `);
  if (respuesta.trim() !== projectId) {
    throw new AbortoError('La confirmación no coincide con el projectId. No se escribió nada.');
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Firebase
// ---------------------------------------------------------------------------------------------------------------------

let contadorApps = 0;

function separarHost(host: string): [string, number] {
  const [nombre, puerto] = host.split(':');
  return [nombre, Number(puerto)];
}

/** Crea una app de cliente propia (con nombre único). Con --emulador la conecta a los emuladores locales. */
export function crearApp(config: ConfigWeb, opciones: { emulador: boolean; entorno: Record<string, string | undefined> }, rol: string) {
  const app = initializeApp(
    { apiKey: config.apiKey, authDomain: config.authDomain, projectId: config.projectId },
    `produccion-${rol}-${Date.now()}-${++contadorApps}`,
  );
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (opciones.emulador) {
    const hostAuth = opciones.entorno.FIREBASE_AUTH_EMULATOR_HOST || config.hostAuthEmulador || '127.0.0.1:9099';
    const hostFirestore = opciones.entorno.FIRESTORE_EMULATOR_HOST || config.hostFirestoreEmulador || '127.0.0.1:8080';
    connectAuthEmulator(auth, `http://${hostAuth}`, { disableWarnings: true });
    connectFirestoreEmulator(db, ...separarHost(hostFirestore));
  }
  return { app, auth, db };
}

export interface Sesion {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  user: User;
}

const MENSAJES_INGRESO: Record<string, string> = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/user-disabled': 'La cuenta está deshabilitada.',
  'auth/too-many-requests': 'Demasiados intentos. Espere unos minutos.',
  'auth/network-request-failed': 'No hay conexión con Firebase.',
  'auth/invalid-api-key': 'La API key del archivo de configuración no es válida.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'La API key del archivo de configuración no es válida.',
};

/** Inicia sesión. Si falla, borra la app y aborta con un mensaje (nunca con la contraseña). */
export async function iniciarSesion(
  config: ConfigWeb,
  opciones: { emulador: boolean; entorno: Record<string, string | undefined> },
  email: string,
  contrasena: string,
): Promise<Sesion> {
  const { app, auth, db } = crearApp(config, opciones, 'sesion');
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, contrasena);
    return { app, auth, db, user };
  } catch (error) {
    await deleteApp(app);
    const code = (error as { code?: string }).code ?? '';
    throw new AbortoError(`No se pudo iniciar sesión: ${MENSAJES_INGRESO[code] ?? (code || 'error desconocido')}`);
  }
}

export async function cerrarSesion(sesion: Sesion | undefined): Promise<void> {
  if (!sesion) return;
  try {
    await signOut(sesion.auth);
  } finally {
    await deleteApp(sesion.app);
  }
}

/** Traduce un error de Firestore a un mensaje útil. */
export function mensajeFirestore(error: unknown): string {
  const code = (error as { code?: string }).code;
  if (code === 'permission-denied') {
    return 'Permiso denegado por las reglas: la cuenta debe tener users/{uid} con active true y las reglas del repo deben estar desplegadas.';
  }
  if (code === 'unavailable') return 'Firestore no responde (sin conexión o emulador apagado).';
  return error instanceof Error ? error.message : String(error);
}

// ---------------------------------------------------------------------------------------------------------------------
// Flujo común de los dos scripts
// ---------------------------------------------------------------------------------------------------------------------

export interface Preparado {
  args: ArgumentosBase & { extras: Record<string, string> };
  config: ConfigWeb;
}

/**
 * Pasos previos comunes, sin red: argumentos, archivo de configuración, protecciones y aviso de destino.
 * Si algo no cuadra, aborta antes de pedir la contraseña.
 */
export function preparar(argv: readonly string[], terminal: Terminal, espec: EspecArgumentos = {}): Preparado {
  const args = analizarArgumentos(argv, espec);
  const config = leerConfigWeb(args.env, args.project, terminal.leerArchivo);
  comprobarDestino(config, { emulador: args.emulador }, terminal.entorno);
  terminal.log(`Proyecto:    ${config.projectId}`);
  terminal.log(`authDomain:  ${config.authDomain}`);
  terminal.log(`Destino:     ${args.emulador ? 'EMULADORES locales' : 'FIREBASE REAL'}`);
  terminal.log(`Cuenta:      ${args.email}`);
  terminal.log(`Modo:        ${args.escribir ? 'ESCRITURA (--escribir)' : 'prueba (no escribe nada)'}`);
  return { args, config };
}

export async function pedirContrasena(terminal: Terminal): Promise<string> {
  const contrasena = await terminal.pedirOculto('Contraseña del administrador (no se muestra): ');
  if (!contrasena) throw new AbortoError('La contraseña está vacía. No se hizo nada.');
  return contrasena;
}
