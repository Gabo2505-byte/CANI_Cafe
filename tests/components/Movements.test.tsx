// @vitest-environment jsdom
// Tabla de movimientos: historial de cambios de etapa de todas las oportunidades.
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
import type { MovementRow } from '../../src/sales/movements';
import { createMovementsLoader } from '../../src/sales/movementsApi';
import type { MovementsCursor, MovementsPage } from '../../src/sales/movementsRepository';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/sales/movementsApi', () => ({ createMovementsLoader: vi.fn() }));
// Pantallas a las que se navega desde la tabla.
vi.mock('../../src/sales/alertsApi', () => ({ listAlerts: vi.fn().mockResolvedValue([]) }));
vi.mock('../../src/sales/salesApi', () => ({ listBoardSales: vi.fn().mockResolvedValue([]), createSale: vi.fn(), listOpenSaleTitles: vi.fn() }));
vi.mock('../../src/sales/contactSearchApi', () => ({
  getContactNames: vi.fn().mockResolvedValue(new Map()),
  listActiveContacts: vi.fn().mockResolvedValue([]),
  getContactForSale: vi.fn(),
}));
vi.mock('../../src/sales/saleDetailApi', () => ({ loadSaleDetail: vi.fn(() => new Promise(() => {})) }));

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
  return render(
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
const row = (id: string, overrides: Partial<MovementRow> = {}): MovementRow => ({
  id,
  saleId: 'sale-001',
  changedAt: at('2026-10-01T16:00:00Z'),
  saleTitle: 'Café en grano para cafetería',
  contactName: 'Ana Activa',
  previousStageLabel: 'Precio o cotización enviada',
  newStageLabel: 'En negociación',
  reason: '',
  ...overrides,
});

const firstPage: MovementRow[] = [
  row('sale-004_03', {
    saleId: 'sale-004',
    changedAt: at('2026-10-08T21:00:00Z'),
    saleTitle: 'Muestras para eventos',
    contactName: 'Bruno Prueba',
    previousStageLabel: 'Contactado',
    newStageLabel: 'Venta perdida',
    reason: 'El cliente eligió otro proveedor.',
  }),
  row('sale-001_04'),
  row('sale-001_01', { changedAt: at('2026-09-15T15:00:00Z'), previousStageLabel: '—', newStageLabel: 'Nuevo interesado' }),
];

const cursor = { id: 'cursor' } as unknown as MovementsCursor;
const loadPage = vi.fn<(after: MovementsCursor | null) => Promise<MovementsPage>>();

beforeEach(() => {
  loadPage.mockReset();
  vi.mocked(createMovementsLoader).mockReset().mockReturnValue({ loadPage });
});

afterEach(() => cleanup());

const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
const cells = (tr: HTMLElement) => within(tr).getAllByRole('cell').map((td) => td.textContent);

describe('tabla de movimientos', () => {
  it('muestra "Cargando…" mientras lee la primera página', () => {
    loadPage.mockReturnValue(new Promise(() => {}));
    renderAt('/posibles-ventas/movimientos');
    expect(screen.getByRole('heading', { level: 1, name: 'Movimientos' })).toBeTruthy();
    expect(screen.getByText('Cargando…')).toBeTruthy();
    expect(loadPage).toHaveBeenCalledWith(null);
  });

  it('muestra las columnas y las filas en el orden recibido, con guion en la entrada inicial y motivo solo en la pérdida', async () => {
    loadPage.mockResolvedValue({ rows: firstPage, nextCursor: null });
    renderAt('/posibles-ventas/movimientos');
    await screen.findByRole('table');

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Fecha',
      'Oportunidad',
      'Etapa anterior',
      'Etapa nueva',
      'Motivo',
    ]);
    const rows = bodyRows();
    expect(rows).toHaveLength(3);
    expect(cells(rows[0])).toEqual([
      '08/10/2026',
      'Bruno PruebaMuestras para eventos',
      'Contactado',
      'Venta perdida',
      'El cliente eligió otro proveedor.',
    ]);
    expect(cells(rows[1])).toEqual(['01/10/2026', 'Ana ActivaCafé en grano para cafetería', 'Precio o cotización enviada', 'En negociación', '']);
    expect(cells(rows[2])).toEqual(['15/09/2026', 'Ana ActivaCafé en grano para cafetería', '—', 'Nuevo interesado', '']);
    // Con una sola página no hay "Cargar más".
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('el nombre del contacto es un enlace al detalle de la venta', async () => {
    loadPage.mockResolvedValue({ rows: firstPage, nextCursor: null });
    renderAt('/posibles-ventas/movimientos');
    const link = await screen.findByRole('link', { name: 'Bruno Prueba' });
    expect(link.getAttribute('href')).toBe('/posibles-ventas/sale-004');
    await userEvent.click(link);
    expect(currentLocation.pathname).toBe('/posibles-ventas/sale-004');
  });

  it('si la venta ya no existe, la fila no lleva enlace', async () => {
    loadPage.mockResolvedValue({ rows: [row('borrada', { saleTitle: null, contactName: '—' })], nextCursor: null });
    renderAt('/posibles-ventas/movimientos');
    await screen.findByRole('table');
    expect(cells(bodyRows()[0])[1]).toBe('—');
    expect(within(screen.getByRole('table')).queryByRole('link')).toBeNull();
  });

  it('sin movimientos muestra el mensaje de vacío y no la tabla', async () => {
    loadPage.mockResolvedValue({ rows: [], nextCursor: null });
    renderAt('/posibles-ventas/movimientos');
    expect(await screen.findByText('No hay movimientos registrados.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('si falla la lectura muestra el error en rojo', async () => {
    loadPage.mockRejectedValue(new Error('sin conexión'));
    renderAt('/posibles-ventas/movimientos');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('No se pudieron cargar los movimientos. Intente de nuevo.');
    expect(alert.classList.contains('field-error')).toBe(true);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('"Cargar más" pide la página siguiente con el cursor y agrega sus filas al final', async () => {
    const secondPage = [row('sale-005_01', { saleId: 'sale-005', changedAt: at('2026-08-01T16:00:00Z'), contactName: 'Carla Antigua' })];
    loadPage.mockResolvedValueOnce({ rows: firstPage, nextCursor: cursor });
    let resolveSecond!: (page: MovementsPage) => void;
    loadPage.mockReturnValueOnce(new Promise((resolve) => (resolveSecond = resolve)));
    renderAt('/posibles-ventas/movimientos');

    const button = await screen.findByRole('button', { name: 'Cargar más' });
    await userEvent.click(button);
    expect(loadPage).toHaveBeenLastCalledWith(cursor);
    // Mientras carga, el botón queda deshabilitado.
    expect((screen.getByRole('button', { name: 'Cargando…' }) as HTMLButtonElement).disabled).toBe(true);

    resolveSecond({ rows: secondPage, nextCursor: null });
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    expect(cells(bodyRows()[3])[1]).toContain('Carla Antigua');
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
    // Un solo cargador para toda la visita (su caché se comparte entre páginas).
    expect(createMovementsLoader).toHaveBeenCalledTimes(1);
  });

  it('si falla "Cargar más" se conservan las filas, se muestra el error y se puede reintentar', async () => {
    loadPage.mockResolvedValueOnce({ rows: firstPage, nextCursor: cursor });
    loadPage.mockRejectedValueOnce(new Error('sin conexión'));
    loadPage.mockResolvedValueOnce({ rows: [row('extra')], nextCursor: null });
    renderAt('/posibles-ventas/movimientos');

    await userEvent.click(await screen.findByRole('button', { name: 'Cargar más' }));
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudieron cargar más movimientos. Intente de nuevo.');
    expect(bodyRows()).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(loadPage).toHaveBeenNthCalledWith(3, cursor);
  });

  it('el enlace de regreso lleva a Gestión de ventas', async () => {
    loadPage.mockResolvedValue({ rows: [], nextCursor: null });
    renderAt('/posibles-ventas/movimientos');
    await userEvent.click(screen.getByRole('link', { name: '← Volver a gestión de ventas' }));
    expect(currentLocation.pathname).toBe('/posibles-ventas');
  });
});

describe('acceso desde Gestión de ventas', () => {
  it('el encabezado del tablero tiene el botón "Movimientos", que abre la tabla', async () => {
    loadPage.mockResolvedValue({ rows: [], nextCursor: null });
    renderAt('/posibles-ventas');
    const header = screen.getByRole('heading', { level: 1, name: 'Gestión de ventas' }).closest('.page-header') as HTMLElement;
    const button = within(header).getByRole('button', { name: 'Movimientos' });
    // Va antes de "+ Nueva oportunidad".
    expect(within(header).getAllByRole('button').map((b) => b.textContent)).toEqual(['Movimientos', '+Nueva oportunidad']);
    await userEvent.click(button);
    expect(currentLocation.pathname).toBe('/posibles-ventas/movimientos');
    expect(await screen.findByText('No hay movimientos registrados.')).toBeTruthy();
  });

  it('la ruta de movimientos no se confunde con el detalle de una venta', async () => {
    loadPage.mockResolvedValue({ rows: [], nextCursor: null });
    renderAt('/posibles-ventas/movimientos');
    expect(screen.getByRole('heading', { level: 1, name: 'Movimientos' })).toBeTruthy();
    expect(createMovementsLoader).toHaveBeenCalled();
  });
});
