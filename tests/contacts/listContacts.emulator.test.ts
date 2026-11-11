// HU-204, HU-205 y HU-504 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { badgedFirst, filterContacts } from '../../src/contacts/contactSearch';
import {
  clearFormBadgeIn,
  createContactIn,
  listAllContactsIn,
  listenFormBadgeCountIn,
} from '../../src/contacts/contactsRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-list';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;
let db: Firestore;

// Nombres ficticios con mayúsculas/minúsculas y tildes mezcladas, en desorden.
const SPECIAL = ['Zoe Prueba', 'ana Prueba', 'Álvaro Prueba', 'Bruno Prueba', 'Óscar Prueba'];
const FILLER = Array.from({ length: 20 }, (_, i) => `Mario Relleno ${String(i + 1).padStart(2, '0')}`);
const ids: Record<string, string> = {};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), COLLECTIONS.users, 'admin-activo'), {
      username: 'admin',
      email: 'admin@example.com',
      active: true,
    });
  });
  db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
  for (const fullName of [...SPECIAL, ...FILLER]) {
    ids[fullName] = await createContactIn(db, { fullName, email: null, phoneCountry: 'CR', phoneNumber: '88880000', address: null });
  }
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('HU-204 lista ordenada desde Firestore', () => {
  it('trae todos los contactos en orden alfabético (sin importar tildes ni mayúsculas)', async () => {
    const all = await listAllContactsIn(db);
    expect(all).toHaveLength(25);
    expect(all.slice(0, 4).map((c) => c.fullName)).toEqual(['Álvaro Prueba', 'ana Prueba', 'Bruno Prueba', 'Mario Relleno 01']);
    expect(all.slice(-5).map((c) => c.fullName)).toEqual([
      'Mario Relleno 18',
      'Mario Relleno 19',
      'Mario Relleno 20',
      'Óscar Prueba',
      'Zoe Prueba',
    ]);
  });

  it('sin sesión no se puede listar', async () => {
    const anon = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await expect(listAllContactsIn(anon)).rejects.toMatchObject({ code: 'permission-denied' });
  });
});

describe('HU-205 búsqueda y filtro sobre la lista completa', () => {
  it('trae también los inactivos; la búsqueda y el filtro funcionan sobre esos datos', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), COLLECTIONS.contacts, 'inactivo-hu205'), {
        fullName: 'Inactivo Prueba',
        nameSortKey: 'inactivo prueba',
        email: null,
        phoneCountry: null,
        phoneNumber: null,
        address: null,
        classification: 'cliente',
        status: 'inactivo',
        origin: null,
        createdAt: null,
      });
    });
    const all = await listAllContactsIn(db);
    expect(all).toHaveLength(26);
    expect(all.map((c) => c.fullName).slice(0, 4)).toEqual(['Álvaro Prueba', 'ana Prueba', 'Bruno Prueba', 'Inactivo Prueba']);
    expect(filterContacts(all, 'mario relleno 2', 'todos').map((c) => c.fullName)).toEqual(['Mario Relleno 20']);
    expect(filterContacts(all, 'prueba', 'cliente').map((c) => c.id)).toEqual(['inactivo-hu205']);
    expect(filterContacts(all, 'oscar', 'persona_interesada').map((c) => c.fullName)).toEqual(['Óscar Prueba']);
  });
});

describe('HU-504 etiquetas del formulario', () => {
  it('el conteo de la barra cambia en vivo; con etiqueta van primero; al abrir la ficha se quita', async () => {
    const counts: number[] = [];
    const stop = listenFormBadgeCountIn(db, (n) => counts.push(n));
    await expect.poll(() => counts.at(-1)).toBe(0);

    // Lo que hace el procesamiento del formulario (HU-502 y HU-503).
    await updateDoc(doc(db, COLLECTIONS.contacts, ids['Zoe Prueba']), { formBadge: 'Nuevo' });
    await updateDoc(doc(db, COLLECTIONS.contacts, ids['Mario Relleno 10']), { formBadge: 'Nuevo mensaje' });
    await expect.poll(() => counts.at(-1)).toBe(2);

    const list = badgedFirst(await listAllContactsIn(db));
    expect(list.slice(0, 3).map((c) => [c.fullName, c.formBadge ?? null])).toEqual([
      ['Mario Relleno 10', 'Nuevo mensaje'],
      ['Zoe Prueba', 'Nuevo'],
      ['Álvaro Prueba', null],
    ]);

    await clearFormBadgeIn(db, ids['Zoe Prueba']);
    await expect.poll(() => counts.at(-1)).toBe(1);
    expect((await getDoc(doc(db, COLLECTIONS.contacts, ids['Zoe Prueba']))).data()?.formBadge).toBeNull();
    stop();
  });

  it('sin sesión no se puede contar ni quitar la etiqueta', async () => {
    const anon = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    const errors: unknown[] = [];
    const stop = listenFormBadgeCountIn(anon, () => {}, (e) => errors.push(e));
    await expect.poll(() => errors.length).toBe(1);
    stop();
    await expect(clearFormBadgeIn(anon, ids['Mario Relleno 10'])).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
