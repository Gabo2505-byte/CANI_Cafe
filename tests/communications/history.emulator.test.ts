// HU-213 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { countCommunicationsIn, listCommunicationsPageIn } from '../../src/communications/communicationsRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-history';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;
let db: Firestore;

/** 00:00 del día en Costa Rica + minutos de registro. */
const day = (d: number) => Timestamp.fromDate(new Date(Date.UTC(2026, 8, d, 6)));
const at = (d: number, minutes: number) => Timestamp.fromDate(new Date(Date.UTC(2026, 8, d, 15, minutes)));

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    await setDoc(doc(fs, COLLECTIONS.users, 'admin-activo'), { username: 'admin', email: 'admin@example.com', active: true });
    await setDoc(doc(fs, COLLECTIONS.contacts, 'ana'), { fullName: 'Ana' });
    // 23 comunicaciones de Ana: días 1 a 22 y dos el día 22 (la registrada después va primero).
    const base = { contactId: 'ana', saleId: null, appliesToAllSales: true, medium: 'llamada', otherMedium: null };
    for (let d = 1; d <= 22; d += 1) {
      await setDoc(doc(fs, COLLECTIONS.communications, `ana-${d}`), {
        ...base, date: day(d), note: `día ${d}`, source: 'usuario', userId: 'admin-activo', createdAt: at(d, 0),
      });
    }
    await setDoc(doc(fs, COLLECTIONS.communications, 'ana-web'), {
      ...base, date: day(22), note: 'día 22 web', source: 'formulario_web', userId: null, createdAt: at(22, 30),
    });
    await setDoc(doc(fs, COLLECTIONS.communications, 'otro-1'), {
      ...base, contactId: 'otro', date: day(25), note: 'de otro', source: 'usuario', userId: 'admin-activo', createdAt: at(25, 0),
    });
  });
  db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('HU-213 historial paginado desde Firestore', () => {
  it('cuenta solo las del contacto', async () => {
    expect(await countCommunicationsIn(db, 'ana')).toBe(23);
  });

  it('páginas de 10, de la más reciente a la más antigua, hasta que no hay más', async () => {
    const p1 = await listCommunicationsPageIn(db, 'ana', null);
    expect(p1.communications.map((c) => c.note).slice(0, 3)).toEqual(['día 22 web', 'día 22', 'día 21']);
    expect(p1.communications).toHaveLength(10);
    expect(p1.nextCursor).not.toBeNull();
    expect(p1.userNames).toEqual({ 'admin-activo': 'admin' });

    const p2 = await listCommunicationsPageIn(db, 'ana', p1.nextCursor);
    expect(p2.communications.map((c) => c.note)[0]).toBe('día 13');
    expect(p2.communications).toHaveLength(10);

    const p3 = await listCommunicationsPageIn(db, 'ana', p2.nextCursor);
    expect(p3.communications.map((c) => c.note)).toEqual(['día 3', 'día 2', 'día 1']);
    expect(p3.nextCursor).toBeNull();
  });

  it('desde la app no se puede registrar como "formulario web"', async () => {
    await assertFails(
      setDoc(doc(db, COLLECTIONS.communications, 'falsa-web'), {
        contactId: 'ana', saleId: null, appliesToAllSales: true, date: day(1), medium: 'llamada', otherMedium: null,
        note: 'x', source: 'formulario_web', userId: 'admin-activo', createdAt: serverTimestamp(),
      }),
    );
  });
});
