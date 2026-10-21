// @vitest-environment jsdom
// HU-309: Editar una posible venta
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
import { listProducts } from '../../src/products/productsApi';
import type { SaleDetailData } from '../../src/sales/saleDetail';
import { loadSaleDetail } from '../../src/sales/saleDetailApi';
import { listOpenSaleTitles, updateSale } from '../../src/sales/salesApi';
import type { Product, Sale } from '../../src/shared/types';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/sales/saleDetailApi', () => ({ loadSaleDetail: vi.fn() }));
vi.mock('../../src/sales/salesApi', () => ({
  listBoardSales: vi.fn().mockResolvedValue([]),
  createSale: vi.fn(),
  listOpenSaleTitles: vi.fn(),
  updateSale: vi.fn(),
}));
vi.mock('../../src/products/productsApi', () => ({ listProducts: vi.fn(), listActiveProducts: vi.fn() }));
vi.mock('../../src/sales/contactSearchApi', () => ({
  getContactNames: vi.fn().mockResolvedValue(new Map()),
  listActiveContacts: vi.fn().mockResolvedValue([]),
  getContactForSale: vi.fn(),
}));
// HU-207: pestañas de la ficha del contacto.
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

const sale = (overrides: Partial<Sale> = {}): Sale => ({
  id: 'sale-001',
  contactId: 'contact-002',
  title: 'Café en grano para cafetería',
  stage: 'en_negociacion',
  estimatedAmount: 450_000,
  nextFollowUpAt: at('2099-01-10T16:30:00Z'),
  notes: 'Quiere probar muestras.',
  createdAt: at('2026-09-15T15:00:00Z'),
  stageChangedAt: at('2026-10-01T16:00:00Z'),
  lastCommunicationAt: null,
  ...overrides,
});
const detailOf = (s: Sale): SaleDetailData => ({
  sale: s,
  contactName: 'Bruno Ficticio Solís',
  products: [
    { productId: 'p1', name: 'Café en grano', presentation: 'Bolsa de 340 g', quantity: 20 },
    { productId: 'p3', name: 'Café de temporada', presentation: 'Bolsa de 250 g', quantity: 4 },
  ],
  history: [{ saleId: s.id, previousStage: null, newStage: 'nuevo_interesado', changedAt: s.createdAt, lossReason: null }],
});
const CATALOG: Product[] = [
  { id: 'p1', name: 'Café en grano', presentation: 'Bolsa de 340 g', description: '', active: true },
  { id: 'p2', name: 'Café molido', presentation: 'Bolsa de 1 kg', description: '', active: true },
  { id: 'p3', name: 'Café de temporada', presentation: 'Bolsa de 250 g', description: '', active: false },
  { id: 'p4', name: 'Café descontinuado', presentation: 'Bolsa de 500 g', description: '', active: false },
];

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
  vi.mocked(loadSaleDetail).mockResolvedValue(detailOf(sale()));
  vi.mocked(listProducts).mockResolvedValue(CATALOG);
  vi.mocked(listOpenSaleTitles).mockResolvedValue([]);
  vi.mocked(updateSale).mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const title = () => screen.getByLabelText(/^Título/) as HTMLInputElement;
const amount = () => screen.getByLabelText(/^Monto estimado/) as HTMLInputElement;
const followUp = () => screen.getByLabelText(/^Fecha del próximo seguimiento/) as HTMLInputElement;
const notes = () => screen.getByLabelText(/^Notas/) as HTMLTextAreaElement;
const alerts = () => screen.queryAllByRole('alert').map((a) => a.textContent);

async function openEditor() {
  const user = userEvent.setup();
  renderDetail();
  await user.click(await screen.findByRole('button', { name: 'Editar' }));
  await screen.findByRole('button', { name: 'Guardar' });
  return user;
}

