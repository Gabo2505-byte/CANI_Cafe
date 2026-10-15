import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { isNotesOnly, toEditValues, validateSaleEdit, type SaleEditValues } from '../../src/sales/saleEdit';
import type { Sale, SaleStage } from '../../src/shared/types';

const TODAY = '2026-10-15';
const at = (iso: string) => Timestamp.fromDate(new Date(iso));

const sale = (overrides: Partial<Sale> = {}): Sale => ({
  id: 'sale-001',
  contactId: 'contact-002',
  title: 'Café en grano para cafetería',
  stage: 'en_negociacion' as SaleStage,
  estimatedAmount: 450_000,
  nextFollowUpAt: at('2026-10-20T06:00:00Z'),
  notes: 'Notas',
  createdAt: at('2026-09-15T15:00:00Z'),
  stageChangedAt: at('2026-10-01T16:00:00Z'),
  lastCommunicationAt: null,
  ...overrides,
});
const ctx = (openTitles: string[] = []) => ({ today: TODAY, openTitles });
const edit = (s: Sale, overrides: Partial<SaleEditValues> = {}): SaleEditValues => ({ ...toEditValues(s), ...overrides });

describe('HU-309 valores iniciales', () => {
  it('parte de lo guardado, con el seguimiento como día de Costa Rica', () => {
    expect(toEditValues(sale())).toEqual({
      title: 'Café en grano para cafetería',
      amount: '450000',
      followUpDate: '2026-10-20',
      notes: 'Notas',
    });
    expect(toEditValues(sale({ nextFollowUpAt: null, estimatedAmount: 0 }))).toMatchObject({ amount: '0', followUpDate: '' });
  });

  it('una venta ganada solo permite editar las notas; las demás, no', () => {
    expect(isNotesOnly({ stage: 'ganada' })).toBe(true);
    for (const stage of ['nuevo_interesado', 'contactado', 'cotizacion_enviada', 'en_negociacion', 'perdida'] as const) {
      expect(isNotesOnly({ stage })).toBe(false);
    }
  });
});

describe('HU-309 reglas al editar', () => {
  it('sin cambios no hay errores', () => {
    const s = sale();
    expect(validateSaleEdit(s, edit(s), ctx())).toEqual({});
  });

  it('el título es obligatorio y de hasta 100 caracteres', () => {
    const s = sale();
    expect(validateSaleEdit(s, edit(s, { title: '  ' }), ctx()).title).toBe('Ingrese el título.');
    expect(validateSaleEdit(s, edit(s, { title: 'a'.repeat(100) }), ctx()).title).toBeUndefined();
    expect(validateSaleEdit(s, edit(s, { title: 'a'.repeat(101) }), ctx()).title).toBe(
      'El título acepta como máximo 100 caracteres.',
    );
  });

  it('el título nuevo no puede repetir el de otra posible venta abierta del contacto', () => {
    const s = sale();
    const errors = validateSaleEdit(s, edit(s, { title: 'PEDIDO de temporada' }), ctx(['Pedido de temporada']));
    expect(errors.title).toBe('Este contacto ya tiene una posible venta abierta con este título.');
  });

  it('un título que no se tocó no se revisa contra otras ventas', () => {
    const s = sale();
    expect(validateSaleEdit(s, edit(s, { notes: 'Otras notas' }), ctx([s.title]))).toEqual({});
  });

  it('el monto va de ₡ 0 a ₡ 999 999 999', () => {
    const s = sale();
    expect(validateSaleEdit(s, edit(s, { amount: '0' }), ctx())).toEqual({});
    expect(validateSaleEdit(s, edit(s, { amount: '999999999' }), ctx())).toEqual({});
    for (const amount of ['', '1000000000', '-1', '1.5', 'abc']) {
      expect(validateSaleEdit(s, edit(s, { amount }), ctx()).amount).toBe('Ingrese un monto válido.');
    }
  });

  it('un seguimiento nuevo no puede ser anterior a hoy; hoy y el futuro, sí; quitarlo, sí', () => {
    const s = sale();
    expect(validateSaleEdit(s, edit(s, { followUpDate: '2026-10-14' }), ctx()).followUpDate).toBe(
      'La fecha de seguimiento no puede ser anterior a hoy.',
    );
    expect(validateSaleEdit(s, edit(s, { followUpDate: TODAY }), ctx()).followUpDate).toBeUndefined();
    expect(validateSaleEdit(s, edit(s, { followUpDate: '2026-12-01' }), ctx()).followUpDate).toBeUndefined();
    expect(validateSaleEdit(s, edit(s, { followUpDate: '' }), ctx()).followUpDate).toBeUndefined();
  });

  it('un seguimiento ya vencido que no se tocó no impide guardar otros cambios', () => {
    const s = sale({ nextFollowUpAt: at('2026-10-01T06:00:00Z') });
    expect(validateSaleEdit(s, edit(s, { notes: 'Llamé y no contestó' }), ctx())).toEqual({});
  });

  it('las notas, hasta 1000 caracteres', () => {
    const s = sale();
    expect(validateSaleEdit(s, edit(s, { notes: 'n'.repeat(1000) }), ctx()).notes).toBeUndefined();
    expect(validateSaleEdit(s, edit(s, { notes: 'n'.repeat(1001) }), ctx()).notes).toBe(
      'Las notas aceptan como máximo 1000 caracteres.',
    );
  });

  it('nunca pide el contacto (no se puede cambiar al editar)', () => {
    const s = sale();
    expect(validateSaleEdit(s, edit(s), ctx()).contact).toBeUndefined();
  });
});

describe('HU-309 venta ganada: solo notas', () => {
  const won = sale({ stage: 'ganada' });

  it('solo se revisan las notas, aunque lo demás venga vacío o inválido', () => {
    expect(validateSaleEdit(won, edit(won, { title: '', amount: 'x', followUpDate: '2020-01-01' }), ctx())).toEqual({});
  });

  it('las notas siguen limitadas a 1000 caracteres', () => {
    expect(validateSaleEdit(won, edit(won, { notes: 'n'.repeat(1001) }), ctx()).notes).toBe(
      'Las notas aceptan como máximo 1000 caracteres.',
    );
  });
});
