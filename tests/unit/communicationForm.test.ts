// HU-211: reglas del formulario "Registrar comunicación".
import { describe, expect, it } from 'vitest';
import {
  ALL_SALES,
  communicationDayToDate,
  emptyCommunicationForm,
  mediumLabel,
  MEDIUM_OPTIONS,
  saleOptions,
  toNewCommunication,
  validateCommunicationForm,
  type CommunicationFormValues,
} from '../../src/communications/communicationForm';
import { toCostaRicaDateKey } from '../../src/shared/utils/dates';

const TODAY = '2026-10-19';
const form = (overrides: Partial<CommunicationFormValues> = {}): CommunicationFormValues => ({
  date: TODAY,
  medium: 'whatsapp',
  otherMedium: '',
  sale: 'todas',
  note: 'Preguntó por precios del café en grano.',
  ...overrides,
});

describe('HU-211 formulario de comunicación', () => {
  it('la fecha viene con el día de hoy; medio y nota vacíos', () => {
    expect(emptyCommunicationForm(TODAY)).toEqual({ date: TODAY, medium: '', otherMedium: '', sale: 'todas', note: '' });
  });

  it('fecha, medio y nota son obligatorios', () => {
    expect(validateCommunicationForm({ date: '', medium: '', otherMedium: '', sale: 'todas', note: '   ' }, TODAY)).toEqual({
      date: 'Seleccione la fecha.',
      medium: 'Seleccione el medio.',
      note: 'Ingrese la nota.',
    });
  });

  it('una fecha futura → "La fecha no puede ser posterior a hoy."; hoy y días anteriores son válidos', () => {
    expect(validateCommunicationForm(form({ date: '2026-10-20' }), TODAY).date).toBe('La fecha no puede ser posterior a hoy.');
    expect(validateCommunicationForm(form({ date: TODAY }), TODAY)).toEqual({});
    expect(validateCommunicationForm(form({ date: '2025-01-31' }), TODAY)).toEqual({});
  });

  it('medios en el orden de la HU', () => {
    expect(MEDIUM_OPTIONS.map((o) => o.label)).toEqual([
      'Llamada telefónica',
      'WhatsApp',
      'Correo electrónico',
      'Visita presencial',
      'Otro',
    ]);
  });

  it('"Otro" obliga a escribir cuál fue', () => {
    expect(validateCommunicationForm(form({ medium: 'otro', otherMedium: '  ' }), TODAY).otherMedium).toBe(
      'Indique cuál fue el medio.',
    );
    expect(validateCommunicationForm(form({ medium: 'otro', otherMedium: 'Instagram' }), TODAY)).toEqual({});
  });

  it('la nota acepta hasta 1000 caracteres', () => {
    expect(validateCommunicationForm(form({ note: 'a'.repeat(1000) }), TODAY)).toEqual({});
    expect(validateCommunicationForm(form({ note: 'a'.repeat(1001) }), TODAY).note).toBe(
      'La nota acepta como máximo 1000 caracteres.',
    );
  });

  it('al guardar: el día es 00:00 de Costa Rica, se recortan espacios y "cuál" solo va con "Otro"', () => {
    const input = toNewCommunication('c1', form({ medium: 'otro', otherMedium: ' Instagram ', note: '  Hola  ' }));
    expect(input).toEqual({
      contactId: 'c1',
      date: new Date('2026-10-19T06:00:00Z'),
      medium: 'otro',
      otherMedium: 'Instagram',
      saleId: null,
      note: 'Hola',
    });
    expect(toNewCommunication('c1', form({ medium: 'llamada', otherMedium: 'Instagram' })).otherMedium).toBeNull();
  });

  it('el día guardado se sigue viendo como ese mismo día en Costa Rica', () => {
    expect(toCostaRicaDateKey(communicationDayToDate('2026-10-19'))).toBe('2026-10-19');
    expect(toCostaRicaDateKey(communicationDayToDate('2026-01-01'))).toBe('2026-01-01');
  });

  it('en el historial: "WhatsApp" u "Otro: Instagram"', () => {
    expect(mediumLabel({ medium: 'whatsapp', otherMedium: null })).toBe('WhatsApp');
    expect(mediumLabel({ medium: 'otro', otherMedium: 'Instagram' })).toBe('Otro: Instagram');
  });
});

describe('HU-212 oportunidad de venta de la comunicación', () => {
  const open = [
    { id: 's1', title: 'Café en grano para cafetería' },
    { id: 's2', title: 'Distribución mensual' },
  ];

  it('opciones: "Todas sus oportunidades de venta" primero y luego las abiertas', () => {
    expect(saleOptions(open)).toEqual([
      { value: 'todas', label: 'Todas sus oportunidades de venta' },
      { value: 's1', label: 'Café en grano para cafetería' },
      { value: 's2', label: 'Distribución mensual' },
    ]);
    expect(saleOptions([])).toEqual([{ value: 'todas', label: 'Todas sus oportunidades de venta' }]);
  });

  it('"Todas sus oportunidades de venta" viene elegida', () => {
    expect(emptyCommunicationForm(TODAY).sale).toBe(ALL_SALES);
  });

  it('es obligatoria: vacía o una venta que no está entre las abiertas → "Seleccione la oportunidad de venta."', () => {
    expect(validateCommunicationForm(form({ sale: '' }), TODAY, ['s1']).sale).toBe('Seleccione la oportunidad de venta.');
    expect(validateCommunicationForm(form({ sale: 'ganada' }), TODAY, ['s1']).sale).toBe('Seleccione la oportunidad de venta.');
    expect(validateCommunicationForm(form({ sale: 's1' }), TODAY, ['s1'])).toEqual({});
    expect(validateCommunicationForm(form({ sale: ALL_SALES }), TODAY, [])).toEqual({});
  });

  it('al guardar: una venta → su saleId; "Todas" → null', () => {
    expect(toNewCommunication('c1', form({ sale: 's1' })).saleId).toBe('s1');
    expect(toNewCommunication('c1', form({ sale: ALL_SALES })).saleId).toBeNull();
  });
});
