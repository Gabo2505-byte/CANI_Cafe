// Respaldo de la base de datos (RT-06, scripts/produccion/respaldo.ts) contra los emuladores. Corre con:
// npm run test:emulators. Carga datos variados (Timestamps con nanosegundos (en Firestore, hasta microsegundos), null, mapas anidados, arreglos, bytes,
// referencias, enteros grandes, subcolecciones y un documento sin campos), exporta, restaura en un proyecto vacío del
// emulador con una función de prueba y compara documento por documento. Nunca toca producción.
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { GeoPoint, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigWeb, Terminal } from '../../scripts/produccion/comun';
import { crearAppAdmin } from '../../scripts/produccion/limpieza';
import { ejecutarRespaldo, leerColecciones, leerCuentas, type ColeccionRespaldo } from '../../scripts/produccion/respaldo';
import { restaurarRespaldo } from '../helpers/restaurarRespaldo';

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID!;
const DESTINO_ID = 'demo-cani-restaurado';
const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const HOST_AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const AHORA = new Date('2026-11-16T15:30:00Z');

let origen: App;
let destino: App;
let carpeta: string;
let archivoEnv: string;
let salida: string;
let contador = 0;

const dbOrigen = () => getFirestore(origen);
const fecha = (iso: string) => Timestamp.fromDate(new Date(iso));

async function limpiar(proyecto: string) {
  await fetch(`http://${HOST}/emulator/v1/projects/${proyecto}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${HOST_AUTH}/emulator/v1/projects/${proyecto}/accounts`, { method: 'DELETE' });
}

async function armarDatos() {
  await limpiar(PROJECT_ID);
  await limpiar(DESTINO_ID);
  const db = dbOrigen();
  const lote = db.batch();
  const set = (ruta: string, datos: Record<string, unknown>) => lote.set(db.doc(ruta), datos);

  set('contacts/c-1', {
    fullName: 'Ana Pérez Ñandú',
    email: null,
    phoneNumber: '88880000',
    active: true,
    visitas: 3,
    saldo: 12.5,
    enteroGrande: 9007199254740993n,
    createdAt: Timestamp.fromMillis(1700000000123),
    // Firestore guarda los Timestamp con precisión de microsegundos.
    exacto: new Timestamp(1700000000, 123456000),
    ubicacion: new GeoPoint(10.5, -84.25),
    foto: Buffer.from([0, 1, 2, 250, 255]),
    referencia: db.doc('contacts/c-2'),
    etiquetas: ['a', 1, null, { x: [true, false] }, new Timestamp(10, 5)],
    direccion: { provincia: 'Alajuela', detalle: { canton: 'Naranjo', geo: new GeoPoint(1, 2), nada: null } },
    mapaRaro: { __tipo: 'timestamp', segundos: 'no es un timestamp' },
    vacio: {},
    listaVacia: [],
    textoVacio: '',
  });
  set('contacts/c-2', { fullName: 'Luis Soto', email: 'luis@example.com', createdAt: fecha('2026-10-02T12:00:00Z') });
  set('sales/s-1', { contactId: 'c-1', stage: 'contactado', total: 150000, createdAt: fecha('2026-10-03T12:00:00Z') });
  set('sales/s-1/notas/n-1', { texto: 'Primera nota', autor: null, creada: fecha('2026-10-04T12:00:00Z') });
  set('sales/s-1/notas/n-1/adjuntos/a-1', { nombre: 'foto.png', tamano: 2048 });
  set('sales/s-2', { contactId: 'c-2', stage: 'ganada', total: 0 });
  set('colección con espacios/doc: 1', { ok: true });
  // Documento sin campos que solo existe porque tiene una subcolección.
  set('fantasma/f-1/hijos/h-1', { dato: 'cuelga de un documento sin campos' });
  await lote.commit();

  const auth = getAuth(origen);
  await auth.createUser({ uid: 'u-1', email: 'admin@example.com', password: 'secreto-Muy-Privado-123', displayName: 'admin' });
  await auth.createUser({ uid: 'u-2', email: 'otra@example.com', password: 'otra-clave-456', disabled: true });
}

function terminalFalsa() {
  const lineas: string[] = [];
  const terminal: Terminal = {
    log: (m) => lineas.push(m),
    error: (m) => lineas.push(m),
    pedirOculto: vi.fn(async () => ''),
    pedirLinea: vi.fn(async () => ''),
    entorno: process.env,
  };
  return { terminal, texto: () => lineas.join('\n') };
}

