// @vitest-environment jsdom
// HU-310: Cambiar la etapa de una posible venta
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import type { AuthState } from '../../src/auth/useAuthUser';
import { SessionProvider } from '../../src/auth/SessionContext';
import type { SaleDetailData } from '../../src/sales/saleDetail';
import { loadSaleDetail } from '../../src/sales/saleDetailApi';
import { changeSaleStage } from '../../src/sales/salesApi';
import type { Sale, SaleStage } from '../../src/shared/types';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/sales/saleDetailApi', () => ({ loadSaleDetail: vi.fn() }));
vi.mock('../../src/sales/salesApi', () => ({
  listBoardSales: vi.fn().mockResolvedValue([]),
  createSale: vi.fn(),
  listOpenSaleTitles: vi.fn().mockResolvedValue([]),
  updateSale: vi.fn(),
  changeSaleStage: vi.fn(),
}));
vi.mock('../../src/products/productsApi', () => ({ listProducts: vi.fn().mockResolvedValue([]), listActiveProducts: vi.fn() }));
vi.mock('../../src/sales/contactSearchApi', () => ({
  getContactNames: vi.fn().mockResolvedValue(new Map()),
  listActiveContacts: vi.fn().mockResolvedValue([]),
  getContactForSale: vi.fn(),
}));
vi.mock('../../src/contacts/contactDetailApi', () => ({
  loadContactRecords: vi.fn().mockResolvedValue({ communications: [], sales: [], products: [] }),
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

const at = (iso: string) => Timestamp.fromDate(new Date(iso));
const sale = (stage: SaleStage): Sale => ({
  id: 'sale-001',
  contactId: 'contact-002',
  title: 'Café en grano para cafetería',
  stage,
  estimatedAmount: 450_000,
  nextFollowUpAt: null,
  notes: '',
  createdAt: at('2026-09-15T15:00:00Z'),
  stageChangedAt: at('2026-10-01T16:00:00Z'),
  lastCommunicationAt: null,
});
const detailOf = (stage: SaleStage): SaleDetailData => ({
  sale: sale(stage),
  contactName: 'Bruno Ficticio Solís',
  products: [],
  history: [{ saleId: 'sale-001', previousStage: null, newStage: 'nuevo_interesado', changedAt: at('2026-09-15T15:00:00Z'), lossReason: null }],
});

function renderDetail() {
  return render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={['/posibles-ventas/sale-001']}>
          <AppRoutes />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.mocked(loadSaleDetail).mockResolvedValue(detailOf('contactado'));
  vi.mocked(changeSaleStage).mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function openDialog() {
  const user = userEvent.setup();
  renderDetail();
  await user.click(await screen.findByRole('button', { name: 'Cambiar etapa' }));
  return { user, dialog: await screen.findByRole('dialog', { name: 'Cambiar etapa' }) };
}
const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;
const save = () => screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement;

describe('HU-310 botón "Cambiar etapa"', () => {
  it('aparece en el detalle de una posible venta abierta, junto a "Editar"', async () => {
    renderDetail();
    const button = await screen.findByRole('button', { name: 'Cambiar etapa' });
    expect(button.closest('.page-header')?.querySelector('h1')?.textContent).toBe('Café en grano para cafetería');
    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy();
  });

  it.each(['ganada', 'perdida'] as const)('no aparece en una venta %s', async (stage) => {
    vi.mocked(loadSaleDetail).mockResolvedValue(detailOf(stage));
    renderDetail();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Cambiar etapa' })).toBeNull();
  });
});

describe('HU-310 ventana "Cambiar etapa"', () => {
  it('muestra las seis etapas y deja marcada la actual', async () => {
    const { dialog } = await openDialog();
    const labels = within(dialog)
      .getAllByRole('radio')
      .map((r) => r.closest('label')?.textContent);
    expect(labels).toEqual([
      'Nuevo interesado',
      'Contactado Etapa actual',
      'Precio o cotización enviada',
      'En negociación',
      'Venta ganada',
      'Venta perdida',
    ]);
    expect(radio('Contactado Etapa actual').checked).toBe(true);
    expect(within(dialog).getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1);
  });

  it('"Guardar" está apagado mientras no se elija una etapa distinta', async () => {
    const { user } = await openDialog();
    expect(save().disabled).toBe(true);
    await user.click(radio('En negociación'));
    expect(save().disabled).toBe(false);
    await user.click(radio('Contactado Etapa actual'));
    expect(save().disabled).toBe(true);
  });

  it('"Venta ganada" y "Venta perdida" se ven pero todavía no se pueden elegir', async () => {
    await openDialog();
    expect(radio('Venta ganada').disabled).toBe(true);
    expect(radio('Venta perdida').disabled).toBe(true);
    expect(radio('Nuevo interesado').disabled).toBe(false);
    expect(screen.getByText('Marcar una posible venta como ganada o perdida estará disponible pronto.')).toBeTruthy();
  });

  it('hacia adelante: guarda el cambio, cierra la ventana y el detalle muestra la nueva etapa', async () => {
    const { user } = await openDialog();
    vi.mocked(loadSaleDetail).mockResolvedValue(detailOf('en_negociacion'));
    await user.click(radio('En negociación'));
    await user.click(save());

    await waitFor(() => expect(changeSaleStage).toHaveBeenCalledOnce());
    expect(changeSaleStage).toHaveBeenCalledWith('sale-001', 'contactado', 'en_negociacion');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const stageRow = screen.getByText('Etapa', { selector: 'dt' }).parentElement as HTMLElement;
    expect(within(stageRow).getByText('En negociación')).toBeTruthy();
    expect(loadSaleDetail).toHaveBeenCalledTimes(2);
    // Franja verde con la confirmación.
    expect((await screen.findByRole('status')).textContent).toBe('Etapa actualizada correctamente.');
  });

  it('hacia atrás también se puede', async () => {
    const { user } = await openDialog();
    await user.click(radio('Nuevo interesado'));
    await user.click(save());
    await waitFor(() => expect(changeSaleStage).toHaveBeenCalledWith('sale-001', 'contactado', 'nuevo_interesado'));
  });

  it('"Cancelar" y Escape cierran la ventana sin guardar', async () => {
    const { user } = await openDialog();
    await user.click(radio('En negociación'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Cambiar etapa' }));
    await screen.findByRole('dialog');
    // Al abrirla de nuevo parte de la etapa actual, no de lo que se había elegido.
    expect(radio('Contactado Etapa actual').checked).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(changeSaleStage).not.toHaveBeenCalled();
  });

  it('la confirmación vuelve a mostrarse en un segundo cambio', async () => {
    const { user } = await openDialog();
    vi.mocked(loadSaleDetail).mockResolvedValue(detailOf('en_negociacion'));
    await user.click(radio('En negociación'));
    await user.click(save());
    await screen.findByRole('status');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    vi.mocked(loadSaleDetail).mockResolvedValue(detailOf('contactado'));
    await user.click(screen.getByRole('button', { name: 'Cambiar etapa' }));
    await user.click(radio('Contactado'));
    await user.click(save());
    await waitFor(() => expect(changeSaleStage).toHaveBeenCalledTimes(2));
    expect((await screen.findByRole('status')).textContent).toBe('Etapa actualizada correctamente.');
  });

  it('si no se guarda (falla) no aparece la confirmación', async () => {
    vi.mocked(changeSaleStage).mockRejectedValue(new Error('sin red'));
    const { user } = await openDialog();
    await user.click(radio('En negociación'));
    await user.click(save());
    await screen.findByRole('alert');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('si falla el guardado lo avisa y la ventana sigue abierta', async () => {
    vi.mocked(changeSaleStage).mockRejectedValue(new Error('sin red'));
    const { user } = await openDialog();
    await user.click(radio('En negociación'));
    await user.click(save());
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo cambiar la etapa. Intente de nuevo.');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(save().disabled).toBe(false);
  });

  it('si la etapa cambió mientras tanto (otra pestaña) lo avisa', async () => {
    const { SaleStageConflictError } = await import('../../src/sales/salesRepository');
    vi.mocked(changeSaleStage).mockRejectedValue(new SaleStageConflictError());
    const { user } = await openDialog();
    await user.click(radio('En negociación'));
    await user.click(save());
    expect((await screen.findByRole('alert')).textContent).toBe(
      'La etapa de esta posible venta cambió. Cierre esta ventana y vuelva a intentarlo.',
    );
  });
});
