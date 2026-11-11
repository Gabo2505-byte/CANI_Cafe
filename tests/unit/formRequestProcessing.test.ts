// HU-502 y HU-503: procesamiento de una solicitud del formulario (sin Firebase).
import { describe, expect, it } from 'vitest';
import {
  buildFormNote,
  checkInterests,
  CLAIM_TTL_MS,
  contactInterests,
  FORM_NOTE_MAX,
  FORM_PROCESSING_TEXTS,
  isClaimable,
  nextFormBadge,
  productLine,
  REJECT_REASONS,
  resolveProducts,
  sentDifferences,
} from '../../src/formRequests/formRequestProcessing';
import type { Product } from '../../src/shared/types';

const product = (id: string, name: string, presentation: string, active = true): Product => ({
  id,
  name,
  presentation,
  description: '',
  active,
});
const catalog = new Map(
  [
    product('p1', 'Villa Sarchí', 'Bolsa de 340 g, grano entero'),
    product('p2', 'Caturra', 'Bolsa de 1 kg, molido'),
    product('p3', 'Geisha', 'Bolsa de 250 g, grano entero', false),
  ].map((p) => [p.id, p]),
);
const at = (ms: number) => ({ toMillis: () => ms });

describe('textos literales de los criterios', () => {
  it('"Sin mensaje" (HU-502) y la línea de diferencias (HU-503)', () => {
    expect(FORM_PROCESSING_TEXTS.noMessage).toBe('Sin mensaje');
    expect(FORM_PROCESSING_TEXTS.differences).toBe('Datos enviados distintos a los registrados:');
    expect(FORM_PROCESSING_TEXTS.omitted(2)).toBe('Productos no disponibles omitidos: 2.');
  });
});

describe('checkInterests: cada producto de la solicitud (contrato v3, punto 9)', () => {
  it('acepta productos bien formados con cantidad entera de 1 a 9999', () => {
    expect(checkInterests([{ productId: 'p1', quantity: 1 }, { productId: 'p2', quantity: 9999 }])).toEqual({
      ok: true,
      interests: [
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 9999 },
      ],
    });
  });

  it.each([
    [[{ productId: 'p1', quantity: 0 }], REJECT_REASONS.quantity],
    [[{ productId: 'p1', quantity: 10000 }], REJECT_REASONS.quantity],
    [[{ productId: 'p1', quantity: 1.5 }], REJECT_REASONS.quantity],
    [[{ productId: 'p1', quantity: -2 }], REJECT_REASONS.quantity],
    [[{ productId: 'p1', quantity: '3' }], REJECT_REASONS.malformed],
    [[{ productId: '', quantity: 3 }], REJECT_REASONS.malformed],
    [[{ productId: 'p1' }], REJECT_REASONS.malformed],
    [[{ productId: 'p1', quantity: 3, extra: true }], REJECT_REASONS.malformed],
    [['p1'], REJECT_REASONS.malformed],
    [[null], REJECT_REASONS.malformed],
    [[{ productId: 'p1', quantity: 1 }, { productId: 'p1', quantity: 2 }], REJECT_REASONS.repeated],
    [[], REJECT_REASONS.noProducts],
    ['no es lista', REJECT_REASONS.noProducts],
  ])('rechaza %j', (interests, error) => {
    expect(checkInterests(interests)).toEqual({ ok: false, error });
  });

  it('rechaza más de 72 productos', () => {
    const many = Array.from({ length: 73 }, (_, i) => ({ productId: `p${i}`, quantity: 1 }));
    expect(checkInterests(many)).toEqual({ ok: false, error: REJECT_REASONS.tooMany });
  });

  it('los motivos caben en el campo error (hasta 500)', () => {
    for (const reason of Object.values(REJECT_REASONS)) expect(reason.length).toBeLessThanOrEqual(500);
  });
});

describe('resolveProducts: inexistentes se omiten, inactivos se aceptan', () => {
  it('toma nombre y presentación del catálogo y respeta el orden', () => {
    const result = resolveProducts(
      [
        { productId: 'p2', quantity: 10 },
        { productId: 'borrado', quantity: 3 },
        { productId: 'p3', quantity: 1 },
      ],
      catalog,
    );
    expect(result).toEqual({
      products: [
        { productId: 'p2', name: 'Caturra', presentation: 'Bolsa de 1 kg, molido', quantity: 10 },
        { productId: 'p3', name: 'Geisha', presentation: 'Bolsa de 250 g, grano entero', quantity: 1 },
      ],
      omitted: 1,
    });
    expect(contactInterests(result.products)).toEqual([
      { productId: 'p2', quantity: 10 },
      { productId: 'p3', quantity: 1 },
    ]);
  });
});

describe('sentDifferences (HU-503, criterio 5)', () => {
  const stored = { fullName: 'Ana Prueba Mora', email: 'ana@example.com', phoneCountry: 'CR', phoneNumber: '88112233' };
  const sent = { fullName: 'Ana Prueba Mora', email: 'ana@example.com', phoneCountry: 'CR', phoneNumber: '88112233' };

  it('iguales: sin diferencias (sin distinguir mayúsculas en nombre y correo)', () => {
    expect(sentDifferences(stored, { ...sent, fullName: 'ANA PRUEBA MORA', email: 'Ana@Example.com' })).toEqual([]);
  });

  it('teléfono distinto, con el formato de la HU: "Teléfono: +506 8811-2233."', () => {
    expect(sentDifferences({ ...stored, phoneNumber: '70001111' }, sent)).toEqual(['Teléfono: +506 8811-2233.']);
  });

  it('teléfono de otro país también cuenta como distinto', () => {
    expect(sentDifferences(stored, { ...sent, phoneCountry: 'US', phoneNumber: '3055550104' })).toEqual([
      'Teléfono: +1 3055550104.',
    ]);
  });

  it('nombre, correo y teléfono distintos, en ese orden', () => {
    expect(
      sentDifferences(stored, { fullName: 'Ana Mora', email: 'ana.mora@example.com', phoneCountry: 'CR', phoneNumber: '70001111' }),
    ).toEqual(['Nombre: Ana Mora.', 'Correo: ana.mora@example.com.', 'Teléfono: +506 7000-1111.']);
  });

  it('dato guardado vacío y enviado con valor: cuenta como distinto', () => {
    expect(sentDifferences({ ...stored, email: null, phoneCountry: null, phoneNumber: null }, sent)).toEqual([
      'Correo: ana@example.com.',
      'Teléfono: +506 8811-2233.',
    ]);
  });

  it('teléfono que no se envió: no cuenta', () => {
    expect(sentDifferences(stored, { ...sent, phoneCountry: null, phoneNumber: null })).toEqual([]);
  });
});

