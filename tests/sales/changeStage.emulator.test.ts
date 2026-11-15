// HU-310 contra el emulador real de Firestore (con las reglas del repo). Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, where, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { changeSaleStageIn, SaleReopenDuplicateTitleError, SaleStageConflictError } from '../../src/sales/salesRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';
import { SALE_STAGES, type SaleStage } from '../../src/shared/types';
import { isValidStageChange } from '../../src/sales/stageChange';

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
    // Otra persona interesada: no debe convertirse cuando gana la venta de otro contacto.
    await setDoc(doc(admin, COLLECTIONS.contacts, 'c-2'), { fullName: 'Elena Interesada', classification: 'persona_interesada', status: 'activo' });
    await setDoc(doc(admin, COLLECTIONS.sales, 's-cliente'), { ...baseSale, contactId: 'c-cliente', title: 'De un cliente' });
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
/** Paso válido previo a ganar: de "Contactado" a "Precio o cotización enviada" (desde Contactado no se gana directo). */
const toQuote = (saleId: string) => changeSaleStageIn(db, saleId, 'contactado', 'cotizacion_enviada');

describe('cambiar la etapa de una oportunidad de venta (HU-310)', () => {
  it('actualiza la etapa y su fecha y agrega un registro al historial sin borrar los anteriores', async () => {
    await changeSaleStageIn(db, 's-1', 'contactado', 'cotizacion_enviada');

    const sale = (await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).data()!;
    expect(sale.stage).toBe('cotizacion_enviada');
    expect(sale.stageChangedAt.toMillis()).toBeGreaterThan(baseSale.stageChangedAt.toMillis());
    // Lo demás queda igual.
    expect(sale).toMatchObject({ title: 'Venta', estimatedAmount: 1000, notes: 'Notas', contactId: 'c-1' });
    expect(sale.createdAt.toMillis()).toBe(baseSale.createdAt.toMillis());
    expect(sale.lastCommunicationAt.toMillis()).toBe(baseSale.lastCommunicationAt.toMillis());

    const history = await historyOf('s-1');
    expect(history.map((h) => `${h.previousStage ?? '-'}>${h.newStage}`)).toEqual(['->contactado', 'contactado>cotizacion_enviada']);
    // La fecha del nuevo registro coincide con la de la venta.
    expect(history[1].changedAt.toMillis()).toBe(sale.stageChangedAt.toMillis());
    expect(history[1].lossReason).toBeNull();
  });

  it('se puede ir a la etapa anterior y a la siguiente varias veces: cada cambio suma un registro', async () => {
    await changeSaleStageIn(db, 's-1', 'contactado', 'nuevo_interesado');
    await changeSaleStageIn(db, 's-1', 'nuevo_interesado', 'contactado');
    await changeSaleStageIn(db, 's-1', 'contactado', 'cotizacion_enviada');
    await changeSaleStageIn(db, 's-1', 'cotizacion_enviada', 'en_negociacion');
    await changeSaleStageIn(db, 's-1', 'en_negociacion', 'cotizacion_enviada');
    await changeSaleStageIn(db, 's-1', 'cotizacion_enviada', 'contactado');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).get('stage')).toBe('contactado');
    expect((await historyOf('s-1')).map((h) => `${h.previousStage ?? '-'}>${h.newStage}`)).toEqual([
      '->contactado',
      'contactado>nuevo_interesado',
      'nuevo_interesado>contactado',
      'contactado>cotizacion_enviada',
      'cotizacion_enviada>en_negociacion',
      'en_negociacion>cotizacion_enviada',
      'cotizacion_enviada>contactado',
    ]);
  });

  it('no afecta a las demás oportunidades de venta del mismo contacto', async () => {
    const before = (await getDoc(doc(db, COLLECTIONS.sales, 's-hermana'))).data();
    await changeSaleStageIn(db, 's-1', 'contactado', 'cotizacion_enviada');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-hermana'))).data()).toEqual(before);
    expect(await historyOf('s-hermana')).toEqual([]);
  });

  it('si la etapa guardada ya no es la esperada no escribe nada y avisa', async () => {
    // Las dos transiciones son válidas en el mapa: el rechazo es por conflicto (está en "Contactado").
    await expect(changeSaleStageIn(db, 's-1', 'nuevo_interesado', 'contactado')).rejects.toBeInstanceOf(SaleStageConflictError);
    await expect(changeSaleStageIn(db, 's-1', 'cotizacion_enviada', 'en_negociacion')).rejects.toBeInstanceOf(SaleStageConflictError);
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
    await expect(changeSaleStageIn(db, 'no-existe', 'contactado', 'cotizacion_enviada')).rejects.toThrow(/no existe/);
    expect(await historyOf('no-existe')).toEqual([]);
  });

  it('sin sesión no se puede y no cambia nada', async () => {
    const anon = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(changeSaleStageIn(anon, 's-1', 'contactado', 'cotizacion_enviada'));
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).get('stage')).toBe('contactado');
    expect(await historyOf('s-1')).toHaveLength(1);
  });
});

