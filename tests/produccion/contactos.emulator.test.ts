// Cargador de contactos (RT-02, scripts/produccion/contactos.ts) contra los emuladores, con el administrador del seed y
// las reglas del repo. Corre con: npm run test:emulators. Ejecuta el flujo completo con una terminal falsa y un CSV
// ficticio escrito en una carpeta temporal (los datos de contactos nunca viven en el repositorio).
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { listAllContactsIn } from '../../src/contacts/contactsRepository';
import { cerrarSesion, iniciarSesion, leerConfigWeb, type Terminal } from '../../scripts/produccion/comun';
import { ejecutarCargadorContactos } from '../../scripts/produccion/contactos';
import { runSeed } from '../../scripts/seed/runSeed';
import { SEED_ADMIN } from '../../scripts/seed/seedData';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID!;
const PASSWORD = process.env.SEED_ADMIN_PASSWORD!;
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');

const ENCABEZADO = 'nombre_completo,correo,telefono,codigo_pais,direccion,clasificacion';
// Fila 1 = encabezado. Se cargan las filas 2, 3, 4 y 10; las otras cinco se omiten.
const FILAS = [
  'Ana Uno,ANA@Ejemplo.com,88881111,506,"Calle 1, Naranjo",Cliente', // 2
  'Luis Dos,,8888-2222,,,', // 3
  'Marta Tres,marta@ejemplo.com,3055551234,1,,persona interesada', // 4
  ',sinnombre@ejemplo.com,,,,', // 5: sin nombre
  'Sin Datos,,,,,', // 6: sin correo ni teléfono
  'Tel Corto,,1234,,,', // 7: teléfono de largo inválido
  'Ana Repetida,ana@ejemplo.com,,,,', // 8: correo repetido en el archivo
  'Existente Inactivo,existente@ejemplo.com,,,,', // 9: ya existe en Firestore (inactivo)
  'Josefa Cuatro,,88883333,,,CLIENTE', // 10
];

let testEnv: RulesTestEnvironment;
let admin: App;
let carpeta: string;
let archivoEnv: string;
let archivoCsv: string;

function terminalFalsa(opciones: { contrasena?: string; confirmacion?: string } = {}) {
  const salida: string[] = [];
  const terminal: Terminal = {
    log: (m) => salida.push(m),
    error: (m) => salida.push(m),
    pedirOculto: vi.fn(async () => opciones.contrasena ?? PASSWORD),
    pedirLinea: vi.fn(async () => opciones.confirmacion ?? PROJECT_ID),
    entorno: process.env,
  };
  return { terminal, salida, texto: () => salida.join('\n') };
}

const argsContactos = (...extra: string[]) => [
  '--project', PROJECT_ID, '--email', SEED_ADMIN.email, '--env', archivoEnv, '--archivo', archivoCsv, '--emulador', ...extra,
];

const db = () => getFirestore(admin);
async function cargados() {
  const snap = await db().collection(COLLECTIONS.contacts).where('origin', '==', 'carga_inicial').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown> & { id: string });
}
async function totalContactos() {
  return (await db().collection(COLLECTIONS.contacts).get()).size;
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });

  admin = initializeApp({ projectId: PROJECT_ID }, 'contactos-test');
  await runSeed(admin, { adminPassword: PASSWORD });
  // Parte de cero: se quitan los contactos del seed y se deja uno INACTIVO que el archivo vuelve a traer (fila 9).
  for (const d of (await db().collection(COLLECTIONS.contacts).get()).docs) await d.ref.delete();
  await db().collection(COLLECTIONS.contacts).doc('existente-inactivo').set({
    fullName: 'Existente Inactivo',
    nameSortKey: 'existente inactivo',
    email: 'existente@ejemplo.com',
    phoneCountry: null,
    phoneNumber: null,
    address: null,
    classification: 'persona_interesada',
    status: 'inactivo',
    origin: null,
    createdAt: Timestamp.fromDate(new Date('2026-01-01T12:00:00Z')),
  });

  carpeta = mkdtempSync(join(tmpdir(), 'cani-contactos-'));
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
  archivoCsv = join(carpeta, 'contactos.csv');
  // Como lo guardaría Excel: UTF-8 con BOM y CRLF.
  writeFileSync(archivoCsv, `﻿${[ENCABEZADO, ...FILAS].join('\r\n')}\r\n`, 'utf8');
});

afterAll(async () => {
  rmSync(carpeta, { recursive: true, force: true });
  for (const d of (await db().collection(COLLECTIONS.contacts).get()).docs) await d.ref.delete();
  await deleteApp(admin);
  await testEnv?.cleanup();
});

