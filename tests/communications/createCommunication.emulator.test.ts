// HU-211 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { communicationDayToDate } from '../../src/communications/communicationForm';
import { createCommunicationIn } from '../../src/communications/communicationsRepository';
import { loadContactRecordsIn } from '../../src/contacts/contactDetailRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';
import { toCostaRicaDateKey } from '../../src/shared/utils/dates';

const PROJECT_ID = 'demo-cani-crm-communications';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;
let db: Firestore;

const today = () => communicationDayToDate(toCostaRicaDateKey(new Date()));

/** Documento válido escrito "a mano" (para probar las reglas campo por campo). */
const valid = (overrides: Record<string, unknown> = {}) => ({
  contactId: 'contact-001',
  saleId: null,
  appliesToAllSales: true, // HU-212: "Todas sus oportunidades de venta"
  date: Timestamp.fromDate(today()),
  medium: 'whatsapp',
  otherMedium: null,
  note: 'Preguntó por precios.',
  source: 'usuario',
  userId: 'admin-activo',
  createdAt: serverTimestamp(),
  ...overrides,
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    await setDoc(doc(fs, COLLECTIONS.users, 'admin-activo'), { username: 'admin', email: 'admin@example.com', active: true });
    await setDoc(doc(fs, COLLECTIONS.users, 'inactivo'), { username: 'x', email: 'x@example.com', active: false });
    await setDoc(doc(fs, COLLECTIONS.contacts, 'contact-001'), { fullName: 'Ana Prueba' });
  });
  db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('HU-211 registrar una comunicación', () => {
  it('se guarda con usuario, fecha de registro del servidor y aparece primero en el historial', async () => {
    const older = await createCommunicationIn(
      db,
      { contactId: 'contact-001', date: communicationDayToDate('2026-09-01'), medium: 'llamada', otherMedium: null, note: 'Primera.' },
      'admin-activo',
    );
    const id = await createCommunicationIn(
      db,
      { contactId: 'contact-001', date: today(), medium: 'otro', otherMedium: 'Instagram', note: 'Escribió por Instagram.' },
      'admin-activo',
    );
    const snap = await getDoc(doc(db, COLLECTIONS.communications, id));
    expect(snap.data()).toMatchObject({
      contactId: 'contact-001',
      saleId: null,
      appliesToAllSales: true,
      medium: 'otro',
      otherMedium: 'Instagram',
      note: 'Escribió por Instagram.',
      userId: 'admin-activo',
    });
    expect(snap.get('createdAt')).toBeInstanceOf(Timestamp);
    const records = await loadContactRecordsIn(db, 'contact-001');
    expect(records.communications.map((c) => c.id).slice(0, 2)).toEqual([id, older]);
  });

  it('no se puede editar ni eliminar', async () => {
    const id = await createCommunicationIn(
      db,
      { contactId: 'contact-001', date: today(), medium: 'correo', otherMedium: null, note: 'Envió la cotización.' },
      'admin-activo',
    );
    await assertFails(updateDoc(doc(db, COLLECTIONS.communications, id), { note: 'Cambiada' }));
    await assertFails(deleteDoc(doc(db, COLLECTIONS.communications, id)));
  });

  it('las reglas aceptan un documento válido', async () => {
    await assertSucceeds(setDoc(doc(db, COLLECTIONS.communications, 'manual-ok'), valid()));
  });

  it.each([
    ['fecha futura', { date: Timestamp.fromDate(new Date(Date.now() + 2 * 86_400_000)) }],
    ['medio fuera de la lista', { medium: 'reunion' }],
    ['"Otro" sin decir cuál', { medium: 'otro', otherMedium: '  ' }],
    ['texto de "Otro" con otro medio', { medium: 'llamada', otherMedium: 'Instagram' }],
    ['nota vacía', { note: '   ' }],
    ['nota de 1001 caracteres', { note: 'a'.repeat(1001) }],
    ['registrada a nombre de otro usuario', { userId: 'otro-usuario' }],
    ['contacto inexistente', { contactId: 'no-existe' }],
    ['fecha de registro puesta por el cliente', { createdAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')) }],
    ['campos de más', { extra: true }],
  ])('rechaza: %s', async (_caso, overrides) => {
    await assertFails(setDoc(doc(db, COLLECTIONS.communications, `manual-${Math.random()}`), valid(overrides)));
  });

  it('acepta una nota de exactamente 1000 caracteres', async () => {
    await assertSucceeds(setDoc(doc(db, COLLECTIONS.communications, 'manual-1000'), valid({ note: 'a'.repeat(1000) })));
  });

  it('un usuario inactivo o sin sesión no puede registrar ni leer', async () => {
    const inactive = testEnv.authenticatedContext('inactivo').firestore();
    await assertFails(setDoc(doc(inactive, COLLECTIONS.communications, 'x1'), valid({ userId: 'inactivo' })));
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, COLLECTIONS.communications, 'manual-ok')));
  });
});