const argsBase = ['--project', PROJECT_ID, '--env', '', '--emulador'];
function argumentos(...extra: string[]) {
  const a = [...argsBase];
  a[3] = archivoEnv;
  return [...a, ...extra];
}
const exportar = (t: Terminal) => ejecutarRespaldo(argumentos('--salida', salida), t, { ahora: AHORA, raizRepo: process.cwd() });
const verificar = (t: Terminal) => ejecutarRespaldo(argumentos('--verificar', salida), t);

function configDe(projectId: string): ConfigWeb {
  return { apiKey: 'demo', authDomain: `${projectId}.firebaseapp.com`, projectId, usaEmuladores: true };
}

/** Lee un proyecto del emulador con el mismo código del script. */
async function leerProyecto(projectId: string): Promise<ColeccionRespaldo[]> {
  const { app, db } = crearAppAdmin(configDe(projectId), { emulador: true }, process.env, { prefijo: 'lector', useBigInt: true });
  try {
    return await leerColecciones(db);
  } finally {
    await deleteApp(app);
  }
}

const leerJson = (ruta: string) => JSON.parse(readFileSync(ruta, 'utf8')) as Record<string, any>;

beforeAll(() => {
  origen = initializeApp({ projectId: PROJECT_ID }, 'respaldo-origen');
  destino = initializeApp({ projectId: DESTINO_ID }, 'respaldo-destino');
  carpeta = mkdtempSync(join(tmpdir(), 'cani-respaldo-'));
  archivoEnv = join(carpeta, '.env.emulador');
  writeFileSync(
    archivoEnv,
    [
      'VITE_FIREBASE_API_KEY=demo-api-key',
      `VITE_FIREBASE_AUTH_DOMAIN=${PROJECT_ID}.firebaseapp.com`,
      `VITE_FIREBASE_PROJECT_ID=${PROJECT_ID}`,
      'VITE_USE_EMULATORS=true',
    ].join('\r\n'),
  );
});

beforeEach(async () => {
  salida = join(carpeta, `respaldo-${++contador}`);
  await armarDatos();
});

afterAll(async () => {
  await limpiar(PROJECT_ID);
  await limpiar(DESTINO_ID);
  rmSync(carpeta, { recursive: true, force: true });
  await deleteApp(origen);
  await deleteApp(destino);
});

