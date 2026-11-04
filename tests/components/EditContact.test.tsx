// @vitest-environment jsdom
// HU-210: Editar un contacto
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { SessionProvider } from '../../src/auth/SessionContext';
import { findDuplicateContacts, getContact, updateContact } from '../../src/contacts/contactsApi';
import type { AuthState } from '../../src/auth/useAuthUser';
import type { Contact } from '../../src/shared/types';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));
vi.mock('../../src/contacts/contactDetailApi', () => ({
  loadContactRecords: vi.fn().mockResolvedValue({ communications: [], sales: [], products: [] }),
}));
vi.mock('../../src/contacts/contactsApi', () => ({
  createContact: vi.fn(),
  getContact: vi.fn(),
  updateContact: vi.fn(),
  findDuplicateContacts: vi.fn(),
  countContacts: vi.fn().mockResolvedValue(0),
  listContactsPage: vi.fn().mockResolvedValue({ contacts: [], nextCursor: null }),
  listAllContacts: vi.fn().mockResolvedValue([]),
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

function renderAt(path: string, state?: unknown) {
  return render(
    <AuthContext.Provider value={active}>
      <SessionProvider>
        <MemoryRouter initialEntries={[{ pathname: path, state }]}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

const stored: Contact = {
  id: 'contact-002',
  fullName: 'Bruno Ficticio Solís',
  nameSortKey: 'bruno ficticio solis',
  email: 'bruno.ficticio@example.com',
  phoneCountry: 'CR',
  phoneNumber: '00000002',
  address: 'Dirección de prueba 2, Heredia',
  classification: 'cliente',
  status: 'activo',
  origin: 'referido',
  createdAt: Timestamp.fromDate(new Date('2026-09-03T16:30:00Z')),
};

// "Teléfono" exacto para no confundirlo con "País del teléfono" (HU-202).
const field = (label: string) => screen.getByLabelText(label, { exact: label === 'Teléfono' }) as HTMLInputElement;

async function openEditFromDetail(user: ReturnType<typeof userEvent.setup>) {
  renderAt('/contactos/contact-002', { from: '/contactos?buscar=bruno' });
  await user.click(await screen.findByRole('button', { name: 'Editar' }));
  await screen.findByRole('heading', { level: 1, name: 'Editar contacto' });
}

beforeEach(() => {
  vi.mocked(getContact).mockReset().mockResolvedValue(stored);
  vi.mocked(updateContact).mockReset().mockResolvedValue(undefined);
  vi.mocked(findDuplicateContacts).mockReset().mockResolvedValue({});
});
afterEach(cleanup);

describe('HU-210 Editar un contacto', () => {
  it('criterio 1: en la ficha, arriba a la derecha, está "Editar"; abre el formulario con los datos actuales', async () => {
    const user = userEvent.setup();
    renderAt('/contactos/contact-002');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Bruno Ficticio Solís' });
    const header = heading.closest('.contact-header')!;
    const button = within(header as HTMLElement).getByRole('button', { name: 'Editar' });
    expect(header.lastElementChild).toBe(button);

    await user.click(button);
    expect(currentLocation.pathname).toBe('/contactos/contact-002/editar');
    await screen.findByRole('heading', { level: 1, name: 'Editar contacto' });
    expect(field('Nombre completo').value).toBe('Bruno Ficticio Solís');
    expect(field('Correo electrónico').value).toBe('bruno.ficticio@example.com');
    expect(field('Teléfono').value).toContain('0000');
    expect(screen.getByRole('button', { name: /^País del teléfono/ }).textContent).toContain('+506');
    expect(field('Dirección (opcional)').value).toBe('Dirección de prueba 2, Heredia');
  });

  it('criterio 2: no se pueden cambiar la clasificación, el origen ni la fecha de registro (no están en el formulario)', async () => {
    const user = userEvent.setup();
    await openEditFromDetail(user);
    const form = document.querySelector('form')!;
    expect(within(form).queryByLabelText(/Clasificación/)).toBeNull();
    expect(within(form).queryByLabelText(/Origen/)).toBeNull();
    expect(within(form).queryByLabelText(/Fecha de registro/)).toBeNull();
    // Solo nombre, correo, teléfono y dirección (más el botón del país del teléfono).
    expect(within(form).getAllByRole('textbox').map((el) => el.id)).toEqual(['fullName', 'email', 'phone', 'address']);
  });

  it('criterio 2 y 5: se cambian nombre, correo, teléfono con su país y dirección; al guardar vuelve a la ficha con el mensaje', async () => {
    const user = userEvent.setup();
    await openEditFromDetail(user);
    await user.clear(field('Nombre completo'));
    await user.type(field('Nombre completo'), 'Bruno Solís Ficticio');
    await user.clear(field('Correo electrónico'));
    await user.type(field('Correo electrónico'), 'Bruno.Nuevo@Example.com');
    await user.click(screen.getByRole('button', { name: /^País del teléfono/ }));
    await user.type(screen.getByRole('combobox', { name: 'Buscar país' }), 'estados');
    await user.click(screen.getByRole('option', { name: 'Estados Unidos (+1)' }));
    await user.clear(field('Teléfono'));
    await user.type(field('Teléfono'), '3055550199');
    await user.clear(field('Dirección (opcional)'));
    vi.mocked(getContact).mockResolvedValue({ ...stored, fullName: 'Bruno Solís Ficticio' });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(findDuplicateContacts).toHaveBeenCalledWith(
      { fullName: 'Bruno Solís Ficticio', email: 'bruno.nuevo@example.com', phoneCountry: 'US', phoneNumber: '3055550199', address: null },
      'contact-002',
    );
    expect(updateContact).toHaveBeenCalledWith('contact-002', {
      fullName: 'Bruno Solís Ficticio',
      email: 'bruno.nuevo@example.com',
      phoneCountry: 'US',
      phoneNumber: '3055550199',
      address: null,
    });
    expect((await screen.findByRole('status')).textContent).toBe('Cambios guardados correctamente.');
    expect(currentLocation.pathname).toBe('/contactos/contact-002');
    expect(await screen.findByRole('heading', { level: 1, name: 'Bruno Solís Ficticio' })).toBeTruthy();
    // "Volver a contactos" sigue llevando a la lista como estaba antes de editar (HU-207).
    expect(screen.getByRole('link', { name: '← Volver a contactos' }).getAttribute('href')).toBe('/contactos?buscar=bruno');
  });

  it('criterio 3: el nombre sigue siendo obligatorio y debe quedar correo o teléfono', async () => {
    const user = userEvent.setup();
    await openEditFromDetail(user);
    await user.clear(field('Nombre completo'));
    await user.clear(field('Correo electrónico'));
    await user.clear(field('Teléfono'));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    const messages = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(messages).toContain('Ingrese el nombre completo.');
    expect(messages).toContain('Ingrese un correo electrónico o un teléfono.');
    expect(updateContact).not.toHaveBeenCalled();
  });

  it('criterio 3: formato del correo y largo del teléfono (8 en Costa Rica)', async () => {
    const user = userEvent.setup();
    await openEditFromDetail(user);
    await user.clear(field('Correo electrónico'));
    await user.type(field('Correo electrónico'), 'bruno@dominio');
    await user.clear(field('Teléfono'));
    await user.type(field('Teléfono'), '8812345');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    const messages = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(messages).toContain('Ingrese un correo electrónico válido.');
    expect(messages.some((m) => m?.includes('8'))).toBe(true);
    expect(updateContact).not.toHaveBeenCalled();
  });

  it('criterio 4: correo de otro contacto → "Ya existe un contacto con este correo electrónico." y no se guarda', async () => {
    vi.mocked(findDuplicateContacts).mockResolvedValue({ email: 'contact-001' });
    const user = userEvent.setup();
    await openEditFromDetail(user);
    await user.clear(field('Correo electrónico'));
    await user.type(field('Correo electrónico'), 'ana.prueba@example.com');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    const message = await screen.findByText('Ya existe un contacto con este correo electrónico.', { exact: false });
    expect(within(message).getByRole('link', { name: 'Ver contacto' }).getAttribute('href')).toBe('/contactos/contact-001');
    expect(updateContact).not.toHaveBeenCalled();
  });

  it('criterio 4: teléfono de otro contacto → "Ya existe un contacto con este teléfono." y no se guarda', async () => {
    vi.mocked(findDuplicateContacts).mockResolvedValue({ phone: 'contact-001' });
    const user = userEvent.setup();
    await openEditFromDetail(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ya existe un contacto con este teléfono.', { exact: false })).toBeTruthy();
    expect(updateContact).not.toHaveBeenCalled();
  });

  it('criterio 4: sus propios datos no cuentan como repetidos (se excluye el contacto que se edita)', async () => {
    const user = userEvent.setup();
    await openEditFromDetail(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(vi.mocked(findDuplicateContacts).mock.calls[0][1]).toBe('contact-002');
    expect(updateContact).toHaveBeenCalled();
  });

  it('criterio 5: "Cancelar" después de cambiar algo pregunta "¿Desea salir sin guardar? Los cambios se perderán."', async () => {
    const user = userEvent.setup();
    await openEditFromDetail(user);
    await user.type(field('Dirección (opcional)'), ', casa 3');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('¿Desea salir sin guardar? Los cambios se perderán.')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Seguir editando' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(field('Dirección (opcional)').value).toBe('Dirección de prueba 2, Heredia, casa 3');

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Salir sin guardar' }));
    expect(currentLocation.pathname).toBe('/contactos/contact-002');
    expect(updateContact).not.toHaveBeenCalled();
    await screen.findByRole('heading', { level: 1, name: 'Bruno Ficticio Solís' });
    expect(screen.queryByText('Cambios guardados correctamente.')).toBeNull();
  });

  it('criterio 5: "Cancelar" sin cambios vuelve directo a la ficha', async () => {
    const user = userEvent.setup();
    await openEditFromDetail(user);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(currentLocation.pathname).toBe('/contactos/contact-002');
  });

  it('si falla el guardado, avisa y conserva lo escrito', async () => {
    vi.mocked(updateContact).mockRejectedValue(new Error('unavailable'));
    const user = userEvent.setup();
    await openEditFromDetail(user);
    await user.type(field('Nombre completo'), ' Jr.');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('No se pudieron guardar los cambios. Intente de nuevo.')).toBeTruthy();
    expect(field('Nombre completo').value).toBe('Bruno Ficticio Solís Jr.');
  });

  it('contacto inexistente: "El contacto no existe." sin formulario', async () => {
    vi.mocked(getContact).mockResolvedValue(null);
    renderAt('/contactos/no-existe/editar');
    expect(await screen.findByText('El contacto no existe.', { exact: false })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
  });
});
