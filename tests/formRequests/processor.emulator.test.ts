// HU-502 y HU-503: procesamiento de las solicitudes del formulario contra el emulador real de Firestore, con las reglas
// del repo. Las solicitudes las crea el "sitio público" sin sesión, y en una prueba el sitio público de verdad
// (Firestore Lite). El procesamiento corre con la sesión de un administrador. Corre con: npm run test:emulators
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { connectFirestoreEmulator, getFirestore as getLiteFirestore, type Firestore as LiteFirestore } from 'firebase/firestore/lite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { guardarSolicitudIn, nuevoIdSolicitudIn } from '../../sitio-publico/src/formulario/guardarSolicitud';
import { CLAIM_TTL_MS, REJECT_REASONS } from '../../src/formRequests/formRequestProcessing';
import { claimRequestIn, listenPendingRequestsIn, processRequestIn } from '../../src/formRequests/formRequestsRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';
import { FORM_REQUESTS_COLLECTION as REQUESTS } from '../../src/shared/types/formRequest';

const PROJECT_ID = 'demo-cani-crm-processor';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;
let liteApp: FirebaseApp;
let lite: LiteFirestore;

const admin = (uid = 'admin-1') => testEnv.authenticatedContext(uid).firestore() as unknown as Firestore;
const publico = () => testEnv.unauthenticatedContext().firestore() as unknown as Firestore;

/** El sitio público crea la solicitud, sin sesión (pasa por las reglas de Dylan). */
async function submit(id: string, changes: Record<string, unknown> = {}) {
  await setDoc(doc(publico(), REQUESTS, id), {
    fullName: 'Persona Nueva',
    email: 'persona.nueva@example.com',
    phoneCountry: 'CR',
    phoneNumber: '88112233',
    interests: [
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 10 },
    ],
    message: 'Quiero precios para mi cafetería.',
    submittedAt: serverTimestamp(),
    processed: false,
    ...changes,
  });
}

/** Lee como administrador (con reglas) y devuelve los datos. */
const read = async (path: string, id: string) => (await getDoc(doc(admin(), path, id))).data()!;

async function contactsWhere(field: string, value: string) {
  return (await getDocs(query(collection(admin(), COLLECTIONS.contacts), where(field, '==', value)))).docs;
}

async function communicationsOf(contactId: string) {
  return (await getDocs(query(collection(admin(), COLLECTIONS.communications), where('contactId', '==', contactId)))).docs.map(
    (d) => d.data(),
  );
}

async function seedContact(id: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), COLLECTIONS.contacts, id), {
      fullName: 'Ana Prueba Mora',
      nameSortKey: 'ana prueba mora',
      email: 'ana@example.com',
      phoneCountry: 'CR',
      phoneNumber: '70001111',
      address: 'San José',
      classification: 'cliente',
      status: 'activo',
      origin: 'referido',
      createdAt: Timestamp.fromDate(new Date('2026-09-01T15:00:00Z')),
      ...data,
    });
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  liteApp = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-api-key' }, 'publico-lite-processor');
  lite = getLiteFirestore(liteApp);
  connectFirestoreEmulator(lite, host, Number(port));
});

afterAll(async () => {
  await deleteApp(liteApp);
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    for (const uid of ['admin-1', 'admin-2']) {
      await setDoc(doc(fs, COLLECTIONS.users, uid), { username: uid, email: `${uid}@example.com`, active: true });
    }
    const product = (id: string, name: string, presentation: string, active = true) =>
      setDoc(doc(fs, COLLECTIONS.products, id), { name, presentation, description: '', active });
    await product('p1', 'Villa Sarchí', 'Bolsa de 340 g, grano entero');
    await product('p2', 'Caturra', 'Bolsa de 1 kg, molido');
    await product('p3', 'Geisha', 'Bolsa de 250 g, grano entero', false);
  });
});

