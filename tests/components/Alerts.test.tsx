// @vitest-environment jsdom
// HU-314: pantalla "Avisos" con los avisos de seguimiento
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import type { User as FirebaseUser } from 'firebase/auth';
import { MemoryRouter } from 'react-router';
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
  message: 'Seguimiento programado para hoy con Bruno Ficticio Solís – Café en grano.',
  date: new Date('2026-10-19T15:00:00Z'),
  ...overrides,
});

function renderAlerts() {
  return render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={['/avisos']}>
          <AppRoutes />
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

describe('HU-314 pantalla "Avisos"', () => {
  it('muestra el texto de cada aviso de seguimiento, en el orden recibido', async () => {
    vi.mocked(listAlerts).mockResolvedValue([
      alert({
        id: 'sale-002:seguimiento_vencido',
        kind: 'seguimiento_vencido',
        saleId: 'sale-002',
        message: 'Seguimiento vencido desde el 12/10/2026 con Carla Ficticia – Distribución.',
      }),
      alert({}),
    ]);
    renderAlerts();
    await screen.findByRole('link', { name: /Seguimiento vencido/ });
    const items = within(screen.getByRole('main')).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual([
      'Seguimiento vencido desde el 12/10/2026 con Carla Ficticia – Distribución.',
      'Seguimiento programado para hoy con Bruno Ficticio Solís – Café en grano.',
    ]);
  });

  it('cada aviso lleva al detalle de la posible venta', async () => {
    vi.mocked(listAlerts).mockResolvedValue([alert({})]);
    renderAlerts();
    const link = (await screen.findByRole('link', { name: /Seguimiento programado para hoy/ })) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/posibles-ventas/sale-001');
  });

  it('sin avisos dice "No hay avisos pendientes."', async () => {
    renderAlerts();
    expect(await screen.findByText('No hay avisos pendientes.')).toBeTruthy();
  });

  it('si falla la carga lo avisa', async () => {
    vi.mocked(listAlerts).mockRejectedValue(new Error('sin red'));
    renderAlerts();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('No se pudieron cargar los avisos. Intente de nuevo.'));
  });
});
