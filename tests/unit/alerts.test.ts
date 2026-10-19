import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import {
  ALERT_KIND_LABELS,
  buildAlerts,
  buildFollowUpAlerts,
  calendarDaysBetween,
  followUpAlert,
  followUpOverdueMessage,
  followUpTodayMessage,
  noCommunicationAlert,
  noCommunicationMessage,
  type AlertContact,
} from '../../src/sales/alerts';
import { SALE_STAGES, type Sale, type SaleStage } from '../../src/shared/types';

// Costa Rica es UTC-6 todo el año: 00:00 del 19/10/2026 en CR = 06:00 UTC.
const cr = (iso: string) => new Date(`${iso}-06:00`);
const NOW = cr('2026-10-19T12:00:00');

const sale = (overrides: Partial<Sale> = {}): Sale => ({
  id: 'sale-1',
  contactId: 'c-1',
  title: 'Café en grano',
  stage: 'contactado',
  estimatedAmount: 100_000,
  nextFollowUpAt: Timestamp.fromDate(cr('2026-10-19T09:00:00')),
  notes: '',
  createdAt: Timestamp.fromDate(cr('2026-09-01T09:00:00')),
  stageChangedAt: Timestamp.fromDate(cr('2026-09-01T09:00:00')),
  lastCommunicationAt: null,
  ...overrides,
});
const followUp = (iso: string | null) => (iso ? Timestamp.fromDate(cr(iso)) : null);
const ana: AlertContact = { fullName: 'Ana Prueba Mora', status: 'activo' };

describe('HU-314 criterio 1: el día del seguimiento, desde las 00:00', () => {
  it('con el seguimiento hoy: "Seguimiento programado para hoy con [contacto] – [título]."', () => {
    const alert = followUpAlert(sale(), ana, NOW);
    expect(alert).toMatchObject({ kind: 'seguimiento_hoy', saleId: 'sale-1', contactName: 'Ana Prueba Mora' });
    expect(alert?.message).toBe('Seguimiento programado para hoy con Ana Prueba Mora – Café en grano.');
  });

  it('aparece desde las 00:00 de ese día (hora de Costa Rica) y no antes', () => {
    const s = sale({ nextFollowUpAt: followUp('2026-10-19T00:00:00') });
    expect(followUpAlert(s, ana, cr('2026-10-18T23:59:59'))).toBeNull();
    expect(followUpAlert(s, ana, cr('2026-10-19T00:00:00'))?.kind).toBe('seguimiento_hoy');
  });

  it('un seguimiento a futuro no genera aviso', () => {
    expect(followUpAlert(sale({ nextFollowUpAt: followUp('2026-10-20T00:00:00') }), ana, NOW)).toBeNull();
  });
});

describe('HU-314 criterio 2: pasado el día pasa a vencido', () => {
  it('"Seguimiento vencido desde el [fecha] con [contacto] – [título]." con la fecha dd/mm/aaaa', () => {
    const alert = followUpAlert(sale({ nextFollowUpAt: followUp('2026-10-12T10:00:00') }), ana, NOW);
    expect(alert?.kind).toBe('seguimiento_vencido');
    expect(alert?.message).toBe('Seguimiento vencido desde el 12/10/2026 con Ana Prueba Mora – Café en grano.');
  });

  it('a las 23:59:59 del día sigue siendo "para hoy"; a las 00:00 del siguiente es "vencido"', () => {
    const s = sale({ nextFollowUpAt: followUp('2026-10-19T09:00:00') });
    expect(followUpAlert(s, ana, cr('2026-10-19T23:59:59'))?.kind).toBe('seguimiento_hoy');
    expect(followUpAlert(s, ana, cr('2026-10-20T00:00:00'))?.kind).toBe('seguimiento_vencido');
  });

  it('los textos son los del documento', () => {
    expect(followUpTodayMessage('Ana', 'Venta')).toBe('Seguimiento programado para hoy con Ana – Venta.');
    expect(followUpOverdueMessage(cr('2026-10-01T10:00:00'), 'Ana', 'Venta')).toBe(
      'Seguimiento vencido desde el 01/10/2026 con Ana – Venta.',
    );
  });
});

