// Partes puras de los scripts de publicación: validación del catálogo, cálculo de diferencias y revisión de la cuenta.
import { describe, expect, it } from 'vitest';
import {
  AUSENTE,
  calcularDiferencias,
  describirDiferencias,
  validarCatalogo,
} from '../../scripts/produccion/catalogo';
import { revisarCuenta } from '../../scripts/produccion/nombreVisible';
import { buildCatalogProducts, type CatalogProduct } from '../../scripts/seed/catalogData';

const catalogo = buildCatalogProducts();
const copia = (): CatalogProduct[] => catalogo.map(({ id, data }) => ({ id, data: { ...data } }));

describe('validarCatalogo', () => {
  it('el catálogo oficial pasa: 72 productos, 9 variedades × 8 presentaciones', () => {
    expect(validarCatalogo(catalogo)).toEqual([]);
  });

  it('detecta un producto de menos', () => {
    const problemas = validarCatalogo(catalogo.slice(1));
    expect(problemas).toContain('Se esperaban 72 productos y hay 71.');
    expect(problemas.some((p) => /Villa Sarchí: 7 presentaciones/.test(p))).toBe(true);
  });

  it('detecta ids repetidos', () => {
    const productos = copia();
    productos[1].id = productos[0].id;
    expect(validarCatalogo(productos)).toContain(`Id repetido: ${productos[0].id}.`);
  });

  it('detecta tipos incorrectos y descripción larga', () => {
    const productos = copia() as unknown as { id: string; data: Record<string, unknown> }[];
    productos[0].data.active = 'true';
    productos[1].data.name = '';
    productos[2].data.presentation = 5;
    productos[3].data.description = 'x'.repeat(301);
    productos[4].data.price = 1000;
    const problemas = validarCatalogo(productos as unknown as CatalogProduct[]);
    expect(problemas).toContain(`${productos[0].id}: active debe ser true o false.`);
    expect(problemas).toContain(`${productos[1].id}: name debe ser texto no vacío.`);
    expect(problemas).toContain(`${productos[2].id}: presentation debe ser texto no vacío.`);
    expect(problemas).toContain(`${productos[3].id}: description tiene 301 caracteres (máximo 300).`);
    expect(problemas).toContain(`${productos[4].id}: campos no esperados (price).`);
  });

  it('detecta una variedad de más o una presentación repetida', () => {
    const productos = copia();
    productos[0].data.name = 'Variedad nueva';
    const problemas = validarCatalogo(productos);
    expect(problemas).toContain('Se esperaban 9 variedades y hay 10.');
    const repetida = copia();
    repetida[1].data.presentation = repetida[0].data.presentation;
    expect(validarCatalogo(repetida).some((p) => /está repetido/.test(p))).toBe(true);
  });
});

describe('calcularDiferencias', () => {
  it('con Firestore vacío, crea los 72', () => {
    const d = calcularDiferencias(catalogo, new Map());
    expect(d.crear).toHaveLength(72);
    expect(d.cambiar).toEqual([]);
    expect(d.iguales).toEqual([]);
    expect(d.sobrantes).toEqual([]);
  });

  it('con el catálogo ya cargado, no cambia nada', () => {
    const existentes = new Map(catalogo.map((p) => [p.id, { ...p.data }]));
    const d = calcularDiferencias(catalogo, existentes);
    expect(d.iguales).toHaveLength(72);
    expect(d.crear.length + d.cambiar.length + d.sobrantes.length).toBe(0);
  });

  it('detecta cada campo cambiado, uno que falta y uno que sobra', () => {
    const existentes = new Map(catalogo.map((p) => [p.id, { ...p.data } as Record<string, unknown>]));
    const [a, b] = catalogo;
    existentes.get(a.id)!.description = 'Texto viejo';
    existentes.get(a.id)!.active = false;
    delete existentes.get(b.id)!.presentation;
    existentes.get(b.id)!.price = 5000;
    const d = calcularDiferencias(catalogo, existentes);
    expect(d.iguales).toHaveLength(70);
    expect(d.cambiar).toEqual([
      {
        producto: a,
        cambios: [
          { campo: 'description', antes: 'Texto viejo', despues: a.data.description },
          { campo: 'active', antes: false, despues: true },
        ],
      },
      {
        producto: b,
        cambios: [
          { campo: 'presentation', antes: AUSENTE, despues: b.data.presentation },
          { campo: 'price', antes: 5000, despues: AUSENTE },
        ],
      },
    ]);
    const texto = describirDiferencias(d).join('\n');
    expect(texto).toContain(`~ ${a.id}`);
    expect(texto).toContain('active: false -> true');
    expect(texto).toContain('presentation: (no existe) -> "Bolsa de 250 g, molido"');
    expect(texto).toContain('price: 5000 -> (no existe)');
  });

  it('lista los sobrantes (ordenados) sin tocarlos', () => {
    const existentes = new Map<string, Record<string, unknown>>([
      ['zz-viejo', { name: 'Vieja', presentation: 'Bolsa', active: true }],
      ['aa-prueba', { name: 'Prueba', presentation: 'Bolsa', active: false }],
    ]);
    const d = calcularDiferencias(catalogo, existentes);
    expect(d.sobrantes.map((s) => s.id)).toEqual(['aa-prueba', 'zz-viejo']);
    expect(d.crear).toHaveLength(72);
    expect(describirDiferencias(d).join('\n')).toMatch(/NO se borran\): 2/);
  });
});

describe('revisarCuenta', () => {
  const base = {
    uid: 'u1',
    email: 'Admin@Example.com',
    usuario: 'admin',
    user: { username: 'admin', email: 'admin@example.com', active: true },
    username: { uid: 'u1', email: 'admin@example.com' },
  };

  it('sin diferencias cuando todo coincide (el correo sin distinguir mayúsculas)', () => {
    expect(revisarCuenta(base)).toEqual([]);
  });

  it('informa users inexistente, sin permiso o inactivo', () => {
    expect(revisarCuenta({ ...base, user: null })).toEqual(['users/u1: no existe.']);
    expect(revisarCuenta({ ...base, user: 'sin-permiso' })[0]).toMatch(/no se pudo leer/);
    expect(revisarCuenta({ ...base, user: { ...base.user, active: false } })).toEqual([
      'users/u1: active es false (debe ser true).',
    ]);
  });

  it('informa usernames inexistente o con otro uid o correo', () => {
    expect(revisarCuenta({ ...base, username: null })[0]).toMatch(/usernames\/admin: no existe/);
    expect(revisarCuenta({ ...base, username: { uid: 'otro', email: 'otro@example.com' } })).toEqual([
      'usernames/admin: uid es "otro" (la cuenta es "u1").',
      'usernames/admin: email es "otro@example.com" (la cuenta es "admin@example.com").',
    ]);
  });
});
