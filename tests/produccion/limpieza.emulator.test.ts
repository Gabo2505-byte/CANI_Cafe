// Limpieza de datos de prueba (RT-01, scripts/produccion/limpieza.ts) contra el emulador de Firestore. Corre con:
// npm run test:emulators. Arma 18 contactos de la carga inicial, un contacto real con sus ventas y comunicaciones, y dos
// contactos "PRUEBA" con todo lo que cuelga de ellos. Comprueba que solo se borra lo de prueba, que lo real queda igual
// documento por documento y que no quedan huérfanos.
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Terminal } from '../../scripts/produccion/comun';
import { ejecutarLimpieza } from '../../scripts/produccion/limpieza';
import { COLLECTIONS } from '../../src/shared/constants/collections';
import { FORM_REQUESTS_COLLECTION } from '../../src/shared/types/formRequest';

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID!;
const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const AHORA = new Date('2026-11-16T15:00:00Z');
const TODAS = [
  COLLECTIONS.contacts,
  COLLECTIONS.sales,
  COLLECTIONS.saleProducts,
  COLLECTIONS.stageHistory,
  COLLECTIONS.communications,
  FORM_REQUESTS_COLLECTION,
];

/** Lo que el script debe borrar (por ruta) con los datos de armarDatos. */
const ESPERADOS_BORRADOS = [
  'contacts/p-1',
  'contacts/p-2',
  'sales/v-p1a',
  'sales/v-p1b',
  'saleProducts/v-p1a_prod-1',
  'saleProducts/v-p1a_prod-2',
  'saleProducts/v-p1b_prod-1',
  'stageHistory/h-p1a-1',
  'stageHistory/h-p1b-1',
  'stageHistory/h-p1b-2',
  'communications/c-p1-todas',
  'communications/c-p1-venta',
  'communications/c-p2',
  'formRequests/fr-p1',
  'formRequests/fr-suelta',
  'formRequests/fr-prueba-vinculada',
].sort();

let admin: App;
let carpeta: string;
let archivoEnv: string;
const db = () => getFirestore(admin);
const fecha = (iso: string) => Timestamp.fromDate(new Date(iso));

function contacto(fullName: string, origin: string | null): DocumentData {
  return {
    fullName,
    nameSortKey: fullName.toLowerCase(),
    email: null,
    phoneCountry: 'CR',
    phoneNumber: '88880000',
    address: null,
    classification: 'persona_interesada',
    status: 'activo',
    origin,
    createdAt: fecha('2026-10-01T12:00:00Z'),
  };
}

function venta(contactId: string, stage: string): DocumentData {
  return {
    contactId,
    title: `Venta de ${contactId}`,
    stage,
    estimatedAmount: 10000,
    nextFollowUpAt: fecha('2026-11-01T06:00:00Z'),
    notes: '',
    createdAt: fecha('2026-10-01T12:00:00Z'),
    stageChangedAt: fecha('2026-10-01T12:00:00Z'),
    lastCommunicationAt: null,
  };
}

function comunicacion(contactId: string, saleId: string | null): DocumentData {
  return {
    contactId,
    saleId,
    appliesToAllSales: saleId === null,
    date: fecha('2026-10-02T06:00:00Z'),
    medium: 'llamada',
    otherMedium: null,
    note: 'Nota',
    source: 'usuario',
    userId: 'admin',
    createdAt: fecha('2026-10-02T12:00:00Z'),
  };
}

function solicitud(fullName: string, contactId: string | null): DocumentData {
  const base = {
    fullName,
    email: null,
    phoneCountry: 'CR',
    phoneNumber: '88880000',
    interests: [{ productId: 'prod-1', quantity: 1 }],
    message: null,
    submittedAt: fecha('2026-10-03T12:00:00Z'),
    processed: contactId !== null,
  };
  return contactId ? { ...base, contactId, outcome: 'updated', processedAt: fecha('2026-10-03T12:01:00Z') } : base;
}

