// Script B: pone displayName = usuario en la cuenta de Firebase Auth del administrador, para que el correo de
// recuperación diga "Hola, admin:" (HU-107, docs/HU-107-plantilla-correo.md). Además revisa users/{uid} y
// usernames/{usuario} e informa las diferencias SIN corregirlas.
// La lógica está aquí para poder probarla; el punto de entrada de la terminal es cuentaNombreVisible.ts.
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, type Firestore } from 'firebase/firestore';
import { normalizeUsername } from '../../src/auth/username';
import { COLLECTIONS } from '../../src/shared/constants/collections';
import {
  AbortoError,
  cerrarSesion,
  confirmarProyecto,
  iniciarSesion,
  mensajeFirestore,
  pedirContrasena,
  preparar,
  type Sesion,
  type Terminal,
} from './comun';

/** Diferencias de users/{uid} y usernames/{usuario} con la cuenta que inició sesión (pura). */
export function revisarCuenta(datos: {
  uid: string;
  email: string;
  usuario: string;
  user: Record<string, unknown> | null | 'sin-permiso';
  username: Record<string, unknown> | null;
}): string[] {
  const { uid, email, usuario, user, username } = datos;
  const correo = email.toLowerCase();
  const diferencias: string[] = [];
  if (user === 'sin-permiso') {
    diferencias.push(`users/${uid}: no se pudo leer (las reglas lo niegan: falta el documento o active no es true).`);
  } else if (user === null) {
    diferencias.push(`users/${uid}: no existe.`);
  } else {
    if (user.active !== true) diferencias.push(`users/${uid}: active es ${JSON.stringify(user.active)} (debe ser true).`);
    if (user.username !== usuario) {
      diferencias.push(`users/${uid}: username es ${JSON.stringify(user.username)} (se esperaba "${usuario}").`);
    }
    if (typeof user.email !== 'string' || user.email.toLowerCase() !== correo) {
      diferencias.push(`users/${uid}: email es ${JSON.stringify(user.email)} (la cuenta es "${correo}").`);
    }
  }
  if (username === null) {
    diferencias.push(`usernames/${usuario}: no existe (no se podría ingresar con el usuario "${usuario}").`);
  } else {
    if (username.uid !== uid) diferencias.push(`usernames/${usuario}: uid es ${JSON.stringify(username.uid)} (la cuenta es "${uid}").`);
    if (typeof username.email !== 'string' || username.email.toLowerCase() !== correo) {
      diferencias.push(`usernames/${usuario}: email es ${JSON.stringify(username.email)} (la cuenta es "${correo}").`);
    }
  }
  return diferencias;
}

async function leerCuenta(db: Firestore, uid: string, usuario: string) {
  let user: Record<string, unknown> | null | 'sin-permiso';
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.users, uid));
    user = snap.exists() ? snap.data() : null;
  } catch (error) {
    if ((error as { code?: string }).code !== 'permission-denied') throw error;
    user = 'sin-permiso';
  }
  const snap = await getDoc(doc(db, COLLECTIONS.usernames, usuario));
  return { user, username: snap.exists() ? snap.data() : null };
}

export interface ResultadoNombreVisible {
  codigo: 0 | 1;
  antes?: string | null;
  despues?: string | null;
  cambiado: boolean;
  diferencias: string[];
}

/** Flujo completo del script B. Nunca lanza: devuelve el código de salida y lo que hizo. */
export async function ejecutarNombreVisible(argv: readonly string[], terminal: Terminal): Promise<ResultadoNombreVisible> {
  let sesion: Sesion | undefined;
  let diferencias: string[] = [];
  let antes: string | null | undefined;
  let cambiado = false;
  try {
    const { args, config } = preparar(argv, terminal, { extras: ['usuario'] });
    const usuario = normalizeUsername(args.extras.usuario);
    if (!/^[a-z0-9._-]{1,50}$/.test(usuario)) throw new AbortoError(`El usuario "${args.extras.usuario}" no es válido.`);
    terminal.log(`Usuario:     ${usuario}`);

    const contrasena = await pedirContrasena(terminal);
    sesion = await iniciarSesion(config, { emulador: args.emulador, entorno: terminal.entorno }, args.email, contrasena);
    const { user } = sesion;
    antes = user.displayName;
    terminal.log(`Sesión iniciada (uid ${user.uid}).`);

    try {
      const cuenta = await leerCuenta(sesion.db, user.uid, usuario);
      diferencias = revisarCuenta({ uid: user.uid, email: user.email ?? args.email, usuario, ...cuenta });
    } catch (error) {
      throw new AbortoError(`No se pudieron leer users y usernames: ${mensajeFirestore(error)}`);
    }
    if (diferencias.length === 0) {
      terminal.log(`users/${user.uid} y usernames/${usuario}: correctos (active true, mismo uid y correo).`);
    } else {
      terminal.log('Diferencias en users o usernames (NO se corrigen; avísele a Gabriel):');
      for (const d of diferencias) terminal.log(`  - ${d}`);
    }

    terminal.log(`displayName actual: ${antes === null ? '(vacío)' : JSON.stringify(antes)} -> deseado: "${usuario}"`);
    if (antes === usuario) {
      terminal.log('El nombre visible ya es el correcto: no hay nada que cambiar.');
    } else if (!args.escribir) {
      terminal.log('Modo prueba: no se cambió nada. Para aplicarlo, repita con --escribir.');
    } else {
      await confirmarProyecto(terminal, config.projectId);
      await updateProfile(user, { displayName: usuario });
      await user.reload();
      if (user.displayName !== usuario) throw new AbortoError('Firebase no guardó el nombre visible.');
      cambiado = true;
      terminal.log(`Nombre visible actualizado: "${user.displayName}". El correo de recuperación dirá "Hola, ${usuario}:".`);
    }
    return { codigo: 0, antes, despues: user.displayName, cambiado, diferencias };
  } catch (error) {
    terminal.error(error instanceof AbortoError ? `ABORTADO: ${error.message}` : `ERROR: ${mensajeFirestore(error)}`);
    return { codigo: 1, antes, despues: undefined, cambiado, diferencias };
  } finally {
    await cerrarSesion(sesion);
  }
}
