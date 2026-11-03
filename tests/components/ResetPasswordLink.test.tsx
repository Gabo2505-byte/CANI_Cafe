// @vitest-environment jsdom
// HU-107: enlace del correo que ya no sirve
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { checkResetLink } from '../../src/auth/resetLinkApi';
import { SessionProvider } from '../../src/auth/SessionContext';

vi.mock('../../src/auth/resetLinkApi', () => ({ checkResetLink: vi.fn(), markResetLinkUsed: vi.fn() }));
vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));

const VALID = '/nueva-contrasena?mode=resetPassword&oobCode=XYZ&u=admin&rid=abc';

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

beforeEach(() => {
  vi.mocked(checkResetLink).mockReset();
});

afterEach(cleanup);

describe('HU-107 enlace no válido', () => {
  it('si el enlace ya no sirve aparece "El enlace ya no es válido. Solicite uno nuevo."', async () => {
    vi.mocked(checkResetLink).mockResolvedValue({ ok: false });
    renderAt(VALID);
    expect((await screen.findByRole('alert')).textContent).toBe('El enlace ya no es válido. Solicite uno nuevo.');
    expect(screen.getByRole('link', { name: 'Solicitar un enlace nuevo' }).getAttribute('href')).toBe('/recuperar-contrasena');
    expect(checkResetLink).toHaveBeenCalledWith({ oobCode: 'XYZ', username: 'admin', rid: 'abc' });
  });

  it('un enlace incompleto es no válido sin consultar a Firebase', async () => {
    renderAt('/nueva-contrasena?mode=resetPassword&u=admin');
    expect((await screen.findByRole('alert')).textContent).toBe('El enlace ya no es válido. Solicite uno nuevo.');
    expect(checkResetLink).not.toHaveBeenCalled();
  });

  it('si el enlace sirve, no muestra el mensaje y pasa a "Crear nueva contraseña" (HU-108)', async () => {
    vi.mocked(checkResetLink).mockResolvedValue({ ok: true, email: 'admin@example.com', expiresAt: new Date() });
    renderAt(VALID);
    expect(await screen.findByRole('heading', { name: 'Crear nueva contraseña' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
