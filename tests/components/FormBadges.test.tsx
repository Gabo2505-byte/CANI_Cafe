// @vitest-environment jsdom
// HU-504: Identificar los contactos que llegan por el formulario
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { SessionProvider } from '../../src/auth/SessionContext';
import { getContact, listAllContacts } from '../../src/contacts/contactsApi';
import { clearFormBadge, listenFormBadgeCount } from '../../src/contacts/formBadgesApi';
import type { AuthState } from '../../src/auth/useAuthUser';
import type { Contact } from '../../src/shared/types';

// contactsApi y formBadgesApi ya están mockeados en tests/setup.ts.
vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/contacts/contactDetailApi', () => ({
  loadContactRecords: vi.fn().mockResolvedValue({ communications: [], sales: [], products: [] }),
}));

const active: AuthState = {
  status: 'active',
  firebaseUser: { uid: 'u1' } as FirebaseUser,
  profile: { id: 'u1', username: 'admin', email: 'admin@example.com', active: true },
};

function renderAt(path: string) {
  render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

const contact = (id: string, fullName: string, overrides: Partial<Contact> = {}): Contact => ({
  id,
  fullName,
  nameSortKey: fullName.toLowerCase(),
  email: `${id}@example.com`,
  phoneCountry: null,
  phoneNumber: null,
  address: null,
  classification: 'persona_interesada',
  status: 'activo',
  origin: null,
  createdAt: Timestamp.fromDate(new Date('2026-10-12T15:00:00Z')),
  ...overrides,
});

// En orden alfabético, como llegan de Firestore.
const CONTACTS = [
  contact('ana', 'Ana Prueba'),
  contact('bruno', 'Bruno Prueba', { classification: 'cliente' }),
  contact('laura', 'Laura Formulario', { origin: 'formulario_web', formBadge: 'Nuevo' }),
  contact('zoe', 'Zoe Prueba', { formBadge: 'Nuevo mensaje' }),
];

const names = () =>
  within(screen.getAllByRole('rowgroup')[1])
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[0].querySelector('a')?.textContent);
const contactsOption = () => within(screen.getByRole('navigation', { name: 'Principal' })).getAllByRole('link')[0];

let emitCount: (count: number) => void;

beforeEach(() => {
  vi.mocked(listAllContacts).mockReset().mockResolvedValue(CONTACTS);
  vi.mocked(getContact).mockReset().mockImplementation(async (id) => CONTACTS.find((c) => c.id === id) ?? null);
  vi.mocked(clearFormBadge).mockReset().mockResolvedValue(undefined);
  vi.mocked(listenFormBadgeCount).mockReset().mockImplementation((onCount) => {
    emitCount = onCount;
    onCount(2);
    return () => {};
  });
});
afterEach(cleanup);

describe('HU-504 Identificar los contactos que llegan por el formulario', () => {
  it('criterio 1 y 2: etiqueta verde "Nuevo" o "Nuevo mensaje" junto al nombre', async () => {
    renderAt('/contactos');
    await screen.findByRole('table');
    const laura = screen.getByRole('link', { name: 'Laura Formulario' }).closest('td')!;
    const zoe = screen.getByRole('link', { name: 'Zoe Prueba' }).closest('td')!;
    const lauraBadge = within(laura).getByText('Nuevo');
    expect(lauraBadge.classList.contains('form-badge')).toBe(true);
    expect(within(zoe).getByText('Nuevo mensaje').classList.contains('form-badge')).toBe(true);
    // Los demás, sin etiqueta.
    const ana = screen.getByRole('link', { name: 'Ana Prueba' }).closest('td')!;
    expect(ana.querySelector('.form-badge')).toBeNull();
  });

  it('criterio 3: los contactos con etiqueta aparecen de primeros (y después, en orden alfabético)', async () => {
    renderAt('/contactos');
    await screen.findByRole('table');
    expect(names()).toEqual(['Laura Formulario', 'Zoe Prueba', 'Ana Prueba', 'Bruno Prueba']);
  });

  it('criterio 3: también de primeros al buscar o filtrar', async () => {
    const user = userEvent.setup();
    renderAt('/contactos');
    await screen.findByRole('table');
    await user.type(screen.getByRole('searchbox'), 'prueba');
    await screen.findByText('Se encontraron 3 contactos.');
    expect(names()).toEqual(['Zoe Prueba', 'Ana Prueba', 'Bruno Prueba']);
  });

  it('criterio 4: en la barra, "Contactos (2)"; cambia en vivo y sin etiquetas dice solo "Contactos"', async () => {
    renderAt('/contactos');
    await screen.findByRole('table');
    expect(contactsOption().textContent).toBe('Contactos (2)');
    act(() => emitCount(3));
    expect(contactsOption().textContent).toBe('Contactos (3)');
    act(() => emitCount(0));
    expect(contactsOption().textContent).toBe('Contactos');
  });

  it('criterio 4: el conteo está en todas las pantallas internas', async () => {
    renderAt('/avisos');
    await waitFor(() => expect(contactsOption().textContent).toBe('Contactos (2)'));
  });

  it('criterio 5: al abrir la ficha de un contacto con etiqueta, la etiqueta se quita', async () => {
    const user = userEvent.setup();
    renderAt('/contactos');
    await screen.findByRole('table');
    await user.click(screen.getByRole('link', { name: 'Laura Formulario' }));
    await screen.findByRole('heading', { level: 1, name: 'Laura Formulario' });
    await waitFor(() => expect(clearFormBadge).toHaveBeenCalledWith('laura'));
    // La ficha muestra el origen "Formulario web".
    expect(screen.getByText('Formulario web')).toBeTruthy();
  });

  it('criterio 5: un contacto sin etiqueta no se toca al abrir su ficha', async () => {
    renderAt('/contactos/ana');
    await screen.findByRole('heading', { level: 1, name: 'Ana Prueba' });
    expect(clearFormBadge).not.toHaveBeenCalled();
  });

  it('si no se puede quitar la etiqueta, la ficha se ve igual', async () => {
    vi.mocked(clearFormBadge).mockRejectedValue(new Error('unavailable'));
    renderAt('/contactos/zoe');
    expect(await screen.findByRole('heading', { level: 1, name: 'Zoe Prueba' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
