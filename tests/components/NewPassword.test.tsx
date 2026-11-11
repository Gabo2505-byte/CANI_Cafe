// @vitest-environment jsdom
// HU-108: pantalla "Crear nueva contraseña"
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { checkResetLink, saveNewPassword } from '../../src/auth/resetLinkApi';
import { SessionProvider } from '../../src/auth/SessionContext';

vi.mock('../../src/auth/resetLinkApi', () => ({ checkResetLink: vi.fn(), saveNewPassword: vi.fn() }));
vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));

const VALID = '/nueva-contrasena?mode=resetPassword&oobCode=XYZ&u=admin&rid=abc';
const LINK = { oobCode: 'XYZ', username: 'admin', rid: 'abc' };

function renderAt(path: string) {
  return render(
    <AuthContext.Provider value={{ status: 'signedOut' }}>
      <SessionProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

async function openValidLink() {
  renderAt(VALID);
  await screen.findByRole('heading', { name: 'Crear nueva contraseña' });
}

function fill(password: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
}

function alertTexts(): string[] {
  return screen.queryAllByRole('alert').map((el) => el.textContent ?? '');
}

beforeEach(() => {
  vi.mocked(checkResetLink).mockReset();
  vi.mocked(checkResetLink).mockResolvedValue({ ok: true, email: 'admin@example.com', expiresAt: new Date() });
  vi.mocked(saveNewPassword).mockReset();
});

afterEach(cleanup);

describe('HU-108 Crear una nueva contraseña', () => {
  it('con un enlace válido aparece "Crear nueva contraseña" con "Nueva contraseña", "Confirmar contraseña" y "Guardar"', async () => {
    await openValidLink();
    expect(screen.getByLabelText('Nueva contraseña').getAttribute('type')).toBe('password');
    expect(screen.getByLabelText('Confirmar contraseña').getAttribute('type')).toBe('password');
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeTruthy();
  });

  it('la regla aparece escrita debajo del primer campo y está asociada a él', async () => {
    await openValidLink();
    const first = screen.getByLabelText('Nueva contraseña');
    const rule = screen.getByText('Al menos 8 caracteres, con al menos una letra y un número.');
    expect(first.getAttribute('aria-describedby')).toContain(rule.id);
    // Debajo del primer campo y antes del segundo.
    const second = screen.getByLabelText('Confirmar contraseña');
    expect(first.compareDocumentPosition(rule) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rule.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('si no cumple la regla aparece el mensaje literal y no se guarda', async () => {
    await openValidLink();
    fill('cafecafe', 'cafecafe');
    expect(alertTexts()).toEqual(['La contraseña debe tener al menos 8 caracteres, una letra y un número.']);
    expect(screen.getByLabelText('Nueva contraseña').getAttribute('aria-invalid')).toBe('true');
    expect(saveNewPassword).not.toHaveBeenCalled();
  });

  it('si las contraseñas no son iguales aparece "Las contraseñas no coinciden." y no se guarda', async () => {
    await openValidLink();
    fill('cafe2026', 'cafe2027');
    expect(alertTexts()).toEqual(['Las contraseñas no coinciden.']);
    expect(screen.getByLabelText('Confirmar contraseña').getAttribute('aria-invalid')).toBe('true');
    expect(saveNewPassword).not.toHaveBeenCalled();
  });

  it('al guardar pasa al ingreso con "Contraseña actualizada correctamente. Ya puede iniciar sesión."', async () => {
    vi.mocked(saveNewPassword).mockResolvedValue({ ok: true });
    await openValidLink();
    fill('cafe2026', 'cafe2026');
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toBe('Contraseña actualizada correctamente. Ya puede iniciar sesión.');
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeTruthy();
    expect(saveNewPassword).toHaveBeenCalledWith(LINK, 'cafe2026');
  });

  it('si Firebase rechaza el enlace al guardar aparece "El enlace ya no es válido. Solicite uno nuevo."', async () => {
    vi.mocked(saveNewPassword).mockResolvedValue({ ok: false, message: 'El enlace ya no es válido. Solicite uno nuevo.' });
    await openValidLink();
    fill('cafe2026', 'cafe2026');
    expect((await screen.findByRole('alert')).textContent).toBe('El enlace ya no es válido. Solicite uno nuevo.');
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Solicitar un enlace nuevo' })).toBeTruthy();
  });

  it('si falla la conexión se queda en el formulario con el aviso y con lo escrito', async () => {
    vi.mocked(saveNewPassword).mockResolvedValue({ ok: false, message: 'No se pudo guardar la contraseña. Intente de nuevo.' });
    await openValidLink();
    fill('cafe2026', 'cafe2026');
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo guardar la contraseña. Intente de nuevo.');
    expect((screen.getByLabelText('Nueva contraseña') as HTMLInputElement).value).toBe('cafe2026');
    expect((screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
