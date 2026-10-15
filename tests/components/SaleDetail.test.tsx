// @vitest-environment jsdom
// HU-308: Consultar el detalle de una posible venta
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import type { AuthState } from '../../src/auth/useAuthUser';
import { SessionProvider } from '../../src/auth/SessionContext';
import type { SaleDetailData } from '../../src/sales/saleDetail';
import { loadSaleDetail } from '../../src/sales/saleDetailApi';
import type { Sale, StageHistory } from '../../src/shared/types';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/sales/saleDetailApi', () => ({ loadSaleDetail: vi.fn() }));
// Pantallas a las que se navega desde el detalle.
vi.mock('../../src/sales/salesApi', () => ({ listBoardSales: vi.fn().mockResolvedValue([]), createSale: vi.fn(), listOpenSaleTitles: vi.fn() }));
vi.mock('../../src/sales/contactSearchApi', () => ({
  getContactNames: vi.fn().mockResolvedValue(new Map()),
  listActiveContacts: vi.fn().mockResolvedValue([]),
  getContactForSale: vi.fn(),
}));
vi.mock('../../src/contacts/contactsApi', () => ({
  getContact: vi.fn().mockResolvedValue(null),
  createContact: vi.fn(),
  findDuplicateContacts: vi.fn(),
  countContacts: vi.fn().mockResolvedValue(0),
  listContactsPage: vi.fn().mockResolvedValue({ contacts: [], nextCursor: null }),
}));

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

