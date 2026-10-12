import { describe, expect, it } from 'vitest';
import { toSortKey } from '../../src/shared/utils/text';

describe('toSortKey (HU-204)', () => {
  it('minúsculas, sin tildes y sin espacios de más', () => {
    expect(toSortKey('  Álvaro   MORA ')).toBe('alvaro mora');
    expect(toSortKey('Óscar Núñez')).toBe('oscar nunez');
  });

  it('ordena alfabéticamente como se espera en español', () => {
    const names = ['Zoe Prueba', 'ana Prueba', 'Álvaro Prueba', 'Bruno Prueba', 'Óscar Prueba'];
    const sorted = [...names].sort((a, b) => (toSortKey(a) < toSortKey(b) ? -1 : 1));
    expect(sorted).toEqual(['Álvaro Prueba', 'ana Prueba', 'Bruno Prueba', 'Óscar Prueba', 'Zoe Prueba']);
  });
});
