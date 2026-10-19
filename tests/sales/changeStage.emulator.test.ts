// HU-310 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, where, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { changeSaleStageIn, SaleStageConflictError } from '../../src/sales/salesRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-change-stage';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;
let db: Firestore;

const at = (iso: string) => Timestamp.fromDate(new Date(iso));
const baseSale = {
  contactId: 'c-1',
  title: 'Venta',
  stage: 'contactado',
  estimatedAmount: 1000,
  nextFollowUpAt: null,
  notes: 'Notas',
  createdAt: at('2026-09-01T12:00:00Z'),
  stageChangedAt: at('2026-09-10T12:00:00Z'),
  lastCommunicationAt: at('2026-10-05T12:00:00Z'),
};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  db = testEnv.authenticatedContext('admin-activo').firestore() as unknown as Firestore;
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();
    await setDoc(doc(admin, COLLECTIONS.users, 'admin-activo'), { username: 'admin', email: 'a@example.com', active: true });
    await setDoc(doc(admin, COLLECTIONS.sales, 's-1'), baseSale);
    // Otra venta abierta del mismo contacto: no debe verse afectada.
    await setDoc(doc(admin, COLLECTIONS.sales, 's-hermana'), { ...baseSale, title: 'Hermana', stage: 'en_negociacion' });
    await setDoc(doc(admin, COLLECTIONS.sales, 's-ganada'), { ...baseSale, title: 'Ganada', stage: 'ganada' });
    await setDoc(doc(admin, COLLECTIONS.sales, 's-perdida'), { ...baseSale, title: 'Perdida', stage: 'perdida' });
    await setDoc(doc(admin, COLLECTIONS.stageHistory, 's-1_01'), { saleId: 's-1', previousStage: null, newStage: 'contactado', changedAt: at('2026-09-10T12:00:00Z'), lossReason: null });
  });
});
afterAll(async () => {
  await testEnv?.cleanup();
});

const historyOf = async (saleId: string) => {
  const snap = await getDocs(query(collection(db, COLLECTIONS.stageHistory), where('saleId', '==', saleId)));
  return snap.docs.map((d) => d.data()).sort((a, b) => a.changedAt.toMillis() - b.changedAt.toMillis());
};

describe('cambiar la etapa de una posible venta (HU-310)', () => {
  it('actualiza la etapa y su fecha y agrega un registro al historial sin borrar los anteriores', async () => {
    await changeSaleStageIn(db, 's-1', 'contactado', 'en_negociacion');

    const sale = (await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).data()!;
    expect(sale.stage).toBe('en_negociacion');
    expect(sale.stageChangedAt.toMillis()).toBeGreaterThan(baseSale.stageChangedAt.toMillis());
    // Lo demás queda igual.
    expect(sale).toMatchObject({ title: 'Venta', estimatedAmount: 1000, notes: 'Notas', contactId: 'c-1' });
    expect(sale.createdAt.toMillis()).toBe(baseSale.createdAt.toMillis());
    expect(sale.lastCommunicationAt.toMillis()).toBe(baseSale.lastCommunicationAt.toMillis());

    const history = await historyOf('s-1');
    expect(history.map((h) => `${h.previousStage ?? '-'}>${h.newStage}`)).toEqual(['-', 'contactado>en_negociacion'].map((x, i) => (i === 0 ? '->contactado' : x)));
    // La fecha del nuevo registro coincide con la de la venta.
    expect(history[1].changedAt.toMillis()).toBe(sale.stageChangedAt.toMillis());
    expect(history[1].lossReason).toBeNull();
  });

  it('se puede ir hacia atrás y varias veces: cada cambio suma un registro', async () => {
    await changeSaleStageIn(db, 's-1', 'contactado', 'nuevo_interesado');
    await changeSaleStageIn(db, 's-1', 'nuevo_interesado', 'cotizacion_enviada');
    await changeSaleStageIn(db, 's-1', 'cotizacion_enviada', 'contactado');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).get('stage')).toBe('contactado');
    expect((await historyOf('s-1')).map((h) => h.newStage)).toEqual([
      'contactado',
      'nuevo_interesado',
      'cotizacion_enviada',
      'contactado',
    ]);
  });

  it('no afecta a las demás posibles ventas del mismo contacto', async () => {
    const before = (await getDoc(doc(db, COLLECTIONS.sales, 's-hermana'))).data();
    await changeSaleStageIn(db, 's-1', 'contactado', 'en_negociacion');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-hermana'))).data()).toEqual(before);
    expect(await historyOf('s-hermana')).toEqual([]);
  });

  it('si la etapa guardada ya no es la esperada no escribe nada y avisa', async () => {
    await expect(changeSaleStageIn(db, 's-1', 'nuevo_interesado', 'en_negociacion')).rejects.toBeInstanceOf(SaleStageConflictError);
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).get('stage')).toBe('contactado');
    expect(await historyOf('s-1')).toHaveLength(1);
  });

  it('no mueve una venta ganada o perdida, ni a la misma etapa, ni (todavía) a ganada', async () => {
    await expect(changeSaleStageIn(db, 's-ganada', 'ganada', 'contactado')).rejects.toThrow(/no permitido/);
    await expect(changeSaleStageIn(db, 's-perdida', 'perdida', 'contactado')).rejects.toThrow(/no permitido/);
    await expect(changeSaleStageIn(db, 's-1', 'contactado', 'contactado')).rejects.toThrow(/no permitido/);
    await expect(changeSaleStageIn(db, 's-1', 'contactado', 'ganada')).rejects.toThrow(/no permitido/);
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).get('stage')).toBe('contactado');
    expect(await historyOf('s-1')).toHaveLength(1);
  });

  it('una venta que no existe da error y no crea nada', async () => {
    await expect(changeSaleStageIn(db, 'no-existe', 'contactado', 'en_negociacion')).rejects.toThrow(/no existe/);
    expect(await historyOf('no-existe')).toEqual([]);
  });

  it('sin sesión no se puede y no cambia nada', async () => {
    const anon = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(changeSaleStageIn(anon, 's-1', 'contactado', 'en_negociacion'));
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).get('stage')).toBe('contactado');
    expect(await historyOf('s-1')).toHaveLength(1);
  });
});