const historial = (saleId: string, newStage: string) => ({
  saleId,
  previousStage: null,
  newStage,
  changedAt: fecha('2026-10-01T12:00:00Z'),
  lossReason: null,
});

async function armarDatos() {
  await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
  const lote = db().batch();
  const set = (ruta: string, datos: DocumentData) => lote.set(db().doc(ruta), datos);

  // 18 de la carga inicial; uno tiene "Prueba" en el nombre, pero no al inicio.
  for (let i = 1; i <= 18; i++) {
    set(`contacts/ci-${String(i).padStart(2, '0')}`, contacto(i === 1 ? 'Ana Prueba Real' : `Real ${i}`, 'carga_inicial'));
  }
  // Contacto real con ventas, comunicaciones y una solicitud procesada.
  set('contacts/real', contacto('Mario Formulario', 'formulario_web'));
  set('sales/v-real', venta('real', 'contactado'));
  set('saleProducts/v-real_prod-1', { saleId: 'v-real', productId: 'prod-1', quantity: 2 });
  set('stageHistory/h-real', historial('v-real', 'contactado'));
  set('communications/c-real', comunicacion('real', 'v-real'));
  set('formRequests/fr-real', solicitud('Mario Formulario', 'real'));
  set('formRequests/fr-pendiente', solicitud('Laura Pendiente', null));

  // PRUEBA Uno: dos ventas (una abierta con aviso de seguimiento y de falta de comunicación, una ganada).
  set('contacts/p-1', contacto('PRUEBA Uno', 'formulario_web'));
  set('sales/v-p1a', venta('p-1', 'contactado'));
  set('sales/v-p1b', venta('p-1', 'ganada'));
  set('saleProducts/v-p1a_prod-1', { saleId: 'v-p1a', productId: 'prod-1', quantity: 1 });
  set('saleProducts/v-p1a_prod-2', { saleId: 'v-p1a', productId: 'prod-2', quantity: 3 });
  set('saleProducts/v-p1b_prod-1', { saleId: 'v-p1b', productId: 'prod-1', quantity: 1 });
  set('stageHistory/h-p1a-1', historial('v-p1a', 'contactado'));
  set('stageHistory/h-p1b-1', historial('v-p1b', 'contactado'));
  set('stageHistory/h-p1b-2', historial('v-p1b', 'ganada'));
  set('communications/c-p1-todas', comunicacion('p-1', null));
  set('communications/c-p1-venta', comunicacion('p-1', 'v-p1a'));
  set('formRequests/fr-p1', solicitud('PRUEBA Uno', 'p-1'));

  // prueba dos: sin ventas, una comunicación.
  set('contacts/p-2', contacto('prueba dos', null));
  set('communications/c-p2', comunicacion('p-2', null));

  // Solicitudes "PRUEBA" que no cuelgan de un contacto seleccionado: una pendiente y otra que se unió al contacto real.
  set('formRequests/fr-suelta', solicitud('Prueba Sitio', null));
  set('formRequests/fr-prueba-vinculada', solicitud('PRUEBA vinculada', 'real'));
  await lote.commit();
}

/** Todos los documentos de las colecciones del dominio, por ruta. */
async function foto(): Promise<Map<string, string>> {
  const resultado = new Map<string, string>();
  for (const col of TODAS) {
    for (const d of (await db().collection(col).get()).docs) resultado.set(d.ref.path, JSON.stringify(d.data()));
  }
  return resultado;
}

function terminalFalsa(confirmacion = PROJECT_ID) {
  const salida: string[] = [];
  const terminal: Terminal = {
    log: (m) => salida.push(m),
    error: (m) => salida.push(m),
    pedirOculto: vi.fn(async () => ''),
    pedirLinea: vi.fn(async () => confirmacion),
    entorno: process.env,
  };
  return { terminal, texto: () => salida.join('\n') };
}

