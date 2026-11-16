// Bitácora del contacto en "Avisos": combinar y ordenar comunicaciones y cambios de etapa (función pura).
import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import {
  buildTimeline,
  communicationInstant,
  filterTimeline,
  isCreationEvent,
  timelineFilterFromParam,
  truncatedMessage,
  type TimelineStageEntry,
} from '../../src/sales/timeline';
import type { Communication, Sale } from '../../src/shared/types';

// Costa Rica es UTC-6 todo el año.
const cr = (iso: string) => new Date(`${iso}-06:00`);
const at = (iso: string) => Timestamp.fromDate(cr(iso));

const sale = (id: string, title: string): Sale => ({
  id,
  contactId: 'c-1',
  title,
  stage: 'contactado',
  estimatedAmount: 1000,
  nextFollowUpAt: null,
  notes: '',
  createdAt: at('2026-09-01T09:00:00'),
  stageChangedAt: at('2026-09-01T09:00:00'),
  lastCommunicationAt: null,
});

const comm = (id: string, overrides: Partial<Communication> = {}): Communication => ({
  id,
  contactId: 'c-1',
  saleId: null,
  appliesToAllSales: true,
  date: at('2026-10-01T00:00:00'),
  medium: 'llamada',
  otherMedium: null,
  note: `Nota ${id}`,
  source: 'usuario',
  userId: 'u-1',
  createdAt: at('2026-10-01T10:00:00'),
  ...overrides,
});

const stage = (id: string, overrides: Partial<TimelineStageEntry> = {}): TimelineStageEntry => ({
  id,
  saleId: 's-1',
  previousStage: 'nuevo_interesado',
  newStage: 'contactado',
  changedAt: at('2026-10-01T12:00:00'),
  lossReason: null,
  ...overrides,
});

const sales = [sale('s-1', 'Café en grano'), sale('s-2', 'Distribución')];

describe('orden de la línea de tiempo', () => {
  it('combina comunicaciones y cambios de etapa, del más reciente al más antiguo', () => {
    const { events } = buildTimeline({
      communications: [comm('c1', { date: at('2026-10-05T00:00:00'), createdAt: at('2026-10-05T09:00:00') })],
      sales,
      history: [
        stage('h1', { previousStage: null, newStage: 'nuevo_interesado', changedAt: at('2026-09-01T09:00:00') }),
        stage('h2', { changedAt: at('2026-10-07T15:00:00') }),
      ],
    });
    expect(events.map((e) => e.id)).toEqual(['stage:h2', 'comm:c1', 'stage:h1']);
  });

  it('una comunicación registrada el mismo día se ordena por la hora de registro frente a un cambio de etapa', () => {
    const { events } = buildTimeline({
      communications: [comm('c1', { date: at('2026-10-01T00:00:00'), createdAt: at('2026-10-01T16:00:00') })],
      sales,
      history: [stage('h1', { changedAt: at('2026-10-01T12:00:00') })],
    });
    expect(events.map((e) => e.id)).toEqual(['comm:c1', 'stage:h1']);
  });

  it('una comunicación registrada días después usa el día indicado (00:00), no la hora del registro', () => {
    const c = comm('c1', { date: at('2026-10-01T00:00:00'), createdAt: at('2026-10-09T16:00:00') });
    expect(communicationInstant(c)).toBe(cr('2026-10-01T00:00:00').getTime());
    const { events } = buildTimeline({ communications: [c], sales, history: [stage('h1', { changedAt: at('2026-10-03T08:00:00') })] });
    expect(events.map((e) => e.id)).toEqual(['stage:h1', 'comm:c1']);
  });

  it('las del formulario web se ordenan por la fecha y hora exactas del envío', () => {
    const c = comm('c1', { source: 'formulario_web', userId: null, date: at('2026-10-12T18:20:00'), createdAt: at('2026-10-12T18:20:05') });
    expect(communicationInstant(c)).toBe(cr('2026-10-12T18:20:00').getTime());
  });

  it('empates de instante: cambio de etapa, luego comunicación, luego creación; y después por id, siempre igual', () => {
    const same = at('2026-10-01T12:00:00');
    const source = {
      communications: [comm('c1', { date: at('2026-10-01T00:00:00'), createdAt: same }), comm('c2', { date: at('2026-10-01T00:00:00'), createdAt: same })],
      sales,
      history: [
        stage('h0', { saleId: 's-2', previousStage: null, newStage: 'nuevo_interesado', changedAt: same }),
        stage('h1', { changedAt: same }),
      ],
    };
    const ids = buildTimeline(source).events.map((e) => e.id);
    expect(ids).toEqual(['stage:h1', 'comm:c2', 'comm:c1', 'stage:h0']);
    // El resultado no depende del orden de entrada.
    const reversed = buildTimeline({
      ...source,
      communications: [...source.communications].reverse(),
      history: [...source.history].reverse(),
    });
    expect(reversed.events.map((e) => e.id)).toEqual(ids);
  });
});

