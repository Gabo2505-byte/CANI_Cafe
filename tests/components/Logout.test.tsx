// @vitest-environment jsdom
// HU-104: Cerrar sesión
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { SessionProvider } from '../../src/auth/SessionContext';
import { LOGOUT_ERROR_MESSAGE, LOGOUT_SUCCESS_MESSAGE } from '../../src/auth/sessionMessages';
import { signOutUser } from '../../src/auth/signOutUser';
import type { AuthState } from '../../src/auth/useAuthUser';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));

const signedOut: AuthState = { status: 'signedOut' };
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
function BackButton() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Atrás del navegador</button>;
}

/** Historial: /contactos → /avisos (actual). */
function renderSignedIn() {
  const tree = (s: AuthState) => (
    <AuthContext.Provider value={s}>
      <SessionProvider>
        <MemoryRouter initialEntries={['/contactos', '/avisos']} initialIndex={1}>
          <AppRoutes />
          <LocationProbe />
          <BackButton />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>
  );
  const result = render(tree(active));
  // Simula onAuthStateChanged de Firebase.
  const setAuth = (s: AuthState) => act(() => result.rerender(tree(s)));
  return { setAuth };
}

const logoutButton = () => within(screen.getByRole('banner')).getByRole('button', { name: 'Cerrar sesión' });

beforeEach(() => {
  vi.mocked(signOutUser).mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('HU-104 Cerrar sesión', () => {
  it('clic en "Cerrar sesión" llama a signOut sin confirmación y lleva al ingreso con el mensaje', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    const { setAuth } = renderSignedIn();

    await user.click(logoutButton());
    expect(signOutUser).toHaveBeenCalledTimes(1);
    expect(confirmSpy).not.toHaveBeenCalled();
    setAuth(signedOut);

    expect(await screen.findByText(LOGOUT_SUCCESS_MESSAGE)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeTruthy();
    expect(currentLocation.pathname).toBe('/ingreso');
    expect(screen.queryByRole('banner')).toBeNull();
  });

  it('el botón se desactiva mientras se cierra la sesión (evita doble clic)', async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    vi.mocked(signOutUser).mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    renderSignedIn();

    await user.click(logoutButton());
    expect((logoutButton() as HTMLButtonElement).disabled).toBe(true);
    await user.click(logoutButton());
    expect(signOutUser).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });

  it('si signOut falla, muestra el error y no navega', async () => {
    const user = userEvent.setup();
    vi.mocked(signOutUser).mockRejectedValue(new Error('auth/network-request-failed'));
    renderSignedIn();

    await user.click(logoutButton());

    expect(await screen.findByText(LOGOUT_ERROR_MESSAGE)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Avisos' })).toBeTruthy();
    expect(currentLocation.pathname).toBe('/avisos');
    expect((logoutButton() as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(LOGOUT_SUCCESS_MESSAGE)).toBeNull();
  });

  it('el mensaje se borra del historial: no reaparece al recargar', async () => {
    const user = userEvent.setup();
    const { setAuth } = renderSignedIn();
    await user.click(logoutButton());
    setAuth(signedOut);

    await screen.findByText(LOGOUT_SUCCESS_MESSAGE);
    expect(currentLocation.state).toBeNull();
  });

  it('después de cerrar sesión, "Atrás" no vuelve a las pantallas internas', async () => {
    const user = userEvent.setup();
    const { setAuth } = renderSignedIn();
    await user.click(logoutButton());
    setAuth(signedOut);
    await screen.findByText(LOGOUT_SUCCESS_MESSAGE);

    await user.click(screen.getByRole('button', { name: 'Atrás del navegador' }));

    expect(currentLocation.pathname).toBe('/ingreso');
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeTruthy();
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('heading', { level: 1, name: 'Contactos' })).toBeNull();
    expect(screen.queryByText(LOGOUT_SUCCESS_MESSAGE)).toBeNull();
  });

  it('una ruta interna sin sesión redirige al ingreso (sin mostrar la pantalla)', () => {
    render(
      <AuthContext.Provider value={signedOut}>
        <SessionProvider>
          <MemoryRouter initialEntries={['/posibles-ventas']}>
            <AppRoutes />
            <LocationProbe />
          </MemoryRouter>
        </SessionProvider>
      </AuthContext.Provider>,
    );
    expect(currentLocation.pathname).toBe('/ingreso');
    expect(screen.queryByRole('heading', { level: 1, name: 'Gestión de ventas' })).toBeNull();
    expect(screen.queryByText(LOGOUT_SUCCESS_MESSAGE)).toBeNull();
  });

  it('mientras se resuelve la sesión solo muestra "Cargando…", sin datos internos', () => {
    render(
      <AuthContext.Provider value={{ status: 'loading' }}>
        <SessionProvider>
          <MemoryRouter initialEntries={['/contactos']}>
            <AppRoutes />
          </MemoryRouter>
        </SessionProvider>
      </AuthContext.Provider>,
    );
    expect(screen.getByText('Cargando…')).toBeTruthy();
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('heading', { level: 1, name: 'Contactos' })).toBeNull();
  });
});