describe('marcar una posible venta como perdida (HU-311)', () => {
  it('pasa a "Venta perdida" y guarda la fecha y el motivo en el historial', async () => {
    await changeSaleStageIn(db, 's-1', 'contactado', 'perdida', '  El cliente eligió otro proveedor.  ');

    const sale = (await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).data()!;
    expect(sale.stage).toBe('perdida');
    expect(sale.stageChangedAt.toMillis()).toBeGreaterThan(baseSale.stageChangedAt.toMillis());
    const history = await historyOf('s-1');
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({ previousStage: 'contactado', newStage: 'perdida', lossReason: 'El cliente eligió otro proveedor.' });
    // La fecha de la pérdida es la de la venta (con ella el tablero la muestra 30 días).
    expect(history[1].changedAt.toMillis()).toBe(sale.stageChangedAt.toMillis());
  });

  it('el motivo es opcional: sin escribirlo queda null', async () => {
    await changeSaleStageIn(db, 's-1', 'contactado', 'perdida');
    await changeSaleStageIn(db, 's-hermana', 'en_negociacion', 'perdida', '   ');
    expect((await historyOf('s-1'))[1].lossReason).toBeNull();
    expect((await historyOf('s-hermana'))[0].lossReason).toBeNull();
  });

  it('acepta un motivo de 250 caracteres y rechaza uno de 251 sin escribir nada', async () => {
    await changeSaleStageIn(db, 's-1', 'contactado', 'perdida', 'm'.repeat(250));
    expect((await historyOf('s-1'))[1].lossReason).toHaveLength(250);

    await expect(changeSaleStageIn(db, 's-hermana', 'en_negociacion', 'perdida', 'm'.repeat(251))).rejects.toThrow(/demasiado largo/);
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-hermana'))).get('stage')).toBe('en_negociacion');
    expect(await historyOf('s-hermana')).toEqual([]);
  });

  it('un motivo que llega con una etapa abierta no se guarda', async () => {
    await changeSaleStageIn(db, 's-1', 'contactado', 'en_negociacion', 'Esto no es una pérdida');
    expect((await historyOf('s-1'))[1].lossReason).toBeNull();
  });

  it('no afecta a las demás ventas del contacto y la perdida no se puede volver a mover desde aquí', async () => {
    const before = (await getDoc(doc(db, COLLECTIONS.sales, 's-hermana'))).data();
    await changeSaleStageIn(db, 's-1', 'contactado', 'perdida', 'Motivo');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-hermana'))).data()).toEqual(before);
    await expect(changeSaleStageIn(db, 's-1', 'perdida', 'contactado')).rejects.toThrow(/no permitido/);
  });

  it('si la etapa guardada ya no es la esperada no escribe nada', async () => {
    await expect(changeSaleStageIn(db, 's-1', 'nuevo_interesado', 'perdida', 'Motivo')).rejects.toBeInstanceOf(SaleStageConflictError);
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).get('stage')).toBe('contactado');
    expect(await historyOf('s-1')).toHaveLength(1);
  });
});
