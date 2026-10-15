import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { buildBoard, closedSalesCutoff, formatColumnHeader, isVisibleOnBoard, type BoardSale } from '../../src/sales/board';
import { SALE_STAGES, type Sale, type SaleStage } from '../../src/shared/types';

const NOW = new Date('2026-10-14T18:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => Timestamp.fromDate(new Date(NOW.getTime() - days * DAY));

let n = 0;
function item(stage: SaleStage, amount: number, overrides: Partial<Sale> = {}): BoardSale {
  n += 1;
  return {
    contactName: `Contacto ${n}`,
    sale: {
      id: `s-${n}`,
      contactId: 'c-1',
      title: `Venta ${n}`,
      stage,
      estimatedAmount: amount,
      nextFollowUpAt: null,
      notes: '',
      createdAt: ago(40 - n),
      stageChangedAt: ago(1),
      lastCommunicationAt: null,
      ...overrides,
    },
  };
}

describe('HU-305 columnas del tablero', () => {
  it('siempre son seis, en el orden de las etapas, aunque no haya ventas', () => {
    const columns = buildBoard([], NOW);
    expect(columns.map((c) => c.stage)).toEqual([...SALE_STAGES]);
    expect(columns.map((c) => c.label)).toEqual([
      'Nuevo interesado',
      'Contactado',
      'Precio o cotización enviada',
      'En negociación',
      'Venta ganada',
      'Venta perdida',
    ]);
    expect(columns.every((c) => c.count === 0 && c.total === 0 && c.sales.length === 0)).toBe(true);
  });

  it('cada venta cae en la columna de su etapa, con conteo y suma de montos', () => {
    const columns = buildBoard(
      [
        item('en_negociacion', 400_000),
        item('en_negociacion', 420_000),
        item('contactado', 100_000),
        item('nuevo_interesado', 0),
      ],
      NOW,
    );
    const byStage = Object.fromEntries(columns.map((c) => [c.stage, c]));
    expect(byStage.en_negociacion).toMatchObject({ count: 2, total: 820_000 });
    expect(byStage.contactado).toMatchObject({ count: 1, total: 100_000 });
    expect(byStage.nuevo_interesado).toMatchObject({ count: 1, total: 0 });
    expect(byStage.cotizacion_enviada.count).toBe(0);
  });

  it('el encabezado se escribe como "En negociación · 4 · ₡ 820 000"', () => {
    expect(formatColumnHeader({ label: 'En negociación', count: 4, total: 820_000 })).toBe('En negociación · 4 · ₡ 820 000');
    expect(formatColumnHeader({ label: 'Contactado', count: 0, total: 0 })).toBe('Contactado · 0 · ₡ 0');
  });

  it('dentro de cada columna, la más nueva primero', () => {
    const older = item('contactado', 1, { createdAt: ago(10) });
    const newer = item('contactado', 1, { createdAt: ago(2) });
    const column = buildBoard([older, newer], NOW).find((c) => c.stage === 'contactado')!;
    expect(column.sales.map((s) => s.sale.id)).toEqual([newer.sale.id, older.sale.id]);
  });
});

describe('HU-305 ganadas y perdidas: solo los últimos 30 días', () => {
  it('el corte es 30 días antes de ahora', () => {
    expect(closedSalesCutoff(NOW).toISOString()).toBe('2026-09-14T18:00:00.000Z');
  });

  it.each(['ganada', 'perdida'] as const)('%s: a los 29 días sí se ve; a los 31, no', (stage) => {
    expect(isVisibleOnBoard(item(stage, 1, { stageChangedAt: ago(29) }).sale, NOW)).toBe(true);
    expect(isVisibleOnBoard(item(stage, 1, { stageChangedAt: ago(31) }).sale, NOW)).toBe(false);
  });

  it('las abiertas se ven siempre, aunque sean muy antiguas', () => {
    expect(isVisibleOnBoard(item('en_negociacion', 1, { stageChangedAt: ago(400) }).sale, NOW)).toBe(true);
  });

  it('el tablero deja fuera las cerradas antiguas y no las cuenta en el encabezado', () => {
    const columns = buildBoard(
      [item('ganada', 300_000), item('ganada', 999_000, { stageChangedAt: ago(45) }), item('perdida', 50_000, { stageChangedAt: ago(40) })],
      NOW,
    );
    expect(columns.find((c) => c.stage === 'ganada')).toMatchObject({ count: 1, total: 300_000 });
    expect(columns.find((c) => c.stage === 'perdida')).toMatchObject({ count: 0, total: 0 });
  });
});