const args = (...extra: string[]) => ['--project', PROJECT_ID, '--env', archivoEnv, '--emulador', ...extra];
const correr = (t: Terminal, ...extra: string[]) => ejecutarLimpieza(args(...extra), t, { ahora: AHORA });

beforeAll(() => {
  admin = initializeApp({ projectId: PROJECT_ID }, 'limpieza-test');
  carpeta = mkdtempSync(join(tmpdir(), 'cani-limpieza-'));
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

beforeEach(armarDatos);

afterAll(async () => {
  rmSync(carpeta, { recursive: true, force: true });
  await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
  await deleteApp(admin);
});

describe('limpieza de datos de prueba', () => {
  it('modo prueba: lista cada contacto con sus conteos por colección y no borra nada', async () => {
    const antes = await foto();
    const t = terminalFalsa();
    const r = await correr(t.terminal);
    expect(r.codigo).toBe(0);
    expect(r.borrados).toBe(0);
    expect(t.terminal.pedirLinea).not.toHaveBeenCalled();
    expect(await foto()).toEqual(antes);

    expect(r.plan?.contactos.map((c) => c.id).sort()).toEqual(['p-1', 'p-2']);
    expect(t.texto()).toContain('Contactos con origen "carga_inicial": 18 (se esperan 18; no se tocan)');
    expect(t.texto()).toContain('Se borrarían: 2 contactos con nombre PRUEBA');
    expect(t.texto()).toContain('  PRUEBA Uno (p-1)');
    expect(t.texto()).toContain(
      '    sales 2 | saleProducts 3 | stageHistory 3 | communications 2 | formRequests 1 | avisos 2 (calculados, no se guardan)',
    );
    expect(t.texto()).toContain('  prueba dos (p-2)');
    expect(t.texto()).toContain(
      '    sales 0 | saleProducts 0 | stageHistory 0 | communications 1 | formRequests 0 | avisos 0 (calculados, no se guardan)',
    );
    expect(t.texto()).toContain('2 formRequests con nombre PRUEBA sin contacto seleccionado');
    expect(t.texto()).toContain('  Prueba Sitio (fr-suelta, sin contacto)');
    expect(t.texto()).toContain('  PRUEBA vinculada (fr-prueba-vinculada, vinculada al contacto real, que NO se borra)');
    expect(t.texto()).toContain('Total: contacts 2 | sales 2 | saleProducts 3 | stageHistory 3 | communications 3 | formRequests 3');
    expect(t.texto()).toContain('Modo prueba: no se borró nada. Para borrar 16 documentos, repita con --borrar.');
    expect(t.texto()).not.toContain('Ana Prueba Real (');
  });

  it('confirmación distinta al projectId: no borra nada', async () => {
    const antes = await foto();
    const t = terminalFalsa('cani-cafe');
    const r = await correr(t.terminal, '--borrar');
    expect(r.codigo).toBe(1);
    expect(t.texto()).toContain('ABORTADO: La confirmación no coincide con el projectId. No se borró nada.');
    expect(await foto()).toEqual(antes);
  });

  it('aborta sin borrar si un contacto "PRUEBA" tiene origen carga_inicial', async () => {
    await db().doc('contacts/ci-prueba').set(contacto('PRUEBA Real', 'carga_inicial'));
    const antes = await foto();
    const t = terminalFalsa();
    const r = await correr(t.terminal, '--borrar');
    expect(r.codigo).toBe(1);
    expect(t.texto()).toContain('ABORTADO: Hay contactos seleccionados con origen "carga_inicial": PRUEBA Real (ci-prueba).');
    expect(t.terminal.pedirLinea).not.toHaveBeenCalled();
    expect(await foto()).toEqual(antes);
  });

  it('aborta sin borrar si se seleccionan más de 10 contactos', async () => {
    for (let i = 3; i <= 11; i++) await db().doc(`contacts/p-${i}`).set(contacto(`PRUEBA ${i}`, null));
    const antes = await foto();
    const t = terminalFalsa();
    const r = await correr(t.terminal, '--borrar');
    expect(r.codigo).toBe(1);
    expect(t.texto()).toContain('ABORTADO: Se seleccionaron 11 contactos y el máximo es 10. No se hizo nada.');
    expect(await foto()).toEqual(antes);
  });

  it('aborta sin borrar si no hay 18 contactos de la carga inicial', async () => {
    await db().doc('contacts/ci-18').delete();
    const antes = await foto();
    const t = terminalFalsa();
    const r = await correr(t.terminal, '--borrar');
    expect(r.codigo).toBe(1);
    expect(t.texto()).toContain('Hay 17 contactos con origen "carga_inicial" y se esperan 18.');
    expect(t.terminal.pedirLinea).not.toHaveBeenCalled();
    expect(await foto()).toEqual(antes);
  });

  it('--borrar: borra solo lo de prueba, deja lo real igual, no deja huérfanos y verifica 18 y 0', async () => {
    const antes = await foto();
    const t = terminalFalsa();
    const r = await correr(t.terminal, '--borrar');
    expect(r.codigo).toBe(0);
    expect(t.terminal.pedirLinea).toHaveBeenCalledOnce();
    expect(r.borrados).toBe(16);

    const despues = await foto();
    const borrados = [...antes.keys()].filter((ruta) => !despues.has(ruta)).sort();
    expect(borrados).toEqual(ESPERADOS_BORRADOS);
    // Todo lo demás (carga inicial, contacto real, sus ventas, comunicaciones y solicitudes) queda idéntico.
    for (const [ruta, datos] of despues) expect(antes.get(ruta)).toBe(datos);
    expect(despues.size).toBe(antes.size - ESPERADOS_BORRADOS.length);

    // Sin huérfanos: cada referencia apunta a un documento que existe.
    const existe = (col: string, id: string) => despues.has(`${col}/${id}`);
    for (const [ruta, json] of despues) {
      const d = JSON.parse(json) as DocumentData;
      if (ruta.startsWith('sales/') || ruta.startsWith('communications/')) expect(existe('contacts', d.contactId)).toBe(true);
      if (ruta.startsWith('saleProducts/') || ruta.startsWith('stageHistory/')) expect(existe('sales', d.saleId)).toBe(true);
      if (ruta.startsWith('communications/') && d.saleId) expect(existe('sales', d.saleId)).toBe(true);
      if (ruta.startsWith('formRequests/') && d.contactId) expect(existe('contacts', d.contactId)).toBe(true);
    }

    expect(t.texto()).toContain('Borrado terminado: 16 documentos borrados.');
    expect(t.texto()).toContain('[OK] Contactos con origen "carga_inicial": 18 (se esperan 18)');
    expect(t.texto()).toContain('[OK] Contactos con nombre PRUEBA: 0 (se espera 0)');
    expect(t.texto()).toContain('[OK] formRequests con nombre PRUEBA: 0 (se espera 0)');
    expect(t.texto()).toContain('[OK] Documentos que apuntan a un contacto o venta borrados: 0 (se espera 0)');
    expect(r.comprobaciones?.every((c) => c.ok)).toBe(true);

    // Una segunda corrida no encuentra nada y vuelve a verificar.
    const t2 = terminalFalsa();
    const r2 = await correr(t2.terminal, '--borrar');
    expect(r2.codigo).toBe(0);
    expect(r2.borrados).toBe(0);
    expect(t2.terminal.pedirLinea).not.toHaveBeenCalled();
    expect(t2.texto()).toContain('No hay datos de prueba que borrar.');
    expect(t2.texto()).toContain('[OK] Contactos con nombre PRUEBA: 0 (se espera 0)');
    expect(await foto()).toEqual(despues);
  });
});
