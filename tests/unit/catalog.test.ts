// Catálogo oficial de productos (9 variedades × 4 pesos × 2 formatos) y su agrupación en dos pasos.
import { describe, expect, it } from 'vitest';
import { groupByVariety } from '../../src/products/catalog';
import type { Product } from '../../src/shared/types';
import {
  buildCatalogProducts,
  CATALOG_FORMATS,
  CATALOG_MAX_DESCRIPTION,
  CATALOG_VARIETIES,
  CATALOG_WEIGHTS,
  catalogProductId,
} from '../../scripts/seed/catalogData';

const asProducts = () => buildCatalogProducts().map((p) => ({ ...p.data, id: p.id }) as Product);

describe('catálogo oficial: datos', () => {
  const products = buildCatalogProducts();

  it('tiene las 9 variedades del cliente, en el orden de su documento', () => {
    expect(CATALOG_VARIETIES.map((v) => v.name)).toEqual([
      'Villa Sarchí',
      'Caturra',
      'Catuaí',
      'Kenia',
      'San Roque',
      'Milenio',
      'Centroamericano',
      'Casiopea',
      'Geisha',
    ]);
  });

  it('son 72 productos: 8 por variedad (4 pesos × 2 formatos)', () => {
    expect(products).toHaveLength(72);
    for (const variety of CATALOG_VARIETIES) {
      expect(products.filter((p) => p.data.name === variety.name)).toHaveLength(8);
    }
    expect(CATALOG_WEIGHTS).toHaveLength(4);
    expect(CATALOG_FORMATS).toHaveLength(2);
  });

  it('los ids son únicos y fijos, y ordenados como texto dan el orden del catálogo', () => {
    const ids = products.map((p) => p.id);
    expect(new Set(ids).size).toBe(72);
    expect(ids[0]).toBe('prod-01-villa-sarchi-0250-grano');
    expect(ids[71]).toBe('prod-09-geisha-1000-molido');
    expect([...ids].sort()).toEqual(ids);
    expect(buildCatalogProducts().map((p) => p.id)).toEqual(ids);
    expect(catalogProductId('geisha', '0250', 'grano')).toBe('prod-09-geisha-0250-grano');
    expect(() => catalogProductId('no-existe', '0250', 'molido')).toThrow(/desconocida/);
  });

  it('la presentación sigue el formato "Bolsa de 250 g, molido" (1 kg se escribe "Bolsa de 1 kg")', () => {
    const geisha = products.filter((p) => p.data.name === 'Geisha').map((p) => p.data.presentation);
    // Dentro de cada peso, "grano entero" va antes que "molido": es el orden de los ids.
    expect(geisha).toEqual([
      'Bolsa de 250 g, grano entero',
      'Bolsa de 250 g, molido',
      'Bolsa de 340 g, grano entero',
      'Bolsa de 340 g, molido',
      'Bolsa de 500 g, grano entero',
      'Bolsa de 500 g, molido',
      'Bolsa de 1 kg, grano entero',
      'Bolsa de 1 kg, molido',
    ]);
  });

  it('toda descripción tiene texto y no pasa de 300 caracteres (HU-402); la de la variedad es la misma en sus 8 productos', () => {
    for (const variety of CATALOG_VARIETIES) {
      expect(variety.description.length).toBeGreaterThan(0);
      expect(variety.description.length).toBeLessThanOrEqual(CATALOG_MAX_DESCRIPTION);
      for (const p of products.filter((x) => x.data.name === variety.name)) expect(p.data.description).toBe(variety.description);
    }
    expect(CATALOG_MAX_DESCRIPTION).toBe(300);
  });

  it('todos están activos', () => {
    expect(products.every((p) => p.data.active === true)).toBe(true);
  });

  it('no tienen ningún precio: solo los cuatro campos del contrato y ningún valor en colones o dólares', () => {
    for (const p of products) {
      expect(Object.keys(p.data).sort()).toEqual(['active', 'description', 'name', 'presentation']);
      const text = `${p.data.name} ${p.data.presentation} ${p.data.description}`;
      expect(text).not.toMatch(/[₡$]|precio|price|colones/i);
    }
  });
});

describe('catálogo en dos pasos: groupByVariety', () => {
  it('agrupa las 72 en 9 variedades con 8 presentaciones, en el orden del catálogo', () => {
    // Se mezclan a propósito: el orden sale del id, no de cómo lleguen.
    const shuffled = asProducts().reverse();
    const groups = groupByVariety(shuffled);
    expect(groups.map((g) => g.name)).toEqual(CATALOG_VARIETIES.map((v) => v.name));
    for (const group of groups) expect(group.products).toHaveLength(8);
    expect(groups[8].products.map((p) => p.presentation)[0]).toBe('Bolsa de 250 g, grano entero');
    expect(groups[8].products.map((p) => p.presentation)[7]).toBe('Bolsa de 1 kg, molido');
  });

  it('no usa el orden alfabético: "Villa Sarchí" va primero y "Casiopea" después de "Centroamericano"', () => {
    const names = groupByVariety(asProducts()).map((g) => g.name);
    expect(names[0]).toBe('Villa Sarchí');
    expect(names.indexOf('Casiopea')).toBeGreaterThan(names.indexOf('Centroamericano'));
  });

  it('sin productos no hay variedades', () => {
    expect(groupByVariety([])).toEqual([]);
  });

  it('no modifica la lista que recibe', () => {
    const original = asProducts().reverse();
    const copy = [...original];
    groupByVariety(original);
    expect(original).toEqual(copy);
  });
});
