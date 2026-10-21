// HU-310 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, where, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { changeSaleStageIn, SaleReopenDuplicateTitleError, SaleStageConflictError } from '../../src/sales/salesRepository';
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
    await setDoc(doc(admin, COLLECTIONS.contacts, 'c-1'), { fullName: 'Ana Interesada', classification: 'persona_interesada', status: 'activo', email: 'ana@example.com' });
    await setDoc(doc(admin, COLLECTIONS.contacts, 'c-cliente'), { fullName: 'Bruno Cliente', classification: 'cliente', status: 'activo' });
    await setDoc(doc(admin, COLLECTIONS.contacts, 'c-distribuidor'), { fullName: 'Carla Distribuidora', classification: 'distribuidor', status: 'activo' });
    await setDoc(doc(admin, COLLECTIONS.contacts, 'c-otro'), { fullName: 'Diego Otro', classification: 'otro', status: 'activo' });
    await setDoc(doc(admin, COLLECTIONS.sales, 's-cliente'), { ...baseSale, contactId: 'c-cliente', title: 'De un cliente' });
    await setDoc(doc(admin, COLLECTIONS.sales, 's-distribuidor'), { ...baseSale, contactId: 'c-distribuidor', title: 'De un distribuidor' });
    await setDoc(doc(admin, COLLECTIONS.sales, 's-otro'), { ...baseSale, contactId: 'c-otro', title: 'De un otro' });
    await setDoc(doc(admin, COLLECTIONS.sales, 's-sin-contacto'), { ...baseSale, contactId: 'no-existe', title: 'Sin contacto' });
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

