// HU-204 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { countContactsIn, createContactIn, listContactsPageIn } from '../../src/contacts/contactsRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-list';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;
let db: Firestore;

// Nombres ficticios con mayúsculas/minúsculas y tildes mezcladas, en desorden.
const SPECIAL = ['Zoe Prueba', 'ana Prueba', 'Álvaro Prueba', 'Bruno Prueba', 'Óscar Prueba'];
const FILLER = Array.from({ length: 20 }, (_, i) => `Mario Relleno ${String(i + 1).padStart(2, '0')}`);

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
    await createContactIn(db, { fullName, email: null, phoneCountry: 'CR', phoneNumber: '88880000', address: null });
  }
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('HU-204 lista paginada y ordenada desde Firestore', () => {
  it('cuenta el total en el servidor', async () => {
    expect(await countContactsIn(db)).toBe(25);
  });

  it('página 1: 20 contactos en orden alfabético (sin importar tildes ni mayúsculas)', async () => {
    const page = await listContactsPageIn(db, null);
    expect(page.contacts).toHaveLength(20);
    expect(page.contacts.slice(0, 4).map((c) => c.fullName)).toEqual([
      'Álvaro Prueba',
      'ana Prueba',
      'Bruno Prueba',
      'Mario Relleno 01',
    ]);
    expect(page.nextCursor).not.toBeNull();
  });

  it('página 2: los 5 restantes, siguiendo el orden; no hay más páginas', async () => {
    const first = await listContactsPageIn(db, null);
    const second = await listContactsPageIn(db, first.nextCursor);
    expect(second.contacts.map((c) => c.fullName)).toEqual([
      'Mario Relleno 18',
      'Mario Relleno 19',
      'Mario Relleno 20',
      'Óscar Prueba',
      'Zoe Prueba',
    ]);
    expect(second.nextCursor).toBeNull();
  });

  it('sin sesión no se puede listar', async () => {
    const anon = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await expect(listContactsPageIn(anon, null)).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
