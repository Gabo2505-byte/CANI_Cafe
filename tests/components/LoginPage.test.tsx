// @vitest-environment jsdom
// HU-101: Iniciar sesión
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { ProtectedRoute } from '../../src/app/ProtectedRoute';
import { AuthContext } from '../../src/auth/AuthContext';
import { LoginPage } from '../../src/auth/LoginPage';
import type { AuthState } from '../../src/auth/useAuthUser';
import { signInWithUsername } from '../../src/auth/signInWithUsername';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));

const signedOut: AuthState = { status: 'signedOut' };
const active: AuthState = {
  status: 'active',
  firebaseUser: { uid: 'u1' } as FirebaseUser,
  profile: { id: 'u1', username: 'admin', email: 'admin@example.com', active: true },
};

function renderApp(path: string, state: AuthState, routes: ReactNode = <AppRoutes />) {
  const tree = (s: AuthState) => (
    <AuthContext.Provider value={s}>
      <MemoryRouter initialEntries={[path]}>{routes}</MemoryRouter>
    </AuthContext.Provider>
  );
  const result = render(tree(state));
  return { ...result, setAuth: (s: AuthState) => result.rerender(tree(s)) };
}

beforeEach(() => {
  vi.mocked(signInWithUsername).mockReset().mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('HU-101 Iniciar sesión', () => {
  it('al abrir el sistema sin sesión aparece la pantalla de ingreso', () => {
    renderApp('/', signedOut);
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeTruthy();
  });

  it('tiene Usuario, Contraseña, botón Ingresar y enlace ¿Olvidó su contraseña?', () => {
    renderApp('/ingreso', signedOut);
    expect(screen.getByLabelText('Usuario')).toBeTruthy();
    expect(screen.getByLabelText('Contraseña')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '¿Olvidó su contraseña?' })).toBeTruthy();
  });

  it('la contraseña se ve como puntos y el ojo la muestra u oculta', async () => {
    const user = userEvent.setup();
    renderApp('/ingreso', signedOut);
    const password = screen.getByLabelText('Contraseña') as HTMLInputElement;
    expect(password.type).toBe('password');

    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(password.type).toBe('text');

    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(password.type).toBe('password');
  });

  it('ingresa al dar clic en Ingresar', async () => {
    const user = userEvent.setup();
    renderApp('/ingreso', signedOut);
    await user.type(screen.getByLabelText('Usuario'), 'admin');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(signInWithUsername).toHaveBeenCalledWith('admin', 'secreta');
  });

  it('ingresa al presionar Enter', async () => {
    const user = userEvent.setup();
    renderApp('/ingreso', signedOut);
    await user.type(screen.getByLabelText('Usuario'), 'admin');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta{Enter}');
    expect(signInWithUsername).toHaveBeenCalledWith('admin', 'secreta');
  });

  it('con credenciales correctas aparece la pantalla Contactos', async () => {
    const user = userEvent.setup();
    const { setAuth } = renderApp('/', signedOut);
    await user.type(screen.getByLabelText('Usuario'), 'admin');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta{Enter}');
    setAuth(active); // Firebase confirma la sesión

    expect(await screen.findByRole('heading', { name: 'Contactos' })).toBeTruthy();
  });

  it('si había intentado abrir otra pantalla, aparece esa pantalla', async () => {
    const user = userEvent.setup();
    const routes = (
      <Routes>
        <Route path="/ingreso" element={<LoginPage />} />
        <Route
          path="/ventas"
          element={
            <ProtectedRoute>
              <h1>Ventas</h1>
            </ProtectedRoute>
          }
        />
      </Routes>
    );
    const { setAuth } = renderApp('/ventas', signedOut, routes);
    expect(screen.queryByRole('heading', { name: 'Ventas' })).toBeNull();

    await user.type(screen.getByLabelText('Usuario'), 'admin');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta{Enter}');
    setAuth(active);

    expect(await screen.findByRole('heading', { name: 'Ventas' })).toBeTruthy();
  });

  it('con credenciales incorrectas se queda en la pantalla de ingreso', async () => {
    const user = userEvent.setup();
    vi.mocked(signInWithUsername).mockRejectedValue(new Error('auth/invalid-credential'));
    renderApp('/ingreso', signedOut);
    await user.type(screen.getByLabelText('Usuario'), 'admin');
    await user.type(screen.getByLabelText('Contraseña'), 'mala{Enter}');

    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Contactos' })).toBeNull();
  });
});

const authError = (code: string) => Object.assign(new Error(code), { code });

describe('HU-102 Mensajes de error al ingresar', () => {
  it('usuario vacío → "Ingrese su usuario."', async () => {
    const user = userEvent.setup();
    renderApp('/ingreso', signedOut);
    await user.type(screen.getByLabelText('Contraseña'), 'secreta');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(screen.getByText('Ingrese su usuario.')).toBeTruthy();
    expect(signInWithUsername).not.toHaveBeenCalled();
  });

  it('contraseña vacía → "Ingrese su contraseña."', async () => {
    const user = userEvent.setup();
    renderApp('/ingreso', signedOut);
    await user.type(screen.getByLabelText('Usuario'), 'admin{Enter}');

    expect(screen.getByText('Ingrese su contraseña.')).toBeTruthy();
    expect(signInWithUsername).not.toHaveBeenCalled();
  });

  it('ambos vacíos → muestra los dos mensajes', async () => {
    const user = userEvent.setup();
    renderApp('/ingreso', signedOut);
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(screen.getByText('Ingrese su usuario.')).toBeTruthy();
    expect(screen.getByText('Ingrese su contraseña.')).toBeTruthy();
  });

  it('usuario inexistente → "El usuario ingresado no existe."', async () => {
    const user = userEvent.setup();
    vi.mocked(signInWithUsername).mockRejectedValue(authError('auth/user-not-found'));
    renderApp('/ingreso', signedOut);
    await user.type(screen.getByLabelText('Usuario'), 'noexiste');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta{Enter}');

    expect(await screen.findByText('El usuario ingresado no existe.')).toBeTruthy();
  });

  it('contraseña incorrecta → mensaje, se borra la contraseña y se mantiene el usuario', async () => {
    const user = userEvent.setup();
    vi.mocked(signInWithUsername).mockRejectedValue(authError('auth/wrong-password'));
    renderApp('/ingreso', signedOut);
    const username = screen.getByLabelText('Usuario') as HTMLInputElement;
    const password = screen.getByLabelText('Contraseña') as HTMLInputElement;
    await user.type(username, 'admin');
    await user.type(password, 'mala{Enter}');

    expect(await screen.findByText('La contraseña es incorrecta.')).toBeTruthy();
    expect(password.value).toBe('');
    expect(username.value).toBe('admin');
    expect(document.activeElement).toBe(password);
  });
});