describe('HU-502 persona nueva', () => {
  it('crea el contacto, sus productos de interés y la comunicación; cierra la solicitud; no crea ninguna venta', async () => {
    await submit('s1');
    const result = await processRequestIn(admin(), 's1', 'admin-1');
    expect(result).toMatchObject({ status: 'processed', outcome: 'created' });
    const contactId = (result as { contactId: string }).contactId;
    const request = await read(REQUESTS, 's1');

    // Criterio 2: nombre, correo y teléfono; "Persona interesada" y origen "Formulario web".
    const contact = await read(COLLECTIONS.contacts, contactId);
    expect(contact).toMatchObject({
      fullName: 'Persona Nueva',
      nameSortKey: 'persona nueva',
      email: 'persona.nueva@example.com',
      phoneCountry: 'CR',
      phoneNumber: '88112233',
      address: null,
      classification: 'persona_interesada',
      status: 'activo',
      origin: 'formulario_web',
      formBadge: 'Nuevo',
    });
    // Fecha de registro = la del envío (no la del procesamiento).
    expect(contact.createdAt.toMillis()).toBe(request.submittedAt.toMillis());
    // Criterio 3: productos marcados con sus cantidades.
    expect(contact.interests).toEqual([
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 10 },
    ]);
    expect(contact.interestsUpdatedAt.toMillis()).toBe(request.submittedAt.toMillis());

    // Criterio 4: el mensaje en el historial, con la fecha y hora del envío, medio "Formulario web", y la nota con el
    // mensaje y los productos con sus cantidades.
    const [communication] = await communicationsOf(contactId);
    expect(communication).toMatchObject({
      medium: 'formulario_web',
      source: 'formulario_web',
      userId: null,
      saleId: null,
      appliesToAllSales: true,
      otherMedium: null,
      note:
        'Quiero precios para mi cafetería.\n\nProductos:\n- Villa Sarchí (Bolsa de 340 g, grano entero): 2\n- Caturra (Bolsa de 1 kg, molido): 10',
      products: [
        { productId: 'p1', name: 'Villa Sarchí', presentation: 'Bolsa de 340 g, grano entero', quantity: 2 },
        { productId: 'p2', name: 'Caturra', presentation: 'Bolsa de 1 kg, molido', quantity: 10 },
      ],
    });
    expect(communication.date.toMillis()).toBe(request.submittedAt.toMillis());

    // Criterio 5: ninguna posible venta.
    expect((await getDocs(collection(admin(), COLLECTIONS.sales))).size).toBe(0);
    // La solicitud queda cerrada (se conserva).
    expect(request).toMatchObject({ processed: true, outcome: 'created', contactId, claimedBy: 'admin-1' });
  });

  it('sin mensaje: la nota dice "Sin mensaje"; sin teléfono: el contacto queda sin teléfono', async () => {
    await submit('s1', { message: null, phoneCountry: null, phoneNumber: null });
    const { contactId } = (await processRequestIn(admin(), 's1', 'admin-1')) as { contactId: string };
    expect(await read(COLLECTIONS.contacts, contactId)).toMatchObject({ phoneCountry: null, phoneNumber: null });
    expect((await communicationsOf(contactId))[0].note.startsWith('Sin mensaje\n\nProductos:')).toBe(true);
  });
});