describe('HU-314 criterio 3: cuándo desaparece', () => {
  it('si se borra la fecha de seguimiento', () => {
    expect(followUpAlert(sale({ nextFollowUpAt: null }), ana, NOW)).toBeNull();
  });

  it('si se programa una fecha nueva a futuro (el aviso vencido se va)', () => {
    const vencida = sale({ nextFollowUpAt: followUp('2026-10-12T10:00:00') });
    expect(followUpAlert(vencida, ana, NOW)).not.toBeNull();
    expect(followUpAlert({ ...vencida, nextFollowUpAt: followUp('2026-10-30T10:00:00') }, ana, NOW)).toBeNull();
  });

  it.each(['ganada', 'perdida'] as const)('si la posible venta se pasa a "%s"', (stage) => {
    expect(followUpAlert(sale({ stage }), ana, NOW)).toBeNull();
  });

  it('si el contacto se desactiva', () => {
    expect(followUpAlert(sale(), { ...ana, status: 'inactivo' }, NOW)).toBeNull();
  });

  it('registrar una comunicación no quita el aviso', () => {
    const conComunicacion = sale({ lastCommunicationAt: Timestamp.fromDate(NOW) });
    expect(followUpAlert(conComunicacion, ana, NOW)?.kind).toBe('seguimiento_hoy');
  });
});

describe('HU-314 criterio 4: solo ventas abiertas de contactos activos', () => {
  it.each(SALE_STAGES)('etapa "%s"', (stage: SaleStage) => {
    const open = stage !== 'ganada' && stage !== 'perdida';
    expect(followUpAlert(sale({ stage }), ana, NOW) !== null).toBe(open);
  });

  it('un contacto que no existe no genera aviso', () => {
    expect(followUpAlert(sale(), undefined, NOW)).toBeNull();
  });
});

describe('lista de avisos', () => {
  const contacts = new Map<string, AlertContact>([
    ['c-1', ana],
    ['c-2', { fullName: 'Bruno Ficticio', status: 'activo' }],
    ['c-3', { fullName: 'Carla Inactiva', status: 'inactivo' }],
  ]);

  it('devuelve solo los que corresponden, los más antiguos primero', () => {
    const sales = [
      sale({ id: 'hoy', contactId: 'c-1', nextFollowUpAt: followUp('2026-10-19T09:00:00') }),
      sale({ id: 'reciente', contactId: 'c-2', nextFollowUpAt: followUp('2026-10-17T09:00:00') }),
      sale({ id: 'antiguo', contactId: 'c-1', nextFollowUpAt: followUp('2026-10-05T09:00:00') }),
      sale({ id: 'futuro', contactId: 'c-1', nextFollowUpAt: followUp('2026-11-01T09:00:00') }),
      sale({ id: 'inactivo', contactId: 'c-3', nextFollowUpAt: followUp('2026-10-05T09:00:00') }),
      sale({ id: 'perdida', contactId: 'c-1', stage: 'perdida', nextFollowUpAt: followUp('2026-10-05T09:00:00') }),
      sale({ id: 'sin-fecha', contactId: 'c-1', nextFollowUpAt: null }),
    ];
    expect(buildFollowUpAlerts(sales, contacts, NOW).map((a) => a.saleId)).toEqual(['antiguo', 'reciente', 'hoy']);
  });

  it('sin ventas no hay avisos', () => {
    expect(buildFollowUpAlerts([], contacts, NOW)).toEqual([]);
  });
});

// ---------------------------------------------------------------- HU-315