describe('exportar', () => {
  it('descubre todas las colecciones y subcolecciones y escribe un archivo por colección más el manifiesto', async () => {
    const t = terminalFalsa();
    const r = await exportar(t.terminal);
    expect(r.codigo).toBe(0);

    const manifiesto = leerJson(join(salida, 'respaldo-manifiesto.json'));
    expect(manifiesto).toMatchObject({
      formato: 'cani-firestore-respaldo/1',
      proyecto: PROJECT_ID,
      generadoEn: '2026-11-16T15:30:00.000Z',
      generadoEnLocal: '2026-11-16 09:30 (America/Costa_Rica)',
      totalDocumentos: 8,
    });
    const conteos = Object.fromEntries(manifiesto.colecciones.map((c: { ruta: string; documentos: number }) => [c.ruta, c.documentos]));
    expect(conteos).toEqual({
      contacts: 2,
      sales: 2,
      'sales/s-1/notas': 1,
      'sales/s-1/notas/n-1/adjuntos': 1,
      'colección con espacios': 1,
      fantasma: 0,
      'fantasma/f-1/hijos': 1,
    });
    expect(manifiesto.authentication).toMatchObject({ archivo: 'respaldo-authentication.json', cuentas: 2 });
    expect(readdirSync(join(salida, 'respaldo-colecciones')).sort()).toEqual([
      'colecci_n_con_espacios.json',
      'contacts.json',
      'fantasma.json',
      'fantasma__f-1__hijos.json',
      'sales.json',
      'sales__s-1__notas.json',
      'sales__s-1__notas__n-1__adjuntos.json',
    ]);
    expect(leerJson(join(salida, 'respaldo-colecciones', 'fantasma.json')).documentosSinCampos).toEqual(['f-1']);
    expect(t.texto()).toContain('Respaldo terminado: 7 colecciones, 8 documentos.');
    expect(t.texto()).toContain('canal privado');
  });

  it('guarda los tipos de Firestore con su etiqueta y la fecha de creación de las cuentas, sin contraseñas ni hashes', async () => {
    await exportar(terminalFalsa().terminal);
    const contactos = leerJson(join(salida, 'respaldo-colecciones', 'contacts.json'));
    const c1 = contactos.documentos.find((d: { id: string }) => d.id === 'c-1').datos;
    expect(c1.email).toBeNull();
    expect(c1.exacto).toEqual({ __tipo: 'timestamp', segundos: 1700000000, nanosegundos: 123456000, iso: '2023-11-14T22:13:20.123Z' });
    expect(c1.ubicacion).toEqual({ __tipo: 'geopoint', latitud: 10.5, longitud: -84.25 });
    expect(c1.referencia).toEqual({ __tipo: 'referencia', ruta: 'contacts/c-2' });
    expect(c1.foto).toEqual({ __tipo: 'bytes', base64: 'AAEC+v8=' });
    expect(c1.enteroGrande).toEqual({ __tipo: 'entero', valor: '9007199254740993' });
    expect(c1.visitas).toBe(3);
    expect(c1.saldo).toBe(12.5);
    expect(c1.mapaRaro.__tipo).toBe('mapa');
    expect(c1.direccion.detalle.nada).toBeNull();

    const textoAuth = readFileSync(join(salida, 'respaldo-authentication.json'), 'utf8');
    const auth = JSON.parse(textoAuth);
    expect(auth.cuentas.map((c: { uid: string; email: string }) => [c.uid, c.email])).toEqual([
      ['u-1', 'admin@example.com'],
      ['u-2', 'otra@example.com'],
    ]);
    expect(auth.cuentas[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(auth.cuentas[1].disabled).toBe(true);
    expect(textoAuth).not.toMatch(/secreto|otra-clave|password|salt|hash/i);
  });

  it('no escribe nada en la base: queda igual documento por documento', async () => {
    const antes = await leerProyecto(PROJECT_ID);
    const cuentasAntes = await leerCuentas(origen);
    await exportar(terminalFalsa().terminal);
    expect(await leerProyecto(PROJECT_ID)).toEqual(antes);
    expect(await leerCuentas(origen)).toEqual(cuentasAntes);
  });

  it('no sobrescribe una carpeta con archivos', async () => {
    expect((await exportar(terminalFalsa().terminal)).codigo).toBe(0);
    const t = terminalFalsa();
    expect((await exportar(t.terminal)).codigo).toBe(1);
    expect(t.texto()).toContain('ya tiene archivos');
  });
});

describe('restaurar en un emulador vacío', () => {
  it('la copia restaurada es idéntica a la original, documento por documento y con los mismos tipos', async () => {
    await exportar(terminalFalsa().terminal);
    expect(await leerProyecto(DESTINO_ID)).toEqual([]);

    const restaurados = await restaurarRespaldo(salida, destino, { cuentas: true });
    expect(restaurados).toBe(8);

    const original = await leerProyecto(PROJECT_ID);
    const restaurada = await leerProyecto(DESTINO_ID);
    expect(restaurada.map((c) => c.ruta)).toEqual(original.map((c) => c.ruta));
    for (const col of restaurada) {
      const esperada = original.find((c) => c.ruta === col.ruta)!;
      expect(col.documentos, col.ruta).toEqual(esperada.documentos);
      expect(col.sinCampos, col.ruta).toEqual(esperada.sinCampos);
    }

    // Los valores restaurados son del tipo original, no solo "se ven igual" en JSON.
    const c1 = (await getFirestore(destino).doc('contacts/c-1').get()).data()!;
    expect(c1.exacto).toBeInstanceOf(Timestamp);
    expect((c1.exacto as Timestamp).nanoseconds).toBe(123456000);
    expect(c1.ubicacion).toBeInstanceOf(GeoPoint);
    expect(c1.referencia.path).toBe('contacts/c-2');
    expect(Buffer.from(c1.foto).equals(Buffer.from([0, 1, 2, 250, 255]))).toBe(true);
    expect(c1.email).toBeNull();
    expect('email' in c1).toBe(true);
    expect(c1.mapaRaro).toEqual({ __tipo: 'timestamp', segundos: 'no es un timestamp' });
    expect(c1.vacio).toEqual({});
    expect(c1.listaVacia).toEqual([]);

    const cuentasOriginal = (await leerCuentas(origen)).map((c) => ({ uid: c.uid, email: c.email, disabled: c.disabled }));
    const cuentasRestauradas = (await leerCuentas(destino)).map((c) => ({ uid: c.uid, email: c.email, disabled: c.disabled }));
    expect(cuentasRestauradas).toEqual(cuentasOriginal);
  });

  it('la copia restaurada también se puede exportar y da los mismos checksums por documento', async () => {
    await exportar(terminalFalsa().terminal);
    await restaurarRespaldo(salida, destino);
    const checksums = (cols: ColeccionRespaldo[]) =>
      Object.fromEntries(cols.flatMap((c) => c.documentos.map((d) => [d.ruta, d.sha256])));
    expect(checksums(await leerProyecto(DESTINO_ID))).toEqual(checksums(await leerProyecto(PROJECT_ID)));
  });

  it('la restauración se niega a correr sin el emulador de Firestore', async () => {
    const guardado = process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIRESTORE_EMULATOR_HOST;
    try {
      await expect(restaurarRespaldo(salida, destino)).rejects.toThrow('solo corre contra el emulador');
    } finally {
      process.env.FIRESTORE_EMULATOR_HOST = guardado;
    }
  });
});

describe('--verificar', () => {
  it('un respaldo recién hecho coincide con la base viva (código 0)', async () => {
    await exportar(terminalFalsa().terminal);
    const t = terminalFalsa();
    const r = await verificar(t.terminal);
    expect(r.codigo).toBe(0);
    expect(t.texto()).toContain('[OK] contacts: 2 en el respaldo y 2 en la base viva; checksums iguales');
    expect(t.texto()).toContain('[OK] sales/s-1/notas/n-1/adjuntos: 1 en el respaldo y 1 en la base viva; checksums iguales');
    expect(t.texto()).toContain('[OK] Authentication: 2 en el respaldo y 2 en la base viva; cuentas iguales');
    expect(t.texto()).toContain('Todo coincide.');
    expect(t.texto()).not.toContain('FALLA');
  });

  it('código 1 si cambió el contenido de un documento', async () => {
    await exportar(terminalFalsa().terminal);
    await dbOrigen().doc('contacts/c-2').update({ fullName: 'Luis Soto Modificado' });
    const t = terminalFalsa();
    expect((await verificar(t.terminal)).codigo).toBe(1);
    expect(t.texto()).toContain('[FALLA] contacts: contenido distinto: c-2');
  });

  it('código 1 si se agregó un documento, se borró otro o aparece una colección nueva', async () => {
    await exportar(terminalFalsa().terminal);
    await dbOrigen().doc('contacts/c-3').set({ fullName: 'Nuevo' });
    await dbOrigen().doc('sales/s-2').delete();
    await dbOrigen().doc('otra/o-1').set({ x: 1 });
    const t = terminalFalsa();
    expect((await verificar(t.terminal)).codigo).toBe(1);
    expect(t.texto()).toContain('[FALLA] contacts: 2 en el respaldo y 3 en la base viva; solo en la base viva: c-3');
    expect(t.texto()).toContain('[FALLA] sales: 2 en el respaldo y 1 en la base viva; solo en el respaldo: s-2');
    expect(t.texto()).toContain('[FALLA] otra: existe en la base viva (1 documentos) y no está en el respaldo');
  });

  it('código 1 si cambió una cuenta de Authentication', async () => {
    await exportar(terminalFalsa().terminal);
    await getAuth(origen).deleteUser('u-2');
    const t = terminalFalsa();
    expect((await verificar(t.terminal)).codigo).toBe(1);
    expect(t.texto()).toContain('[FALLA] Authentication: 2 en el respaldo y 1 en la base viva; solo en el respaldo: u-2');
  });

  it('código 1 si un archivo del respaldo fue alterado o falta', async () => {
    await exportar(terminalFalsa().terminal);
    const ruta = join(salida, 'respaldo-colecciones', 'contacts.json');
    const alterado = readFileSync(ruta, 'utf8').replace('Luis Soto', 'Luis Alterado');
    writeFileSync(ruta, alterado, 'utf8');
    const t = terminalFalsa();
    expect((await verificar(t.terminal)).codigo).toBe(1);
    expect(t.texto()).toContain('[FALLA] respaldo-colecciones/contacts.json: el checksum del archivo no coincide con el manifiesto');
    expect(t.texto()).toContain('documentos con checksum distinto: c-2');
    expect(t.texto()).toContain('[FALLA] contacts: contenido distinto: c-2');

    rmSync(join(salida, 'respaldo-colecciones', 'sales.json'));
    const t2 = terminalFalsa();
    expect((await verificar(t2.terminal)).codigo).toBe(1);
    expect(t2.texto()).toContain('[FALLA] respaldo-colecciones/sales.json: no se pudo leer');
  });

  it('aborta si el respaldo es de otro proyecto', async () => {
    await exportar(terminalFalsa().terminal);
    const ruta = join(salida, 'respaldo-manifiesto.json');
    writeFileSync(ruta, readFileSync(ruta, 'utf8').replace(`"proyecto": "${PROJECT_ID}"`, '"proyecto": "cani-cafe"'), 'utf8');
    const t = terminalFalsa();
    expect((await verificar(t.terminal)).codigo).toBe(1);
    expect(t.texto()).toContain('El respaldo es del proyecto "cani-cafe"');
  });
});
