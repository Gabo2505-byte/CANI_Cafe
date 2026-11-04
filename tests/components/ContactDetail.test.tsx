// @vitest-environment jsdom
// HU-207: Consultar la ficha de un contacto. HU-209: pestaña "Productos de interés".
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { SessionProvider } from '../../src/auth/SessionContext';
import type { AuthState } from '../../src/auth/useAuthUser';
import type { ContactRecords } from '../../src/contacts/contactDetail';
import { loadContactRecords } from '../../src/contacts/contactDetailApi';
import { getContact, listAllContacts } from '../../src/contacts/contactsApi';
import type { Communication, Contact, Sale } from '../../src/shared/types';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/contacts/contactDetailApi', () => ({ loadContactRecords: vi.fn() }));
vi.mock('../../src/contacts/contactsApi', () => ({
  createContact: vi.fn(),
  getContact: vi.fn(),
  findDuplicateContacts: vi.fn(),
  listAllContacts: vi.fn(),
}));
// Pantalla a la que se navega desde la pestaña "Oportunidades de venta".
vi.mock('../../src/sales/saleDetailApi', () => ({ loadSaleDetail: vi.fn().mockResolvedValue(null) }));

const active: AuthState = {
  status: 'active',
  firebaseUser: { uid: 'u1' } as FirebaseUser,
  profile: { id: 'u1', username: 'admin', email: 'admin@example.com', active: true },
};

let currentLocation: ReturnType<typeof useLocation>;
function LocationProbe() {
  currentLocation = useLocation();
  return null;
}

function renderAt(path: string) {
  render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

const at = (iso: string) => Timestamp.fromDate(new Date(iso));

const makeContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 'contact-002',
  fullName: 'Bruno Ficticio Solís',
  nameSortKey: 'bruno ficticio solis',
  email: 'bruno.ficticio@example.com',
  phoneCountry: 'CR',
  phoneNumber: '00000002',
  address: 'Dirección de prueba 2, Heredia',
  classification: 'cliente',
  status: 'activo',
  origin: 'referido',
  createdAt: at('2026-09-03T16:30:00Z'),
  ...overrides,
});

const listContact = (i: number): Contact =>
  makeContact({
    id: `c${String(i).padStart(2, '0')}`,
    fullName: `Contacto ${String(i).padStart(2, '0')}`,
    nameSortKey: `contacto ${String(i).padStart(2, '0')}`,
  });

const comm = (id: string, iso: string, note: string): Communication => ({
  id,
  contactId: 'contact-002',
  saleId: null,
  appliesToAllSales: false,
  date: at(iso),
  medium: 'llamada',
  otherMedium: null,
  note,
  source: 'usuario',
  userId: 'u1',
  createdAt: at(iso),
});

const sale = (id: string, title: string): Sale => ({
  id,
  contactId: 'contact-002',
  title,
  stage: 'en_negociacion',
  estimatedAmount: 450_000,
  nextFollowUpAt: null,
  notes: '',
  createdAt: at('2026-09-15T15:00:00Z'),
  stageChangedAt: at('2026-10-01T16:00:00Z'),
  lastCommunicationAt: null,
});

const records = (overrides: Partial<ContactRecords> = {}): ContactRecords => ({
  communications: [
    comm('comm-003', '2026-10-02T17:00:00Z', 'Actualización de condiciones de pago.'),
    comm('comm-002', '2026-09-30T20:00:00Z', 'Revisión de volúmenes para la cafetería.'),
  ],
  sales: [sale('sale-003', 'Pedido de temporada navideña'), sale('sale-001', 'Café en grano para cafetería'), sale('sale-005', 'Pedido antiguo')],
  products: [
    { productId: 'product-002', name: 'Café en grano', presentation: 'Bolsa de 1 kg', quantity: 2 },
    { productId: 'product-001', name: 'Café en grano', presentation: 'Bolsa de 340 g', quantity: 5 },
    { productId: 'product-004', name: 'Café molido', presentation: 'Bolsa de 1 kg', quantity: 1 },
    { productId: 'product-003', name: 'Café molido', presentation: 'Bolsa de 340 g', quantity: 12 },
  ],
  ...overrides,
});

