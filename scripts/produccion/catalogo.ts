// Script A: cargador del catálogo oficial (72 productos) en Firestore, con la sesión del administrador.
// La lógica está aquí para poder probarla; el punto de entrada de la terminal es cargarCatalogo.ts.
import { deleteApp } from 'firebase/app';
import { collection, doc, getDocs, query, setDoc, where, type DocumentData, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '../../src/shared/constants/collections';
import {
  buildCatalogProducts,
  CATALOG_FORMATS,
  CATALOG_MAX_DESCRIPTION,
  CATALOG_VARIETIES,
  CATALOG_WEIGHTS,
  type CatalogProduct,
} from '../seed/catalogData';
import {
  AbortoError,
  cerrarSesion,
  confirmarProyecto,
  crearApp,
  iniciarSesion,
  mensajeFirestore,
  pedirContrasena,
  preparar,
  type Sesion,
  type Terminal,
} from './comun';

export const TOTAL_PRODUCTOS = CATALOG_VARIETIES.length * CATALOG_WEIGHTS.length * CATALOG_FORMATS.length; // 72
export const TOTAL_VARIEDADES = CATALOG_VARIETIES.length; // 9
export const PRESENTACIONES_POR_VARIEDAD = CATALOG_WEIGHTS.length * CATALOG_FORMATS.length; // 8
const CAMPOS = ['name', 'presentation', 'description', 'active'] as const;

// ---------------------------------------------------------------------------------------------------------------------
// Validación (pura)
// ---------------------------------------------------------------------------------------------------------------------

/** Revisa el catálogo antes de escribir. Devuelve la lista de problemas (vacía si está bien). */
export function validarCatalogo(productos: readonly CatalogProduct[]): string[] {
  const problemas: string[] = [];
  if (productos.length !== TOTAL_PRODUCTOS) {
    problemas.push(`Se esperaban ${TOTAL_PRODUCTOS} productos y hay ${productos.length}.`);
  }
  const ids = new Set<string>();
  const porVariedad = new Map<string, Set<string>>();
  for (const { id, data } of productos) {
    if (typeof id !== 'string' || !/^prod-\d{2}-[a-z0-9-]+$/.test(id)) problemas.push(`Id inválido: "${id}".`);
    if (ids.has(id)) problemas.push(`Id repetido: ${id}.`);
    ids.add(id);
    const sobrantes = Object.keys(data).filter((k) => !(CAMPOS as readonly string[]).includes(k));
    if (sobrantes.length > 0) problemas.push(`${id}: campos no esperados (${sobrantes.join(', ')}).`);
    if (typeof data.active !== 'boolean') problemas.push(`${id}: active debe ser true o false.`);
    if (typeof data.name !== 'string' || data.name.trim() === '') problemas.push(`${id}: name debe ser texto no vacío.`);
    if (typeof data.presentation !== 'string' || data.presentation.trim() === '') {
      problemas.push(`${id}: presentation debe ser texto no vacío.`);
    }
    if (typeof data.description !== 'string') problemas.push(`${id}: description debe ser texto.`);
    else if (data.description.length > CATALOG_MAX_DESCRIPTION) {
      problemas.push(`${id}: description tiene ${data.description.length} caracteres (máximo ${CATALOG_MAX_DESCRIPTION}).`);
    }
    if (typeof data.name === 'string' && typeof data.presentation === 'string') {
      const presentaciones = porVariedad.get(data.name) ?? new Set<string>();
      if (presentaciones.has(data.presentation)) problemas.push(`${id}: "${data.name}, ${data.presentation}" está repetido.`);
      presentaciones.add(data.presentation);
      porVariedad.set(data.name, presentaciones);
    }
  }
  problemas.push(...revisarVariedades(porVariedad));
  return problemas;
}

/** 9 variedades con 8 presentaciones cada una. */
export function revisarVariedades(porVariedad: ReadonlyMap<string, ReadonlySet<string>>): string[] {
  const problemas: string[] = [];
  if (porVariedad.size !== TOTAL_VARIEDADES) {
    problemas.push(`Se esperaban ${TOTAL_VARIEDADES} variedades y hay ${porVariedad.size}.`);
  }
  for (const [variedad, presentaciones] of porVariedad) {
    if (presentaciones.size !== PRESENTACIONES_POR_VARIEDAD) {
      problemas.push(`${variedad}: ${presentaciones.size} presentaciones (se esperaban ${PRESENTACIONES_POR_VARIEDAD}).`);
    }
  }
  return problemas;
}

// ---------------------------------------------------------------------------------------------------------------------
// Diferencias (puras)
// ---------------------------------------------------------------------------------------------------------------------

export interface CambioCampo {
  campo: string;
  antes: unknown;
  despues: unknown;
}

export interface Diferencias {
  crear: CatalogProduct[];
  cambiar: { producto: CatalogProduct; cambios: CambioCampo[] }[];
  iguales: string[];
  /** En Firestore pero no en el catálogo. Solo se listan: nunca se borran. */
  sobrantes: { id: string; data: DocumentData }[];
}

/** Ausente (el campo no existe en el documento): distinto de null. */
export const AUSENTE = Symbol('ausente');

/**
 * Compara el catálogo con lo que hay en Firestore. Un campo extra en Firestore (por ejemplo un precio viejo) cuenta como
 * cambio, porque setDoc sin merge reemplaza el documento entero y ese campo desaparece.
 */
export function calcularDiferencias(
  catalogo: readonly CatalogProduct[],
  existentes: ReadonlyMap<string, DocumentData>,
): Diferencias {
  const diferencias: Diferencias = { crear: [], cambiar: [], iguales: [], sobrantes: [] };
  const idsCatalogo = new Set(catalogo.map((p) => p.id));
  for (const producto of catalogo) {
    const actual = existentes.get(producto.id);
    if (!actual) {
      diferencias.crear.push(producto);
      continue;
    }
    const cambios: CambioCampo[] = [];
    const esperado = producto.data as unknown as DocumentData;
    for (const campo of CAMPOS) {
      if (!(campo in actual)) cambios.push({ campo, antes: AUSENTE, despues: esperado[campo] });
      else if (!Object.is(actual[campo], esperado[campo])) cambios.push({ campo, antes: actual[campo], despues: esperado[campo] });
    }
    for (const campo of Object.keys(actual).sort()) {
      if (!(CAMPOS as readonly string[]).includes(campo)) cambios.push({ campo, antes: actual[campo], despues: AUSENTE });
    }
    if (cambios.length > 0) diferencias.cambiar.push({ producto, cambios });
    else diferencias.iguales.push(producto.id);
  }
  for (const [id, data] of [...existentes].sort(([a], [b]) => a.localeCompare(b))) {
    if (!idsCatalogo.has(id)) diferencias.sobrantes.push({ id, data });
  }
  return diferencias;
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

function mostrarValor(valor: unknown): string {
  if (valor === AUSENTE) return '(no existe)';
  if (typeof valor === 'string') return JSON.stringify(valor.length > 70 ? `${valor.slice(0, 67)}...` : valor);
  return JSON.stringify(valor) ?? String(valor);
}

export function describirDiferencias(diferencias: Diferencias): string[] {
  const lineas: string[] = [];
  lineas.push(`Se crearían: ${diferencias.crear.length}`);
  for (const { id, data } of diferencias.crear) lineas.push(`  + ${id}  (${data.name}, ${data.presentation})`);
  lineas.push(`Cambiarían: ${diferencias.cambiar.length}`);
  for (const { producto, cambios } of diferencias.cambiar) {
    lineas.push(`  ~ ${producto.id}`);
    for (const c of cambios) lineas.push(`      ${c.campo}: ${mostrarValor(c.antes)} -> ${mostrarValor(c.despues)}`);
  }
  lineas.push(`Sin cambios: ${diferencias.iguales.length}`);
  lineas.push(`Sobran (están en Firestore y no en el catálogo; NO se borran): ${diferencias.sobrantes.length}`);
  for (const { id, data } of diferencias.sobrantes) {
    lineas.push(`  ? ${id}  (${String(data.name ?? '¿sin nombre?')}, ${String(data.presentation ?? '')}, active=${String(data.active)})`);
  }
  return lineas;
}

// ---------------------------------------------------------------------------------------------------------------------
// Firestore
// ---------------------------------------------------------------------------------------------------------------------

export async function leerProductos(db: Firestore): Promise<Map<string, DocumentData>> {
  const snap = await getDocs(collection(db, COLLECTIONS.products));
  return new Map(snap.docs.map((d) => [d.id, d.data()]));
}

export interface Verificacion {
  ok: boolean;
  activos: number;
  problemas: string[];
}

/** Lo que ve el sitio público: sin sesión y con where('active', '==', true). */
export async function verificarSinSesion(db: Firestore): Promise<Verificacion> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.products), where('active', '==', true)));
  const porVariedad = new Map<string, Set<string>>();
  for (const d of snap.docs) {
    const name = String(d.get('name'));
    const presentaciones = porVariedad.get(name) ?? new Set<string>();
    presentaciones.add(String(d.get('presentation')));
    porVariedad.set(name, presentaciones);
  }
  const problemas = revisarVariedades(porVariedad);
  return { ok: problemas.length === 0, activos: snap.size, problemas };
}

