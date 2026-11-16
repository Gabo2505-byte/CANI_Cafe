// Scripts de publicación (scripts/produccion/) contra los emuladores, con el administrador del seed y las reglas del
// repo. Corre con: npm run test:emulators. Ejecuta el flujo completo de cada script (argumentos, archivo de
// configuración, protecciones, inicio de sesión, lectura, escritura y verificación) con una terminal falsa.
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ejecutarCargador } from '../../scripts/produccion/catalogo';
import type { Terminal } from '../../scripts/produccion/comun';
import { ejecutarNombreVisible } from '../../scripts/produccion/nombreVisible';
import { buildCatalogProducts } from '../../scripts/seed/catalogData';
import { runSeed } from '../../scripts/seed/runSeed';
import { SEED_ADMIN } from '../../scripts/seed/seedData';
import { COLLECTIONS } from '../../src/shared/constants/collections';

// El emulador de Auth atiende al SDK de cliente con el proyecto por defecto de emulators:exec (el de .env.test), y el
// seed crea la cuenta con el Admin SDK: los dos deben usar ese proyecto. Solo la prueba del seed lo usa, y lo reinicia.
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID!;
const PASSWORD = process.env.SEED_ADMIN_PASSWORD!;
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const catalogo = buildCatalogProducts();

let testEnv: RulesTestEnvironment;
let admin: App;
let carpeta: string;
let archivoEnv: string;

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

const argsCatalogo = (...extra: string[]) => ['--project', PROJECT_ID, '--email', SEED_ADMIN.email, '--env', archivoEnv, '--emulador', ...extra];
const argsCuenta = (...extra: string[]) => [...argsCatalogo(), '--usuario', SEED_ADMIN.username, ...extra];

const db = () => getFirestore(admin);
async function productos() {
  const snap = await db().collection(COLLECTIONS.products).get();
  return new Map(snap.docs.map((d) => [d.id, { data: d.data(), actualizado: d.updateTime.toMillis() }]));
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });

  // Administrador del seed (Auth + users + usernames). Se quitan los productos del seed: el cargador parte de cero.
  admin = initializeApp({ projectId: PROJECT_ID }, 'cargador-test');
  await runSeed(admin, { adminPassword: PASSWORD });
  const seedProducts = await db().collection(COLLECTIONS.products).get();
  for (const d of seedProducts.docs) await d.ref.delete();

  carpeta = mkdtempSync(join(tmpdir(), 'cani-cargador-'));
  archivoEnv = join(carpeta, '.env.emulador');
  // Como lo escribiría PowerShell: con BOM y CRLF.
  writeFileSync(
    archivoEnv,
    '﻿' +
      [
        '# Configuración web de prueba (solo emulador)',
        'VITE_FIREBASE_API_KEY=demo-api-key',
        `VITE_FIREBASE_AUTH_DOMAIN=${PROJECT_ID}.firebaseapp.com`,
        `VITE_FIREBASE_PROJECT_ID=${PROJECT_ID}`,
        'VITE_USE_EMULATORS=true',
      ].join('\r\n'),
  );
});

afterAll(async () => {
  rmSync(carpeta, { recursive: true, force: true });
  await deleteApp(admin);
  await testEnv?.cleanup();
});

