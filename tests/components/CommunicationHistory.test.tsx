// @vitest-environment jsdom
// HU-213: Consultar el historial de comunicaciones
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
import { listCommunicationsPage } from '../../src/communications/communicationsApi';
import type { CommunicationsCursor } from '../../src/communications/communicationsRepository';
import type { ContactRecords } from '../../src/contacts/contactDetail';
import { loadContactRecords } from '../../src/contacts/contactDetailApi';
import { getContact } from '../../src/contacts/contactsApi';
import type { Communication, Contact, Sale } from '../../src/shared/types';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/communications/communicationsApi', () => ({ createCommunication: vi.fn(), listCommunicationsPage: vi.fn() }));
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
  id: 'contact-001',
  fullName: 'Ana Prueba Mora',
  nameSortKey: 'ana prueba mora',
  email: 'ana.prueba@example.com',
  phoneCountry: 'CR',
  phoneNumber: '00000001',
  address: null,
  classification: 'persona_interesada',
  status: 'activo',
  origin: null,
  createdAt: cr('2026-09-01T09:00:00'),
};

const sales: Sale[] = [
  {
    id: 'sale-010',
    contactId: 'contact-001',
    title: 'Café para eventos',
    stage: 'contactado',
    estimatedAmount: 50_000,
    nextFollowUpAt: null,
    notes: '',
    createdAt: cr('2026-09-10T09:00:00'),
    stageChangedAt: cr('2026-09-10T09:00:00'),
    lastCommunicationAt: null,
  },
];

/** Comunicación n.º i (1 = la más reciente): un día distinto por cada una. */
const comm = (i: number, overrides: Partial<Communication> = {}): Communication => {
  const date = new Date(Date.UTC(2026, 9, 31 - i, 6)); // 00:00 en Costa Rica
  return {
    id: `comm-${String(i).padStart(2, '0')}`,
    contactId: 'contact-001',
    saleId: null,
    appliesToAllSales: true,
    date: Timestamp.fromDate(date),
    medium: 'llamada',
    otherMedium: null,
    note: `Nota ${i}`,
    source: 'usuario',
    userId: 'admin-uid',
    createdAt: Timestamp.fromDate(date),
    ...overrides,
  };
};

/** Simula Firestore: comunicaciones ya ordenadas, páginas de 10 con cursor = índice de inicio. */
function serveHistory(all: Communication[]) {
  const page = (start: number) => ({
    communications: all.slice(start, start + 10),
    nextCursor: (start + 10 < all.length ? start + 10 : null) as unknown as CommunicationsCursor | null,
    userNames: { 'admin-uid': 'admin' },
  });
  const first = page(0);
  vi.mocked(loadContactRecords).mockResolvedValue({
    communications: first.communications,
    communicationsTotal: all.length,
    communicationsCursor: first.nextCursor,
    userNames: first.userNames,
    sales,
    products: [],
  } satisfies ContactRecords);
  vi.mocked(listCommunicationsPage).mockImplementation(async (_contactId, after) => page(after as unknown as number));
}

