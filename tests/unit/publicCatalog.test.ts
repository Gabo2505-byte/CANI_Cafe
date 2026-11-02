// HU-402: descripción de la tarjeta del catálogo público.
import { describe, expect, it } from 'vitest';
import { buildCatalogProducts, CATALOG_MAX_DESCRIPTION } from '../../scripts/seed/catalogData';
import { PUBLIC_DESCRIPTION_MAX, publicDescription } from '../../src/products/publicCatalog';

describe('publicDescription (HU-402)', () => {
  it('el tope es de 300 caracteres, el mismo del catálogo oficial', () => {
    expect(PUBLIC_DESCRIPTION_MAX).toBe(300);
    expect(PUBLIC_DESCRIPTION_MAX).toBe(CATALOG_MAX_DESCRIPTION);
  });

  it('deja intacta una descripción de hasta 300 caracteres', () => {
    expect(publicDescription('a'.repeat(300))).toBe('a'.repeat(300));
    expect(publicDescription('')).toBe('');
  });

  it('recorta la que pasa de 300 y nunca devuelve más', () => {
    expect(publicDescription('a'.repeat(301))).toHaveLength(300);
    expect(publicDescription(`${'a'.repeat(299)} bbb`).length).toBeLessThanOrEqual(300);
  });

  it('ninguna descripción del catálogo oficial se recorta', () => {
    for (const { data } of buildCatalogProducts()) expect(publicDescription(data.description)).toBe(data.description);
  });
});
