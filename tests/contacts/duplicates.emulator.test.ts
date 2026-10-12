// HU-203 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createContactIn, findDuplicateContactsIn } from '../../src/contacts/contactsRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-duplicates';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;
let db: Firestore;
let anaId: string;
let brunoId: string;

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
  anaId = await createContactIn(db, {
    fullName: 'Ana Prueba',
    email: 'ana.prueba@example.com',
    phoneCountry: null,
    phoneNumber: null,
    address: null,
  });
  brunoId = await createContactIn(db, {
    fullName: 'Bruno Prueba',
    email: null,
    phoneCountry: 'CR',
    phoneNumber: '00000002',
    address: null,
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('HU-203 repetidos en Firestore (usuario activo, reglas reales)', () => {
  it('detecta el correo repetido y devuelve el id del contacto existente', async () => {
    expect(
      await findDuplicateContactsIn(db, { email: 'ana.prueba@example.com', phoneCountry: null, phoneNumber: null }),
    ).toEqual({ email: anaId });
  });

  it('detecta el teléfono repetido con el mismo país y número', async () => {
    expect(
      await findDuplicateContactsIn(db, { email: null, phoneCountry: 'CR', phoneNumber: '00000002' }),
    ).toEqual({ phone: brunoId });
  });

  it('el mismo número en otro país NO es repetido', async () => {
    expect(
      await findDuplicateContactsIn(db, { email: null, phoneCountry: 'NI', phoneNumber: '00000002' }),
    ).toEqual({});
  });

  it('datos nuevos no son repetidos', async () => {
    expect(
      await findDuplicateContactsIn(db, {
        email: 'otra@example.com',
        phoneCountry: 'CR',
        phoneNumber: '00000099',
      }),
    ).toEqual({});
  });

  it('al editar, el propio contacto no cuenta como repetido (excludeId)', async () => {
    expect(
      await findDuplicateContactsIn(db, { email: 'ana.prueba@example.com', phoneCountry: null, phoneNumber: null }, anaId),
    ).toEqual({});
  });
});
