// @vitest-environment jsdom
// HU-203: Revisar los datos de un contacto antes de guardarlo
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { SessionProvider } from '../../src/auth/SessionContext';
import { createContact, findDuplicateContacts, getContact } from '../../src/contacts/contactsApi';
import type { AuthState } from '../../src/auth/useAuthUser';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/contacts/contactsApi', () => ({
  createContact: vi.fn(),
  getContact: vi.fn(),
  findDuplicateContacts: vi.fn(),
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

function renderForm() {
  render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={['/contactos/nuevo']}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

const nameInput = () => screen.getByLabelText('Nombre completo', { exact: false }) as HTMLInputElement;
const emailInput = () => screen.getByLabelText('Correo electrónico') as HTMLInputElement;
const phoneInput = () => screen.getByLabelText('Teléfono') as HTMLInputElement;
const addressInput = () => screen.getByLabelText('Dirección', { exact: false }) as HTMLTextAreaElement;
const save = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Guardar' }));

beforeEach(() => {
  vi.mocked(findDuplicateContacts).mockReset().mockResolvedValue({});
  vi.mocked(createContact).mockReset().mockResolvedValue('nuevo-1');
  vi.mocked(getContact).mockReset().mockResolvedValue(null);
});
afterEach(cleanup);

describe('HU-203 Revisar los datos antes de guardar', () => {
  it('nombre y correo aceptan como máximo 100 caracteres; la dirección, 250', async () => {
    const user = userEvent.setup();
    renderForm();
    expect(nameInput().maxLength).toBe(100);
    expect(emailInput().maxLength).toBe(100);
    expect(addressInput().maxLength).toBe(250);

    await user.click(nameInput());
    await user.paste('n'.repeat(120));
    await user.click(addressInput());
    await user.paste('d'.repeat(300));
    expect(nameInput().value).toHaveLength(100);
    expect(addressInput().value).toHaveLength(250);
  });

  it('el contador avisa al llegar al máximo (nombre 100, dirección 250)', async () => {
    const user = userEvent.setup();
    renderForm();
    expect(document.getElementById('fullName-count')!.textContent).toBe('0/100');
    expect(document.getElementById('email-count')!.textContent).toBe('0/100');
    expect(document.getElementById('address-count')!.textContent).toBe('0/250');

    await user.type(nameInput(), 'Ana');
    expect(document.getElementById('fullName-count')!.textContent).toBe('3/100');
    expect(screen.queryByText(/acepta como máximo/)).toBeNull();

    await user.click(nameInput());
    await user.paste('n'.repeat(120));
    expect(document.getElementById('fullName-count')!.textContent).toBe('Llegó al máximo de 100 caracteres. 100/100');

    await user.click(addressInput());
    await user.paste('d'.repeat(300));
    expect(document.getElementById('address-count')!.textContent).toBe('Llegó al máximo de 250 caracteres. 250/250');
    // Es un aviso, no un error
    expect(document.getElementById('fullName-count')!.getAttribute('role')).toBeNull();
  });

  it('justo en el máximo (100 / 250) es válido y SÍ se guarda', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(nameInput());
    await user.paste('n'.repeat(100));
    await user.type(emailInput(), 'max@example.com');
    await user.click(addressInput());
    await user.paste('d'.repeat(250));
    await save(user);

    expect(createContact).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'n'.repeat(100), address: 'd'.repeat(250) }),
    );
  });

  it.each(['ana', 'ana@dominio', 'ana @dominio.com', 'ana@dominio .com', '@dominio.com'])(
    'correo "%s" → "Ingrese un correo electrónico válido." y no se guarda',
    async (email) => {
      const user = userEvent.setup();
      renderForm();
      await user.type(nameInput(), 'Ana Prueba');
      await user.type(emailInput(), email);
      await save(user);

      expect(screen.getByText('Ingrese un correo electrónico válido.')).toBeTruthy();
      expect(findDuplicateContacts).not.toHaveBeenCalled();
      expect(createContact).not.toHaveBeenCalled();
    },
  );

  it('un correo válido (nombre@dominio.com) se guarda en minúsculas', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(nameInput(), 'Ana Prueba');
    await user.type(emailInput(), 'Ana.Prueba@Example.com');
    await save(user);

    expect(createContact).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana.prueba@example.com' }));
  });

  it('correo repetido → mensaje + "Ver contacto" que abre la ficha existente; no se guarda', async () => {
    const user = userEvent.setup();
    vi.mocked(findDuplicateContacts).mockResolvedValue({ email: 'contact-001' });
    renderForm();
    await user.type(nameInput(), 'Ana Otra');
    await user.type(emailInput(), 'ana.prueba@example.com');
    await save(user);

    const message = await screen.findByText(/Ya existe un contacto con este correo electrónico\./);
    expect(createContact).not.toHaveBeenCalled();
    const link = within(message).getByRole('link', { name: 'Ver contacto' });
    await user.click(link);
    expect(currentLocation.pathname).toBe('/contactos/contact-001');
  });

  it('teléfono repetido (mismo país y número) → mensaje + "Ver contacto"; no se guarda', async () => {
    const user = userEvent.setup();
    vi.mocked(findDuplicateContacts).mockResolvedValue({ phone: 'contact-002' });
    renderForm();
    await user.type(nameInput(), 'Bruno Otro');
    await user.type(phoneInput(), '0000 0002');
    await save(user);

    expect(findDuplicateContacts).toHaveBeenCalledWith(
      expect.objectContaining({ phoneCountry: 'CR', phoneNumber: '00000002' }),
    );
    const message = await screen.findByText(/Ya existe un contacto con este teléfono\./);
    expect(within(message).getByRole('link', { name: 'Ver contacto' }).getAttribute('href')).toBe(
      '/contactos/contact-002',
    );
    expect(createContact).not.toHaveBeenCalled();
  });

  it('correo y teléfono repetidos a la vez → los dos mensajes, cada uno con su enlace', async () => {
    const user = userEvent.setup();
    vi.mocked(findDuplicateContacts).mockResolvedValue({ email: 'contact-001', phone: 'contact-002' });
    renderForm();
    await user.type(nameInput(), 'Repetido');
    await user.type(emailInput(), 'ana.prueba@example.com');
    await user.type(phoneInput(), '00000002');
    await save(user);

    expect(await screen.findAllByRole('link', { name: 'Ver contacto' })).toHaveLength(2);
    expect(createContact).not.toHaveBeenCalled();
  });

  it('al corregir el dato repetido, se vuelve a revisar y se guarda', async () => {
    const user = userEvent.setup();
    vi.mocked(findDuplicateContacts).mockResolvedValueOnce({ email: 'contact-001' }).mockResolvedValueOnce({});
    renderForm();
    await user.type(nameInput(), 'Ana Nueva');
    await user.type(emailInput(), 'ana.prueba@example.com');
    await save(user);
    await screen.findByText(/Ya existe un contacto con este correo electrónico\./);

    await user.clear(emailInput());
    await user.type(emailInput(), 'ana.nueva@example.com');
    await save(user);

    expect(createContact).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Ya existe un contacto/)).toBeNull();
  });
});
