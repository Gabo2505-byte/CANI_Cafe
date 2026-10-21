// @vitest-environment jsdom
// HU-314 y HU-316: pantalla "Avisos" y círculo rojo de la barra
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import type { AuthState } from '../../src/auth/useAuthUser';
import { SessionProvider } from '../../src/auth/SessionContext';
import type { SaleAlert } from '../../src/sales/alerts';
import { listAlerts } from '../../src/sales/alertsApi';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/sales/alertsApi', () => ({ listAlerts: vi.fn() }));
vi.mock('../../src/sales/saleDetailApi', () => ({ loadSaleDetail: vi.fn().mockResolvedValue(null) }));
vi.mock('../../src/sales/salesApi', () => ({ listBoardSales: vi.fn().mockResolvedValue([]) }));
vi.mock('../../src/sales/contactSearchApi', () => ({ getContactNames: vi.fn().mockResolvedValue(new Map()) }));

const active: AuthState = {
  status: 'active',
  firebaseUser: { uid: 'u1' } as FirebaseUser,
  profile: { id: 'u1', username: 'admin', email: 'admin@example.com', active: true },
};

const alert = (overrides: Partial<SaleAlert>): SaleAlert => ({
  id: 'sale-001:seguimiento_hoy',
  kind: 'seguimiento_hoy',
  saleId: 'sale-001',
  contactId: 'contact-002',
  contactName: 'Bruno Ficticio Solís',
  saleTitle: 'Café en grano',
  stage: 'en_negociacion',
  message: 'Seguimiento programado para hoy con Bruno Ficticio Solís – Café en grano.',
  date: new Date('2026-10-19T15:00:00Z'),
  ...overrides,
});
const overdue = alert({
  id: 'sale-002:seguimiento_vencido',
  kind: 'seguimiento_vencido',
  saleId: 'sale-002',
  contactName: 'Carla Ficticia',
  saleTitle: 'Distribución',
  stage: 'cotizacion_enviada',
  message: 'Seguimiento vencido desde el 12/10/2026 con Carla Ficticia – Distribución.',
  date: new Date('2026-10-12T16:00:00Z'),
});
const silent = alert({
  id: 'sale-003:sin_comunicacion',
  kind: 'sin_comunicacion',
  saleId: 'sale-003',
  contactName: 'Ana Prueba Mora',
  saleTitle: 'Muestras',
  stage: 'nuevo_interesado',
  message: 'Ana Prueba Mora – Muestras no tiene comunicaciones desde hace 12 días.',
  date: new Date('2026-10-14T16:00:00Z'),
});

let currentPath = '';
function PathProbe() {
  currentPath = useLocation().pathname;
  return null;
}