const lastComm = (iso: string | null) => (iso ? Timestamp.fromDate(cr(iso)) : null);
const quiet = (overrides: Partial<Sale> = {}) => sale({ nextFollowUpAt: null, lastCommunicationAt: lastComm('2026-10-01T10:00:00'), ...overrides });

describe('HU-315 criterio 1 y 2: más de 10 días sin comunicaciones', () => {
  it('"[Contacto] – [título] no tiene comunicaciones desde hace [número] días."', () => {
    const alert = noCommunicationAlert(quiet(), ana, cr('2026-10-12T08:00:00'));
    expect(alert).toMatchObject({ kind: 'sin_comunicacion', saleId: 'sale-1' });
    expect(alert?.message).toBe('Ana Prueba Mora – Café en grano no tiene comunicaciones desde hace 11 días.');
  });

  it('ejemplo del documento: la última fue el 01/10/2026, el aviso aparece el 12/10/2026 y no antes', () => {
    expect(noCommunicationAlert(quiet(), ana, cr('2026-10-11T23:59:59'))).toBeNull();
    expect(noCommunicationAlert(quiet(), ana, cr('2026-10-12T00:00:00'))?.kind).toBe('sin_comunicacion');
  });

  it('con exactamente 10 días no hay aviso; con 11 sí', () => {
    expect(noCommunicationAlert(quiet(), ana, cr('2026-10-11T12:00:00'))).toBeNull();
    expect(noCommunicationAlert(quiet(), ana, cr('2026-10-12T12:00:00'))).not.toBeNull();
  });

  it('cuenta la última comunicación, que ya incluye las de "Todas sus posibles ventas"', () => {
    const reciente = quiet({ lastCommunicationAt: lastComm('2026-10-15T10:00:00') });
    expect(noCommunicationAlert(reciente, ana, NOW)).toBeNull();
  });

  it('el texto del número de días es el del documento', () => {
    expect(noCommunicationMessage('Ana', 'Venta', 14)).toBe('Ana – Venta no tiene comunicaciones desde hace 14 días.');
  });
});

describe('HU-315 criterio 3: sin comunicaciones se cuenta desde la creación y el número se actualiza cada día', () => {
  const nunca = quiet({ lastCommunicationAt: null, createdAt: Timestamp.fromDate(cr('2026-10-01T10:00:00')) });

  it('desde la fecha de creación: creada el 01/10, aviso el 12/10', () => {
    expect(noCommunicationAlert(nunca, ana, cr('2026-10-11T12:00:00'))).toBeNull();
    expect(noCommunicationAlert(nunca, ana, cr('2026-10-12T12:00:00'))?.message).toBe(
      'Ana Prueba Mora – Café en grano no tiene comunicaciones desde hace 11 días.',
    );
  });

  it('el número sube un día cada día', () => {
    const days = ['2026-10-12', '2026-10-13', '2026-10-19'].map((d) =>
      noCommunicationAlert(nunca, ana, cr(`${d}T09:00:00`))?.message.match(/hace (\d+) días/)?.[1],
    );
    expect(days).toEqual(['11', '12', '18']);
  });

  it('una venta creada hace pocos días no avisa', () => {
    expect(noCommunicationAlert({ ...nunca, createdAt: Timestamp.fromDate(cr('2026-10-15T10:00:00')) }, ana, NOW)).toBeNull();
  });

  it('cuenta días calendario de Costa Rica, no bloques de 24 horas', () => {
    expect(calendarDaysBetween(cr('2026-10-01T23:30:00'), cr('2026-10-02T00:10:00'))).toBe(1);
    expect(calendarDaysBetween(cr('2026-10-01T08:00:00'), cr('2026-10-01T20:00:00'))).toBe(0);
  });
});

describe('HU-315 criterio 4: desaparece al registrar una comunicación', () => {
  it('al actualizarse la última comunicación (sobre la venta o "Todas") el aviso se va', () => {
    const vieja = quiet();
    expect(noCommunicationAlert(vieja, ana, NOW)).not.toBeNull();
    expect(noCommunicationAlert({ ...vieja, lastCommunicationAt: Timestamp.fromDate(NOW) }, ana, NOW)).toBeNull();
  });
});

