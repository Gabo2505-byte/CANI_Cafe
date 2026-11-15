// Tabla de movimientos contra el emulador real de Firestore (con las reglas del repo), usando los datos del seed.
// Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContacts, seedSales, seedStageHistory } from '../../scripts/seed/seedData';
import { MOVEMENTS_PAGE_SIZE } from '../../src/sales/movements';
import { createMovementsLoaderIn, listStageHistoryPageIn, type MovementsCursor } from '../../src/sales/movementsRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';
import type { StageHistory } from '../../src/shared/types';

const PROJECT_ID = 'demo-cani-crm-movements';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;

/** Los datos del seed usan Date; en Firestore van como Timestamp. */
function toFirestore(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v instanceof Date ? Timestamp.fromDate(v) : v]));
}

const SEED_COUNT = seedStageHistory.length;
/** Ids del historial del seed del más reciente al más antiguo. */
const expectedOrder = [...seedStageHistory]
  .sort((a, b) => (b.data.changedAt as Date).getTime() - (a.data.changedAt as Date).getTime())
  .map((e) => e.id);
const contactName = (id: string) => seedContacts.find((c) => c.id === id)!.data.fullName;

const adminDb = () => testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, COLLECTIONS.users, 'admin-activo'), { username: 'admin', email: 'a@example.com', active: true });
    for (const { id, data } of seedContacts) await setDoc(doc(db, COLLECTIONS.contacts, id), toFirestore(data));
    for (const { id, data } of seedSales) await setDoc(doc(db, COLLECTIONS.sales, id), toFirestore(data));
    for (const { id, data } of seedStageHistory) await setDoc(doc(db, COLLECTIONS.stageHistory, id), toFirestore(data));
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('consulta de stageHistory para la tabla de movimientos', () => {
  it('el seed tiene 20 registros sin fechas repetidas (el orden esperado es único)', () => {
    expect(SEED_COUNT).toBe(20);
    expect(new Set(seedStageHistory.map((e) => (e.data.changedAt as Date).getTime())).size).toBe(SEED_COUNT);
  });

  it('con la página de 25 trae los 20 registros en una sola página, del más reciente al más antiguo', async () => {
    const page = await listStageHistoryPageIn(adminDb(), null);
    expect(MOVEMENTS_PAGE_SIZE).toBe(25);
    expect(page.entries.map((e) => e.id)).toEqual(expectedOrder);
    expect(page.nextCursor).toBeNull();
    const millis = page.entries.map((e) => e.changedAt.toMillis());
    expect(millis).toEqual([...millis].sort((a, b) => b - a));
  });

  it('respeta el límite y pagina sin repetir ni saltarse registros (8 + 8 + 4)', async () => {
    const db = adminDb();
    const sizes: number[] = [];
    const ids: string[] = [];
    let cursor: MovementsCursor | null = null;
    do {
      const page = await listStageHistoryPageIn(db, cursor, 8);
      sizes.push(page.entries.length);
      ids.push(...page.entries.map((e) => e.id));
      cursor = page.nextCursor;
    } while (cursor && sizes.length < 10);
    expect(sizes).toEqual([8, 8, 4]);
    expect(ids).toEqual(expectedOrder);
  });

  it('si la última página queda justa (20 de 10 en 10) no ofrece una página vacía', async () => {
    const db = adminDb();
    const first = await listStageHistoryPageIn(db, null, 10);
    expect(first.nextCursor).not.toBeNull();
    const second = await listStageHistoryPageIn(db, first.nextCursor, 10);
    expect(second.entries).toHaveLength(10);
    expect(second.nextCursor).toBeNull();
  });

  it('cada registro trae su id y los campos del contrato', async () => {
    const { entries } = await listStageHistoryPageIn(adminDb(), null, 1);
    const seeded = seedStageHistory.find((e) => e.id === entries[0].id)!;
    expect(entries[0]).toMatchObject({
      saleId: seeded.data.saleId,
      previousStage: seeded.data.previousStage,
      newStage: seeded.data.newStage,
      lossReason: seeded.data.lossReason,
    });
  });

  it('sin sesión no se puede leer el historial', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDocs(query(collection(anon, COLLECTIONS.stageHistory), orderBy('changedAt', 'desc'), limit(1))));
  });
});

