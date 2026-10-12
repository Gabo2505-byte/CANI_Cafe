// @vitest-environment jsdom
// HU-201: Registrar un nuevo contacto
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { SessionProvider } from '../../src/auth/SessionContext';
import { createContact, findDuplicateContacts, getContact } from '../../src/contacts/contactsApi';
import { CONTACT_MESSAGES } from '../../src/contacts/contactForm';
import type { AuthState } from '../../src/auth/useAuthUser';
import type { Contact } from '../../src/shared/types';

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

function renderAt(path: string) {
  return render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

// "Teléfono" exacto para no confundirlo con "País del teléfono" (HU-202).
const field = (label: string) =>
  screen.getByLabelText(label, { exact: label === 'Teléfono' }) as HTMLInputElement;
const saved = (overrides: Partial<Contact> = {}): Contact => ({
  id: 'nuevo-123',
  fullName: 'Ana Prueba Mora',
  email: 'ana.prueba@example.com',
  phoneCountry: null,
  phoneNumber: null,
  address: null,
  classification: 'persona_interesada',
  status: 'activo',
  origin: null,
  createdAt: Timestamp.fromDate(new Date('2026-10-12T15:00:00Z')),
  ...overrides,
});

beforeEach(() => {
  vi.mocked(findDuplicateContacts).mockReset().mockResolvedValue({});
  vi.mocked(createContact).mockReset().mockResolvedValue('nuevo-123');
  vi.mocked(getContact).mockReset().mockResolvedValue(saved());
});
afterEach(cleanup);

describe('HU-201 Registrar un nuevo contacto', () => {
  it('en Contactos está el botón "Nuevo contacto", arriba a la derecha junto al título, y abre el formulario', async () => {
    const user = userEvent.setup();
    renderAt('/contactos');
    const header = screen.getByRole('heading', { level: 1, name: 'Contactos' }).parentElement!;
    const button = within(header).getByRole('button', { name: 'Nuevo contacto' });
    expect(header.lastElementChild).toBe(button);

    await user.click(button);
    expect(screen.getByRole('heading', { level: 1, name: 'Nuevo contacto' })).toBeTruthy();
    expect(currentLocation.pathname).toBe('/contactos/nuevo');
  });

  it('el formulario pide cuatro datos: nombre completo, correo, teléfono y dirección', () => {
    renderAt('/contactos/nuevo');
    const form = document.querySelector('form')!;
    const inputs = form.querySelectorAll('input, textarea');
    expect(inputs).toHaveLength(4);
    expect(field('Nombre completo')).toBeTruthy();
    expect(field('Correo electrónico')).toBeTruthy();
    expect(field('Teléfono')).toBeTruthy();
    expect(field('Dirección')).toBeTruthy();
  });

  it('el nombre completo es obligatorio', async () => {
    const user = userEvent.setup();
    renderAt('/contactos/nuevo');
    await user.type(field('Correo electrónico'), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByText(CONTACT_MESSAGES.fullNameRequired)).toBeTruthy();
    expect(createContact).not.toHaveBeenCalled();
  });

  it('pide al menos correo o teléfono', async () => {
    const user = userEvent.setup();
    renderAt('/contactos/nuevo');
    await user.type(field('Nombre completo'), 'Ana Prueba');
    await user.type(field('Dirección'), 'San José');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByText(CONTACT_MESSAGES.emailOrPhoneRequired)).toBeTruthy();
    expect(createContact).not.toHaveBeenCalled();
  });

  it('con nombre y solo teléfono se guarda (correo y dirección quedan en null)', async () => {
    const user = userEvent.setup();
    renderAt('/contactos/nuevo');
    await user.type(field('Nombre completo'), 'Bruno Prueba');
    await user.type(field('Teléfono'), '0000 0009');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(createContact).toHaveBeenCalledWith({
      fullName: 'Bruno Prueba',
      email: null,
      phoneCountry: 'CR',
      phoneNumber: '00000009',
      address: null,
    });
  });

  it('al guardar aparece la ficha con "Contacto registrado correctamente." y clasificado como "Persona interesada"', async () => {
    const user = userEvent.setup();
    renderAt('/contactos/nuevo');
    await user.type(field('Nombre completo'), 'Ana Prueba Mora');
    await user.type(field('Correo electrónico'), 'ana.prueba@example.com');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Contacto registrado correctamente.')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Ana Prueba Mora' })).toBeTruthy();
    expect(screen.getByText('Persona interesada')).toBeTruthy();
    expect(currentLocation.pathname).toBe('/contactos/nuevo-123');
    expect(currentLocation.state).toBeNull(); // el mensaje no reaparece al recargar
    expect(getContact).toHaveBeenCalledWith('nuevo-123');
  });

  it('si falla el guardado, muestra un error y se queda en el formulario', async () => {
    const user = userEvent.setup();
    vi.mocked(createContact).mockRejectedValue(new Error('unavailable'));
    renderAt('/contactos/nuevo');
    await user.type(field('Nombre completo'), 'Ana');
    await user.type(field('Correo electrónico'), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(CONTACT_MESSAGES.saveError)).toBeTruthy();
    expect(currentLocation.pathname).toBe('/contactos/nuevo');
    expect(field('Nombre completo').value).toBe('Ana');
  });

  it('"Cancelar" después de escribir pregunta "¿Desea salir sin guardar? Los datos ingresados se perderán."', async () => {
    const user = userEvent.setup();
    renderAt('/contactos/nuevo');
    await user.type(field('Dirección'), 'algo');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('¿Desea salir sin guardar? Los datos ingresados se perderán.')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Seguir editando' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(field('Dirección').value).toBe('algo');

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Salir sin guardar' }));
    expect(currentLocation.pathname).toBe('/contactos');
    expect(createContact).not.toHaveBeenCalled();
  });

  it('cambiar solo el país del teléfono no cuenta como "escribir": Cancelar vuelve directo', async () => {
    const user = userEvent.setup();
    renderAt('/contactos/nuevo');
    await user.click(screen.getByRole('button', { name: /^País del teléfono/ }));
    await user.type(screen.getByRole('combobox', { name: 'Buscar país' }), 'estados');
    await user.click(screen.getByRole('option', { name: 'Estados Unidos (+1)' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(currentLocation.pathname).toBe('/contactos');
  });

  it('"Cancelar" sin haber escrito nada vuelve directamente a la lista de contactos', async () => {
    const user = userEvent.setup();
    renderAt('/contactos/nuevo');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(currentLocation.pathname).toBe('/contactos');
  });
});
