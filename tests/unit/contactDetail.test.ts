// HU-207: lógica pura de la ficha del contacto.
import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import {
  backToListPath,
  registeredByLabel,
  communicationSaleLabel,
  openSaleOptions,
  CONTACT_SALES_COLUMNS,
  contactSaleCells,
  contactDataRows,
  interestProducts,
  pageIndexFromParam,
  sortCommunications,
  sortSales,
  tabLabel,
} from '../../src/contacts/contactDetail';
import type { Communication, Contact, Product, Sale } from '../../src/shared/types';

const at = (iso: string) => Timestamp.fromDate(new Date(iso));

const contact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 'c1',
  fullName: 'Ana Prueba Mora',
  nameSortKey: 'ana prueba mora',
  email: 'ana@example.com',
  phoneCountry: 'CR',
  phoneNumber: '88880001',
  address: 'San José',
  classification: 'persona_interesada',
  status: 'activo',
  origin: 'redes_sociales',
  createdAt: at('2026-09-01T15:00:00Z'),
  ...overrides,
});

const product = (id: string, name: string, presentation: string): Product => ({
  id,
  name,
  presentation,
  description: '',
  active: true,
});

describe('HU-207 contactDataRows', () => {
  it('correo, teléfono, dirección, fecha de registro y origen, en ese orden', () => {
    expect(contactDataRows(contact())).toEqual([
      ['Correo electrónico', 'ana@example.com'],
      ['Teléfono', '+506 8888-0001'],
      ['Dirección', 'San José'],
      ['Fecha de registro', '1 sept 2026'],
      ['Origen', 'Redes sociales'],
    ]);
  });

  it('un dato que falta dice "No registrado" (también si viene vacío o con espacios)', () => {
    const rows = contactDataRows(
      contact({ email: null, phoneCountry: null, phoneNumber: null, address: '   ', origin: null }),
    );
    expect(rows.map(([, v]) => v)).toEqual(['No registrado', 'No registrado', 'No registrado', '1 sept 2026', 'No registrado']);
  });

  it('teléfono de otro país con su código', () => {
    expect(contactDataRows(contact({ phoneCountry: 'US', phoneNumber: '3055550104' }))[1][1]).toBe('+1 3055550104');
  });
});

describe('HU-207 tabLabel', () => {
  it('indica el conteo entre paréntesis', () => {
    expect(tabLabel('Comunicaciones', 3)).toBe('Comunicaciones (3)');
    expect(tabLabel('Posibles ventas', 0)).toBe('Posibles ventas (0)');
  });
  it('sin conteo mientras no se conoce', () => {
    expect(tabLabel('Productos de interés', null)).toBe('Productos de interés');
  });
});

describe('HU-207 backToListPath', () => {
  it('vuelve a la lista con la misma página, búsqueda y filtros (la URL de la lista)', () => {
    expect(backToListPath({ from: '/contactos?pagina=2' })).toBe('/contactos?pagina=2');
    expect(backToListPath({ from: '/contactos?q=ana&clasificacion=cliente&pagina=3' })).toBe(
      '/contactos?q=ana&clasificacion=cliente&pagina=3',
    );
  });
  it('si no se llegó desde la lista, va a la lista desde el inicio', () => {
    expect(backToListPath(null)).toBe('/contactos');
    expect(backToListPath({})).toBe('/contactos');
    expect(backToListPath({ notice: 'Contacto registrado correctamente.' })).toBe('/contactos');
  });
  it('no acepta rutas que no sean la lista de contactos', () => {
    expect(backToListPath({ from: '/posibles-ventas' })).toBe('/contactos');
    expect(backToListPath({ from: '/contactos/nuevo' })).toBe('/contactos');
    expect(backToListPath({ from: 'https://otro.sitio/contactos' })).toBe('/contactos');
  });
});

describe('HU-207 pageIndexFromParam', () => {
  it('"?pagina=N" → índice N-1; otros valores → primera página', () => {
    expect(pageIndexFromParam('2')).toBe(1);
    expect(pageIndexFromParam('1')).toBe(0);
    expect(pageIndexFromParam(null)).toBe(0);
    expect(pageIndexFromParam('0')).toBe(0);
    expect(pageIndexFromParam('-3')).toBe(0);
    expect(pageIndexFromParam('abc')).toBe(0);
    expect(pageIndexFromParam('1.5')).toBe(0);
  });
});

describe('HU-207 interestProducts', () => {
  const catalog = [
    product('p1', 'Café molido', 'Bolsa de 340 g'),
    product('p2', 'Café en grano', 'Bolsa de 1 kg'),
    product('p3', 'Café en grano', 'Bolsa de 340 g'),
  ];

  it('productos distintos de todas las ventas, ordenados por nombre y presentación', () => {
    const result = interestProducts(
      [
        { saleId: 's1', productId: 'p1', quantity: 2 },
        { saleId: 's1', productId: 'p2', quantity: 1 },
        { saleId: 's2', productId: 'p2', quantity: 5 },
        { saleId: 's2', productId: 'p3', quantity: 5 },
      ],
      catalog,
    );
    expect(result.map((p) => `${p.name} · ${p.presentation}`)).toEqual([
      'Café en grano · Bolsa de 1 kg',
      'Café en grano · Bolsa de 340 g',
      'Café molido · Bolsa de 340 g',
    ]);
  });

  it('un producto que ya no está en el catálogo se muestra como "Producto no disponible"', () => {
    expect(interestProducts([{ saleId: 's1', productId: 'borrado', quantity: 1 }], catalog)).toEqual([
      { productId: 'borrado', name: 'Producto no disponible', presentation: '—' },
    ]);
  });

  it('sin ventas o ventas sin productos → lista vacía', () => {
    expect(interestProducts([], catalog)).toEqual([]);
  });
});

