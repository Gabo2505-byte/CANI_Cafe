// HU-303 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listOpenSaleTitlesIn } from '../../src/sales/salesRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-sale-titles';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;

const SALES = [
  { id: 's-1', contactId: 'c-1', title: 'Abierta uno', stage: 'nuevo_interesado' },
  { id: 's-2', contactId: 'c-1', title: 'Abierta dos', stage: 'en_negociacion' },
  { id: 's-3', contactId: 'c-1', title: 'Ya ganada', stage: 'ganada' },
  { id: 's-4', contactId: 'c-1', title: 'Ya perdida', stage: 'perdida' },
  { id: 's-5', contactId: 'c-2', title: 'De otro contacto', stage: 'contactado' },
];

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, COLLECTIONS.users, 'admin-activo'), { username: 'admin', email: 'a@example.com', active: true });
    for (const { id, ...data } of SALES) await setDoc(doc(db, COLLECTIONS.sales, id), data);
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('títulos de oportunidades de venta abiertas (HU-303)', () => {
  it('trae solo los títulos de las abiertas de ese contacto', async () => {
    const db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
    expect((await listOpenSaleTitlesIn(db, 'c-1')).sort()).toEqual(['Abierta dos', 'Abierta uno']);
    expect(await listOpenSaleTitlesIn(db, 'c-2')).toEqual(['De otro contacto']);
    expect(await listOpenSaleTitlesIn(db, 'sin-ventas')).toEqual([]);
  });

  it('al editar se excluye la propia venta', async () => {
    const db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
    expect(await listOpenSaleTitlesIn(db, 'c-1', 's-1')).toEqual(['Abierta dos']);
  });

  it('sin sesión no se puede leer', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(listOpenSaleTitlesIn(db, 'c-1'));
  });
});
