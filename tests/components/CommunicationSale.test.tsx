// @vitest-environment jsdom
// HU-212: Relacionar una comunicación con una posible venta
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { SessionProvider } from '../../src/auth/SessionContext';
import type { AuthState } from '../../src/auth/useAuthUser';
import { createCommunication } from '../../src/communications/communicationsApi';
import { SaleNotOpenError } from '../../src/communications/communicationsRepository';
import { sortSales, type ContactRecords } from '../../src/contacts/contactDetail';
import { loadContactRecords } from '../../src/contacts/contactDetailApi';
import { getContact } from '../../src/contacts/contactsApi';
import type { Communication, Contact, Sale } from '../../src/shared/types';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/communications/communicationsApi', () => ({ createCommunication: vi.fn() }));
vi.mock('../../src/contacts/contactDetailApi', () => ({ loadContactRecords: vi.fn() }));
vi.mock('../../src/contacts/contactsApi', () => ({
  createContact: vi.fn(),
  getContact: vi.fn(),
  findDuplicateContacts: vi.fn(),
  countContacts: vi.fn().mockResolvedValue(0),
  listContactsPage: vi.fn().mockResolvedValue({ contacts: [], nextCursor: null }),
}));

const active: AuthState = {
  status: 'active',
  firebaseUser: { uid: 'admin-uid' } as FirebaseUser,
  profile: { id: 'admin-uid', username: 'admin', email: 'admin@example.com', active: true },
};

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

const sale = (id: string, title: string, stage: Sale['stage'], created: string): Sale => ({
  id,
  contactId: 'contact-002',
  title,
  stage,
  estimatedAmount: 100_000,
  nextFollowUpAt: null,
  notes: '',
  createdAt: cr(`${created}T09:00:00`),
  stageChangedAt: cr(`${created}T09:00:00`),
  lastCommunicationAt: null,
});

const sales = sortSales([
  sale('sale-001', 'Café en grano para cafetería', 'en_negociacion', '2026-09-15'),
  sale('sale-003', 'Pedido de temporada navideña', 'ganada', '2026-09-25'),
  sale('sale-007', 'Muestras para oficina', 'perdida', '2026-10-01'),
  sale('sale-008', 'Café molido para hotel', 'contactado', '2026-10-05'),
]);

const comm = (id: string, overrides: Partial<Communication>): Communication => ({
  id,
  contactId: 'contact-002',
  saleId: null,
  appliesToAllSales: false,
  date: cr('2026-10-02T00:00:00'),
  medium: 'correo',
  otherMedium: null,
  note: `Nota ${id}`,
  source: 'usuario',
  userId: 'admin-uid',
  createdAt: cr('2026-10-02T11:00:00'),
  ...overrides,
});

const records = (communications: Communication[] = []): ContactRecords => ({ communications, sales, products: [] });

