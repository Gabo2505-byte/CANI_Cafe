// Corre con: npm run test:emulators (usa el proyecto de .env.test, separado del de desarrollo)
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertEmulatorTarget, runSeed } from '../../scripts/seed/runSeed';
import { COLLECTIONS } from '../../src/shared/constants/collections';
import { SALE_STAGES } from '../../src/shared/types';

const projectId = process.env.VITE_FIREBASE_PROJECT_ID!;
const adminPassword = process.env.SEED_ADMIN_PASSWORD!;
let app: App;

async function resetEmulators() {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  await fetch(`http://${firestoreHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`, {
    method: 'DELETE',
  });
  await fetch(`http://${authHost}/emulator/v1/projects/${projectId}/accounts`, { method: 'DELETE' });
}

beforeAll(async () => {
  app = initializeApp({ projectId }, 'seed-test');
  await resetEmulators();
});

afterAll(async () => {
  await deleteApp(app);
});

describe('seed', () => {
  it('se niega a correr fuera de un proyecto demo-*', () => {
    expect(() => assertEmulatorTarget('cani-crm-produccion')).toThrow(/demo-/);
  });

  it('es idempotente: correrlo dos veces no duplica datos', async () => {
    await runSeed(app, { adminPassword });
    await runSeed(app, { adminPassword });

    const db = getFirestore(app);
    const count = async (name: string) => (await db.collection(name).count().get()).data().count;

    expect(await count(COLLECTIONS.users)).toBe(1);
    expect(await count(COLLECTIONS.contacts)).toBe(5);
    expect(await count(COLLECTIONS.communications)).toBe(5);
    expect(await count(COLLECTIONS.sales)).toBe(6);
    expect(await count(COLLECTIONS.products)).toBe(6);
    expect(await count(COLLECTIONS.saleProducts)).toBe(6);
    expect(await count(COLLECTIONS.stageHistory)).toBe(15);

    const { users } = await getAuth(app).listUsers();
    expect(users).toHaveLength(1);
  });

  it('guarda relaciones por ID válidas y fechas como Timestamp', async () => {
    const db = getFirestore(app);
    const [users, contacts, sales, communications] = await Promise.all(
      [COLLECTIONS.users, COLLECTIONS.contacts, COLLECTIONS.sales, COLLECTIONS.communications].map((c) =>
        db.collection(c).get(),
      ),
    );
    const userIds = new Set(users.docs.map((d) => d.id));
    const contactIds = new Set(contacts.docs.map((d) => d.id));
    const saleById = new Map(sales.docs.map((d) => [d.id, d.data()]));

    for (const contact of contacts.docs) {
      expect(contact.get('createdAt')).toBeInstanceOf(Timestamp);
    }
    for (const [, sale] of saleById) {
      expect(contactIds.has(sale.contactId)).toBe(true);
      expect(sale.createdAt).toBeInstanceOf(Timestamp);
    }
    for (const snap of communications.docs) {
      const comm = snap.data();
      expect(contactIds.has(comm.contactId)).toBe(true);
      expect(userIds.has(comm.userId)).toBe(true);
      expect(comm.date).toBeInstanceOf(Timestamp);
      if (comm.appliesToAllSales) expect(comm.saleId).toBeNull();
      if (comm.saleId !== null) {
        expect(saleById.get(comm.saleId)?.contactId).toBe(comm.contactId);
      }
    }
  });

  it('productos, productos de la venta y etapas: relaciones válidas y ventas coherentes con su historial', async () => {
    const db = getFirestore(app);
    const [sales, products, saleProducts, history] = await Promise.all(
      [COLLECTIONS.sales, COLLECTIONS.products, COLLECTIONS.saleProducts, COLLECTIONS.stageHistory].map((c) =>
        db.collection(c).get(),
      ),
    );
    const productIds = new Set(products.docs.map((d) => d.id));
    const saleIds = new Set(sales.docs.map((d) => d.id));

    expect(products.docs.some((d) => d.get('active') === false)).toBe(true);
    for (const snap of saleProducts.docs) {
      const row = snap.data();
      expect(snap.id).toBe(`${row.saleId}_${row.productId}`);
      expect(saleIds.has(row.saleId)).toBe(true);
      expect(productIds.has(row.productId)).toBe(true);
      expect(Number.isInteger(row.quantity) && row.quantity >= 1 && row.quantity <= 9999).toBe(true);
    }

    for (const sale of sales.docs) {
      expect(SALE_STAGES).toContain(sale.get('stage'));
      expect(sale.get('stageChangedAt')).toBeInstanceOf(Timestamp);
      const changes = history.docs
        .map((d) => d.data())
        .filter((h) => h.saleId === sale.id)
        .sort((a, b) => a.changedAt.toMillis() - b.changedAt.toMillis());
      expect(changes.length).toBeGreaterThan(0);
      expect(changes[0].previousStage).toBeNull();
      changes.forEach((change, i) => {
        if (i > 0) expect(change.previousStage).toBe(changes[i - 1].newStage);
      });
      const last = changes[changes.length - 1];
      expect(last.newStage).toBe(sale.get('stage'));
      expect(last.changedAt.toMillis()).toBe(sale.get('stageChangedAt').toMillis());
    }
    for (const snap of history.docs) expect(saleIds.has(snap.get('saleId'))).toBe(true);
  });
});
