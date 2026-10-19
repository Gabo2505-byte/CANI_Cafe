// @vitest-environment jsdom
// HU-202: Teléfonos de Costa Rica y de otros países (lista con buscador y agrupada por letras)
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { SessionProvider } from '../../src/auth/SessionContext';
import { createContact, findDuplicateContacts, getContact } from '../../src/contacts/contactsApi';
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
  // HU-204: la lista de Contactos (vacía en estas pruebas)
  countContacts: vi.fn().mockResolvedValue(0),
  listContactsPage: vi.fn().mockResolvedValue({ contacts: [], nextCursor: null }),
}));

const active: AuthState = {
  status: 'active',
  firebaseUser: { uid: 'u1' } as FirebaseUser,
  profile: { id: 'u1', username: 'admin', email: 'admin@example.com', active: true },
};

function renderAt(path: string) {
  return render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

const trigger = () => screen.getByRole('button', { name: /^País del teléfono/ });
const numberInput = () => screen.getByLabelText('Teléfono') as HTMLInputElement;
const search = () => screen.getByRole('combobox', { name: 'Buscar país' });
const contact = (phoneCountry: string, phoneNumber: string): Contact => ({
  id: 'c1',
  fullName: 'Contacto Prueba',
  nameSortKey: 'contacto prueba',
  email: null,
  phoneCountry,
  phoneNumber,
  address: null,
  classification: 'persona_interesada',
  status: 'activo',
  origin: null,
  createdAt: Timestamp.fromDate(new Date('2026-10-12T15:00:00Z')),
});

async function pickCountry(user: ReturnType<typeof userEvent.setup>, searchText: string, optionLabel: string) {
  await user.click(trigger());
  await user.type(search(), searchText);
  await user.click(screen.getByRole('option', { name: optionLabel }));
}

async function fillAndSave(country: { search: string; label: string } | null, number: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Nombre completo', { exact: false }), 'Contacto Prueba');
  if (country) await pickCountry(user, country.search, country.label);
  await user.type(numberInput(), number);
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
}

const US = { search: 'estados', label: 'Estados Unidos (+1)' };

beforeEach(() => {
  vi.mocked(findDuplicateContacts).mockReset().mockResolvedValue({});
  vi.mocked(createContact).mockReset().mockResolvedValue('c1');
  vi.mocked(getContact).mockReset();
});
afterEach(cleanup);

describe('HU-202 Teléfonos de Costa Rica y de otros países', () => {
  it('el teléfono tiene dos partes: primero el país y después el número', () => {
    renderAt('/contactos/nuevo');
    expect(trigger().compareDocumentPosition(numberInput()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Costa Rica viene elegido; cerrado muestra las siglas y el código: "CR (+506)"', () => {
    renderAt('/contactos/nuevo');
    expect(trigger().textContent).toContain('CR (+506)');
    expect(trigger().textContent).not.toContain('Costa Rica');
    expect(trigger().getAttribute('aria-label')).toBe('País del teléfono: Costa Rica (+506)');
  });

  it('la lista muestra el nombre de cada país con su código, agrupada por letras', async () => {
    const user = userEvent.setup();
    renderAt('/contactos/nuevo');
    await user.click(trigger());

    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options.length).toBeGreaterThan(200);
    expect(options).toContain('Estados Unidos (+1)');
    expect(options).toContain('Nicaragua (+505)');
    expect(screen.getByRole('option', { name: 'Costa Rica (+506)' }).getAttribute('aria-selected')).toBe('true');

    const groups = screen.getAllByRole('group').map((g) => g.firstElementChild?.textContent);
    expect(groups[0]).toBe('A');
    expect(groups).toContain('D – E'); // letras con pocos países se juntan
    const groupC = screen.getAllByRole('group').find((g) => g.firstElementChild?.textContent === 'C')!;
    expect(within(groupC).getByRole('option', { name: 'Costa Rica (+506)' })).toBeTruthy();
  });

  it.each([
    ['estados', 'Estados Unidos (+1)'],
    ['mexico', 'México (+52)'], // sin tildes
    ['+506', 'Costa Rica (+506)'], // por código
    ['ni', 'Nicaragua (+505)'], // por siglas o nombre
  ])('el buscador encuentra "%s"', async (text, expected) => {
    const user = userEvent.setup();
    renderAt('/contactos/nuevo');
    await user.click(trigger());
    await user.type(search(), text);
    expect(screen.getByRole('option', { name: expected })).toBeTruthy();
    // Con búsqueda, los resultados van en un solo grupo
    expect(screen.getAllByRole('group').map((g) => g.firstElementChild?.textContent)).toEqual(['Resultados']);
  });

  it('si no hay coincidencias, lo indica', async () => {
    const user = userEvent.setup();
    renderAt('/contactos/nuevo');
    await user.click(trigger());
    await user.type(search(), 'zzzz');
    expect(screen.getByText('No se encontraron países.')).toBeTruthy();
  });

  it('al elegir un país, la lista se cierra y muestra sus siglas y código: "US (+1)"', async () => {
    const user = userEvent.setup();
    renderAt('/contactos/nuevo');
    await pickCountry(user, US.search, US.label);

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger().textContent).toContain('US (+1)');
    expect(trigger().textContent).not.toContain('Estados Unidos');
    expect(trigger().getAttribute('aria-label')).toBe('País del teléfono: Estados Unidos (+1)');
  });

  it('con teclado: buscar, ↓ y Enter elige; Escape cierra sin cambiar', async () => {
    const user = userEvent.setup();
    renderAt('/contactos/nuevo');
    await user.click(trigger());
    await user.type(search(), 'pan');
    await user.keyboard('{Enter}');
    expect(trigger().textContent).toContain('PA'); // Panamá

    await user.click(trigger());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger().textContent).toContain('PA');
    expect(createContact).not.toHaveBeenCalled(); // Enter no envió el formulario
  });

  it('Costa Rica con 8 números se guarda y se muestra "+506 8888-8888"', async () => {
    vi.mocked(getContact).mockResolvedValue(contact('CR', '88888888'));
    renderAt('/contactos/nuevo');
    await fillAndSave(null, '8888 8888');

    expect(createContact).toHaveBeenCalledWith(expect.objectContaining({ phoneCountry: 'CR', phoneNumber: '88888888' }));
    expect(await screen.findByText('+506 8888-8888')).toBeTruthy();
  });

  it.each(['8888888', '888888888'])('Costa Rica con %s → "El teléfono debe tener 8 dígitos."', async (number) => {
    renderAt('/contactos/nuevo');
    await fillAndSave(null, number);
    expect(screen.getByText('El teléfono debe tener 8 dígitos.')).toBeTruthy();
    expect(createContact).not.toHaveBeenCalled();
  });

  it('otro país entre 6 y 14 números se guarda y se muestra con su código: "+1 3055551234"', async () => {
    vi.mocked(getContact).mockResolvedValue(contact('US', '3055551234'));
    renderAt('/contactos/nuevo');
    await fillAndSave(US, '305 555 1234');

    expect(createContact).toHaveBeenCalledWith(expect.objectContaining({ phoneCountry: 'US', phoneNumber: '3055551234' }));
    expect(await screen.findByText('+1 3055551234')).toBeTruthy();
  });

  it.each(['12345', '123456789012345'])(
    'otro país con %s → "El teléfono debe tener entre 6 y 14 dígitos."',
    async (number) => {
      renderAt('/contactos/nuevo');
      await fillAndSave(US, number);
      expect(screen.getByText('El teléfono debe tener entre 6 y 14 dígitos.')).toBeTruthy();
      expect(createContact).not.toHaveBeenCalled();
    },
  );
});