/** Simula Firestore: todos los contactos, ya en orden alfabético. */
function serveContacts(all: Contact[]) {
  vi.mocked(listAllContacts).mockResolvedValue(all);
}

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
const dataBox = () => screen.getByRole('region', { name: 'Datos del contacto' });
const dataValue = (label: string) => within(dataBox()).getByText(label).nextElementSibling?.textContent;

beforeEach(() => {
  vi.mocked(getContact).mockReset().mockResolvedValue(makeContact());
  vi.mocked(loadContactRecords).mockReset().mockResolvedValue(records());
  vi.mocked(listAllContacts).mockReset();
});
afterEach(cleanup);

describe('HU-207 Consultar la ficha de un contacto', () => {
  it('criterio 1: la ficha se abre al dar clic sobre el contacto en la lista', async () => {
    const user = userEvent.setup();
    serveContacts([listContact(1), listContact(2)]);
    vi.mocked(getContact).mockResolvedValue(listContact(2));
    renderAt('/contactos');
    await screen.findByRole('table');

    await user.click(within(bodyRows()[1]).getAllByRole('cell')[2]);
    expect(currentLocation.pathname).toBe('/contactos/c02');
    expect(await screen.findByRole('heading', { level: 1, name: 'Contacto 02' })).toBeTruthy();
    expect(getContact).toHaveBeenCalledWith('c02');
    expect(loadContactRecords).toHaveBeenCalledWith('c02');
  });

  it('criterio 2: arriba a la izquierda está "← Volver a contactos", antes del título', async () => {
    renderAt('/contactos/contact-002');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Bruno Ficticio Solís' });
    const back = screen.getByRole('link', { name: '← Volver a contactos' });
    expect(back.getAttribute('href')).toBe('/contactos');
    expect(back.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('criterio 2: "Volver a contactos" regresa a la lista en la misma página', async () => {
    const user = userEvent.setup();
    serveContacts(Array.from({ length: 45 }, (_, i) => listContact(i + 1)));
    vi.mocked(getContact).mockResolvedValue(listContact(23));
    renderAt('/contactos');
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Página 2 de 3')).toBeTruthy();
    expect(currentLocation.search).toBe('?pagina=2');

    await user.click(screen.getByRole('link', { name: 'Contacto 23' }));
    await screen.findByRole('heading', { level: 1, name: 'Contacto 23' });
    expect(screen.getByRole('link', { name: '← Volver a contactos' }).getAttribute('href')).toBe('/contactos?pagina=2');

    await user.click(screen.getByRole('link', { name: '← Volver a contactos' }));
    expect(await screen.findByText('Página 2 de 3')).toBeTruthy();
    expect(currentLocation.pathname).toBe('/contactos');
    expect(currentLocation.search).toBe('?pagina=2');
    expect(bodyRows()[0].firstElementChild?.textContent).toBe('Contacto 21');
  });

  it('criterio 2: conserva la búsqueda y los filtros que estén en la URL de la lista', async () => {
    const user = userEvent.setup();
    const client = { ...listContact(1), classification: 'cliente' as const };
    serveContacts([client]);
    vi.mocked(getContact).mockResolvedValue(client);
    renderAt('/contactos?buscar=contacto&clasificacion=cliente');
    await screen.findByRole('table');
    await user.click(screen.getByRole('link', { name: 'Contacto 01' }));
    await screen.findByRole('heading', { level: 1, name: 'Contacto 01' });
    expect(screen.getByRole('link', { name: '← Volver a contactos' }).getAttribute('href')).toBe(
      '/contactos?buscar=contacto&clasificacion=cliente',
    );
  });

  it('criterio 2: si se abre la ficha desde otro lado, vuelve a la lista desde el inicio', async () => {
    renderAt('/contactos/contact-002');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: '← Volver a contactos' }).getAttribute('href')).toBe('/contactos');
  });

  it('la lista abierta con "?pagina=3" (recarga o "Atrás") muestra esa página', async () => {
    serveContacts(Array.from({ length: 45 }, (_, i) => listContact(i + 1)));
    renderAt('/contactos?pagina=3');
    expect(await screen.findByText('Página 3 de 3')).toBeTruthy();
    expect(bodyRows()[0].firstElementChild?.textContent).toBe('Contacto 41');
  });

  it('si la página de la URL ya no existe, se queda en la última', async () => {
    serveContacts(Array.from({ length: 25 }, (_, i) => listContact(i + 1)));
    renderAt('/contactos?pagina=9');
    expect(await screen.findByText('Página 2 de 2')).toBeTruthy();
    await waitFor(() => expect(currentLocation.search).toBe('?pagina=2'));
  });

  it('criterio 3: el nombre es el título y a su lado la clasificación "Cliente" en verde', async () => {
    renderAt('/contactos/contact-002');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Bruno Ficticio Solís' });
    const badge = screen.getByText('Cliente');
    expect(badge.parentElement).toBe(heading.parentElement);
    expect(badge.className).toContain('classification-cliente');
  });

  it('criterio 3: "Persona interesada" en azul', async () => {
    vi.mocked(getContact).mockResolvedValue(makeContact({ classification: 'persona_interesada' }));
    renderAt('/contactos/contact-002');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('Persona interesada').className).toContain('classification-persona_interesada');
  });

  it('criterio 4: "Datos del contacto" con correo, teléfono, dirección, fecha de registro y origen, debajo del título', async () => {
    renderAt('/contactos/contact-002');
    const heading = await screen.findByRole('heading', { level: 1 });
    const box = dataBox();
    expect(heading.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(box).getAllByRole('term').map((t) => t.textContent)).toEqual([
      'Correo electrónico',
      'Teléfono',
      'Dirección',
      'Fecha de registro',
      'Origen',
    ]);
    expect(dataValue('Correo electrónico')).toBe('bruno.ficticio@example.com');
    expect(dataValue('Teléfono')).toBe('+506 0000-0002');
    expect(dataValue('Dirección')).toBe('Dirección de prueba 2, Heredia');
    expect(dataValue('Fecha de registro')).toBe('3 sept 2026');
    expect(dataValue('Origen')).toBe('Referido');
  });

  it('criterio 4: si falta un dato, dice "No registrado"', async () => {
    vi.mocked(getContact).mockResolvedValue(
      makeContact({ email: null, address: null, origin: null }),
    );
    renderAt('/contactos/contact-002');
    await screen.findByRole('heading', { level: 1 });
    expect(dataValue('Correo electrónico')).toBe('No registrado');
    expect(dataValue('Dirección')).toBe('No registrado');
    expect(dataValue('Origen')).toBe('No registrado');
    expect(dataValue('Teléfono')).toBe('+506 0000-0002');
  });

  it('criterio 5: tres pestañas con su conteo entre paréntesis; al abrir se ve "Comunicaciones"', async () => {
    renderAt('/contactos/contact-002');
    const tabs = await screen.findAllByRole('tab');
    expect(await screen.findByRole('tab', { name: 'Comunicaciones (2)' })).toBeTruthy();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Comunicaciones (2)',
      'Oportunidades de venta (3)',
      'Productos de interés (4)',
    ]);
    expect(tabs).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Comunicaciones (2)' }).getAttribute('aria-selected')).toBe('true');
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('Actualización de condiciones de pago.')).toBeTruthy();
    // Las pestañas quedan debajo de "Datos del contacto"
    expect(dataBox().compareDocumentPosition(tabs[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('criterio 5: al elegir otra pestaña se ven sus registros', async () => {
    const user = userEvent.setup();
    renderAt('/contactos/contact-002');
    await user.click(await screen.findByRole('tab', { name: 'Oportunidades de venta (3)' }));
    expect(screen.getByRole('tab', { name: 'Oportunidades de venta (3)' }).getAttribute('aria-selected')).toBe('true');
    expect(within(screen.getByRole('tabpanel')).getByRole('link', { name: 'Café en grano para cafetería' }).getAttribute('href')).toBe(
      '/posibles-ventas/sale-001',
    );

    await user.click(screen.getByRole('tab', { name: 'Productos de interés (4)' }));
    const lastRow = within(screen.getByRole('tabpanel')).getAllByRole('row').at(-1)!;
    expect([...lastRow.children].map((cell) => cell.textContent)).toEqual(['Café molido', 'Bolsa de 340 g', '12']);
  });

  it('las pestañas se recorren con las flechas del teclado', async () => {
    const user = userEvent.setup();
    renderAt('/contactos/contact-002');
    const first = await screen.findByRole('tab', { name: 'Comunicaciones (2)' });
    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Oportunidades de venta (3)' }).getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Productos de interés (4)' }).getAttribute('aria-selected')).toBe('true');
  });

  it('pestañas sin registros: (0) y un mensaje', async () => {
    const user = userEvent.setup();
    vi.mocked(loadContactRecords).mockResolvedValue({ communications: [], sales: [], products: [] });
    renderAt('/contactos/contact-002');
    expect(await screen.findByRole('tab', { name: 'Comunicaciones (0)' })).toBeTruthy();
    expect(screen.getByText('Este contacto no tiene comunicaciones registradas.')).toBeTruthy(); // HU-213
    await user.click(screen.getByRole('tab', { name: 'Oportunidades de venta (0)' }));
    expect(screen.getByText('Este contacto no tiene oportunidades de venta.')).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Productos de interés (0)' }));
    expect(screen.getByText('Este contacto no ha indicado productos de interés.')).toBeTruthy(); // HU-209
  });

  it('si fallan los registros, la ficha se ve igual y las pestañas avisan del error', async () => {
    vi.mocked(loadContactRecords).mockRejectedValue(new Error('unavailable'));
    renderAt('/contactos/contact-002');
    expect(await screen.findByText('No se pudieron cargar los registros del contacto. Intente de nuevo.')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Bruno Ficticio Solís' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Comunicaciones' })).toBeTruthy();
  });

  it('contacto inexistente: "El contacto no existe." con el enlace para volver', async () => {
    vi.mocked(getContact).mockResolvedValue(null);
    renderAt('/contactos/no-existe');
    expect(await screen.findByText('El contacto no existe.')).toBeTruthy();
    expect(screen.getByRole('link', { name: '← Volver a contactos' })).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });
});