describe('script A: cargador del catálogo', () => {
  it('modo prueba: muestra los 72 por crear y no escribe nada', async () => {
    const t = terminalFalsa();
    const r = await ejecutarCargador(argsCatalogo(), t.terminal);
    expect(r.codigo).toBe(0);
    expect(r.diferencias?.crear).toHaveLength(72);
    expect(r.escritos).toEqual([]);
    expect((await productos()).size).toBe(0);
    expect(t.terminal.pedirLinea).not.toHaveBeenCalled();
    expect(t.texto()).toContain(`Proyecto:    ${PROJECT_ID}`);
    expect(t.texto()).toContain(`authDomain:  ${PROJECT_ID}.firebaseapp.com`);
    expect(t.texto()).toContain('Se crearían: 72');
    expect(t.texto()).toContain('Modo prueba: no se escribió nada.');
    // El sitio público todavía no ve productos.
    expect(r.verificacion).toMatchObject({ ok: false, activos: 0 });
    expect(t.texto()).not.toContain(PASSWORD);
  });

  it('confirmación distinta al projectId: no escribe nada', async () => {
    const t = terminalFalsa({ confirmacion: 'cani-otro' });
    const r = await ejecutarCargador(argsCatalogo('--escribir'), t.terminal);
    expect(r.codigo).toBe(1);
    expect(r.escritos).toEqual([]);
    expect(t.texto()).toContain('La confirmación no coincide con el projectId. No se escribió nada.');
    expect((await productos()).size).toBe(0);
  });

  it('--escribir: crea los 72 productos y la verificación sin sesión da 9 variedades × 8 presentaciones', async () => {
    const t = terminalFalsa();
    const r = await ejecutarCargador(argsCatalogo('--escribir'), t.terminal);
    expect(r.codigo).toBe(0);
    expect(t.terminal.pedirLinea).toHaveBeenCalledOnce();
    expect(r.escritos).toEqual(catalogo.map((p) => p.id));
    const guardados = await productos();
    expect(guardados.size).toBe(72);
    for (const { id, data } of catalogo) expect(guardados.get(id)?.data).toEqual(data);
    expect(r.verificacion).toEqual({ ok: true, activos: 72, problemas: [] });
    expect(t.texto()).toContain('[72/72] escrito prod-09-geisha-1000-molido');
    expect(t.texto()).toContain('Verificación sin sesión: OK. 72 productos activos, 9 variedades con 8 presentaciones cada una.');
  });

  it('repetirlo es idempotente: no hay nada que escribir y nada cambia', async () => {
    const antes = await productos();
    const t = terminalFalsa();
    const r = await ejecutarCargador(argsCatalogo('--escribir'), t.terminal);
    expect(r.codigo).toBe(0);
    expect(r.diferencias?.iguales).toHaveLength(72);
    expect(r.escritos).toEqual([]);
    expect(t.terminal.pedirLinea).not.toHaveBeenCalled();
    expect(t.texto()).toContain('Todo está al día: no hay nada que escribir.');
    expect(await productos()).toEqual(antes); // mismos datos y misma hora de actualización
  });

  it('un campo cambiado se detecta campo por campo y --escribir lo corrige', async () => {
    const [a, b] = [catalogo[0], catalogo[10]];
    await db().doc(`${COLLECTIONS.products}/${a.id}`).update({ description: 'Texto viejo', active: false });
    await db().doc(`${COLLECTIONS.products}/${b.id}`).update({ price: 5000 });

    const prueba = terminalFalsa();
    const r1 = await ejecutarCargador(argsCatalogo(), prueba.terminal);
    expect(r1.diferencias?.cambiar.map((c) => [c.producto.id, c.cambios.map((x) => x.campo)])).toEqual([
      [a.id, ['description', 'active']],
      [b.id, ['price']],
    ]);
    expect(prueba.texto()).toContain('description: "Texto viejo" -> ');
    expect(prueba.texto()).toContain('active: false -> true');
    expect(prueba.texto()).toContain('price: 5000 -> (no existe)');
    expect((await productos()).get(a.id)?.data.active).toBe(false); // la prueba no corrigió nada

    const r2 = await ejecutarCargador(argsCatalogo('--escribir'), terminalFalsa().terminal);
    expect(r2.codigo).toBe(0);
    expect(r2.escritos).toEqual([a.id, b.id]);
    const guardados = await productos();
    expect(guardados.get(a.id)?.data).toEqual(a.data);
    expect(guardados.get(b.id)?.data).toEqual(b.data);
  });

  it('los productos sobrantes solo se listan: nunca se borran', async () => {
    await db().doc(`${COLLECTIONS.products}/prueba-inactivo`).set({ name: 'Prueba', presentation: 'Bolsa', description: '', active: false });
    await db().doc(`${COLLECTIONS.products}/viejo-activo`).set({ name: 'Variedad retirada', presentation: 'Bolsa', description: '', active: true });

    const t = terminalFalsa();
    const r = await ejecutarCargador(argsCatalogo('--escribir'), t.terminal);
    expect(r.diferencias?.sobrantes.map((s) => s.id)).toEqual(['prueba-inactivo', 'viejo-activo']);
    expect(r.escritos).toEqual([]);
    expect(t.texto()).toContain('Sobran (están en Firestore y no en el catálogo; NO se borran): 2');
    const guardados = await productos();
    expect(guardados.size).toBe(74);
    expect(guardados.has('prueba-inactivo') && guardados.has('viejo-activo')).toBe(true);
    // El sobrante activo lo ve el sitio público: la verificación lo señala y el código de salida es 1.
    expect(r.verificacion?.ok).toBe(false);
    expect(r.verificacion?.problemas).toContain('Se esperaban 9 variedades y hay 10.');
    expect(r.codigo).toBe(1);

    await db().doc(`${COLLECTIONS.products}/prueba-inactivo`).delete();
    await db().doc(`${COLLECTIONS.products}/viejo-activo`).delete();
  });

  it('un projectId distinto al del archivo aborta antes de pedir la contraseña', async () => {
    const t = terminalFalsa();
    const argv = ['--project', 'demo-cani-otro', '--email', SEED_ADMIN.email, '--env', archivoEnv, '--emulador', '--escribir'];
    const r = await ejecutarCargador(argv, t.terminal);
    expect(r.codigo).toBe(1);
    expect(t.terminal.pedirOculto).not.toHaveBeenCalled();
    expect(t.texto()).toContain(`ABORTADO: El archivo de configuración es del proyecto "${PROJECT_ID}" y se pidió --project "demo-cani-otro".`);
  });

  it('un proyecto demo-* sin --emulador aborta antes de pedir la contraseña', async () => {
    const t = terminalFalsa();
    const r = await ejecutarCargador(['--project', PROJECT_ID, '--email', SEED_ADMIN.email, '--env', archivoEnv], t.terminal);
    expect(r.codigo).toBe(1);
    expect(t.terminal.pedirOculto).not.toHaveBeenCalled();
    expect(t.texto()).toMatch(/solo existe en los emuladores/);
  });

  it('una contraseña incorrecta aborta sin leer ni escribir', async () => {
    const t = terminalFalsa({ contrasena: 'incorrecta-123' });
    const r = await ejecutarCargador(argsCatalogo('--escribir'), t.terminal);
    expect(r.codigo).toBe(1);
    expect(r.diferencias).toBeUndefined();
    expect(t.texto()).toContain('ABORTADO: No se pudo iniciar sesión: Correo o contraseña incorrectos.');
    expect(t.texto()).not.toContain('incorrecta-123');
  });
});