describe('cambiar la etapa de una oportunidad de venta (HU-310)', () => {
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

  it('no afecta a las demás oportunidades de venta del mismo contacto', async () => {
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

  it('no mueve una venta ganada o perdida ni a la misma etapa', async () => {
    await expect(changeSaleStageIn(db, 's-ganada', 'ganada', 'contactado')).rejects.toThrow(/no permitido/);
    await expect(changeSaleStageIn(db, 's-perdida', 'perdida', 'ganada')).rejects.toThrow(/no permitido/);
    await expect(changeSaleStageIn(db, 's-1', 'contactado', 'contactado')).rejects.toThrow(/no permitido/);
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

describe('marcar una oportunidad de venta como perdida (HU-311)', () => {
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

  it('no afecta a las demás ventas del contacto y la perdida no pasa directo a ganada', async () => {
    const before = (await getDoc(doc(db, COLLECTIONS.sales, 's-hermana'))).data();
    await changeSaleStageIn(db, 's-1', 'contactado', 'perdida', 'Motivo');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-hermana'))).data()).toEqual(before);
    await expect(changeSaleStageIn(db, 's-1', 'perdida', 'ganada')).rejects.toThrow(/no permitido/);
  });

  it('si la etapa guardada ya no es la esperada no escribe nada', async () => {
    await expect(changeSaleStageIn(db, 's-1', 'nuevo_interesado', 'perdida', 'Motivo')).rejects.toBeInstanceOf(SaleStageConflictError);
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).get('stage')).toBe('contactado');
    expect(await historyOf('s-1')).toHaveLength(1);
  });
});

describe('marcar una oportunidad de venta como ganada (HU-313)', () => {
  const classificationOf = async (id: string) => (await getDoc(doc(db, COLLECTIONS.contacts, id))).get('classification');

  it('una persona interesada pasa a cliente y la venta a "Venta ganada", con su registro en el historial', async () => {
    const result = await changeSaleStageIn(db, 's-1', 'contactado', 'ganada');

    expect(result).toEqual({ contactBecameClient: true, contactName: 'Ana Interesada' });
    expect(await classificationOf('c-1')).toBe('cliente');
    const sale = (await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).data()!;
    expect(sale.stage).toBe('ganada');
    expect(sale.stageChangedAt.toMillis()).toBeGreaterThan(baseSale.stageChangedAt.toMillis());
    const history = await historyOf('s-1');
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({ previousStage: 'contactado', newStage: 'ganada', lossReason: null });
    expect(history[1].changedAt.toMillis()).toBe(sale.stageChangedAt.toMillis());
  });

  it('solo se cambia la clasificación: el resto del contacto queda igual', async () => {
    await changeSaleStageIn(db, 's-1', 'contactado', 'ganada');
    expect((await getDoc(doc(db, COLLECTIONS.contacts, 'c-1'))).data()).toEqual({
      fullName: 'Ana Interesada',
      classification: 'cliente',
      status: 'activo',
      email: 'ana@example.com',
    });
  });

  it('si el contacto ya era cliente sigue siéndolo y no hay conversión', async () => {
    const result = await changeSaleStageIn(db, 's-cliente', 'contactado', 'ganada');
    expect(result).toEqual({ contactBecameClient: false, contactName: null });
    expect(await classificationOf('c-cliente')).toBe('cliente');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-cliente'))).get('stage')).toBe('ganada');
  });

  it('distribuidor y otro no cambian de clasificación', async () => {
    expect(await changeSaleStageIn(db, 's-distribuidor', 'contactado', 'ganada')).toEqual({ contactBecameClient: false, contactName: null });
    expect(await changeSaleStageIn(db, 's-otro', 'contactado', 'ganada')).toEqual({ contactBecameClient: false, contactName: null });
    expect(await classificationOf('c-distribuidor')).toBe('distribuidor');
    expect(await classificationOf('c-otro')).toBe('otro');
  });

  it('si el contacto ya no existe la venta se gana igual y no se crea ningún contacto', async () => {
    const result = await changeSaleStageIn(db, 's-sin-contacto', 'contactado', 'ganada');
    expect(result).toEqual({ contactBecameClient: false, contactName: null });
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-sin-contacto'))).get('stage')).toBe('ganada');
    expect((await getDoc(doc(db, COLLECTIONS.contacts, 'no-existe'))).exists()).toBe(false);
  });

  it('no afecta a las demás ventas ni a los demás contactos', async () => {
    const hermana = (await getDoc(doc(db, COLLECTIONS.sales, 's-hermana'))).data();
    await changeSaleStageIn(db, 's-1', 'contactado', 'ganada');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-hermana'))).data()).toEqual(hermana);
    expect(await classificationOf('c-cliente')).toBe('cliente');
    expect(await classificationOf('c-distribuidor')).toBe('distribuidor');
  });

  it('es definitiva: una venta ganada ya no cambia de etapa', async () => {
    await changeSaleStageIn(db, 's-1', 'contactado', 'ganada');
    for (const to of ['nuevo_interesado', 'contactado', 'en_negociacion', 'perdida'] as const) {
      await expect(changeSaleStageIn(db, 's-1', 'ganada', to)).rejects.toThrow(/no permitido/);
    }
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).get('stage')).toBe('ganada');
  });

  it('es atómico: si la etapa ya cambió no se toca ni la venta ni el contacto', async () => {
    await expect(changeSaleStageIn(db, 's-1', 'nuevo_interesado', 'ganada')).rejects.toBeInstanceOf(SaleStageConflictError);
    expect(await classificationOf('c-1')).toBe('persona_interesada');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).get('stage')).toBe('contactado');
    expect(await historyOf('s-1')).toHaveLength(1);
  });

  it('ganar desde cualquier etapa abierta funciona (aunque se haya saltado alguna)', async () => {
    await changeSaleStageIn(db, 's-hermana', 'en_negociacion', 'ganada');
    expect(await classificationOf('c-1')).toBe('cliente');
  });

  it('sin sesión no cambia nada: ni la venta ni el contacto', async () => {
    const anon = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(changeSaleStageIn(anon, 's-1', 'contactado', 'ganada'));
    expect(await classificationOf('c-1')).toBe('persona_interesada');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).get('stage')).toBe('contactado');
  });
});

