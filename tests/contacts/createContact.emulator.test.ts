// HU-201 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createContactIn, getContactIn } from '../../src/contacts/contactsRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-contacts';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;

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
});

afterAll(async () => {
  await testEnv?.cleanup();
});

const asFirestore = (db: unknown) => db as Firestore;

describe('HU-201 registrar contacto en Firestore', () => {
  it('un usuario activo registra el contacto con clasificación "persona_interesada", nulls y Timestamp', async () => {
    const db = asFirestore(testEnv.authenticatedContext('admin-activo').firestore());
    const id = await createContactIn(db, {
      fullName: 'Contacto Prueba',
      email: null,
      phoneCountry: 'CR',
      phoneNumber: '00000099',
      address: null,
    });

    const raw = (await getDoc(doc(db, COLLECTIONS.contacts, id))).data()!;
    expect(raw).toMatchObject({
      fullName: 'Contacto Prueba',
      email: null,
      phoneCountry: 'CR',
      phoneNumber: '00000099',
      address: null,
      classification: 'persona_interesada',
      status: 'activo',
      origin: null,
    });
    // Los null se guardan explícitos (el campo existe), no se omiten.
    expect(Object.keys(raw)).toEqual(expect.arrayContaining(['email', 'address', 'origin']));
    expect(raw.createdAt).toBeInstanceOf(Timestamp);

    const contact = await getContactIn(db, id);
    expect(contact?.id).toBe(id);
  });

  it('sin sesión no se puede registrar un contacto', async () => {
    const db = asFirestore(testEnv.unauthenticatedContext().firestore());
    await expect(
      createContactIn(db, { fullName: 'X', email: 'x@example.com', phoneCountry: null, phoneNumber: null, address: null }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