describe('buildFormNote (HU-502 criterio 4; HU-503 criterios 3 y 5)', () => {
  const products = [
    { productId: 'p1', name: 'Villa Sarchí', presentation: 'Bolsa de 340 g, grano entero', quantity: 2 },
    { productId: 'p2', name: 'Caturra', presentation: 'Bolsa de 1 kg, molido', quantity: 10 },
  ];

  it('mensaje y productos con sus cantidades', () => {
    expect(buildFormNote({ message: 'Quiero precios para mi cafetería.', products, omitted: 0, differences: [] })).toBe(
      'Quiero precios para mi cafetería.\n\nProductos:\n- Villa Sarchí (Bolsa de 340 g, grano entero): 2\n- Caturra (Bolsa de 1 kg, molido): 10',
    );
  });

  it('sin mensaje (null o solo espacios): "Sin mensaje"', () => {
    expect(buildFormNote({ message: null, products, omitted: 0, differences: [] }).startsWith('Sin mensaje\n\nProductos:')).toBe(true);
    expect(buildFormNote({ message: '   ', products, omitted: 0, differences: [] }).startsWith('Sin mensaje\n')).toBe(true);
  });

  it('omitidos y, al final, las diferencias', () => {
    const note = buildFormNote({
      message: null,
      products: products.slice(0, 1),
      omitted: 1,
      differences: ['Teléfono: +506 8811-2233.'],
    });
    expect(note).toBe(
      'Sin mensaje\n\nProductos:\n- Villa Sarchí (Bolsa de 340 g, grano entero): 2\n\nProductos no disponibles omitidos: 1.\n\nDatos enviados distintos a los registrados: Teléfono: +506 8811-2233.',
    );
    expect(note.endsWith('Datos enviados distintos a los registrados: Teléfono: +506 8811-2233.')).toBe(true);
  });

  it('el caso más largo posible del catálogo actual cabe completo (mensaje de 1000, 72 productos y 3 diferencias)', () => {
    const many = Array.from({ length: 72 }, (_, i) => ({
      productId: `p${i}`,
      name: 'Centroamericano',
      presentation: 'Bolsa de 1 kg, grano entero',
      quantity: 9999,
    }));
    const note = buildFormNote({
      message: 'x'.repeat(1000),
      products: many,
      omitted: 0,
      differences: [`Nombre: ${'n'.repeat(100)}.`, `Correo: ${'c'.repeat(100)}.`, 'Teléfono: +506 8811-2233.'],
    });
    expect(note.length).toBeLessThanOrEqual(FORM_NOTE_MAX);
    expect(note.split('\n').filter((l) => l.startsWith('- '))).toHaveLength(72);
  });

  it('si la lista no cupiera, se corta con "… y N productos más." y las diferencias siguen al final', () => {
    const huge = Array.from({ length: 72 }, (_, i) => ({ productId: `p${i}`, name: 'N'.repeat(100), presentation: 'P'.repeat(100), quantity: 1 }));
    const note = buildFormNote({ message: 'x'.repeat(1000), products: huge, omitted: 0, differences: ['Teléfono: +506 8811-2233.'] });
    expect(note.length).toBeLessThanOrEqual(FORM_NOTE_MAX);
    expect(note).toMatch(/… y \d+ productos más\./);
    expect(note.endsWith('Teléfono: +506 8811-2233.')).toBe(true);
  });

  it('productLine', () => {
    expect(productLine(products[0])).toBe('- Villa Sarchí (Bolsa de 340 g, grano entero): 2');
  });
});

describe('reclamo y etiqueta', () => {
  const now = 1_000_000_000;

  it('se puede tomar si no se procesó y no está reclamada, o si el reclamo tiene 2 minutos o más', () => {
    expect(isClaimable({ processed: false }, now)).toBe(true);
    expect(isClaimable({ processed: false, claimedAt: null }, now)).toBe(true);
    expect(isClaimable({ processed: false, claimedAt: at(now - CLAIM_TTL_MS) }, now)).toBe(true);
  });

  it('no se toma si ya se procesó o si alguien la tomó hace menos de 2 minutos', () => {
    expect(isClaimable({ processed: true }, now)).toBe(false);
    expect(isClaimable({ processed: false, claimedAt: at(now - CLAIM_TTL_MS + 1) }, now)).toBe(false);
  });

  it('HU-504: "Nuevo" sin abrir se queda en "Nuevo"; si no, "Nuevo mensaje"', () => {
    expect(nextFormBadge('Nuevo')).toBe('Nuevo');
    expect(nextFormBadge('Nuevo mensaje')).toBe('Nuevo mensaje');
    expect(nextFormBadge(null)).toBe('Nuevo mensaje');
    expect(nextFormBadge(undefined)).toBe('Nuevo mensaje');
  });
});
