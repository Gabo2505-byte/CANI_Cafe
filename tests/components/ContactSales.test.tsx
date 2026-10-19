// @vitest-environment jsdom
// HU-208: Ver las posibles ventas de un contacto
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { SessionProvider } from '../../src/auth/SessionContext';
import type { AuthState } from '../../src/auth/useAuthUser';
import { sortSales } from '../../src/contacts/contactDetail';
import { loadContactRecords } from '../../src/contacts/contactDetailApi';
import { getContact } from '../../src/contacts/contactsApi';
import { loadSaleDetail } from '../../src/sales/saleDetailApi';
import type { Contact, Sale } from '../../src/shared/types';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/contacts/contactDetailApi', () => ({ loadContactRecords: vi.fn() }));
vi.mock('../../src/contacts/contactsApi', () => ({
  createContact: vi.fn(),
  getContact: vi.fn(),
  findDuplicateContacts: vi.fn(),
  countContacts: vi.fn().mockResolvedValue(0),
  listContactsPage: vi.fn().mockResolvedValue({ contacts: [], nextCursor: null }),
}));
// Pantalla a la que se navega al dar clic en una venta.
vi.mock('../../src/sales/saleDetailApi', () => ({ loadSaleDetail: vi.fn() }));

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

function renderContact() {
  render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={['/contactos/contact-002']}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

/** Fecha/hora de Costa Rica (UTC-6). */
const cr = (localIso: string) => Timestamp.fromDate(new Date(`${localIso}-06:00`));

const contact: Contact = {
  id: 'contact-002',
  fullName: 'Bruno Ficticio Solís',
  nameSortKey: 'bruno ficticio solis',
  email: 'bruno.ficticio@example.com',
  phoneCountry: 'CR',
  phoneNumber: '00000002',
  address: null,
  classification: 'cliente',
  status: 'activo',
  origin: 'referido',
  createdAt: cr('2026-09-03T10:30:00'),
};

const sale = (overrides: Partial<Sale> & Pick<Sale, 'id' | 'title'>): Sale => ({
  contactId: 'contact-002',
  stage: 'en_negociacion',
  estimatedAmount: 450_000,
  nextFollowUpAt: null,
  notes: '',
  createdAt: cr('2026-09-15T09:00:00'),
  stageChangedAt: cr('2026-09-15T09:00:00'),
  lastCommunicationAt: null,
  ...overrides,
});

// Mismas ventas que Bruno en el seed: una abierta, una ganada reciente y una ganada hace más de 30 días.
const brunoSales = (): Sale[] =>
  sortSales([
    sale({
      id: 'sale-005',
      title: 'Pedido antiguo de temporada (mock)',
      stage: 'ganada',
      estimatedAmount: 250_000,
      createdAt: cr('2026-08-01T10:00:00'),
      stageChangedAt: cr('2026-08-20T12:00:00'),
    }),
    sale({
      id: 'sale-001',
      title: 'Café en grano para cafetería (mock)',
      nextFollowUpAt: cr('2026-10-12T10:00:00'),
      lastCommunicationAt: cr('2026-10-02T11:00:00'),
    }),
    sale({
      id: 'sale-003',
      title: 'Pedido de temporada navideña (mock)',
      stage: 'ganada',
      estimatedAmount: 300_000,
      createdAt: cr('2026-09-25T10:00:00'),
      lastCommunicationAt: cr('2026-10-02T11:00:00'),
    }),
  ]);

async function openSalesTab(sales: Sale[]) {
  vi.mocked(loadContactRecords).mockResolvedValue({ communications: [], sales, products: [] });
  renderContact();
  await userEvent.setup().click(await screen.findByRole('tab', { name: `Posibles ventas (${sales.length})` }));
  return screen.getByRole('tabpanel');
}

const rows = (panel: HTMLElement) => within(within(panel).getAllByRole('rowgroup')[1]).getAllByRole('row');
const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map((c) => c.textContent);

beforeEach(() => {
  vi.mocked(getContact).mockReset().mockResolvedValue(contact);
  vi.mocked(loadContactRecords).mockReset();
  vi.mocked(loadSaleDetail).mockReset().mockResolvedValue(null);
});
afterEach(cleanup);

describe('HU-208 Ver las posibles ventas de un contacto', () => {
  it('criterio 1: tabla con título, etapa, monto estimado, próximo seguimiento y última comunicación', async () => {
    const panel = await openSalesTab(brunoSales());
    expect(within(panel).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Título',
      'Etapa',
      'Monto estimado',
      'Próximo seguimiento',
      'Última comunicación',
    ]);
    const negotiation = rows(panel).find((r) => r.textContent?.includes('Café en grano para cafetería'))!;
    expect(cells(negotiation)).toEqual([
      'Café en grano para cafetería (mock)',
      'En negociación',
      '₡ 450 000',
      '12/10/2026',
      '02/10/2026',
    ]);
  });

  it('criterio 1: sin fechas → "Sin seguimiento programado" y "Sin comunicaciones"', async () => {
    const panel = await openSalesTab(brunoSales());
    const old = rows(panel).find((r) => r.textContent?.includes('Pedido antiguo'))!;
    expect(cells(old).slice(3)).toEqual(['Sin seguimiento programado', 'Sin comunicaciones']);
  });

  it('criterio 2: incluye ganadas y perdidas (aunque tengan más de 30 días), de la más reciente a la más antigua', async () => {
    const lost = sale({ id: 'sale-009', title: 'Venta perdida (mock)', stage: 'perdida', createdAt: cr('2026-10-10T09:00:00') });
    const panel = await openSalesTab(sortSales([...brunoSales(), lost]));
    expect(rows(panel).map((r) => cells(r).slice(0, 2))).toEqual([
      ['Venta perdida (mock)', 'Venta perdida'],
      ['Pedido de temporada navideña (mock)', 'Venta ganada'],
      ['Café en grano para cafetería (mock)', 'En negociación'],
      ['Pedido antiguo de temporada (mock)', 'Venta ganada'],
    ]);
  });

  it('criterio 3: al dar clic en cualquier parte de la fila se abre el detalle de esa venta', async () => {
    const user = userEvent.setup();
    const panel = await openSalesTab(brunoSales());
    const row = rows(panel).find((r) => r.textContent?.includes('Pedido de temporada navideña'))!;
    await user.click(within(row).getAllByRole('cell')[2]); // celda del monto
    expect(currentLocation.pathname).toBe('/posibles-ventas/sale-003');
    expect(loadSaleDetail).toHaveBeenCalledWith('sale-003');
  });

  it('criterio 3: el título es un enlace al detalle (accesible con teclado)', async () => {
    const panel = await openSalesTab(brunoSales());
    expect(within(panel).getByRole('link', { name: 'Café en grano para cafetería (mock)' }).getAttribute('href')).toBe(
      '/posibles-ventas/sale-001',
    );
  });

  it('criterio 4: sin posibles ventas → "Este contacto no tiene posibles ventas." (sin tabla)', async () => {
    const panel = await openSalesTab([]);
    expect(within(panel).getByText('Este contacto no tiene posibles ventas.')).toBeTruthy();
    expect(within(panel).queryByRole('table')).toBeNull();
  });
});
