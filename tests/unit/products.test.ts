import { describe, expect, it } from 'vitest';
import { sortProducts } from '../../src/products/productsRepository';
import type { Product } from '../../src/shared/types';

const product = (id: string, name: string, presentation: string): Product => ({
  id,
  name,
  presentation,
  description: '',
  active: true,
});

describe('sortProducts (HT-002)', () => {
  it('ordena por nombre sin distinguir mayúsculas ni tildes', () => {
    const sorted = sortProducts([
      product('1', 'Zeta', 'A'),
      product('2', 'árbol', 'A'),
      product('3', 'Bruno', 'A'),
      product('4', 'ana', 'A'),
    ]);
    expect(sorted.map((p) => p.name)).toEqual(['ana', 'árbol', 'Bruno', 'Zeta']);
  });

  it('con el mismo nombre ordena por presentación y no modifica la lista original', () => {
    const original = [product('1', 'Café', 'Bolsa de 340 g'), product('2', 'Café', 'Bolsa de 1 kg')];
    expect(sortProducts(original).map((p) => p.id)).toEqual(['2', '1']);
    expect(original.map((p) => p.id)).toEqual(['1', '2']);
  });
});
