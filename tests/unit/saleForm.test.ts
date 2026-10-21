import { describe, expect, it } from 'vitest';
import {
  EMPTY_SALE_FORM,
  followUpToDate,
  isDuplicateTitle,
  parseAmount,
  validateSaleForm,
  type SaleFormContext,
  type SaleFormValues,
} from '../../src/sales/saleForm';

const TODAY = '2026-10-14';
const context = (overrides: Partial<SaleFormContext> = {}): SaleFormContext => ({
  contactId: 'contact-001',
  today: TODAY,
  openTitles: [],
  ...overrides,
});
const valid = (overrides: Partial<SaleFormValues> = {}): SaleFormValues => ({
  ...EMPTY_SALE_FORM,
  title: 'Café en grano para su cafetería',
  amount: '150000',
  ...overrides,
});

describe('HU-303 monto', () => {
  it.each([
    ['0', 0],
    ['150000', 150000],
    ['150 000', 150000],
    ['999999999', 999999999],
    [' 25 ', 25],
  ])('acepta "%s"', (text, value) => expect(parseAmount(text)).toBe(value));

  it.each(['', '   ', '1000000000', '-1', '1.5', '1,5', 'abc', '₡ 100', '1e3'])('rechaza "%s"', (text) =>
    expect(parseAmount(text)).toBeNull(),
  );
});

describe('HU-303 título repetido', () => {
  it('compara sin mayúsculas, tildes ni espacios de más', () => {
    expect(isDuplicateTitle('  CAFÉ   en grano ', ['cafe en grano'])).toBe(true);
    expect(isDuplicateTitle('Café molido', ['cafe en grano'])).toBe(false);
    expect(isDuplicateTitle('Café', [])).toBe(false);
  });
});

describe('HU-303 validación del formulario', () => {
  it('etapa por defecto: Nuevo interesado', () => {
    expect(EMPTY_SALE_FORM.stage).toBe('nuevo_interesado');
  });

  it('datos correctos no tienen errores', () => {
    expect(validateSaleForm(valid({ followUpDate: TODAY, notes: 'Notas' }), context())).toEqual({});
  });

  it('el monto ₡ 0 es válido (sin estimar)', () => {
    expect(validateSaleForm(valid({ amount: '0' }), context())).toEqual({});
  });

  it('formulario vacío: pide contacto, título y monto', () => {
    expect(validateSaleForm(EMPTY_SALE_FORM, context({ contactId: null }))).toEqual({
      contact: 'Seleccione un contacto.',
      title: 'Ingrese el título.',
      amount: 'Ingrese un monto válido.',
    });
  });

  it('título de 100 caracteres sí; de 101, no', () => {
    expect(validateSaleForm(valid({ title: 'a'.repeat(100) }), context())).toEqual({});
    expect(validateSaleForm(valid({ title: 'a'.repeat(101) }), context()).title).toBe(
      'El título acepta como máximo 100 caracteres.',
    );
  });

  it('título repetido entre las abiertas del contacto', () => {
    const errors = validateSaleForm(
      valid({ title: 'CAFE en grano para su cafetería' }),
      context({ openTitles: ['Café en grano para su cafetería'] }),
    );
    expect(errors.title).toBe('Este contacto ya tiene una oportunidad de venta abierta con este título.');
  });

  it('monto vacío o fuera de rango: Ingrese un monto válido.', () => {
    for (const amount of ['', '1000000000', '-5', '12.5']) {
      expect(validateSaleForm(valid({ amount }), context()).amount).toBe('Ingrese un monto válido.');
    }
  });

  it('seguimiento: hoy y futuro sí; ayer, no; sin fecha, sí', () => {
    expect(validateSaleForm(valid({ followUpDate: '2026-10-14' }), context()).followUpDate).toBeUndefined();
    expect(validateSaleForm(valid({ followUpDate: '2026-12-01' }), context()).followUpDate).toBeUndefined();
    expect(validateSaleForm(valid({ followUpDate: '' }), context()).followUpDate).toBeUndefined();
    expect(validateSaleForm(valid({ followUpDate: '2026-10-13' }), context()).followUpDate).toBe(
      'La fecha de seguimiento no puede ser anterior a hoy.',
    );
  });

  it('notas: 1000 caracteres sí; 1001, no', () => {
    expect(validateSaleForm(valid({ notes: 'n'.repeat(1000) }), context()).notes).toBeUndefined();
    expect(validateSaleForm(valid({ notes: 'n'.repeat(1001) }), context()).notes).toBe(
      'Las notas aceptan como máximo 1000 caracteres.',
    );
  });
});

describe('fecha de seguimiento guardada', () => {
  it('es la medianoche de Costa Rica de ese día', () => {
    expect(followUpToDate('2026-10-14')?.toISOString()).toBe('2026-10-14T06:00:00.000Z');
    expect(followUpToDate('')).toBeNull();
  });
});
