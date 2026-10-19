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
  vi.mocked(changeSaleStage).mockResolvedValue({ contactBecameClient: false, contactName: null });
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

  it('"Venta perdida" y "Venta ganada" se pueden elegir', async () => {
    await openDialog();
    expect(radio('Venta perdida').disabled).toBe(false);
    expect(radio('Venta ganada').disabled).toBe(false);
    expect(radio('Nuevo interesado').disabled).toBe(false);
  });

  it('hacia adelante: guarda el cambio, cierra la ventana y el detalle muestra la nueva etapa', async () => {
    const { user } = await openDialog();
    vi.mocked(loadSaleDetail).mockResolvedValue(detailOf('en_negociacion'));
    await user.click(radio('En negociación'));
    await user.click(save());

    await waitFor(() => expect(changeSaleStage).toHaveBeenCalledOnce());
    expect(changeSaleStage).toHaveBeenCalledWith('sale-001', 'contactado', 'en_negociacion', undefined);
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
    await waitFor(() => expect(changeSaleStage).toHaveBeenCalledWith('sale-001', 'contactado', 'nuevo_interesado', undefined));
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

describe('HU-311 marcar como perdida desde la ventana "Cambiar etapa"', () => {
  const QUESTION = '¿Está seguro de que desea marcar esta venta como perdida?';
  const reason = () => screen.getByLabelText(/^Motivo de la pérdida/) as HTMLTextAreaElement;

  it('al elegir "Venta perdida" pregunta si está seguro y ofrece el motivo; con otras etapas no', async () => {
    const { user } = await openDialog();
    expect(screen.queryByText(QUESTION)).toBeNull();
    expect(screen.queryByLabelText(/^Motivo de la pérdida/)).toBeNull();

    await user.click(radio('Venta perdida'));
    expect(screen.getByText(QUESTION)).toBeTruthy();
    expect(reason().value).toBe('');
    // El cursor pasa al motivo y el botón pasa a ser "Aceptar".
    expect(document.activeElement).toBe(reason());
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Aceptar' }) as HTMLButtonElement).disabled).toBe(false);

    await user.click(radio('En negociación'));
    expect(screen.queryByText(QUESTION)).toBeNull();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeTruthy();
  });

  it('el motivo es opcional: aceptar sin escribirlo guarda la pérdida', async () => {
    const { user } = await openDialog();
    vi.mocked(loadSaleDetail).mockResolvedValue(detailOf('perdida'));
    await user.click(radio('Venta perdida'));
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));

    await waitFor(() => expect(changeSaleStage).toHaveBeenCalledOnce());
    expect(changeSaleStage).toHaveBeenCalledWith('sale-001', 'contactado', 'perdida', '');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await screen.findByRole('status')).textContent).toBe('Posible venta marcada como perdida.');
    // Ya perdida: no se puede volver a mover desde aquí (se reabre con HU-312).
    expect(screen.queryByRole('button', { name: 'Cambiar etapa' })).toBeNull();
  });

  it('con motivo: se entrega para guardarlo', async () => {
    const { user } = await openDialog();
    await user.click(radio('Venta perdida'));
    await user.type(reason(), 'Eligió otro proveedor.');
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));
    await waitFor(() =>
      expect(changeSaleStage).toHaveBeenCalledWith('sale-001', 'contactado', 'perdida', 'Eligió otro proveedor.'),
    );
  });

  it('el motivo acepta como máximo 250 caracteres y muestra el contador', async () => {
    const { user } = await openDialog();
    await user.click(radio('Venta perdida'));
    await user.click(reason());
    await user.paste('m'.repeat(300));
    expect(reason().value).toHaveLength(250);
    expect(screen.getByText('250/250')).toBeTruthy();
  });

  it('"Cancelar" deja la posible venta en su etapa y no guarda nada', async () => {
    const { user } = await openDialog();
    await user.click(radio('Venta perdida'));
    await user.type(reason(), 'No debe guardarse');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(changeSaleStage).not.toHaveBeenCalled();
    expect(loadSaleDetail).toHaveBeenCalledTimes(1);
    const stageRow = screen.getByText('Etapa', { selector: 'dt' }).parentElement as HTMLElement;
    expect(within(stageRow).getByText('Contactado')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();

    // Al abrirla otra vez no queda ni la pregunta ni el motivo escrito.
    await user.click(screen.getByRole('button', { name: 'Cambiar etapa' }));
    await screen.findByRole('dialog');
    expect(screen.queryByText(QUESTION)).toBeNull();
    await user.click(radio('Venta perdida'));
    expect(reason().value).toBe('');
  });

  it('si falla el guardado lo avisa, la ventana sigue abierta y el motivo escrito se conserva', async () => {
    vi.mocked(changeSaleStage).mockRejectedValue(new Error('sin red'));
    const { user } = await openDialog();
    await user.click(radio('Venta perdida'));
    await user.type(reason(), 'Motivo');
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo cambiar la etapa. Intente de nuevo.');
    expect(reason().value).toBe('Motivo');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('HU-313 marcar como ganada desde la ventana "Cambiar etapa"', () => {
  const QUESTION =
    '¿Confirma que esta venta fue ganada? El contacto pasará a ser cliente y la venta ya no podrá cambiar de etapa.';

  it('al elegir "Venta ganada" pregunta si confirma; con otras etapas no', async () => {
    const { user } = await openDialog();
    expect(screen.queryByText(QUESTION)).toBeNull();

    await user.click(radio('Venta ganada'));
    expect(screen.getByText(QUESTION)).toBeTruthy();
    // No es una pérdida: no pide motivo ni usa la pregunta de la pérdida.
    expect(screen.queryByLabelText(/^Motivo de la pérdida/)).toBeNull();
    expect(screen.queryByText('¿Está seguro de que desea marcar esta venta como perdida?')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Aceptar' }) as HTMLButtonElement).disabled).toBe(false);

    await user.click(radio('En negociación'));
    expect(screen.queryByText(QUESTION)).toBeNull();
  });

  it('persona interesada: al aceptar pasa a ganada y aparece "Venta ganada. [Nombre] ahora es cliente."', async () => {
    vi.mocked(changeSaleStage).mockResolvedValue({ contactBecameClient: true, contactName: 'Bruno Ficticio Solís' });
    const { user } = await openDialog();
    vi.mocked(loadSaleDetail).mockResolvedValue(detailOf('ganada'));
    await user.click(radio('Venta ganada'));
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));

    await waitFor(() => expect(changeSaleStage).toHaveBeenCalledWith('sale-001', 'contactado', 'ganada', undefined));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await screen.findByRole('status')).textContent).toBe('Venta ganada. Bruno Ficticio Solís ahora es cliente.');
    const stageRow = screen.getByText('Etapa', { selector: 'dt' }).parentElement as HTMLElement;
    expect(within(stageRow).getByText('Venta ganada')).toBeTruthy();
  });

  it('si el contacto ya era cliente: "Venta ganada correctamente."', async () => {
    vi.mocked(changeSaleStage).mockResolvedValue({ contactBecameClient: false, contactName: null });
    const { user } = await openDialog();
    vi.mocked(loadSaleDetail).mockResolvedValue(detailOf('ganada'));
    await user.click(radio('Venta ganada'));
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));
    expect((await screen.findByRole('status')).textContent).toBe('Venta ganada correctamente.');
  });

  it('una venta ganada ya no puede cambiar de etapa: el botón "Cambiar etapa" desaparece', async () => {
    const { user } = await openDialog();
    vi.mocked(loadSaleDetail).mockResolvedValue(detailOf('ganada'));
    await user.click(radio('Venta ganada'));
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await screen.findByRole('status');
    expect(screen.queryByRole('button', { name: 'Cambiar etapa' })).toBeNull();
    // Editar sigue (solo notas, HU-309).
    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy();
  });

  it('"Cancelar" no cambia nada', async () => {
    const { user } = await openDialog();
    await user.click(radio('Venta ganada'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(changeSaleStage).not.toHaveBeenCalled();
    expect(loadSaleDetail).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).toBeNull();
    const stageRow = screen.getByText('Etapa', { selector: 'dt' }).parentElement as HTMLElement;
    expect(within(stageRow).getByText('Contactado')).toBeTruthy();
    // Al abrirla otra vez parte de la etapa actual, sin la pregunta.
    await user.click(screen.getByRole('button', { name: 'Cambiar etapa' }));
    await screen.findByRole('dialog');
    expect(screen.queryByText(QUESTION)).toBeNull();
  });

  it('si falla el guardado lo avisa y no muestra la confirmación', async () => {
    vi.mocked(changeSaleStage).mockRejectedValue(new Error('sin red'));
    const { user } = await openDialog();
    await user.click(radio('Venta ganada'));
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo cambiar la etapa. Intente de nuevo.');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