describe('script C: cargador de contactos', () => {
  it('modo prueba: cuenta lo que cargaría, lista las omitidas con fila, nombre y motivo, y no escribe nada', async () => {
    const t = terminalFalsa();
    const r = await ejecutarCargadorContactos(argsContactos(), t.terminal);
    expect(r.codigo).toBe(0);
    expect(r.escritos).toEqual([]);
    expect(r.plan?.cargar.map((c) => c.fila)).toEqual([2, 3, 4, 10]);
    expect(await totalContactos()).toBe(1); // solo el existente
    expect(t.terminal.pedirLinea).not.toHaveBeenCalled();
    expect(t.texto()).toContain('Filas con datos en el archivo: 9');
    expect(t.texto()).toContain('Se cargarían: 4');
    expect(t.texto()).toContain('NO se cargan: 5');
    expect(t.texto()).toContain('fila 5 | (sin nombre) | No tiene nombre completo.');
    expect(t.texto()).toContain('fila 6 | Sin Datos | No tiene un correo ni un teléfono.');
    expect(t.texto()).toContain('fila 7 | Tel Corto | El teléfono debe tener 8 dígitos (Costa Rica).');
    expect(t.texto()).toContain('fila 8 | Ana Repetida | El correo ya está en la fila 2 del archivo (se carga solo la primera).');
    expect(t.texto()).toContain('fila 9 | Existente Inactivo | Ya existe un contacto con este correo.');
    expect(t.texto()).toContain('Modo prueba: no se escribió nada.');
    expect(t.texto()).not.toContain(PASSWORD);
  });

  it('confirmación distinta al projectId: no escribe nada', async () => {
    const t = terminalFalsa({ confirmacion: 'cani-otro' });
    const r = await ejecutarCargadorContactos(argsContactos('--escribir'), t.terminal);
    expect(r.codigo).toBe(1);
    expect(r.escritos).toEqual([]);
    expect(t.texto()).toContain('La confirmación no coincide con el projectId. No se escribió nada.');
    expect(await totalContactos()).toBe(1);
  });

  it('--escribir: crea los 4 contactos activos, con origen "Carga inicial", la clasificación indicada y la forma del documento de la app', async () => {
    const t = terminalFalsa();
    const r = await ejecutarCargadorContactos(argsContactos('--escribir'), t.terminal);
    expect(r.codigo).toBe(0);
    expect(t.terminal.pedirLinea).toHaveBeenCalledOnce();
    expect(r.escritos).toHaveLength(4);
    expect(t.texto()).toContain('[4/4] cargada la fila 10');
    expect(t.texto()).toContain('Carga terminada: 4 contactos cargados.');

    const docs = await cargados();
    expect(docs).toHaveLength(4);
    const porNombre = new Map(docs.map((d) => [d.fullName as string, d]));
    expect([...porNombre.keys()].sort()).toEqual(['Ana Uno', 'Josefa Cuatro', 'Luis Dos', 'Marta Tres']);
    for (const d of docs) {
      expect(d.status).toBe('activo');
      expect(d.origin).toBe('carga_inicial');
      expect(d.createdAt).toBeInstanceOf(Timestamp);
      expect(Object.keys(d).sort()).toEqual(
        ['address', 'classification', 'createdAt', 'email', 'fullName', 'id', 'nameSortKey', 'origin', 'phoneCountry', 'phoneNumber', 'status'],
      );
    }
    expect(porNombre.get('Ana Uno')).toMatchObject({
      email: 'ana@ejemplo.com', phoneCountry: 'CR', phoneNumber: '88881111', address: 'Calle 1, Naranjo', classification: 'cliente', nameSortKey: 'ana uno',
    });
    expect(porNombre.get('Luis Dos')).toMatchObject({ email: null, phoneCountry: 'CR', phoneNumber: '88882222', address: null, classification: 'persona_interesada' });
    expect(porNombre.get('Marta Tres')).toMatchObject({ email: 'marta@ejemplo.com', phoneCountry: 'US', phoneNumber: '3055551234', classification: 'persona_interesada' });
    expect(porNombre.get('Josefa Cuatro')).toMatchObject({ email: null, phoneNumber: '88883333', classification: 'cliente' });
  });

  it('la pantalla de contactos los lee con listAllContactsIn (activos e inactivo, en orden alfabético)', async () => {
    const config = leerConfigWeb(archivoEnv, PROJECT_ID);
    const sesion = await iniciarSesion(config, { emulador: true, entorno: process.env }, SEED_ADMIN.email, PASSWORD);
    try {
      const contactos = await listAllContactsIn(sesion.db);
      expect(contactos.map((c) => c.fullName)).toEqual(['Ana Uno', 'Existente Inactivo', 'Josefa Cuatro', 'Luis Dos', 'Marta Tres']);
      expect(contactos.filter((c) => c.origin === 'carga_inicial' && c.status === 'activo')).toHaveLength(4);
    } finally {
      await cerrarSesion(sesion);
    }
  });

  it('una segunda corrida con --escribir no duplica nada: todo se omite como ya existente', async () => {
    const antes = new Map((await cargados()).map((d) => [d.id, d]));
    const t = terminalFalsa();
    const r = await ejecutarCargadorContactos(argsContactos('--escribir'), t.terminal);
    expect(r.codigo).toBe(0);
    expect(r.escritos).toEqual([]);
    expect(r.plan?.cargar).toEqual([]);
    expect(t.terminal.pedirLinea).not.toHaveBeenCalled();
    expect(t.texto()).toContain('No hay contactos nuevos que cargar.');
    expect(t.texto()).toContain('fila 2 | Ana Uno | Ya existe un contacto con este correo.');
    expect(t.texto()).toContain('fila 3 | Luis Dos | Ya existe un contacto con este teléfono.');
    expect(await totalContactos()).toBe(5);
    expect(new Map((await cargados()).map((d) => [d.id, d]))).toEqual(antes);
  });

  it('un contacto ya existente se omite aunque el archivo traiga el teléfono con otro formato; el resto se carga', async () => {
    await db().collection(COLLECTIONS.contacts).doc('existente-activo').set({
      fullName: 'Otra Persona', nameSortKey: 'otra persona', email: null, phoneCountry: 'CR', phoneNumber: '88884444', address: null,
      classification: 'cliente', status: 'activo', origin: 'otro', createdAt: Timestamp.now(),
    });
    const archivo = join(carpeta, 'segundo.csv');
    // Punto y coma y teléfono con guion y espacio: otro formato, mismo número.
    writeFileSync(archivo, `${ENCABEZADO.replaceAll(',', ';')}\nHomónimo Nuevo;;8888 4444;;;\nPedro Cinco;pedro@ejemplo.com;;;;\n`, 'utf8');
    const t = terminalFalsa();
    const argv = argsContactos('--escribir');
    argv[argv.indexOf('--archivo') + 1] = archivo;
    const r = await ejecutarCargadorContactos(argv, t.terminal);
    expect(r.codigo).toBe(0);
    expect(r.escritos).toHaveLength(1);
    expect(t.texto()).toContain('fila 2 | Homónimo Nuevo | Ya existe un contacto con este teléfono.');
    expect((await db().collection(COLLECTIONS.contacts).where('email', '==', 'pedro@ejemplo.com').get()).docs[0].get('origin')).toBe('carga_inicial');
    expect(await totalContactos()).toBe(7);
  });

  it('un archivo que no existe, sin encabezado válido o que no es UTF-8 aborta antes de pedir la contraseña', async () => {
    const malo = join(carpeta, 'malo.csv');
    writeFileSync(malo, 'correo,telefono\na@b.com,\n', 'utf8');
    const ansi = join(carpeta, 'ansi.csv');
    writeFileSync(ansi, Buffer.concat([Buffer.from(`${ENCABEZADO}\nJos`), Buffer.from([0xe9]), Buffer.from(' Prueba,a@b.com,,,,\n')]));
    const casos: [string, RegExp][] = [
      [join(carpeta, 'no-existe.csv'), /No se pudo leer el archivo CSV/],
      [malo, /Falta la columna nombre_completo/],
      [ansi, /no está en UTF-8/],
    ];
    for (const [ruta, mensaje] of casos) {
      const t = terminalFalsa();
      const argv = argsContactos('--escribir');
      argv[argv.indexOf('--archivo') + 1] = ruta;
      const r = await ejecutarCargadorContactos(argv, t.terminal);
      expect(r.codigo).toBe(1);
      expect(t.terminal.pedirOculto).not.toHaveBeenCalled();
      expect(t.texto()).toMatch(mensaje);
    }
  });

  it('sin --archivo, o con un projectId distinto al del archivo, aborta antes de pedir la contraseña', async () => {
    const sinArchivo = terminalFalsa();
    const argv = ['--project', PROJECT_ID, '--email', SEED_ADMIN.email, '--env', archivoEnv, '--emulador'];
    expect((await ejecutarCargadorContactos(argv, sinArchivo.terminal)).codigo).toBe(1);
    expect(sinArchivo.texto()).toContain('Falta la opción obligatoria --archivo.');
    expect(sinArchivo.terminal.pedirOculto).not.toHaveBeenCalled();

    const otro = terminalFalsa();
    const r = await ejecutarCargadorContactos(argsContactos().map((a) => (a === PROJECT_ID ? 'demo-cani-otro' : a)), otro.terminal);
    expect(r.codigo).toBe(1);
    expect(otro.terminal.pedirOculto).not.toHaveBeenCalled();
    expect(otro.texto()).toContain('se pidió --project "demo-cani-otro"');
  });

  it('una contraseña incorrecta aborta sin leer ni escribir', async () => {
    const t = terminalFalsa({ contrasena: 'incorrecta-123' });
    const r = await ejecutarCargadorContactos(argsContactos('--escribir'), t.terminal);
    expect(r.codigo).toBe(1);
    expect(r.plan).toBeUndefined();
    expect(t.texto()).toContain('ABORTADO: No se pudo iniciar sesión: Correo o contraseña incorrectos.');
    expect(t.texto()).not.toContain('incorrecta-123');
  });
});