describe('HU-503 persona ya registrada', () => {
  it('el mismo correo otra vez: no duplica, reemplaza los productos y agrega la comunicación', async () => {
    await submit('s1');
    const first = (await processRequestIn(admin(), 's1', 'admin-1')) as { contactId: string };
    await submit('s2', { interests: [{ productId: 'p3', quantity: 5 }], message: null });
    const second = await processRequestIn(admin(), 's2', 'admin-1');

    expect(second).toMatchObject({ status: 'processed', outcome: 'updated', contactId: first.contactId });
    expect(await contactsWhere('email', 'persona.nueva@example.com')).toHaveLength(1);
    const contact = await read(COLLECTIONS.contacts, first.contactId);
    // Criterio 2: reemplazados (el inactivo p3 se acepta).
    expect(contact.interests).toEqual([{ productId: 'p3', quantity: 5 }]);
    // HU-504: seguía en "Nuevo" sin abrir, así que sigue en "Nuevo".
    expect(contact.formBadge).toBe('Nuevo');
    // Criterio 3: dos comunicaciones en el historial.
    const notes = (await communicationsOf(first.contactId)).map((c) => c.note);
    expect(notes).toHaveLength(2);
    expect(notes).toContain('Sin mensaje\n\nProductos:\n- Geisha (Bolsa de 250 g, grano entero): 5');
  });

  it('coincidencia por teléfono (mismo país y número) cuando el correo es otro; la diferencia se anota', async () => {
    await seedContact('ana', { email: 'ana@example.com', phoneCountry: 'CR', phoneNumber: '88112233' });
    await submit('s1', { email: 'ana.otro@example.com' });
    const result = await processRequestIn(admin(), 's1', 'admin-1');
    expect(result).toMatchObject({ outcome: 'updated', contactId: 'ana' });
    expect(await contactsWhere('email', 'ana.otro@example.com')).toHaveLength(0);
    const [communication] = await communicationsOf('ana');
    expect(communication.note.endsWith('Datos enviados distintos a los registrados: Nombre: Persona Nueva. Correo: ana.otro@example.com.')).toBe(true);
  });

  it('el mismo número en otro país NO es la misma persona', async () => {
    await seedContact('ana', { email: 'ana@example.com', phoneCountry: 'US', phoneNumber: '88112233' });
    await submit('s1', { email: 'otra@example.com' });
    expect(await processRequestIn(admin(), 's1', 'admin-1')).toMatchObject({ outcome: 'created' });
  });

  it('un contacto inactivo se encuentra y se reactiva; mantiene su clasificación; nombre, correo y teléfono no cambian', async () => {
    await seedContact('ana', { status: 'inactivo', classification: 'cliente', formBadge: null });
    await submit('s1', { fullName: 'ANA PRUEBA MORA', email: 'ana@example.com', phoneNumber: '88112233' });
    expect(await processRequestIn(admin(), 's1', 'admin-1')).toMatchObject({ outcome: 'updated', contactId: 'ana' });
    const contact = await read(COLLECTIONS.contacts, 'ana');
    expect(contact).toMatchObject({
      status: 'activo',
      classification: 'cliente',
      fullName: 'Ana Prueba Mora',
      email: 'ana@example.com',
      phoneCountry: 'CR',
      phoneNumber: '70001111',
      origin: 'referido',
      formBadge: 'Nuevo mensaje',
    });
    // Criterio 5: solo el teléfono es distinto (el nombre difiere solo en mayúsculas), con el formato de la HU.
    const [communication] = await communicationsOf('ana');
    expect(communication.note.endsWith('Datos enviados distintos a los registrados: Teléfono: +506 8811-2233.')).toBe(true);
  });

  it('un dato guardado vacío y uno enviado con valor se anota y no se rellena', async () => {
    await seedContact('ana', { phoneCountry: null, phoneNumber: null });
    await submit('s1', { fullName: 'Ana Prueba Mora', email: 'ana@example.com' });
    await processRequestIn(admin(), 's1', 'admin-1');
    expect(await read(COLLECTIONS.contacts, 'ana')).toMatchObject({ phoneCountry: null, phoneNumber: null });
    const [communication] = await communicationsOf('ana');
    expect(communication.note.endsWith('Teléfono: +506 8811-2233.')).toBe(true);
  });

  it('lastCommunicationAt de una venta abierta se actualiza; una ganada no; nunca retrocede', async () => {
    await seedContact('ana', {});
    const future = Timestamp.fromDate(new Date(Date.now() + 86_400_000));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const sale = (id: string, stage: string, lastCommunicationAt: Timestamp | null) =>
        setDoc(doc(ctx.firestore(), COLLECTIONS.sales, id), {
          contactId: 'ana',
          title: id,
          stage,
          estimatedAmount: 1000,
          nextFollowUpAt: null,
          notes: '',
          createdAt: Timestamp.now(),
          stageChangedAt: Timestamp.now(),
          lastCommunicationAt,
        });
      await sale('abierta', 'contactado', Timestamp.fromDate(new Date('2026-09-01T15:00:00Z')));
      await sale('ganada', 'ganada', null);
      await sale('mas-reciente', 'en_negociacion', future);
    });
    await submit('s1', { email: 'ana@example.com' });
    await processRequestIn(admin(), 's1', 'admin-1');
    const submittedAt = (await read(REQUESTS, 's1')).submittedAt.toMillis();
    expect((await read(COLLECTIONS.sales, 'abierta')).lastCommunicationAt.toMillis()).toBe(submittedAt);
    expect((await read(COLLECTIONS.sales, 'ganada')).lastCommunicationAt).toBeNull();
    expect((await read(COLLECTIONS.sales, 'mas-reciente')).lastCommunicationAt.toMillis()).toBe(future.toMillis());
  });
});

describe('productos de la solicitud (contrato v3, punto 9)', () => {
  it('un producto que no existe se omite y la nota lo dice', async () => {
    await submit('s1', { interests: [{ productId: 'p1', quantity: 2 }, { productId: 'borrado', quantity: 4 }] });
    const { contactId } = (await processRequestIn(admin(), 's1', 'admin-1')) as { contactId: string };
    expect((await read(COLLECTIONS.contacts, contactId)).interests).toEqual([{ productId: 'p1', quantity: 2 }]);
    expect((await communicationsOf(contactId))[0].note).toContain('Productos no disponibles omitidos: 1.');
  });

  it('si ninguno existe, se rechaza sin tocar contactos', async () => {
    await submit('s1', { interests: [{ productId: 'borrado', quantity: 4 }] });
    expect(await processRequestIn(admin(), 's1', 'admin-1')).toEqual({
      status: 'processed',
      outcome: 'rejected',
      error: REJECT_REASONS.noneAvailable,
    });
    expect((await getDocs(collection(admin(), COLLECTIONS.contacts))).size).toBe(0);
  });

  it('una cantidad inválida rechaza la solicitud completa, con su motivo, sin tocar contactos', async () => {
    await submit('s1', { interests: [{ productId: 'p1', quantity: 2 }, { productId: 'p2', quantity: 0 }] });
    expect(await processRequestIn(admin(), 's1', 'admin-1')).toMatchObject({ outcome: 'rejected' });
    expect(await read(REQUESTS, 's1')).toMatchObject({ processed: true, outcome: 'rejected', error: REJECT_REASONS.quantity });
    expect((await getDocs(collection(admin(), COLLECTIONS.contacts))).size).toBe(0);
    expect((await getDocs(collection(admin(), COLLECTIONS.communications))).size).toBe(0);
  });
});

