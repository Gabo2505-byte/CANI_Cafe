// HU-302 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listActiveContactsIn } from '../../src/sales/contactSearchRepository';
import { searchContacts } from '../../src/sales/contactSearch';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-sales-contacts';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;

const base = { email: null, phoneCountry: null, phoneNumber: null, address: null, classification: 'persona_interesada', origin: null };

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, COLLECTIONS.users, 'admin-activo'), { username: 'admin', email: 'a@example.com', active: true });
    await setDoc(doc(db, COLLECTIONS.contacts, 'c-1'), { ...base, fullName: 'Ana Activa', nameSortKey: 'ana activa', status: 'activo' });
    await setDoc(doc(db, COLLECTIONS.contacts, 'c-2'), { ...base, fullName: 'Iván Inactivo', nameSortKey: 'ivan inactivo', status: 'inactivo' });
    await setDoc(doc(db, COLLECTIONS.contacts, 'c-3'), { ...base, fullName: 'Óscar Activo', nameSortKey: 'oscar activo', status: 'activo', email: 'oscar@example.com' });
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('contactos activos para elegir (HU-302)', () => {
  it('trae solo los activos, con su id, y la búsqueda los encuentra sin tildes', async () => {
    const db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
    const contacts = await listActiveContactsIn(db);
    expect(contacts.map((c) => c.id).sort()).toEqual(['c-1', 'c-3']);
    expect(searchContacts(contacts, 'oscar').map((c) => c.id)).toEqual(['c-3']);
    expect(searchContacts(contacts, 'ivan')).toEqual([]);
  });

  it('sin sesión no se puede leer', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(listActiveContactsIn(db));
  });
});