describe('script B: nombre visible de la cuenta', () => {
  const displayName = async () => (await getAuth(admin).getUser(SEED_ADMIN.uid)).displayName ?? null;

  beforeAll(async () => {
    await getAuth(admin).updateUser(SEED_ADMIN.uid, { displayName: null });
  });

  it('modo prueba: informa el cambio sin hacerlo; users y usernames correctos', async () => {
    const t = terminalFalsa();
    const r = await ejecutarNombreVisible(argsCuenta(), t.terminal);
    expect(r).toMatchObject({ codigo: 0, antes: null, cambiado: false, diferencias: [] });
    expect(t.texto()).toContain('displayName actual: (vacío) -> deseado: "admin"');
    expect(t.texto()).toContain('Modo prueba: no se cambió nada.');
    expect(await displayName()).toBeNull();
  });

  it('--escribir: pone displayName = usuario', async () => {
    const t = terminalFalsa();
    const r = await ejecutarNombreVisible(argsCuenta('--escribir'), t.terminal);
    expect(r).toMatchObject({ codigo: 0, cambiado: true, despues: 'admin' });
    expect(t.terminal.pedirLinea).toHaveBeenCalledOnce();
    expect(await displayName()).toBe('admin');
    expect(t.texto()).toContain('El correo de recuperación dirá "Hola, admin:".');

    const otraVez = await ejecutarNombreVisible(argsCuenta('--escribir'), terminalFalsa().terminal);
    expect(otraVez.cambiado).toBe(false);
  });

  it('detecta diferencias en usernames y users y no las corrige', async () => {
    await db().doc(`${COLLECTIONS.usernames}/${SEED_ADMIN.username}`).update({ email: 'otro@example.com' });
    await db().doc(`${COLLECTIONS.users}/${SEED_ADMIN.uid}`).update({ username: 'otro' });
    const t = terminalFalsa();
    const r = await ejecutarNombreVisible(argsCuenta(), t.terminal);
    expect(r.diferencias).toEqual([
      `users/${SEED_ADMIN.uid}: username es "otro" (se esperaba "admin").`,
      `usernames/admin: email es "otro@example.com" (la cuenta es "${SEED_ADMIN.email}").`,
    ]);
    expect(t.texto()).toContain('NO se corrigen');
    expect((await db().doc(`${COLLECTIONS.usernames}/admin`).get()).get('email')).toBe('otro@example.com');
    expect((await db().doc(`${COLLECTIONS.users}/${SEED_ADMIN.uid}`).get()).get('username')).toBe('otro');
  });

  it('con users inactivo informa que no se pudo leer (las reglas lo niegan)', async () => {
    await db().doc(`${COLLECTIONS.users}/${SEED_ADMIN.uid}`).update({ active: false, username: FieldValue.delete() });
    const r = await ejecutarNombreVisible(argsCuenta(), terminalFalsa().terminal);
    expect(r.diferencias[0]).toMatch(new RegExp(`^users/${SEED_ADMIN.uid}: no se pudo leer`));
    await db().doc(`${COLLECTIONS.users}/${SEED_ADMIN.uid}`).update({ active: true, username: SEED_ADMIN.username });
  });
});