describe('cambios de etapa', () => {
  it('la entrada inicial (sin etapa anterior) es la creación de la oportunidad, con su título', () => {
    const [event] = buildTimeline({
      communications: [],
      sales,
      history: [stage('h1', { previousStage: null, newStage: 'nuevo_interesado', changedAt: at('2026-09-15T09:00:00') })],
    }).events;
    expect(isCreationEvent(event)).toBe(true);
    expect(event).toMatchObject({ kind: 'etapa', saleTitle: 'Café en grano', previousStage: null, newStage: 'nuevo_interesado', dateLabel: '15/09/2026', lossReason: null });
  });

  it('un cambio normal no es creación y no tiene motivo', () => {
    const [event] = buildTimeline({ communications: [], sales, history: [stage('h1')] }).events;
    expect(isCreationEvent(event)).toBe(false);
    expect(event).toMatchObject({ previousStage: 'nuevo_interesado', newStage: 'contactado', lossReason: null });
  });

  it('a "Venta perdida" lleva el motivo; sin motivo dice "Sin motivo registrado"', () => {
    const { events } = buildTimeline({
      communications: [],
      sales,
      history: [
        stage('h1', { newStage: 'perdida', lossReason: 'Eligió otro proveedor.', changedAt: at('2026-10-02T10:00:00') }),
        stage('h2', { saleId: 's-2', newStage: 'perdida', lossReason: '  ', changedAt: at('2026-10-01T10:00:00') }),
      ],
    });
    expect(events.map((e) => (e.kind === 'etapa' ? e.lossReason : null))).toEqual(['Eligió otro proveedor.', 'Sin motivo registrado']);
  });

  it('si la oportunidad no aparece, el título es "—"', () => {
    const [event] = buildTimeline({ communications: [], sales: [], history: [stage('h1')] }).events;
    expect(event).toMatchObject({ saleTitle: '—' });
  });
});

describe('comunicaciones', () => {
  it('con oportunidad: muestra su título; para todas: "Todas sus oportunidades de venta"', () => {
    const { events } = buildTimeline({
      communications: [
        comm('c1', { saleId: 's-2', appliesToAllSales: false, createdAt: at('2026-10-01T11:00:00') }),
        comm('c2', { saleId: null, appliesToAllSales: true, createdAt: at('2026-10-01T10:00:00') }),
      ],
      sales,
      history: [],
    });
    expect(events.map((e) => (e.kind === 'comunicacion' ? [e.saleId, e.saleLabel] : null))).toEqual([
      ['s-2', 'Distribución'],
      [null, 'Todas sus oportunidades de venta'],
    ]);
  });

  it('sin oportunidad y sin "todas": no muestra oportunidad', () => {
    const [event] = buildTimeline({ communications: [comm('c1', { appliesToAllSales: false })], sales, history: [] }).events;
    expect(event).toMatchObject({ saleId: null, saleLabel: null });
  });

  it('registrada a mano: medio, nota y fecha dd/mm/aaaa; "Otro" lleva lo escrito', () => {
    const { events } = buildTimeline({
      communications: [
        comm('c1', { medium: 'whatsapp', createdAt: at('2026-10-01T11:00:00') }),
        comm('c2', { medium: 'otro', otherMedium: 'Instagram' }),
      ],
      sales,
      history: [],
    });
    expect(events[0]).toMatchObject({ medium: 'WhatsApp', note: 'Nota c1', fromWebForm: false, dateLabel: '01/10/2026' });
    expect(events[1]).toMatchObject({ medium: 'Otro: Instagram' });
  });

  it('del formulario web: se marca el origen y la fecha lleva la hora del envío', () => {
    const [event] = buildTimeline({
      communications: [comm('c1', { medium: 'formulario_web', source: 'formulario_web', userId: null, date: at('2026-10-05T18:20:00') })],
      sales,
      history: [],
    }).events;
    expect(event).toMatchObject({ kind: 'comunicacion', medium: 'Formulario web', fromWebForm: true, dateLabel: '05/10/2026 6:20 p. m.' });
  });

  it('no incluye quién la registró', () => {
    const [event] = buildTimeline({ communications: [comm('c1')], sales, history: [] }).events;
    expect(JSON.stringify(event)).not.toContain('u-1');
  });
});

describe('tope, filtro y URL', () => {
  it('se queda con los más recientes y avisa que hay más', () => {
    const communications = Array.from({ length: 5 }, (_, i) =>
      comm(`c${i}`, { date: at(`2026-10-0${i + 1}T00:00:00`), createdAt: at(`2026-10-0${i + 1}T09:00:00`) }),
    );
    const result = buildTimeline({ communications, sales, history: [] }, 3);
    expect(result.events.map((e) => e.id)).toEqual(['comm:c4', 'comm:c3', 'comm:c2']);
    expect(result.truncated).toBe(true);
    expect(buildTimeline({ communications, sales, history: [] }, 5).truncated).toBe(false);
    expect(buildTimeline({ communications, sales, history: [], truncated: true }, 5).truncated).toBe(true);
    expect(truncatedMessage(100)).toBe('Se muestran los 100 eventos más recientes.');
  });

  it('sin datos no hay eventos', () => {
    expect(buildTimeline({ communications: [], sales: [], history: [] })).toEqual({ events: [], truncated: false });
  });

  it('filtra por tipo de evento', () => {
    const { events } = buildTimeline({ communications: [comm('c1')], sales, history: [stage('h1'), stage('h0', { previousStage: null, newStage: 'nuevo_interesado' })] });
    expect(filterTimeline(events, 'todos')).toHaveLength(3);
    expect(filterTimeline(events, 'comunicaciones').map((e) => e.kind)).toEqual(['comunicacion']);
    expect(filterTimeline(events, 'etapas').every((e) => e.kind === 'etapa')).toBe(true);
    expect(filterTimeline(events, 'etapas')).toHaveLength(2);
  });

  it('lee el filtro de la URL; un valor desconocido es "Todos"', () => {
    expect(timelineFilterFromParam('comunicaciones')).toBe('comunicaciones');
    expect(timelineFilterFromParam('etapas')).toBe('etapas');
    expect(timelineFilterFromParam('x')).toBe('todos');
    expect(timelineFilterFromParam(null)).toBe('todos');
  });
});
