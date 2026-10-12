import { describe, expect, it } from 'vitest';
import {
  filterCountries,
  formatPhone,
  getPhoneCountries,
  groupCountriesByLetter,
  PHONE_MESSAGES,
  phoneKey,
  validatePhoneNumber,
} from '../../src/shared/phone/phone';

describe('HU-202 reglas de teléfono', () => {
  it('Costa Rica: exactamente 8 dígitos', () => {
    expect(validatePhoneNumber('CR', '88888888')).toBeNull();
    expect(validatePhoneNumber('CR', '8888888')).toBe(PHONE_MESSAGES.costaRicaLength);
    expect(validatePhoneNumber('CR', '888888888')).toBe(PHONE_MESSAGES.costaRicaLength);
  });

  it('otros países: entre 6 y 14 dígitos, sin contar el código', () => {
    expect(validatePhoneNumber('US', '123456')).toBeNull();
    expect(validatePhoneNumber('US', '12345678901234')).toBeNull();
    expect(validatePhoneNumber('US', '12345')).toBe(PHONE_MESSAGES.otherLength);
    expect(validatePhoneNumber('NI', '123456789012345')).toBe(PHONE_MESSAGES.otherLength);
  });

  it('formato: "+506 8888-8888" para Costa Rica y "+1 3055551234" para otros países', () => {
    expect(formatPhone('CR', '88888888')).toBe('+506 8888-8888');
    expect(formatPhone('US', '3055551234')).toBe('+1 3055551234');
    expect(formatPhone('ES', '612345678')).toBe('+34 612345678');
  });

  it('textos exactos de los mensajes', () => {
    expect(PHONE_MESSAGES.costaRicaLength).toBe('El teléfono debe tener 8 dígitos.');
    expect(PHONE_MESSAGES.otherLength).toBe('El teléfono debe tener entre 6 y 14 dígitos.');
  });

  it('phoneKey normaliza a código + número (para detectar duplicados en HU-203)', () => {
    expect(phoneKey('CR', '8888-8888')).toBe('+50688888888');
    expect(phoneKey('US', '(305) 555 1234')).toBe('+13055551234');
  });

  it('agrupa por letra y junta letras seguidas con pocos países (mínimo 6 por grupo)', () => {
    const groups = groupCountriesByLetter(getPhoneCountries());
    const labels = groups.map((g) => g.label);
    expect(labels.slice(0, 3)).toEqual(['A', 'B', 'C']);
    expect(labels).toContain('D – E');
    expect(labels.at(-1)).toMatch(/– Z$/);
    expect(groups.every((g) => g.countries.length >= 6)).toBe(true);
    // No se pierde ningún país
    expect(groups.reduce((n, g) => n + g.countries.length, 0)).toBe(getPhoneCountries().length);
  });

  it('el buscador ignora tildes y busca por nombre, siglas o código', () => {
    const all = getPhoneCountries();
    const codes = (q: string) => filterCountries(all, q).map((c) => c.code);
    expect(codes('mexico')).toContain('MX');
    expect(codes('CR')).toContain('CR');
    expect(codes('+506')).toEqual(['CR']);
    expect(codes('')).toHaveLength(all.length);
    expect(codes('zzzz')).toEqual([]);
  });

  it('el buscador muestra primero los países que empiezan con lo escrito', () => {
    const all = getPhoneCountries();
    const codes = filterCountries(all, 'pan').map((c) => c.code);
    expect(codes[0]).toBe('PA'); // Panamá antes que España
    expect(codes).toContain('ES');
  });

  it('la lista de países trae nombre en español y código, ordenada por nombre', () => {
    const countries = getPhoneCountries();
    const cr = countries.find((c) => c.code === 'CR');
    expect(cr).toEqual({ code: 'CR', name: 'Costa Rica', dialCode: '+506', label: 'Costa Rica (+506)' });
    const names = countries.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
  });
});
