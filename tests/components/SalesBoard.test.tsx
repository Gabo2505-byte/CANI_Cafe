// @vitest-environment jsdom
// HU-305: Ver el tablero de posibles ventas
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import type { AuthState } from '../../src/auth/useAuthUser';
import { SessionProvider } from '../../src/auth/SessionContext';
import type { BoardSale } from '../../src/sales/board';
import { listActiveProducts } from '../../src/products/productsApi';
import { getContactNames, listActiveContacts } from '../../src/sales/contactSearchApi';
import { SaleCard } from '../../src/sales/SaleCard';
import { listBoardSales } from '../../src/sales/salesApi';
import type { Sale, SaleStage } from '../../src/shared/types';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/sales/salesApi', () => ({ listBoardSales: vi.fn(), listOpenSaleTitles: vi.fn(), createSale: vi.fn() }));
vi.mock('../../src/sales/contactSearchApi', () => ({
  getContactNames: vi.fn(),
  listActiveContacts: vi.fn(),
  getContactForSale: vi.fn(),
}));

vi.mock('../../src/products/productsApi', () => ({ listActiveProducts: vi.fn(), listProducts: vi.fn() }));

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

function renderBoard() {
  return render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={['/posibles-ventas']}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

const sale = (id: string, stage: SaleStage, overrides: Partial<Sale> = {}): Sale => ({
  id,
  contactId: 'contact-001',
  title: `Venta ${id}`,
  stage,
  estimatedAmount: 100_000,
  nextFollowUpAt: null,
  notes: '',
  createdAt: Timestamp.fromDate(new Date('2026-10-01T12:00:00Z')),
  stageChangedAt: Timestamp.fromDate(new Date('2026-10-05T12:00:00Z')),
  lastCommunicationAt: null,
  ...overrides,
});

beforeEach(() => {
  // Para cuando se navega al formulario de nueva posible venta.
  vi.mocked(listActiveContacts).mockResolvedValue([]);
  vi.mocked(listActiveProducts).mockResolvedValue([]);
  vi.mocked(getContactNames).mockResolvedValue(new Map([['contact-001', 'Ana Prueba Mora'], ['contact-002', 'Bruno Ficticio Solís']]));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const column = (label: string) => screen.getByRole('region', { name: label });

describe('HU-305 Tablero de posibles ventas', () => {
  it('muestra seis columnas con su conteo y suma, aunque no haya ventas', async () => {
    vi.mocked(listBoardSales).mockResolvedValue([]);
    renderBoard();
    await screen.findByRole('heading', { name: 'Nuevo interesado · 0 · ₡ 0' });
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      'Nuevo interesado · 0 · ₡ 0',
      'Contactado · 0 · ₡ 0',
      'Precio o cotización enviada · 0 · ₡ 0',
      'En negociación · 0 · ₡ 0',
      'Venta ganada · 0 · ₡ 0',
      'Venta perdida · 0 · ₡ 0',
    ]);
  });

  it('una columna sin ventas dice "Sin posibles ventas."', async () => {
    vi.mocked(listBoardSales).mockResolvedValue([sale('s1', 'contactado')]);
    renderBoard();
    await screen.findByRole('heading', { name: 'Contactado · 1 · ₡ 100 000' });
    expect(within(column('Nuevo interesado')).getByText('Sin posibles ventas.')).toBeTruthy();
    expect(within(column('Contactado')).queryByText('Sin posibles ventas.')).toBeNull();
  });

  it('cada venta aparece en la columna de su etapa y el encabezado suma los montos', async () => {
    vi.mocked(listBoardSales).mockResolvedValue([
      sale('s1', 'en_negociacion', { estimatedAmount: 400_000 }),
      sale('s2', 'en_negociacion', { estimatedAmount: 420_000, contactId: 'contact-002' }),
      sale('s3', 'nuevo_interesado', { estimatedAmount: 0 }),
    ]);
    renderBoard();
    await screen.findByRole('heading', { name: 'En negociación · 2 · ₡ 820 000' });
    expect(within(column('En negociación')).getAllByRole('listitem')).toHaveLength(2);
    expect(within(column('Nuevo interesado')).getAllByRole('listitem')).toHaveLength(1);
  });

  it('la tarjeta muestra contacto, título, monto y seguimiento', async () => {
    vi.mocked(listBoardSales).mockResolvedValue([
      sale('s1', 'contactado', {
        title: 'Café en grano para su cafetería',
        estimatedAmount: 150_000,
        nextFollowUpAt: Timestamp.fromDate(new Date('2026-10-20T06:00:00Z')),
      }),
    ]);
    renderBoard();
    const card = await screen.findByRole('link', { name: /Ana Prueba Mora/ });
    expect(card.textContent).toContain('Ana Prueba Mora');
    expect(card.textContent).toContain('Café en grano para su cafetería');
    expect(card.textContent).toContain('₡ 150 000');
    expect(card.textContent).toContain('Seguimiento: 20/10/2026');
  });

  it('sin fecha de seguimiento: "Sin seguimiento programado"', async () => {
    vi.mocked(listBoardSales).mockResolvedValue([sale('s1', 'contactado')]);
    renderBoard();
    const card = await screen.findByRole('link', { name: /Ana Prueba Mora/ });
    expect(card.textContent).toContain('Sin seguimiento programado');
  });

  it('al dar clic en una tarjeta se abre el detalle de esa posible venta', async () => {
    vi.mocked(listBoardSales).mockResolvedValue([sale('sale-xyz', 'contactado')]);
    renderBoard();
    await userEvent.setup().click(await screen.findByRole('link', { name: /Ana Prueba Mora/ }));
    expect(currentLocation.pathname).toBe('/posibles-ventas/sale-xyz');
  });

  it('el botón "Nueva posible venta" sigue ahí', async () => {
    vi.mocked(listBoardSales).mockResolvedValue([]);
    renderBoard();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Nueva posible venta' }));
    expect(currentLocation.pathname).toBe('/posibles-ventas/nueva');
  });

  it('si falla la carga lo avisa y no muestra columnas', async () => {
    vi.mocked(listBoardSales).mockRejectedValue(new Error('sin red'));
    renderBoard();
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudieron cargar las posibles ventas. Intente de nuevo.');
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('mientras carga lo indica', async () => {
    vi.mocked(listBoardSales).mockReturnValue(new Promise(() => {}));
    renderBoard();
    expect(await screen.findByText('Cargando posibles ventas…')).toBeTruthy();
  });

  it('pide una sola vez los nombres de los contactos de las ventas', async () => {
    vi.mocked(listBoardSales).mockResolvedValue([sale('s1', 'contactado'), sale('s2', 'contactado')]);
    renderBoard();
    await screen.findAllByRole('link', { name: /Ana Prueba Mora/ });
    await waitFor(() => expect(getContactNames).toHaveBeenCalledTimes(1));
    expect(getContactNames).toHaveBeenCalledWith(['contact-001', 'contact-001']);
  });
});

describe('HU-305 campana de aviso en la tarjeta', () => {
  const item: BoardSale = { sale: sale('s1', 'contactado'), contactName: 'Ana Prueba Mora' };
  const renderCard = (hasAlert?: boolean) =>
    render(
      <MemoryRouter>
        <ul>
          <SaleCard item={item} hasAlert={hasAlert} />
        </ul>
      </MemoryRouter>,
    );

  it('con aviso pendiente muestra la campana', () => {
    renderCard(true);
    expect(screen.getByRole('img', { name: 'Aviso pendiente' })).toBeTruthy();
  });

  it('sin aviso no la muestra', () => {
    renderCard(false);
    expect(screen.queryByRole('img', { name: 'Aviso pendiente' })).toBeNull();
  });
});