describe('cargador de la tabla de movimientos', () => {
  it('arma las filas con el nombre del contacto y el título de la venta', async () => {
    const { rows, nextCursor } = await createMovementsLoaderIn(adminDb()).loadPage(null);
    expect(rows.map((r) => r.id)).toEqual(expectedOrder);
    expect(nextCursor).toBeNull();
    for (const row of rows) {
      const sale = seedSales.find((s) => s.id === row.saleId)!;
      expect(row.saleTitle).toBe(sale.data.title);
      expect(row.contactName).toBe(contactName(sale.data.contactId));
    }
    // La pérdida del seed lleva su motivo; la entrada inicial, guion.
    const lost = rows.find((r) => r.id === 'sale-004_03')!;
    expect(lost).toMatchObject({ newStageLabel: 'Venta perdida', reason: 'El cliente eligió otro proveedor.' });
    expect(rows.find((r) => r.id === 'sale-004_01')!.previousStageLabel).toBe('—');
    expect(rows.filter((r) => r.reason !== '').map((r) => r.id)).toEqual(['sale-004_03']);
  });

  it('pagina de 8 en 8 y no vuelve a leer las ventas ya vistas (caché en memoria)', async () => {
    const db = adminDb();
    const loader = createMovementsLoaderIn(db, 8);
    const first = await loader.loadPage(null);
    expect(first.rows).toHaveLength(8);

    // Se borra una venta que ya apareció en la primera página y que tiene registros en las siguientes.
    const seenSaleIds = new Set(first.rows.map((r) => r.saleId));
    const laterSaleIds = new Set(expectedOrder.slice(8).map((id) => seedStageHistory.find((e) => e.id === id)!.data.saleId));
    const cached = [...seenSaleIds].find((id) => laterSaleIds.has(id))!;
    expect(cached).toBeDefined();
    const original = seedSales.find((s) => s.id === cached)!;
    await testEnv.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), COLLECTIONS.sales, cached)));

    try {
      const rest: string[] = [];
      let cursor = first.nextCursor;
      while (cursor) {
        const page = await loader.loadPage(cursor);
        for (const row of page.rows.filter((r) => r.saleId === cached)) {
          // Si se hubiera vuelto a leer, la venta ya no existiría y la fila diría "—".
          expect(row.saleTitle).toBe(original.data.title);
          rest.push(row.id);
        }
        cursor = page.nextCursor;
      }
      expect(rest.length).toBeGreaterThan(0);

      // Un cargador nuevo (otra visita a la pantalla) sí lee de nuevo: la venta ya no existe y la fila no lleva enlace.
      const fresh = await createMovementsLoaderIn(db).loadPage(null);
      expect(fresh.rows.filter((r) => r.saleId === cached).every((r) => r.saleTitle === null && r.contactName === '—')).toBe(true);
    } finally {
      await testEnv.withSecurityRulesDisabled((ctx) =>
        setDoc(doc(ctx.firestore(), COLLECTIONS.sales, cached), toFirestore(original.data as Record<string, unknown>)),
      );
    }
  });

  it('busca ventas y contactos en lotes aunque una página tenga más de 30 ventas distintas', async () => {
    const extra = Array.from({ length: 35 }, (_, i) => `mov-extra-${String(i).padStart(2, '0')}`);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (const [i, id] of extra.entries()) {
        await setDoc(doc(db, COLLECTIONS.sales, id), { contactId: 'contact-001', title: `Venta extra ${i}`, stage: 'nuevo_interesado' });
        const entry: StageHistory = {
          saleId: id,
          previousStage: null,
          newStage: 'nuevo_interesado',
          changedAt: Timestamp.fromDate(new Date(Date.UTC(2027, 0, 1, 0, i))),
          lossReason: null,
        };
        await setDoc(doc(db, COLLECTIONS.stageHistory, `${id}_01`), entry);
      }
    });
    try {
      const { rows } = await createMovementsLoaderIn(adminDb(), 40).loadPage(null);
      expect(rows).toHaveLength(40);
      const extraRows = rows.filter((r) => r.saleId.startsWith('mov-extra-'));
      expect(extraRows).toHaveLength(35);
      expect(extraRows.every((r) => r.saleTitle?.startsWith('Venta extra') && r.contactName === contactName('contact-001'))).toBe(true);
    } finally {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        for (const id of extra) {
          await deleteDoc(doc(db, COLLECTIONS.sales, id));
          await deleteDoc(doc(db, COLLECTIONS.stageHistory, `${id}_01`));
        }
      });
    }
  });
});
