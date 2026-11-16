// Bitácora del contacto (pantalla "Avisos") contra el emulador real de Firestore, con las reglas del repo y los
// datos del seed. Corre con: npm run test:emulators
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  SEED_ADMIN,
  seedCommunications,
  seedContacts,
  seedSales,
  seedStageHistory,
  seedUsers,
} from '../../scripts/seed/seedData';
import { isCreationEvent } from '../../src/sales/timeline';
import { listTimelineContactsIn, loadContactTimelineIn } from '../../src/sales/timelineRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';

const PROJECT_ID = 'demo-cani-crm-timeline';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;
let db: Firestore;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await testEnv.clearFirestore();
  // Los datos del seed tal cual (Date → Timestamp lo hace el SDK al guardar).
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();
    const groups: [string, { id: string; data: object }[]][] = [
      [COLLECTIONS.users, seedUsers],
      [COLLECTIONS.contacts, seedContacts],
      [COLLECTIONS.sales, seedSales],
      [COLLECTIONS.stageHistory, seedStageHistory],
      [COLLECTIONS.communications, seedCommunications],
    ];
    for (const [name, docs] of groups) {
      for (const { id, data } of docs) await setDoc(doc(admin, name, id), data);
    }
  });
  db = testEnv.authenticatedContext(SEED_ADMIN.uid).firestore() as unknown as Firestore;
});
afterAll(async () => {
  await testEnv?.cleanup();
});

const ids = async (contactId: string) => (await loadContactTimelineIn(db, contactId)).events.map((e) => e.id);

describe('bitácora con los datos del seed', () => {
  it('el buscador recibe todos los contactos (activos e inactivos) en orden alfabético', async () => {
    const contacts = await listTimelineContactsIn(db);
    expect(contacts.map((c) => c.id)).toEqual(['contact-001', 'contact-002', 'contact-003', 'contact-004', 'contact-005']);
  });

  it('Ana: comunicación del formulario web, cambios de etapa con motivo de pérdida y la creación, del más reciente al más antiguo', async () => {
    const timeline = await loadContactTimelineIn(db, 'contact-001');
    expect(timeline.truncated).toBe(false);
    expect(timeline.events.map((e) => e.id)).toEqual([
      'comm:comm-006',
      'stage:sale-004_03',
      'comm:comm-001',
      'stage:sale-004_02',
      'stage:sale-004_01',
    ]);
    const [form, lost, call, , created] = timeline.events;
    expect(form).toMatchObject({ kind: 'comunicacion', fromWebForm: true, saleLabel: 'Todas sus oportunidades de venta' });
    expect(lost).toMatchObject({ kind: 'etapa', previousStage: 'contactado', newStage: 'perdida', lossReason: 'El cliente eligió otro proveedor.' });
    expect(call).toMatchObject({ kind: 'comunicacion', fromWebForm: false, medium: 'Llamada telefónica', dateLabel: '28/09/2026' });
    expect(isCreationEvent(created)).toBe(true);
  });

  it('Bruno: junta los cambios de etapa de sus tres oportunidades y la comunicación de una de ellas lleva su título', async () => {
    const timeline = await loadContactTimelineIn(db, 'contact-002');
    expect(timeline.events).toHaveLength(15); // 2 comunicaciones + 4 + 5 + 4 cambios de etapa
    const at = timeline.events.map((e) => e.at);
    expect(at).toEqual([...at].sort((a, b) => b - a));
    const visit = timeline.events.find((e) => e.id === 'comm:comm-002');
    expect(visit).toMatchObject({ saleId: 'sale-001', saleLabel: expect.any(String) });
    const titles = new Set(timeline.events.flatMap((e) => (e.kind === 'etapa' ? [e.saleId] : [])));
    expect([...titles].sort()).toEqual(['sale-001', 'sale-003', 'sale-005']);
    expect(timeline.events.filter(isCreationEvent)).toHaveLength(3);
  });

  it('Carla y Elena: sus comunicaciones y los cambios de etapa de su única oportunidad', async () => {
    expect(await ids('contact-003')).toEqual(['comm:comm-004', 'stage:sale-002_03', 'stage:sale-002_02', 'stage:sale-002_01']);
    expect(await ids('contact-005')).toEqual(['stage:sale-006_01', 'comm:comm-005']);
  });

  it('Diego (sin comunicaciones ni oportunidades): sin eventos', async () => {
    expect(await loadContactTimelineIn(db, 'contact-004')).toEqual({ events: [], truncated: false });
  });

  it('un contacto que no existe: sin eventos (no falla)', async () => {
    expect((await loadContactTimelineIn(db, 'no-existe')).events).toEqual([]);
  });

  it('con un tope menor se queda con los más recientes y avisa', async () => {
    const timeline = await loadContactTimelineIn(db, 'contact-002', 3);
    expect(timeline.events).toHaveLength(3);
    expect(timeline.truncated).toBe(true);
  });

  it('las reglas no cambian: sin sesión de usuario activo no se puede leer', async () => {
    const anon = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(loadContactTimelineIn(anon, 'contact-001'));
  });
});

describe('índices compuestos que usan las consultas (producción los exige)', () => {
  const indexes = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')).indexes as {
    collectionGroup: string;
    fields: { fieldPath: string; order: string }[];
  }[];
  const has = (group: string, fields: string[]) =>
    indexes.some((i) => i.collectionGroup === group && i.fields.map((f) => `${f.fieldPath} ${f.order}`).join(',') === fields.join(','));

  it('comunicaciones: contactId + date desc + createdAt desc (el mismo del historial de la ficha, HU-213)', () => {
    expect(has('communications', ['contactId ASCENDING', 'date DESCENDING', 'createdAt DESCENDING'])).toBe(true);
  });

  it('historial de etapas: saleId + changedAt desc (el mismo del detalle de la venta, HU-308)', () => {
    expect(has('stageHistory', ['saleId ASCENDING', 'changedAt DESCENDING'])).toBe(true);
  });
});
