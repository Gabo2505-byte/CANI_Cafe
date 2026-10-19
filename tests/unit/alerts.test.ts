import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import {
  buildFollowUpAlerts,
  followUpAlert,
  followUpOverdueMessage,
  followUpTodayMessage,
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