describe('HU-207 orden de comunicaciones y ventas', () => {
  it('comunicaciones de la más reciente a la más antigua', () => {
    const comm = (id: string, iso: string) => ({ id, date: at(iso) }) as Communication;
    expect(sortCommunications([comm('a', '2026-09-01T10:00:00Z'), comm('b', '2026-10-01T10:00:00Z')]).map((c) => c.id)).toEqual(['b', 'a']);
  });
  it('ventas de la más nueva a la más antigua', () => {
    const sale = (id: string, iso: string) => ({ id, createdAt: at(iso) }) as Sale;
    expect(sortSales([sale('a', '2026-08-01T10:00:00Z'), sale('b', '2026-09-15T10:00:00Z')]).map((s) => s.id)).toEqual(['b', 'a']);
  });
});

describe('HU-208 tabla de posibles ventas del contacto', () => {
  const cr = (localIso: string) => Timestamp.fromDate(new Date(`${localIso}-06:00`));
  const base = {
    contactId: 'c1',
    notes: '',
    stageChangedAt: cr('2026-09-15T09:00:00'),
  };

  it('celdas: título, etapa, monto, seguimiento y última comunicación (dd/mm/aaaa, hora de Costa Rica)', () => {
    const sale: Sale = {
      ...base,
      id: 's1',
      title: 'Café en grano',
      stage: 'cotizacion_enviada',
      estimatedAmount: 1_200_000,
      createdAt: cr('2026-09-15T09:00:00'),
      // 23:30 en Costa Rica: ya es el día siguiente en UTC, pero se muestra el día de Costa Rica.
      nextFollowUpAt: cr('2026-10-09T23:30:00'),
      lastCommunicationAt: cr('2026-10-03T15:30:00'),
    };
    expect(contactSaleCells(sale)).toEqual([
      'Café en grano',
      'Precio o cotización enviada',
      '₡ 1 200 000',
      '09/10/2026',
      '03/10/2026',
    ]);
  });

  it('sin fechas: "Sin seguimiento programado" y "Sin comunicaciones"; monto ₡ 0', () => {
    const sale: Sale = {
      ...base,
      id: 's2',
      title: 'Primer contacto',
      stage: 'ganada',
      estimatedAmount: 0,
      createdAt: cr('2026-09-15T09:00:00'),
      nextFollowUpAt: null,
      lastCommunicationAt: null,
    };
    expect(contactSaleCells(sale).slice(1)).toEqual(['Venta ganada', '₡ 0', 'Sin seguimiento programado', 'Sin comunicaciones']);
  });

  it('las columnas son cinco y en ese orden', () => {
    expect(CONTACT_SALES_COLUMNS).toEqual(['Título', 'Etapa', 'Monto estimado', 'Próximo seguimiento', 'Última comunicación']);
  });

  it('misma fecha de creación: orden estable por id', () => {
    const same = cr('2026-09-15T09:00:00');
    const s = (id: string) => ({ id, createdAt: same }) as Sale;
    expect(sortSales([s('b'), s('a'), s('c')]).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('HU-212 ventas elegibles y venta de cada comunicación', () => {
  const s = (id: string, stage: Sale['stage'], title = id) => ({ id, stage, title }) as Sale;
  const sales = [s('a', 'contactado', 'Abierta A'), s('g', 'ganada'), s('p', 'perdida'), s('b', 'en_negociacion', 'Abierta B')];

  it('solo las que no están ganadas ni perdidas, en el mismo orden', () => {
    expect(openSaleOptions(sales)).toEqual([
      { id: 'a', title: 'Abierta A' },
      { id: 'b', title: 'Abierta B' },
    ]);
  });

  it('en el historial: título de la venta, "Todas sus posibles ventas" o nada (comunicaciones antiguas)', () => {
    expect(communicationSaleLabel({ saleId: 'b', appliesToAllSales: false }, sales)).toBe('Abierta B');
    expect(communicationSaleLabel({ saleId: null, appliesToAllSales: true }, sales)).toBe('Todas sus posibles ventas');
    expect(communicationSaleLabel({ saleId: null, appliesToAllSales: false }, sales)).toBeNull();
    expect(communicationSaleLabel({ saleId: 'borrada', appliesToAllSales: false }, sales)).toBe('—');
  });
});

describe('HU-213 "Registrado por"', () => {
  it('el nombre de usuario de quien la registró', () => {
    expect(registeredByLabel({ source: 'usuario', userId: 'u1' }, { u1: 'admin' })).toBe('Registrado por: admin');
  });
  it('del formulario web: "Sistema (formulario web)"', () => {
    expect(registeredByLabel({ source: 'formulario_web', userId: null })).toBe('Registrado por: Sistema (formulario web)');
  });
  it('usuario que ya no existe: "—"', () => {
    expect(registeredByLabel({ source: 'usuario', userId: 'borrado' }, {})).toBe('Registrado por: —');
  });
});