function renderContact() {
  render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={['/contactos/contact-001']}>
          <AppRoutes />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

const cards = () => within(screen.getByRole('tabpanel')).queryAllByRole('listitem');
const notes = () => cards().map((card) => card.querySelector('.record-note')?.textContent);

beforeEach(() => {
  vi.mocked(getContact).mockReset().mockResolvedValue(contact);
  vi.mocked(loadContactRecords).mockReset();
  vi.mocked(listCommunicationsPage).mockReset();
});
afterEach(cleanup);

describe('HU-213 Consultar el historial de comunicaciones', () => {
  it('criterio 1: cada comunicación en un recuadro, de la más reciente a la más antigua', async () => {
    serveHistory([comm(1), comm(2), comm(3)]);
    renderContact();
    await screen.findByText('Nota 1');
    expect(cards().every((card) => card.className.includes('communication-card'))).toBe(true);
    expect(notes()).toEqual(['Nota 1', 'Nota 2', 'Nota 3']);
  });

  it('criterio 2: fecha, medio, oportunidad de venta, nota completa y quién la registró', async () => {
    const longNote = `Pidió precios. ${'a'.repeat(985)}`; // 1000 caracteres, sin recortar
    serveHistory([comm(1, { saleId: 'sale-010', appliesToAllSales: false, medium: 'whatsapp', note: longNote }), comm(2)]);
    renderContact();
    await screen.findByText(longNote);
    const [first, second] = cards();
    expect(first.querySelector('.record-meta')?.textContent).toBe('30/10/2026 · WhatsApp');
    expect(within(first).getByText('Oportunidad de venta: Café para eventos')).toBeTruthy();
    expect(first.querySelector('.record-note')?.textContent).toHaveLength(1000);
    expect(within(first).getByText('Registrado por: admin')).toBeTruthy();
    expect(within(second).getByText('Oportunidad de venta: Todas sus oportunidades de venta')).toBeTruthy();
  });

  it('criterio 3: "Otro: Instagram" y "Registrado por: Sistema (formulario web)"', async () => {
    serveHistory([
      comm(1, { medium: 'otro', otherMedium: 'Instagram' }),
      comm(2, { source: 'formulario_web', userId: null, medium: 'otro', otherMedium: 'Formulario del sitio web' }),
    ]);
    renderContact();
    await screen.findByText('Nota 1');
    const [instagram, web] = cards();
    expect(instagram.querySelector('.record-meta')?.textContent).toContain('Otro: Instagram');
    expect(within(web).getByText('Registrado por: Sistema (formulario web)')).toBeTruthy();
  });

  it('criterio 4: se ven las 10 más recientes y "Ver más" agrega 10 debajo; con todas a la vista, el botón desaparece', async () => {
    const user = userEvent.setup();
    serveHistory(Array.from({ length: 25 }, (_, i) => comm(i + 1)));
    renderContact();
    await screen.findByText('Nota 1');
    expect(screen.getByRole('tab', { name: 'Comunicaciones (25)' })).toBeTruthy();
    expect(cards()).toHaveLength(10);
    const button = screen.getByRole('button', { name: 'Ver más' });
    expect(cards()[9].compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // al final

    await user.click(button);
    await screen.findByText('Nota 20');
    expect(cards()).toHaveLength(20);
    expect(notes().slice(0, 12)).toEqual(Array.from({ length: 12 }, (_, i) => `Nota ${i + 1}`)); // debajo de las que ya estaban

    await user.click(screen.getByRole('button', { name: 'Ver más' }));
    await screen.findByText('Nota 25');
    expect(cards()).toHaveLength(25);
    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
  });

  it('criterio 4: con 10 o menos no hay botón "Ver más"', async () => {
    serveHistory(Array.from({ length: 10 }, (_, i) => comm(i + 1)));
    renderContact();
    await screen.findByText('Nota 10');
    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
  });

  it('criterio 4: al volver a abrir la pestaña se ven otra vez las 10 más recientes', async () => {
    const user = userEvent.setup();
    serveHistory(Array.from({ length: 15 }, (_, i) => comm(i + 1)));
    renderContact();
    await screen.findByText('Nota 1');
    await user.click(screen.getByRole('button', { name: 'Ver más' }));
    await screen.findByText('Nota 15');
    await user.click(screen.getByRole('tab', { name: /^Oportunidades de venta/ }));
    await user.click(screen.getByRole('tab', { name: 'Comunicaciones (15)' }));
    expect(cards()).toHaveLength(10);
    expect(screen.getByRole('button', { name: 'Ver más' })).toBeTruthy();
  });

  it('si falla "Ver más", avisa y se puede intentar de nuevo', async () => {
    const user = userEvent.setup();
    serveHistory(Array.from({ length: 12 }, (_, i) => comm(i + 1)));
    renderContact();
    await screen.findByText('Nota 1');
    vi.mocked(listCommunicationsPage).mockRejectedValueOnce(new Error('unavailable'));
    await user.click(screen.getByRole('button', { name: 'Ver más' }));
    expect(await screen.findByText('No se pudieron cargar más comunicaciones. Intente de nuevo.')).toBeTruthy();
    expect(cards()).toHaveLength(10);
    await user.click(screen.getByRole('button', { name: 'Ver más' }));
    await screen.findByText('Nota 12');
    expect(cards()).toHaveLength(12);
  });

  it('criterio 5: sin comunicaciones → "Este contacto no tiene comunicaciones registradas."', async () => {
    serveHistory([]);
    renderContact();
    expect(await screen.findByText('Este contacto no tiene comunicaciones registradas.')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Comunicaciones (0)' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
  });
});