describe('mapa de transiciones: el servicio rechaza los cambios no permitidos (HU-310)', () => {
  const OPEN: readonly SaleStage[] = ['nuevo_interesado', 'contactado', 'cotizacion_enviada', 'en_negociacion'];
  const FORBIDDEN = OPEN.flatMap((from) => SALE_STAGES.filter((to) => to !== from && !isValidStageChange(from, to)).map((to) => [from, to] as const));

  it('hay 8 saltos prohibidos entre etapas abiertas o hacia ganada', () => {
    expect(FORBIDDEN.map(([from, to]) => `${from}>${to}`)).toEqual([
      'nuevo_interesado>cotizacion_enviada',
      'nuevo_interesado>en_negociacion',
      'nuevo_interesado>ganada',
      'contactado>en_negociacion',
      'contactado>ganada',
      'cotizacion_enviada>nuevo_interesado',
      'en_negociacion>nuevo_interesado',
      'en_negociacion>contactado',
    ]);
  });

  it.each(FORBIDDEN)('%s → %s: lanza "no permitido" y no escribe nada (ni la venta, ni el historial, ni el contacto)', async (from, to) => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), COLLECTIONS.sales, 's-salto'), { ...baseSale, title: 'Salto', stage: from });
    });
    const before = (await getDoc(doc(db, COLLECTIONS.sales, 's-salto'))).data();

    const attempt = changeSaleStageIn(db, 's-salto', from, to);
    await expect(attempt).rejects.toThrow(/no permitido/);
    await expect(attempt).rejects.not.toBeInstanceOf(SaleStageConflictError);
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-salto'))).data()).toEqual(before);
    expect(await historyOf('s-salto')).toEqual([]);
    expect((await getDoc(doc(db, COLLECTIONS.contacts, 'c-1'))).get('classification')).toBe('persona_interesada');
  });

  it('el error dice la etapa de origen y la de destino', async () => {
    await expect(changeSaleStageIn(db, 's-1', 'contactado', 'ganada')).rejects.toThrow(
      'Cambio de etapa no permitido: de "Contactado" (contactado) a "Venta ganada" (ganada).',
    );
  });

  it('se revisa antes que el conflicto: un salto prohibido se rechaza aunque la etapa esperada no coincida', async () => {
    // s-1 está en "Contactado"; se dice que está en "Nuevo interesado" y se pide un salto prohibido.
    const attempt = changeSaleStageIn(db, 's-1', 'nuevo_interesado', 'ganada');
    await expect(attempt).rejects.toThrow(/no permitido/);
    await expect(attempt).rejects.not.toBeInstanceOf(SaleStageConflictError);
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
    await changeSaleStageIn(db, 's-1', 'contactado', 'cotizacion_enviada', 'Esto no es una pérdida');
    expect((await historyOf('s-1'))[1].lossReason).toBeNull();
  });

  it('no afecta a las demás ventas del contacto y la perdida no pasa directo a ganada', async () => {
    const before = (await getDoc(doc(db, COLLECTIONS.sales, 's-hermana'))).data();
    await changeSaleStageIn(db, 's-1', 'contactado', 'perdida', 'Motivo');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-hermana'))).data()).toEqual(before);
    await expect(changeSaleStageIn(db, 's-1', 'perdida', 'ganada')).rejects.toThrow(/no permitido/);
  });

  it('si la etapa guardada ya no es la esperada no escribe nada', async () => {
    // "Nuevo interesado" → "Venta perdida" es válida: el rechazo es por conflicto (está en "Contactado").
    await expect(changeSaleStageIn(db, 's-1', 'nuevo_interesado', 'perdida', 'Motivo')).rejects.toBeInstanceOf(SaleStageConflictError);
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).get('stage')).toBe('contactado');
    expect(await historyOf('s-1')).toHaveLength(1);
  });
});