describe('reabrir una oportunidad de venta perdida (HU-312)', () => {
  const classificationOf = async (id: string) => (await getDoc(doc(db, COLLECTIONS.contacts, id))).get('classification');

  it('pasa a la etapa abierta elegida, con su fecha y un registro nuevo sin motivo', async () => {
    await changeSaleStageIn(db, 's-1', 'contactado', 'perdida', 'Eligió a otro');
    await changeSaleStageIn(db, 's-1', 'perdida', 'en_negociacion', 'Esto no se guarda');

    const sale = (await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).data()!;
    expect(sale.stage).toBe('en_negociacion');
    const history = await historyOf('s-1');
    expect(history.map((h) => `${h.previousStage ?? '-'}>${h.newStage}`)).toEqual(['->contactado', 'contactado>perdida', 'perdida>en_negociacion']);
    expect(history[2].lossReason).toBeNull();
    expect(history[2].changedAt.toMillis()).toBe(sale.stageChangedAt.toMillis());
    // La pérdida anterior se conserva con su motivo.
    expect(history[1].lossReason).toBe('Eligió a otro');
  });

  it('se puede reabrir a cada una de las cuatro etapas abiertas', async () => {
    for (const to of ['nuevo_interesado', 'contactado', 'cotizacion_enviada', 'en_negociacion'] as const) {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), COLLECTIONS.sales, `p-${to}`), { ...baseSale, contactId: 'c-cliente', title: `Perdida ${to}`, stage: 'perdida' });
      });
      await changeSaleStageIn(db, `p-${to}`, 'perdida', to);
      expect((await getDoc(doc(db, COLLECTIONS.sales, `p-${to}`))).get('stage')).toBe(to);
    }
  });

  it('desde perdida no se pasa directo a ganada: no escribe nada ni toca al contacto', async () => {
    await expect(changeSaleStageIn(db, 's-perdida', 'perdida', 'ganada')).rejects.toThrow(/no permitido/);
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-perdida'))).get('stage')).toBe('perdida');
    expect(await classificationOf('c-1')).toBe('persona_interesada');
    expect(await historyOf('s-perdida')).toEqual([]);
  });

  it('si se reabre y se vuelve a perder se suma otra pérdida con su fecha y motivo, sin borrar la anterior', async () => {
    await changeSaleStageIn(db, 's-1', 'contactado', 'perdida', 'Primer motivo');
    await changeSaleStageIn(db, 's-1', 'perdida', 'contactado');
    await changeSaleStageIn(db, 's-1', 'contactado', 'perdida', 'Segundo motivo');

    const losses = (await historyOf('s-1')).filter((h) => h.newStage === 'perdida');
    expect(losses.map((h) => h.lossReason)).toEqual(['Primer motivo', 'Segundo motivo']);
    expect(losses[1].changedAt.toMillis()).toBeGreaterThanOrEqual(losses[0].changedAt.toMillis());
  });

  it('si el contacto ya tiene otra abierta con el mismo título no reabre y no escribe nada', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      // Mismo título que "Perdida", distinto en mayúsculas y espacios, y del mismo contacto.
      await setDoc(doc(ctx.firestore(), COLLECTIONS.sales, 's-igual'), { ...baseSale, title: ' PERDIDA ', stage: 'contactado' });
    });
    const before = (await getDoc(doc(db, COLLECTIONS.sales, 's-perdida'))).data();

    await expect(changeSaleStageIn(db, 's-perdida', 'perdida', 'nuevo_interesado')).rejects.toBeInstanceOf(SaleReopenDuplicateTitleError);
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-perdida'))).data()).toEqual(before);
    expect(await historyOf('s-perdida')).toEqual([]);
  });

  it('una abierta de otro contacto, o una ganada o perdida del mismo, con el mismo título no lo impide', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore();
      await setDoc(doc(admin, COLLECTIONS.sales, 's-otro-contacto'), { ...baseSale, contactId: 'c-cliente', title: 'Perdida', stage: 'contactado' });
      await setDoc(doc(admin, COLLECTIONS.sales, 's-misma-ganada'), { ...baseSale, title: 'Perdida', stage: 'ganada' });
      await setDoc(doc(admin, COLLECTIONS.sales, 's-misma-perdida'), { ...baseSale, title: 'Perdida', stage: 'perdida' });
    });
    await changeSaleStageIn(db, 's-perdida', 'perdida', 'contactado');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-perdida'))).get('stage')).toBe('contactado');
  });

  it('si la etapa guardada ya no es perdida, lo avisa y no escribe nada', async () => {
    await expect(changeSaleStageIn(db, 's-1', 'perdida', 'en_negociacion')).rejects.toBeInstanceOf(SaleStageConflictError);
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).get('stage')).toBe('contactado');
    expect(await historyOf('s-1')).toHaveLength(1);
  });

  it('sin sesión no se puede reabrir', async () => {
    const anon = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(changeSaleStageIn(anon, 's-perdida', 'perdida', 'contactado'));
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-perdida'))).get('stage')).toBe('perdida');
  });
});
