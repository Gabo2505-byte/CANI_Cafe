// @vitest-environment jsdom
// HU-105: el sistema interno solo puede usarse con una sesión iniciada
import { act, cleanup, render, screen } from '@testing-library/react';
import type { User as FirebaseUser } from 'firebase/auth';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { INACTIVITY_LIMIT_MS, writeLastActivity } from '../../src/auth/inactivity';
import { SessionProvider } from '../../src/auth/SessionContext';
import {
  INACTIVITY_MESSAGE,
  LOGIN_REQUIRED_MESSAGE,
  LOGOUT_SUCCESS_MESSAGE,
} from '../../src/auth/sessionMessages';
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

function renderAt(path: string, state: AuthState) {
  const tree = (s: AuthState) => (
    <AuthContext.Provider value={s}>
      <SessionProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>
  );
  const result = render(tree(state));
  return { setAuth: (s: AuthState) => act(() => result.rerender(tree(s))) };
}

beforeEach(() => {
  vi.mocked(signOutUser).mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('HU-105 Proteger el sistema interno', () => {
  it.each(['/contactos', '/posibles-ventas', '/avisos'])(
    'abrir %s sin sesión → ingreso con "Debe iniciar sesión para acceder al sistema."',
    (path) => {
      renderAt(path, signedOut);
      expect(screen.getByText(LOGIN_REQUIRED_MESSAGE)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Ingresar' })).toBeTruthy();
      expect(screen.queryByRole('banner')).toBeNull();
      expect(currentLocation.pathname).toBe('/ingreso');
    },
  );

  it('abrir la dirección raíz "/" muestra el ingreso sin ese mensaje (HU-101)', () => {
    renderAt('/', signedOut);
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeTruthy();
    expect(screen.queryByText(LOGIN_REQUIRED_MESSAGE)).toBeNull();
  });

  it('el mensaje no reaparece al recargar (se borra del historial)', () => {
    renderAt('/contactos', signedOut);
    expect(screen.getByText(LOGIN_REQUIRED_MESSAGE)).toBeTruthy();
    expect(currentLocation.state).toBeNull();
  });

  it('a los 30 min sin actividad la sesión se cierra sola y aparece el ingreso con el mensaje de inactividad', () => {
    vi.useFakeTimers({ now: new Date('2026-10-12T09:00:00-06:00') });
    const { setAuth } = renderAt('/contactos', active);
    expect(screen.getByRole('heading', { level: 1, name: 'Contactos' })).toBeTruthy();

    act(() => vi.advanceTimersByTime(30 * 60 * 1000 + 15 * 1000));
    expect(signOutUser).toHaveBeenCalledTimes(1);
    setAuth(signedOut); // Firebase confirma el cierre

    expect(screen.getByText(INACTIVITY_MESSAGE)).toBeTruthy();
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByText(LOGIN_REQUIRED_MESSAGE)).toBeNull();
    expect(screen.queryByText(LOGOUT_SUCCESS_MESSAGE)).toBeNull();
  });

  it('una sesión recordada pero vencida no muestra la pantalla interna ni un instante', () => {
    writeLastActivity(Date.now() - INACTIVITY_LIMIT_MS - 60 * 1000);
    const { setAuth } = renderAt('/contactos', active);

    expect(screen.queryByRole('heading', { level: 1, name: 'Contactos' })).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
    expect(signOutUser).toHaveBeenCalledTimes(1);

    setAuth(signedOut);
    expect(screen.getByText(INACTIVITY_MESSAGE)).toBeTruthy();
  });

  it('el aviso de inactividad no se repite después de mostrarse (ej. "Atrás" o recargar)', () => {
    vi.useFakeTimers({ now: new Date('2026-10-12T09:00:00-06:00') });
    const { setAuth } = renderAt('/contactos', active);
    act(() => vi.advanceTimersByTime(30 * 60 * 1000 + 15 * 1000));
    setAuth(signedOut);
    expect(screen.getByText(INACTIVITY_MESSAGE)).toBeTruthy();
    vi.useRealTimers();
    cleanup();

    // "Recarga": nueva app, misma pestaña (mismo localStorage)
    renderAt('/ingreso', signedOut);
    expect(screen.queryByText(INACTIVITY_MESSAGE)).toBeNull();
  });
});