describe('marcar una oportunidad de venta como ganada (HU-313)', () => {
  const classificationOf = async (id: string) => (await getDoc(doc(db, COLLECTIONS.contacts, id))).get('classification');

  it('una persona interesada pasa a cliente y la venta a "Venta ganada", con su registro en el historial', async () => {
    await toQuote('s-1');
    const result = await changeSaleStageIn(db, 's-1', 'cotizacion_enviada', 'ganada');

    expect(result).toEqual({ contactBecameClient: true, contactName: 'Ana Interesada' });
    expect(await classificationOf('c-1')).toBe('cliente');
    const sale = (await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).data()!;
    expect(sale.stage).toBe('ganada');
    expect(sale.stageChangedAt.toMillis()).toBeGreaterThan(baseSale.stageChangedAt.toMillis());
    const history = await historyOf('s-1');
    expect(history.map((h) => `${h.previousStage ?? '-'}>${h.newStage}`)).toEqual([
      '->contactado',
      'contactado>cotizacion_enviada',
      'cotizacion_enviada>ganada',
    ]);
    expect(history[2]).toMatchObject({ previousStage: 'cotizacion_enviada', newStage: 'ganada', lossReason: null });
    expect(history[2].changedAt.toMillis()).toBe(sale.stageChangedAt.toMillis());
  });

  it('solo se cambia la clasificación: el resto del contacto queda igual', async () => {
    await toQuote('s-1');
    await changeSaleStageIn(db, 's-1', 'cotizacion_enviada', 'ganada');
    expect((await getDoc(doc(db, COLLECTIONS.contacts, 'c-1'))).data()).toEqual({
      fullName: 'Ana Interesada',
      classification: 'cliente',
      status: 'activo',
      email: 'ana@example.com',
    });
  });

  it('si el contacto ya era cliente sigue siéndolo y no hay conversión', async () => {
    await toQuote('s-cliente');
    const result = await changeSaleStageIn(db, 's-cliente', 'cotizacion_enviada', 'ganada');
    expect(result).toEqual({ contactBecameClient: false, contactName: null });
    expect(await classificationOf('c-cliente')).toBe('cliente');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-cliente'))).get('stage')).toBe('ganada');
  });

  it('una clasificación antigua (fuera de las dos vigentes) no hace fallar la venta ni se convierte', async () => {
    // Desde 2026-11-08 solo existen "Persona interesada" y "Cliente"; un dato viejo se tolera sin tocarlo.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore();
      await setDoc(doc(admin, COLLECTIONS.contacts, 'c-antigua'), { fullName: 'Carla Antigua', classification: 'distribuidor', status: 'activo' });
      await setDoc(doc(admin, COLLECTIONS.sales, 's-antigua'), { ...baseSale, contactId: 'c-antigua', title: 'De una clasificación antigua' });
    });
    await toQuote('s-antigua');
    const result = await changeSaleStageIn(db, 's-antigua', 'cotizacion_enviada', 'ganada');
    expect(result).toEqual({ contactBecameClient: false, contactName: null });
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-antigua'))).get('stage')).toBe('ganada');
    expect(await classificationOf('c-antigua')).toBe('distribuidor');
  });

  it('si el contacto ya no existe la venta se gana igual y no se crea ningún contacto', async () => {
    await toQuote('s-sin-contacto');
    const result = await changeSaleStageIn(db, 's-sin-contacto', 'cotizacion_enviada', 'ganada');
    expect(result).toEqual({ contactBecameClient: false, contactName: null });
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-sin-contacto'))).get('stage')).toBe('ganada');
    expect((await getDoc(doc(db, COLLECTIONS.contacts, 'no-existe'))).exists()).toBe(false);
  });

  it('no afecta a las demás ventas ni a los demás contactos', async () => {
    const hermana = (await getDoc(doc(db, COLLECTIONS.sales, 's-hermana'))).data();
    await toQuote('s-1');
    await changeSaleStageIn(db, 's-1', 'cotizacion_enviada', 'ganada');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-hermana'))).data()).toEqual(hermana);
    expect(await classificationOf('c-cliente')).toBe('cliente');
    expect(await classificationOf('c-2')).toBe('persona_interesada');
  });

  it('es definitiva: una venta ganada ya no cambia de etapa', async () => {
    await toQuote('s-1');
    await changeSaleStageIn(db, 's-1', 'cotizacion_enviada', 'ganada');
    for (const to of ['nuevo_interesado', 'contactado', 'cotizacion_enviada', 'en_negociacion', 'perdida'] as const) {
      await expect(changeSaleStageIn(db, 's-1', 'ganada', to)).rejects.toThrow(/no permitido/);
    }
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).get('stage')).toBe('ganada');
  });

  it('es atómico: si la etapa ya cambió no se toca ni la venta ni el contacto', async () => {
    // "En negociación" → "Venta ganada" es válida: el rechazo es por conflicto (está en "Contactado").
    await expect(changeSaleStageIn(db, 's-1', 'en_negociacion', 'ganada')).rejects.toBeInstanceOf(SaleStageConflictError);
    await expect(changeSaleStageIn(db, 's-1', 'cotizacion_enviada', 'ganada')).rejects.toBeInstanceOf(SaleStageConflictError);
    expect(await classificationOf('c-1')).toBe('persona_interesada');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).get('stage')).toBe('contactado');
    expect(await historyOf('s-1')).toHaveLength(1);
  });

  it('ganar desde "En negociación" también funciona', async () => {
    await changeSaleStageIn(db, 's-hermana', 'en_negociacion', 'ganada');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-hermana'))).get('stage')).toBe('ganada');
    expect(await classificationOf('c-1')).toBe('cliente');
  });

  it('desde "Contactado" no se gana directo: no escribe nada ni convierte al contacto', async () => {
    await expect(changeSaleStageIn(db, 's-1', 'contactado', 'ganada')).rejects.toThrow(/no permitido/);
    expect(await classificationOf('c-1')).toBe('persona_interesada');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).get('stage')).toBe('contactado');
    expect(await historyOf('s-1')).toHaveLength(1);
  });

  it('sin sesión no cambia nada: ni la venta ni el contacto', async () => {
    const anon = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await toQuote('s-1');
    await assertFails(changeSaleStageIn(anon, 's-1', 'cotizacion_enviada', 'ganada'));
    expect(await classificationOf('c-1')).toBe('persona_interesada');
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-1'))).get('stage')).toBe('cotizacion_enviada');
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
    // "Venta perdida" → "En negociación" es válida (reabrir): el rechazo es por conflicto (está en "Contactado").
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

describe('reabrir arrastrando la tarjeta en el tablero (HU-312)', () => {
  // El tablero llama a changeSaleStage(id, 'perdida', destino) sin motivo: es la misma llamada que se prueba aquí.
  const OPEN_STAGES = ['nuevo_interesado', 'contactado', 'cotizacion_enviada', 'en_negociacion'] as const;

  it.each(OPEN_STAGES)('con otra abierta del mismo contacto y mismo título, soltar en %s no reabre ni escribe nada', async (to) => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), COLLECTIONS.sales, 's-igual'), { ...baseSale, title: 'Perdida', stage: 'en_negociacion' });
    });
    const before = (await getDoc(doc(db, COLLECTIONS.sales, 's-perdida'))).data();

    await expect(changeSaleStageIn(db, 's-perdida', 'perdida', to)).rejects.toBeInstanceOf(SaleReopenDuplicateTitleError);
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-perdida'))).data()).toEqual(before);
    expect(await historyOf('s-perdida')).toEqual([]);
    // La otra oportunidad abierta tampoco cambia.
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-igual'))).get('stage')).toBe('en_negociacion');
  });

  it.each(OPEN_STAGES)('sin duplicado, soltar en %s la reabre y agrega el registro al historial', async (to) => {
    await changeSaleStageIn(db, 's-perdida', 'perdida', to);
    expect((await getDoc(doc(db, COLLECTIONS.sales, 's-perdida'))).get('stage')).toBe(to);
    const history = await historyOf('s-perdida');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ saleId: 's-perdida', previousStage: 'perdida', newStage: to, lossReason: null });
  });
});