function renderContact() {
  render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={['/contactos/contact-002']}>
          <AppRoutes />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

const dialog = () => screen.getByRole('dialog', { name: 'Registrar comunicación' });
const field = (label: string) => within(dialog()).getByLabelText(label) as HTMLSelectElement;

async function openDialog() {
  renderContact();
  const user = userEvent.setup();
  await screen.findByRole('tab', { name: 'Posibles ventas (4)' }); // registros cargados
  await user.click(screen.getByRole('button', { name: 'Registrar comunicación' }));
  return user;
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(field('Medio'), 'Llamada telefónica');
  await user.type(field('Nota'), 'Conversamos sobre el pedido.');
}

beforeEach(() => {
  vi.mocked(getContact).mockReset().mockResolvedValue(contact);
  vi.mocked(loadContactRecords).mockReset().mockResolvedValue(records());
  vi.mocked(createCommunication).mockReset().mockResolvedValue('comm-nueva');
});
afterEach(cleanup);

describe('HU-212 Relacionar una comunicación con una posible venta', () => {
  it('criterio 1: la ventana pide a qué posible venta corresponde (campo obligatorio)', async () => {
    await openDialog();
    const select = field('Posible venta');
    expect(select.tagName).toBe('SELECT');
    expect(select.required).toBe(true);
  });

  it('criterio 2: opciones = "Todas sus posibles ventas" + títulos de las abiertas (sin ganadas ni perdidas)', async () => {
    await openDialog();
    expect(within(field('Posible venta')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Todas sus posibles ventas',
      'Café molido para hotel',
      'Café en grano para cafetería',
    ]);
  });

  it('criterio 2: "Todas sus posibles ventas" viene elegida', async () => {
    await openDialog();
    const select = field('Posible venta');
    expect(select.selectedOptions[0].textContent).toBe('Todas sus posibles ventas');
    expect(within(dialog()).getByText(/si la conversación no fue sobre una en particular/)).toBeTruthy();
  });

  it('criterio 2: un contacto sin ventas abiertas solo tiene "Todas sus posibles ventas"', async () => {
    vi.mocked(loadContactRecords).mockResolvedValue({ communications: [], sales: sales.filter((s) => s.stage === 'ganada' || s.stage === 'perdida'), products: [] });
    renderContact();
    const user = userEvent.setup();
    await screen.findByRole('tab', { name: /^Posibles ventas \(\d\)$/ });
    await user.click(screen.getByRole('button', { name: 'Registrar comunicación' }));
    expect(within(field('Posible venta')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Todas sus posibles ventas']);
  });

  it('criterio 3: al elegir una posible venta se guarda con esa venta (el repositorio actualiza su última comunicación)', async () => {
    const user = await openDialog();
    await fillRequired(user);
    await user.selectOptions(field('Posible venta'), 'Café en grano para cafetería');
    await user.click(within(dialog()).getByRole('button', { name: 'Guardar' }));
    expect(createCommunication).toHaveBeenCalledWith(expect.objectContaining({ contactId: 'contact-002', saleId: 'sale-001' }), 'admin-uid');
    expect(await screen.findByText('Comunicación registrada correctamente.')).toBeTruthy();
  });

  it('criterio 4: con "Todas sus posibles ventas" se guarda sin venta en particular (saleId null)', async () => {
    const user = await openDialog();
    await fillRequired(user);
    await user.click(within(dialog()).getByRole('button', { name: 'Guardar' }));
    expect(createCommunication).toHaveBeenCalledWith(expect.objectContaining({ saleId: null }), 'admin-uid');
  });

  it('si la venta elegida se cerró mientras tanto, avisa en el campo y la ventana sigue abierta', async () => {
    vi.mocked(createCommunication).mockRejectedValue(new SaleNotOpenError());
    const user = await openDialog();
    await fillRequired(user);
    await user.selectOptions(field('Posible venta'), 'Café molido para hotel');
    await user.click(within(dialog()).getByRole('button', { name: 'Guardar' }));
    expect(
      await within(dialog()).findByText('La posible venta elegida ya no está abierta. Elija otra o "Todas sus posibles ventas".'),
    ).toBeTruthy();
  });

  it('el historial indica a qué posible venta corresponde cada comunicación', async () => {
    vi.mocked(loadContactRecords).mockResolvedValue(
      records([
        comm('c1', { saleId: 'sale-001', date: cr('2026-10-03T00:00:00') }),
        comm('c2', { appliesToAllSales: true }),
      ]),
    );
    renderContact();
    const panel = await screen.findByRole('tabpanel');
    await within(panel).findByText('Nota c1');
    // HU-213: la posible venta va en su propia línea del recuadro.
    expect(within(panel).getAllByRole('listitem').map((li) => li.querySelector('.communication-sale')?.textContent)).toEqual([
      'Posible venta: Café en grano para cafetería',
      'Posible venta: Todas sus posibles ventas',
    ]);
  });
});