describe('HU-315 criterio 5: solo abiertas de contactos activos, cada venta por separado', () => {
  it.each(SALE_STAGES)('etapa "%s"', (stage: SaleStage) => {
    const open = stage !== 'ganada' && stage !== 'perdida';
    expect(noCommunicationAlert(quiet({ stage }), ana, NOW) !== null).toBe(open);
  });

  it('contacto inactivo o inexistente: no avisa', () => {
    expect(noCommunicationAlert(quiet(), { ...ana, status: 'inactivo' }, NOW)).toBeNull();
    expect(noCommunicationAlert(quiet(), undefined, NOW)).toBeNull();
  });

  it('cada venta del mismo contacto se revisa por separado', () => {
    const sales = [
      quiet({ id: 'vieja', lastCommunicationAt: lastComm('2026-10-01T10:00:00') }),
      quiet({ id: 'reciente', lastCommunicationAt: lastComm('2026-10-18T10:00:00') }),
    ];
    const alerts = buildAlerts(sales, new Map([['c-1', ana]]), NOW);
    expect(alerts.map((a) => a.saleId)).toEqual(['vieja']);
  });
});

describe('HU-314 y HU-315 juntos', () => {
  const contacts = new Map<string, AlertContact>([['c-1', ana]]);

  it('una venta puede tener los dos avisos a la vez, cada uno con su id', () => {
    const both = sale({ nextFollowUpAt: followUp('2026-10-19T09:00:00'), lastCommunicationAt: lastComm('2026-10-01T10:00:00') });
    const alerts = buildAlerts([both], contacts, NOW);
    expect(alerts.map((a) => a.kind).sort()).toEqual(['seguimiento_hoy', 'sin_comunicacion']);
    expect(new Set(alerts.map((a) => a.id)).size).toBe(2);
  });

  it('el seguimiento de hoy no quita el aviso de falta de comunicación ni al revés', () => {
    const soloComunicacion = quiet();
    expect(buildAlerts([soloComunicacion], contacts, NOW).map((a) => a.kind)).toEqual(['sin_comunicacion']);
    const soloSeguimiento = sale({ lastCommunicationAt: Timestamp.fromDate(NOW) });
    expect(buildAlerts([soloSeguimiento], contacts, NOW).map((a) => a.kind)).toEqual(['seguimiento_hoy']);
  });

  it('los más antiguos primero: el de falta de comunicación se ordena por el día en que empezó a avisar', () => {
    const sales = [
      sale({ id: 'a', nextFollowUpAt: followUp('2026-10-17T09:00:00'), lastCommunicationAt: Timestamp.fromDate(NOW) }),
      quiet({ id: 'b', lastCommunicationAt: lastComm('2026-10-01T10:00:00') }),
    ];
    expect(buildAlerts(sales, contacts, NOW).map((a) => a.id)).toEqual(['b:sin_comunicacion', 'a:seguimiento_vencido']);
  });
});

describe('HU-316 datos de la tabla', () => {
  it('los tipos se llaman como en el documento', () => {
    expect(ALERT_KIND_LABELS).toEqual({
      seguimiento_vencido: 'Seguimiento vencido',
      seguimiento_hoy: 'Seguimiento para hoy',
      sin_comunicacion: 'Sin comunicación',
    });
  });

  it('cada aviso lleva la etapa de su venta, para la columna "Etapa"', () => {
    const contacts = new Map<string, AlertContact>([['c-1', ana]]);
    const alerts = buildAlerts([sale({ stage: 'en_negociacion', nextFollowUpAt: followUp('2026-10-19T09:00:00') })], contacts, NOW);
    expect(alerts.map((a) => a.stage)).toEqual(['en_negociacion', 'en_negociacion']);
  });
});
