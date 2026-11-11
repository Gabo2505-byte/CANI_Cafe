// HU-210 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findDuplicateContactsIn, updateContactIn } from '../../src/contacts/contactsRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-edit';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;
let db: Firestore;

const createdAt = Timestamp.fromDate(new Date('2026-09-03T16:30:00Z'));
const interestsUpdatedAt = Timestamp.fromDate(new Date('2026-10-05T18:20:00Z'));

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    await setDoc(doc(fs, COLLECTIONS.users, 'admin-activo'), { username: 'admin', email: 'admin@example.com', active: true });
    await setDoc(doc(fs, COLLECTIONS.contacts, 'bruno'), {
      fullName: 'Bruno Ficticio Solís',
      nameSortKey: 'bruno ficticio solis',
      email: 'bruno@example.com',
      phoneCountry: 'CR',
      phoneNumber: '00000002',
      address: 'Heredia',
      classification: 'cliente',
      status: 'activo',
      origin: 'referido',
      createdAt,
      interests: [{ productId: 'p1', quantity: 3 }],
      interestsUpdatedAt,
    });
    await setDoc(doc(fs, COLLECTIONS.contacts, 'ana'), {
      fullName: 'Ana Prueba',
      nameSortKey: 'ana prueba',
      email: 'ana@example.com',
      phoneCountry: 'CR',
      phoneNumber: '00000001',
      address: null,
      classification: 'persona_interesada',
      status: 'activo',
      origin: null,
      createdAt,
    });
  });
  db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('HU-210 editar un contacto en Firestore', () => {
  it('guarda nombre, correo, teléfono con país y dirección, y recalcula nameSortKey; lo demás no cambia', async () => {
    await updateContactIn(db, 'bruno', {
      fullName: 'Álvaro Bruno Solís',
      email: 'bruno.nuevo@example.com',
      phoneCountry: 'US',
      phoneNumber: '3055550199',
      address: null,
    });
    const saved = (await getDoc(doc(db, COLLECTIONS.contacts, 'bruno'))).data()!;
    expect(saved).toMatchObject({
      fullName: 'Álvaro Bruno Solís',
      nameSortKey: 'alvaro bruno solis',
      email: 'bruno.nuevo@example.com',
      phoneCountry: 'US',
      phoneNumber: '3055550199',
      address: null,
      // Criterio 2: no se cambian la clasificación, el origen ni la fecha de registro.
      classification: 'cliente',
      origin: 'referido',
      status: 'activo',
      interests: [{ productId: 'p1', quantity: 3 }],
    });
    expect(saved.createdAt.toMillis()).toBe(createdAt.toMillis());
    expect(saved.interestsUpdatedAt.toMillis()).toBe(interestsUpdatedAt.toMillis());
  });

  it('criterio 4: el correo o el teléfono de OTRO contacto cuenta como repetido; los propios no', async () => {
    const mine = { email: 'bruno.nuevo@example.com', phoneCountry: 'US', phoneNumber: '3055550199' };
    expect(await findDuplicateContactsIn(db, mine, 'bruno')).toEqual({});
    expect(await findDuplicateContactsIn(db, { ...mine, email: 'ana@example.com' }, 'bruno')).toEqual({ email: 'ana' });
    expect(
      await findDuplicateContactsIn(db, { ...mine, phoneCountry: 'CR', phoneNumber: '00000001' }, 'bruno'),
    ).toEqual({ phone: 'ana' });
  });

  it('sin sesión no se puede editar', async () => {
    const anon = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(
      updateContactIn(anon, 'ana', { fullName: 'X', email: null, phoneCountry: 'CR', phoneNumber: '00000009', address: null }),
    );
  });
});