describe('HU-209 Ver los productos de interés de un contacto', () => {
  async function openProducts(overrides: Partial<ContactRecords>) {
    const user = userEvent.setup();
    vi.mocked(loadContactRecords).mockResolvedValue(records(overrides));
    renderAt('/contactos/contact-002');
    await user.click(await screen.findByRole('tab', { name: /^Productos de interés/ }));
    return screen.getByRole('tabpanel');
  }

  it('criterio 1: tabla con producto, presentación y cantidad aproximada', async () => {
    const panel = await openProducts({ productsUpdatedAt: at('2026-10-05T18:20:00Z') });
    const table = within(panel).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Producto',
      'Presentación',
      'Cantidad aproximada',
    ]);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => [...row.children].map((cell) => cell.textContent))).toEqual([
      ['Café en grano', 'Bolsa de 1 kg', '2'],
      ['Café en grano', 'Bolsa de 340 g', '5'],
      ['Café molido', 'Bolsa de 1 kg', '1'],
      ['Café molido', 'Bolsa de 340 g', '12'],
    ]);
  });

  it('criterio 2: arriba de la tabla, "Última actualización: 05/10/2026" (fecha del último formulario)', async () => {
    const panel = await openProducts({ productsUpdatedAt: at('2026-10-05T18:20:00Z') });
    const updated = within(panel).getByText('Última actualización: 05/10/2026');
    expect(updated.compareDocumentPosition(within(panel).getByRole('table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('criterio 2: la fecha es la de Costa Rica (11:30 p. m. del 5 de octubre sigue siendo 05/10/2026)', async () => {
    const panel = await openProducts({ productsUpdatedAt: at('2026-10-06T05:30:00Z') });
    expect(within(panel).getByText('Última actualización: 05/10/2026')).toBeTruthy();
  });

  it('sin fecha de formulario (por ejemplo, datos de la carga inicial) se muestra la tabla sin esa línea', async () => {
    const panel = await openProducts({ productsUpdatedAt: null });
    expect(within(panel).getByRole('table')).toBeTruthy();
    expect(within(panel).queryByText(/^Última actualización/)).toBeNull();
  });

  it('criterio 3: sin productos, "Este contacto no ha indicado productos de interés." y sin tabla', async () => {
    const panel = await openProducts({ products: [], productsUpdatedAt: at('2026-10-05T18:20:00Z') });
    expect(within(panel).getByText('Este contacto no ha indicado productos de interés.')).toBeTruthy();
    expect(within(panel).queryByRole('table')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Productos de interés (0)' })).toBeTruthy();
  });

  it('un producto que ya no existe se muestra como "Producto no disponible"', async () => {
    const panel = await openProducts({
      products: [{ productId: 'borrado', name: 'Producto no disponible', presentation: '—', quantity: 3 }],
    });
    expect(within(panel).getByRole('cell', { name: 'Producto no disponible' })).toBeTruthy();
  });
});