function renderAlerts(path = '/avisos') {
  return render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
          <PathProbe />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.mocked(listAlerts).mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const table = async () => (await screen.findByRole('table')) as HTMLTableElement;
const rowsOf = (t: HTMLElement) => within(t).getAllByRole('row').slice(1);

describe('HU-316 criterio 2: tabla de avisos', () => {
  it('tiene las columnas tipo, contacto, oportunidad de venta, etapa, detalle y fecha del aviso', async () => {
    vi.mocked(listAlerts).mockResolvedValue([overdue]);
    renderAlerts();
    const headers = within(await table()).getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual(['Tipo', 'Contacto', 'Oportunidad de venta', 'Etapa', 'Detalle', 'Fecha del aviso']);
  });

  it('cada fila muestra el tipo, el contacto, la venta, su etapa, el texto del aviso y la fecha dd/mm/aaaa', async () => {
    vi.mocked(listAlerts).mockResolvedValue([overdue]);
    renderAlerts();
    const cells = within(rowsOf(await table())[0]).getAllByRole('cell');
    expect(cells.map((c) => c.textContent)).toEqual([
      'Seguimiento vencido',
      'Carla Ficticia',
      'Distribución',
      'Precio o cotización enviada',
      'Seguimiento vencido desde el 12/10/2026 con Carla Ficticia – Distribución.',
      '12/10/2026',
    ]);
  });

  it('respeta el orden recibido (los más antiguos primero)', async () => {
    vi.mocked(listAlerts).mockResolvedValue([overdue, silent, alert({})]);
    renderAlerts();
    const rows = rowsOf(await table());
    expect(rows.map((r) => within(r).getAllByRole('cell')[5].textContent)).toEqual(['12/10/2026', '14/10/2026', '19/10/2026']);
  });
});

describe('HU-316 criterio 3: el tipo se muestra con color', () => {
  it.each([
    ['Seguimiento vencido', 'alert-type-overdue'],
    ['Seguimiento para hoy', 'alert-type-today'],
    ['Sin comunicación', 'alert-type-silent'],
  ])('"%s" usa la clase %s (rojo, naranja y amarillo)', async (label, cssClass) => {
    vi.mocked(listAlerts).mockResolvedValue([overdue, alert({}), silent]);
    renderAlerts();
    await table();
    expect(screen.getByText(label, { selector: 'span' }).className).toContain(cssClass);
  });
});

describe('HU-316 criterio 4: clic y caso sin avisos', () => {
  it('al dar clic en un aviso se abre el detalle de la oportunidad de venta', async () => {
    vi.mocked(listAlerts).mockResolvedValue([overdue]);
    const user = userEvent.setup();
    renderAlerts();
    await user.click(within(rowsOf(await table())[0]).getByText('Carla Ficticia'));
    expect(currentPath).toBe('/posibles-ventas/sale-002');
  });

  it('el título de la venta es un enlace al detalle (se puede abrir con teclado)', async () => {
    vi.mocked(listAlerts).mockResolvedValue([alert({})]);
    renderAlerts();
    const link = within(rowsOf(await table())[0]).getByRole('link', { name: 'Café en grano' });
    expect(link.getAttribute('href')).toBe('/posibles-ventas/sale-001');
  });

  it('sin avisos dice "No hay avisos pendientes." y no hay tabla', async () => {
    renderAlerts();
    expect(await screen.findByText('No hay avisos pendientes.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('si falla la carga lo avisa', async () => {
    vi.mocked(listAlerts).mockRejectedValue(new Error('sin red'));
    renderAlerts();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('No se pudieron cargar los avisos. Intente de nuevo.'));
  });
});

describe('HU-316 criterio 1: círculo rojo en la barra', () => {
  const avisosLink = () => within(screen.getByRole('banner')).getByRole('link', { name: /^Avisos/ });

  it('muestra la cantidad de avisos pendientes junto a "Avisos", en cualquier pantalla', async () => {
    vi.mocked(listAlerts).mockResolvedValue([overdue, silent, alert({})]);
    renderAlerts('/contactos');
    await waitFor(() => expect(within(avisosLink()).getByText('3')).toBeTruthy());
    expect(within(avisosLink()).getByText('3').className).toContain('topbar-count');
    expect(avisosLink().textContent).toBe('Avisos3');
  });

  it('cuenta cada aviso por separado (una venta con dos avisos suma dos)', async () => {
    vi.mocked(listAlerts).mockResolvedValue([alert({}), alert({ id: 'sale-001:sin_comunicacion', kind: 'sin_comunicacion' })]);
    renderAlerts('/contactos');
    await waitFor(() => expect(within(avisosLink()).getByText('2')).toBeTruthy());
  });

  it('sin avisos el círculo no aparece', async () => {
    renderAlerts('/contactos');
    await waitFor(() => expect(listAlerts).toHaveBeenCalled());
    expect(avisosLink().textContent).toBe('Avisos');
    expect(document.querySelector('.topbar-count')).toBeNull();
  });

  it('si no se pueden calcular los avisos la barra sigue funcionando, sin círculo', async () => {
    vi.mocked(listAlerts).mockRejectedValue(new Error('sin red'));
    renderAlerts('/contactos');
    await waitFor(() => expect(listAlerts).toHaveBeenCalled());
    expect(document.querySelector('.topbar-count')).toBeNull();
  });

  it('se recalcula al cambiar de pantalla: al desaparecer los avisos el círculo se va', async () => {
    vi.mocked(listAlerts).mockResolvedValue([alert({})]);
    const user = userEvent.setup();
    renderAlerts('/contactos');
    await waitFor(() => expect(within(avisosLink()).getByText('1')).toBeTruthy());

    vi.mocked(listAlerts).mockResolvedValue([]);
    await user.click(within(screen.getByRole('banner')).getByRole('link', { name: 'Gestión de ventas' }));
    await waitFor(() => expect(document.querySelector('.topbar-count')).toBeNull());
  });
});