export interface ResultadoCatalogo {
  codigo: 0 | 1;
  diferencias?: Diferencias;
  escritos: string[];
  verificacion?: Verificacion;
}

/** Flujo completo del script A. Nunca lanza: devuelve el código de salida y lo que hizo. */
export async function ejecutarCargador(argv: readonly string[], terminal: Terminal): Promise<ResultadoCatalogo> {
  const escritos: string[] = [];
  let sesion: Sesion | undefined;
  let diferencias: Diferencias | undefined;
  let verificacion: Verificacion | undefined;
  try {
    const { args, config } = preparar(argv, terminal);

    const catalogo = buildCatalogProducts();
    const problemas = validarCatalogo(catalogo);
    if (problemas.length > 0) throw new AbortoError(`El catálogo no pasa la validación:\n  ${problemas.join('\n  ')}`);
    terminal.log(`Catálogo válido: ${catalogo.length} productos, ${TOTAL_VARIEDADES} variedades × ${PRESENTACIONES_POR_VARIEDAD} presentaciones.`);

    const contrasena = await pedirContrasena(terminal);
    sesion = await iniciarSesion(config, { emulador: args.emulador, entorno: terminal.entorno }, args.email, contrasena);
    terminal.log(`Sesión iniciada (uid ${sesion.user.uid}).`);

    try {
      diferencias = calcularDiferencias(catalogo, await leerProductos(sesion.db));
    } catch (error) {
      throw new AbortoError(`No se pudo leer la colección products: ${mensajeFirestore(error)}`);
    }
    terminal.log('');
    for (const linea of describirDiferencias(diferencias)) terminal.log(linea);
    terminal.log('');

    const pendientes = [...diferencias.crear, ...diferencias.cambiar.map((c) => c.producto)].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    if (!args.escribir) {
      terminal.log(`Modo prueba: no se escribió nada. Para aplicar ${plural(pendientes.length, 'escritura', 'escrituras')}, repita con --escribir.`);
    } else if (pendientes.length === 0) {
      terminal.log('Todo está al día: no hay nada que escribir.');
    } else {
      await confirmarProyecto(terminal, config.projectId);
      // Un setDoc por producto, en secuencia: las reglas hacen 2 lecturas (exists + get de users) por escritura y un
      // lote de 72 se pasaría del tope de lecturas por operación.
      for (const [i, { id, data }] of pendientes.entries()) {
        try {
          await setDoc(doc(sesion.db, COLLECTIONS.products, id), data);
        } catch (error) {
          throw new AbortoError(
            `Falló la escritura de ${id} (${i + 1}/${pendientes.length}): ${mensajeFirestore(error)}. ` +
              `Se escribieron ${escritos.length}; puede repetir el comando sin riesgo.`,
          );
        }
        escritos.push(id);
        terminal.log(`  [${i + 1}/${pendientes.length}] escrito ${id}`);
      }
      const despues = calcularDiferencias(catalogo, await leerProductos(sesion.db));
      if (despues.crear.length + despues.cambiar.length > 0) {
        throw new AbortoError('Después de escribir, Firestore todavía no coincide con el catálogo. Revise los permisos.');
      }
      terminal.log(`Escritura terminada: ${plural(escritos.length, 'producto', 'productos')}. Firestore coincide con el catálogo.`);
    }

    verificacion = await verificarComoPublico(config, args.emulador, terminal);
    if (verificacion.ok) {
      terminal.log(
        `Verificación sin sesión: OK. ${verificacion.activos} productos activos, ${TOTAL_VARIEDADES} variedades con ${PRESENTACIONES_POR_VARIEDAD} presentaciones cada una.`,
      );
    } else {
      terminal.log(`Verificación sin sesión: NO cuadra (${verificacion.activos} productos activos).`);
      for (const p of verificacion.problemas) terminal.log(`  - ${p}`);
    }
    const codigo = args.escribir && !verificacion.ok ? 1 : 0;
    return { codigo, diferencias, escritos, verificacion };
  } catch (error) {
    terminal.error(error instanceof AbortoError ? `ABORTADO: ${error.message}` : `ERROR: ${mensajeFirestore(error)}`);
    return { codigo: 1, diferencias, escritos, verificacion };
  } finally {
    await cerrarSesion(sesion);
  }
}

/** Relee con otra app, sin iniciar sesión: así lee el sitio público. */
async function verificarComoPublico(
  config: Parameters<typeof crearApp>[0],
  emulador: boolean,
  terminal: Terminal,
): Promise<Verificacion> {
  const { app, db } = crearApp(config, { emulador, entorno: terminal.entorno }, 'publico');
  try {
    return await verificarSinSesion(db);
  } catch (error) {
    return { ok: false, activos: 0, problemas: [`No se pudo leer sin sesión: ${mensajeFirestore(error)}`] };
  } finally {
    await deleteApp(app);
  }
}
