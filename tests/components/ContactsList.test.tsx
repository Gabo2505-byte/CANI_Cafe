// @vitest-environment jsdom
// HU-204: Ver la lista de contactos
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { SessionProvider } from '../../src/auth/SessionContext';
import { countContacts, getContact, listContactsPage } from '../../src/contacts/contactsApi';
import type { ContactsCursor } from '../../src/contacts/contactsRepository';
import type { AuthState } from '../../src/auth/useAuthUser';
import type { Contact } from '../../src/shared/types';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
// HU-207: pestañas de la ficha del contacto.
vi.mock('../../src/contacts/contactDetailApi', () => ({
  loadContactRecords: vi.fn().mockResolvedValue({ communications: [], sales: [], products: [] }),
}));
vi.mock('../../src/contacts/contactsApi', () => ({
  createContact: vi.fn(),
  getContact: vi.fn(),
  findDuplicateContacts: vi.fn(),
  countContacts: vi.fn(),
  listContactsPage: vi.fn(),
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

function renderContacts() {
  render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={['/contactos']}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

const makeContact = (i: number, overrides: Partial<Contact> = {}): Contact => ({
  id: `c${String(i).padStart(2, '0')}`,
  fullName: `Contacto ${String(i).padStart(2, '0')}`,
  nameSortKey: `contacto ${String(i).padStart(2, '0')}`,
  email: `c${i}@example.com`,
  phoneCountry: 'CR',
  phoneNumber: '88880000',
  address: null,
  classification: 'persona_interesada',
  status: 'activo',
  origin: null,
  createdAt: Timestamp.fromDate(new Date('2026-10-12T15:00:00Z')),
  ...overrides,
});

/** Simula Firestore: 45 contactos ya ordenados, páginas de 20 con cursor = índice de inicio. */
function serveContacts(all: Contact[]) {
  vi.mocked(countContacts).mockResolvedValue(all.length);
  vi.mocked(listContactsPage).mockImplementation(async (after) => {
    const start = (after as unknown as number | null) ?? 0;
    const contacts = all.slice(start, start + 20);
    const next = start + 20 < all.length ? start + 20 : null;
    return { contacts, nextCursor: next as unknown as ContactsCursor | null };
  });
}

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');

beforeEach(() => {
  vi.mocked(getContact).mockReset().mockResolvedValue(null);
  vi.mocked(countContacts).mockReset();
  vi.mocked(listContactsPage).mockReset();
});
afterEach(cleanup);

describe('HU-204 Ver la lista de contactos', () => {
  it('muestra una tabla con: nombre completo, correo, teléfono, clasificación y fecha de registro', async () => {
    serveContacts([makeContact(1)]);
    renderContacts();
    await screen.findByRole('table');

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Nombre completo', 'Correo electrónico', 'Teléfono', 'Clasificación', 'Fecha de registro']);
    const cells = within(bodyRows()[0]).getAllByRole('cell').map((c) => c.textContent);
    expect(cells).toEqual(['Contacto 01', 'c1@example.com', '+506 8888-0000', 'Persona interesada', '12 oct 2026']);
  });

  it('los datos vacíos se muestran con "—"', async () => {
    serveContacts([makeContact(1, { email: null })]);
    renderContacts();
    await screen.findByRole('table');
    expect(within(bodyRows()[0]).getAllByRole('cell')[1].textContent).toBe('—');
  });

  it('muestra los contactos en el orden en que llegan de la consulta (alfabético por nombre)', async () => {
    serveContacts([
      makeContact(1, { fullName: 'Álvaro Prueba' }),
      makeContact(2, { fullName: 'ana Prueba' }),
      makeContact(3, { fullName: 'Bruno Prueba' }),
    ]);
    renderContacts();
    await screen.findByRole('table');
    expect(bodyRows().map((r) => r.firstElementChild?.textContent)).toEqual(['Álvaro Prueba', 'ana Prueba', 'Bruno Prueba']);
    expect(listContactsPage).toHaveBeenCalledWith(null);
  });

  it('20 contactos por página, con "Anterior", "Siguiente" y "Página X de Y"', async () => {
    const user = userEvent.setup();
    serveContacts(Array.from({ length: 45 }, (_, i) => makeContact(i + 1)));
    renderContacts();
    await screen.findByRole('table');

    expect(bodyRows()).toHaveLength(20);
    expect(screen.getByText('Página 1 de 3')).toBeTruthy();
    const prev = screen.getByRole('button', { name: 'Anterior' }) as HTMLButtonElement;
    const next = screen.getByRole('button', { name: 'Siguiente' }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    // Los botones y el texto están debajo de la tabla
    expect(screen.getByRole('table').compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(next);
    expect(await screen.findByText('Página 2 de 3')).toBeTruthy();
    expect(bodyRows()[0].firstElementChild?.textContent).toBe('Contacto 21');

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Página 3 de 3')).toBeTruthy();
    expect(bodyRows()).toHaveLength(5);
    expect((screen.getByRole('button', { name: 'Siguiente' }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(await screen.findByText('Página 2 de 3')).toBeTruthy();
    expect(bodyRows()[0].firstElementChild?.textContent).toBe('Contacto 21');
  });

  it('sin contactos: "Aún no hay contactos registrados." (sin tabla)', async () => {
    serveContacts([]);
    renderContacts();
    expect(await screen.findByText('Aún no hay contactos registrados.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('clic en cualquier parte de la fila abre la ficha del contacto', async () => {
    const user = userEvent.setup();
    serveContacts([makeContact(1), makeContact(2)]);
    renderContacts();
    await screen.findByRole('table');

    await user.click(within(bodyRows()[1]).getAllByRole('cell')[3]); // celda de clasificación
    expect(currentLocation.pathname).toBe('/contactos/c02');
  });

  it('el nombre es un enlace a la ficha (accesible con teclado)', async () => {
    serveContacts([makeContact(7)]);
    renderContacts();
    await screen.findByRole('table');
    expect(screen.getByRole('link', { name: 'Contacto 07' }).getAttribute('href')).toBe('/contactos/c07');
  });

  it('si falla la consulta, muestra un error', async () => {
    vi.mocked(countContacts).mockResolvedValue(3);
    vi.mocked(listContactsPage).mockRejectedValue(new Error('unavailable'));
    renderContacts();
    expect(await screen.findByText('No se pudieron cargar los contactos. Intente de nuevo.')).toBeTruthy();
  });
});