describe('HU-309 Editar una oportunidad de venta', () => {
  it('en el detalle hay un botón "Editar" arriba, junto al título', async () => {
    renderDetail();
    const button = await screen.findByRole('button', { name: 'Editar' });
    expect(button.closest('.page-header')?.querySelector('h1')?.textContent).toBe('Café en grano para cafetería');
  });

  it('el formulario parte de los datos guardados y permite cambiar título, monto, productos, seguimiento y notas', async () => {
    await openEditor();
    expect(title().value).toBe('Café en grano para cafetería');
    expect(amount().value).toBe('450000');
    expect(followUp().value).toBe('2099-01-10');
    expect(notes().value).toBe('Quiere probar muestras.');
    // La variedad y la presentación vienen del producto guardado (sin esperar al catálogo).
    expect((screen.getByLabelText('Variedad del producto 1') as HTMLSelectElement).value).toBe('Café en grano');
    expect((screen.getByLabelText('Presentación del producto 1') as HTMLSelectElement).value).toBe('p1');
    expect((screen.getByLabelText('Cantidad del producto 1') as HTMLInputElement).value).toBe('20');
    // La etapa no se edita aquí.
    expect(screen.queryByLabelText(/^Etapa/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
  });

  it('un producto inactivo que la venta ya tenía sigue en la lista; los demás inactivos, no', async () => {
    await openEditor();
    await waitFor(() => expect(listProducts).toHaveBeenCalled());
    const texts = (label: string) => Array.from((screen.getByLabelText(label) as HTMLSelectElement).options).map((o) => o.text);
    const varieties = texts('Variedad del producto 2');
    expect(varieties).toContain('Café de temporada');
    expect(varieties).toContain('Café molido');
    expect(varieties).not.toContain('Café descontinuado');
    // La fila del producto inactivo conserva su variedad y su presentación.
    expect((screen.getByLabelText('Variedad del producto 2') as HTMLSelectElement).value).toBe('Café de temporada');
    expect(texts('Presentación del producto 2')).toContain('Bolsa de 250 g');
  });

  it('al guardar muestra "Cambios guardados correctamente." y vuelve al detalle ya actualizado', async () => {
    const user = await openEditor();
    vi.mocked(loadSaleDetail).mockResolvedValue(detailOf(sale({ title: 'Título nuevo', estimatedAmount: 500_000 })));

    await user.clear(title());
    await user.type(title(), 'Título nuevo');
    await user.clear(amount());
    await user.type(amount(), '500000');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(updateSale).toHaveBeenCalledOnce());
    expect(updateSale).toHaveBeenCalledWith('sale-001', {
      title: 'Título nuevo',
      estimatedAmount: 500_000,
      nextFollowUpAt: new Date('2099-01-10T16:30:00Z'),
      notes: 'Quiere probar muestras.',
      products: [
        { productId: 'p1', quantity: 20 },
        { productId: 'p3', quantity: 4 },
      ],
    });
    expect((await screen.findByRole('status')).textContent).toBe('Cambios guardados correctamente.');
    expect(await screen.findByRole('heading', { level: 1, name: 'Título nuevo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
  });

  it('se pueden agregar, cambiar y quitar productos', async () => {
    const user = await openEditor();
    await user.click(screen.getByRole('button', { name: 'Quitar producto 2' }));
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.selectOptions(screen.getByLabelText('Variedad del producto 2'), 'Café molido');
    await user.selectOptions(screen.getByLabelText('Presentación del producto 2'), 'p2');
    await user.type(screen.getByLabelText('Cantidad del producto 2'), '7');
    await user.clear(screen.getByLabelText('Cantidad del producto 1'));
    await user.type(screen.getByLabelText('Cantidad del producto 1'), '25');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(updateSale).toHaveBeenCalledOnce());
    expect(vi.mocked(updateSale).mock.calls[0][1].products).toEqual([
      { productId: 'p1', quantity: 25 },
      { productId: 'p2', quantity: 7 },
    ]);
  });

  it('un seguimiento nuevo se guarda a las 00:00 de Costa Rica; quitarlo lo deja vacío', async () => {
    const user = await openEditor();
    await user.clear(followUp());
    await user.type(followUp(), '2099-02-01');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updateSale).toHaveBeenCalledOnce());
    expect(vi.mocked(updateSale).mock.calls[0][1].nextFollowUpAt).toEqual(new Date('2099-02-01T06:00:00Z'));
  });

  it('título vacío, monto inválido y seguimiento anterior a hoy: mensaje bajo cada dato y no guarda', async () => {
    const user = await openEditor();
    await user.clear(title());
    await user.clear(amount());
    await user.type(amount(), '1000000000');
    await user.clear(followUp());
    await user.type(followUp(), '2020-01-01');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(alerts()).toHaveLength(3));
    expect(alerts()).toEqual([
      'Ingrese el título.',
      'Ingrese un monto válido.',
      'La fecha de seguimiento no puede ser anterior a hoy.',
    ]);
    expect(title().getAttribute('aria-invalid')).toBe('true');
    expect(updateSale).not.toHaveBeenCalled();
  });

  it('un título igual al de otra oportunidad de venta abierta del contacto no se guarda', async () => {
    vi.mocked(listOpenSaleTitles).mockResolvedValue(['Pedido de temporada']);
    const user = await openEditor();
    await user.clear(title());
    await user.type(title(), 'pedido DE temporada');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(alerts()).toEqual(['Este contacto ya tiene una oportunidad de venta abierta con este título.']),
    );
    // Se comparan solo las otras ventas: se excluye la que se edita.
    expect(listOpenSaleTitles).toHaveBeenCalledWith('contact-002', 'sale-001');
    expect(updateSale).not.toHaveBeenCalled();
  });

  it('cantidad inválida, producto sin elegir y producto repetido: mensajes bajo la fila y no guarda', async () => {
    const user = await openEditor();
    await user.clear(screen.getByLabelText('Cantidad del producto 1'));
    await user.type(screen.getByLabelText('Cantidad del producto 1'), '0');
    await user.selectOptions(screen.getByLabelText('Variedad del producto 2'), 'Café en grano');
    await user.selectOptions(screen.getByLabelText('Presentación del producto 2'), 'p1');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(alerts().length).toBeGreaterThan(0));
    expect(alerts()).toEqual([
      'Ingrese una cantidad entre 1 y 9999.',
      'Este producto ya fue agregado.',
      'Seleccione un producto o elimine la fila.',
      'Ingrese una cantidad entre 1 y 9999.',
    ]);
    expect(updateSale).not.toHaveBeenCalled();
  });

  it('el mensaje de un dato desaparece al corregirlo', async () => {
    const user = await openEditor();
    await user.clear(title());
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(alerts()).toEqual(['Ingrese el título.']));
    await user.type(title(), 'Algo');
    expect(alerts()).toEqual([]);
  });

  it('un seguimiento vencido que no se toca no impide guardar un cambio en las notas', async () => {
    vi.mocked(loadSaleDetail).mockResolvedValue(detailOf(sale({ nextFollowUpAt: at('2020-03-05T16:30:00Z') })));
    const user = await openEditor();
    await user.type(notes(), ' Llamar el lunes.');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updateSale).toHaveBeenCalledOnce());
    expect(vi.mocked(updateSale).mock.calls[0][1].nextFollowUpAt).toEqual(new Date('2020-03-05T16:30:00Z'));
    expect(alerts()).toEqual([]);
  });

  it('"Cancelar" descarta los cambios y vuelve al detalle sin guardar', async () => {
    const user = await openEditor();
    await user.clear(title());
    await user.type(title(), 'Cambio que no se guarda');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(updateSale).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { level: 1, name: 'Café en grano para cafetería' })).toBeTruthy();
    // Al volver a abrir, el formulario parte de lo guardado.
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(title().value).toBe('Café en grano para cafetería');
  });

  it('si falla el guardado lo avisa y se queda en el formulario con los datos', async () => {
    vi.mocked(updateSale).mockRejectedValue(new Error('sin red'));
    const user = await openEditor();
    await user.type(notes(), ' Más notas');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(alerts()).toEqual(['No se pudieron guardar los cambios. Intente de nuevo.']));
    expect(notes().value).toBe('Quiere probar muestras. Más notas');
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('HU-309 venta ganada: solo se pueden cambiar las notas', () => {
  beforeEach(() => {
    vi.mocked(loadSaleDetail).mockResolvedValue(detailOf(sale({ stage: 'ganada' })));
  });

  it('el formulario solo tiene las notas', async () => {
    await openEditor();
    expect(notes().value).toBe('Quiere probar muestras.');
    expect(screen.queryByLabelText(/^Título/)).toBeNull();
    expect(screen.queryByLabelText(/^Monto estimado/)).toBeNull();
    expect(screen.queryByLabelText(/^Fecha del próximo seguimiento/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Agregar producto' })).toBeNull();
    expect(listProducts).not.toHaveBeenCalled();
  });

  it('guarda las notas con "Cambios guardados correctamente."', async () => {
    const user = await openEditor();
    await user.clear(notes());
    await user.type(notes(), 'Cliente satisfecho.');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updateSale).toHaveBeenCalledOnce());
    expect(vi.mocked(updateSale).mock.calls[0][1].notes).toBe('Cliente satisfecho.');
    expect((await screen.findByRole('status')).textContent).toBe('Cambios guardados correctamente.');
  });

  it('las notas siguen limitadas a 1000 caracteres', async () => {
    const user = await openEditor();
    await user.clear(notes());
    await user.click(notes());
    await user.paste('n'.repeat(1100));
    expect(notes().value).toHaveLength(1000);
    expect(within(document.body).getByText('1000/1000')).toBeTruthy();
  });
});