function renderDetail(saleId = 'sale-001') {
  return render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={[`/posibles-ventas/${saleId}`]}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

const at = (iso: string) => Timestamp.fromDate(new Date(iso));
const baseSale: Sale = {
  id: 'sale-001',
  contactId: 'contact-002',
  title: 'Café en grano para cafetería',
  stage: 'en_negociacion',
  estimatedAmount: 450_000,
  nextFollowUpAt: at('2026-10-12T16:00:00Z'),
  notes: 'Quiere probar muestras.',
  createdAt: at('2026-09-15T15:00:00Z'),
  stageChangedAt: at('2026-10-01T16:00:00Z'),
  lastCommunicationAt: at('2026-10-02T17:00:00Z'),
};
const history: StageHistory[] = [
  { saleId: 'sale-001', previousStage: null, newStage: 'nuevo_interesado', changedAt: at('2026-09-15T15:00:00Z'), lossReason: null },
  { saleId: 'sale-001', previousStage: 'nuevo_interesado', newStage: 'contactado', changedAt: at('2026-09-18T17:00:00Z'), lossReason: null },
  { saleId: 'sale-001', previousStage: 'contactado', newStage: 'perdida', changedAt: at('2026-09-20T17:00:00Z'), lossReason: 'Eligió otro proveedor.' },
  { saleId: 'sale-001', previousStage: 'perdida', newStage: 'contactado', changedAt: at('2026-09-25T17:00:00Z'), lossReason: null },
  { saleId: 'sale-001', previousStage: 'contactado', newStage: 'perdida', changedAt: at('2026-09-28T17:00:00Z'), lossReason: null },
];
const detail = (overrides: Partial<SaleDetailData> = {}): SaleDetailData => ({
  sale: baseSale,
  contactName: 'Bruno Ficticio Solís',
  products: [
    { productId: 'p1', name: 'Café en grano', presentation: 'Bolsa de 340 g', quantity: 20 },
    { productId: 'p2', name: 'Café molido', presentation: 'Bolsa de 1 kg', quantity: 1 },
  ],
  history,
  ...overrides,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const row = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement as HTMLElement;
const valueOf = (label: string) => within(row(label)).getByText((_, el) => el?.tagName === 'DD').textContent;

describe('HU-308 Detalle de la posible venta', () => {
  it('arriba tiene el enlace "← Volver a posibles ventas", el título y el contacto', async () => {
    vi.mocked(loadSaleDetail).mockResolvedValue(detail());
    renderDetail();
    expect(await screen.findByRole('heading', { level: 1, name: 'Café en grano para cafetería' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '← Volver a posibles ventas' }).getAttribute('href')).toBe('/posibles-ventas');
    expect(screen.getByRole('link', { name: 'Bruno Ficticio Solís' }).getAttribute('href')).toBe('/contactos/contact-002');
    expect(loadSaleDetail).toHaveBeenCalledWith('sale-001');
  });

  it('al dar clic en el nombre se abre la ficha del contacto', async () => {
    vi.mocked(loadSaleDetail).mockResolvedValue(detail());
    renderDetail();
    await userEvent.setup().click(await screen.findByRole('link', { name: 'Bruno Ficticio Solís' }));
    expect(currentLocation.pathname).toBe('/contactos/contact-002');
  });

  it('el enlace de volver lleva al tablero', async () => {
    vi.mocked(loadSaleDetail).mockResolvedValue(detail());
    renderDetail();
    await userEvent.setup().click(await screen.findByRole('link', { name: '← Volver a posibles ventas' }));
    expect(currentLocation.pathname).toBe('/posibles-ventas');
  });

  it('muestra etapa, monto, productos, seguimiento, notas, creación y última comunicación', async () => {
    vi.mocked(loadSaleDetail).mockResolvedValue(detail());
    renderDetail();
    await screen.findByRole('heading', { level: 1 });
    expect(valueOf('Etapa')).toBe('En negociación');
    expect(valueOf('Monto estimado')).toBe('₡ 450 000');
    expect(within(row('Productos')).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Café en grano · Bolsa de 340 g — 20 unidades',
      'Café molido · Bolsa de 1 kg — 1 unidad',
    ]);
    expect(valueOf('Próximo seguimiento')).toBe('12/10/2026');
    expect(valueOf('Notas')).toBe('Quiere probar muestras.');
    expect(valueOf('Fecha de creación')).toBe('15/09/2026');
    expect(valueOf('Última comunicación')).toBe('02/10/2026');
  });

  it('sin comunicaciones: "Sin comunicaciones"', async () => {
    vi.mocked(loadSaleDetail).mockResolvedValue(detail({ sale: { ...baseSale, lastCommunicationAt: null } }));
    renderDetail();
    await screen.findByRole('heading', { level: 1 });
    expect(valueOf('Última comunicación')).toBe('Sin comunicaciones');
  });

  it('sin seguimiento, sin productos y sin notas lo dice', async () => {
    vi.mocked(loadSaleDetail).mockResolvedValue(
      detail({ products: [], sale: { ...baseSale, nextFollowUpAt: null, notes: '  ' } }),
    );
    renderDetail();
    await screen.findByRole('heading', { level: 1 });
    expect(valueOf('Próximo seguimiento')).toBe('Sin seguimiento programado');
    expect(valueOf('Productos')).toBe('Sin productos');
    expect(valueOf('Notas')).toBe('Sin notas');
  });

  it('el historial va del más reciente al más antiguo, con fecha, etapa anterior y nueva', async () => {
    vi.mocked(loadSaleDetail).mockResolvedValue(detail());
    renderDetail();
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    const cells = rows.map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));
    expect(cells).toEqual([
      ['28/09/2026', 'Contactado', 'Venta perdida', 'Sin motivo registrado'],
      ['25/09/2026', 'Venta perdida', 'Contactado', ''],
      ['20/09/2026', 'Contactado', 'Venta perdida', 'Eligió otro proveedor.'],
      ['18/09/2026', 'Nuevo interesado', 'Contactado', ''],
      ['15/09/2026', '—', 'Nuevo interesado', ''],
    ]);
    expect(screen.getByRole('heading', { level: 2, name: 'Historial de etapas' })).toBeTruthy();
  });

  it('una venta que no existe lo avisa', async () => {
    vi.mocked(loadSaleDetail).mockResolvedValue(null);
    renderDetail('no-existe');
    expect((await screen.findByRole('alert')).textContent).toBe('No se encontró la posible venta.');
    expect(screen.getByRole('link', { name: '← Volver a posibles ventas' })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('si falla la carga lo avisa', async () => {
    vi.mocked(loadSaleDetail).mockRejectedValue(new Error('sin red'));
    renderDetail();
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo cargar la posible venta. Intente de nuevo.');
  });

  it('si el contacto ya no existe no muestra enlace', async () => {
    vi.mocked(loadSaleDetail).mockResolvedValue(detail({ contactName: null }));
    renderDetail();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: /Bruno/ })).toBeNull();
  });
});