describe('doble procesamiento', () => {
  it('dos procesadores a la vez sobre la misma solicitud: se procesa una sola vez', async () => {
    await submit('s1');
    const results = await Promise.all([
      processRequestIn(admin('admin-1'), 's1', 'admin-1'),
      processRequestIn(admin('admin-2'), 's1', 'admin-2'),
    ]);
    expect(results.filter((r) => r.status === 'processed')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'skipped')).toHaveLength(1);
    expect(await contactsWhere('email', 'persona.nueva@example.com')).toHaveLength(1);
    expect((await getDocs(collection(admin(), COLLECTIONS.communications))).size).toBe(1);
  });

  it('una solicitud ya procesada no se vuelve a procesar', async () => {
    await submit('s1');
    await processRequestIn(admin(), 's1', 'admin-1');
    expect(await processRequestIn(admin(), 's1', 'admin-1')).toEqual({ status: 'skipped' });
    expect((await getDocs(collection(admin(), COLLECTIONS.communications))).size).toBe(1);
  });

  it('un reclamo de menos de 2 minutos se respeta; uno vencido se retoma', async () => {
    await submit('s1');
    expect(await claimRequestIn(admin('admin-1'), 's1', 'admin-1')).not.toBeNull();
    // Otro administrador, enseguida: se salta.
    expect(await processRequestIn(admin('admin-2'), 's1', 'admin-2')).toEqual({ status: 'skipped' });
    // Pasados 2 minutos (el navegador del primero se cerró a la mitad), el otro la retoma.
    const later = () => Date.now() + CLAIM_TTL_MS + 1000;
    expect(await processRequestIn(admin('admin-2'), 's1', 'admin-2', later)).toMatchObject({ outcome: 'created' });
    expect(await read(REQUESTS, 's1')).toMatchObject({ claimedBy: 'admin-2', processed: true });
  });

  it('si quien la reclamó la cerró, otro ya no la toma aunque su reclamo haya vencido', async () => {
    await submit('s1');
    const late = () => Date.now() + CLAIM_TTL_MS + 1000;
    await claimRequestIn(admin('admin-1'), 's1', 'admin-1');
    await updateDoc(doc(admin('admin-1'), REQUESTS, 's1'), {
      processed: true,
      processedAt: serverTimestamp(),
      outcome: 'rejected',
      error: 'cerrada por otro',
    });
    expect(await processRequestIn(admin('admin-2'), 's1', 'admin-2', late)).toEqual({ status: 'skipped' });
    expect((await getDocs(collection(admin(), COLLECTIONS.contacts))).size).toBe(0);
  });
});

describe('pendientes y envío real del sitio público', () => {
  it('escucha las pendientes en orden de envío', async () => {
    await submit('s1');
    await submit('s2', { email: 'otra@example.com' });
    const seen: string[][] = [];
    const stop = listenPendingRequestsIn(admin(), (ids) => seen.push(ids));
    await expect.poll(() => seen.at(-1)).toEqual(['s1', 's2']);
    await processRequestIn(admin(), 's1', 'admin-1');
    await expect.poll(() => seen.at(-1)).toEqual(['s2']);
    stop();
  });

  it('de extremo a extremo: el sitio público envía con Firestore Lite y el procesamiento crea el contacto', async () => {
    const id = nuevoIdSolicitudIn(lite);
    await guardarSolicitudIn(lite, id, {
      fullName: 'Persona Del Sitio',
      email: 'sitio@example.com',
      phoneCountry: 'US',
      phoneNumber: '3055550104',
      interests: [{ productId: 'p2', quantity: 3 }],
      message: null,
    });
    const result = await processRequestIn(admin(), id, 'admin-1');
    expect(result).toMatchObject({ status: 'processed', outcome: 'created' });
    const contact = await read(COLLECTIONS.contacts, (result as { contactId: string }).contactId);
    expect(contact).toMatchObject({
      fullName: 'Persona Del Sitio',
      email: 'sitio@example.com',
      phoneCountry: 'US',
      phoneNumber: '3055550104',
      origin: 'formulario_web',
      interests: [{ productId: 'p2', quantity: 3 }],
    });
  });

  it('sin sesión no se puede procesar', async () => {
    await submit('s1');
    await expect(processRequestIn(publico(), 's1', 'nadie')).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
