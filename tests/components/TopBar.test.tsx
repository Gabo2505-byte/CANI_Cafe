// @vitest-environment jsdom
// HU-103: Navegar por el sistema interno
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User as FirebaseUser } from 'firebase/auth';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import type { AuthState } from '../../src/auth/useAuthUser';

vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));

const active: AuthState = {
  status: 'active',
  firebaseUser: { uid: 'u1' } as FirebaseUser,
  profile: { id: 'u1', username: 'admin', email: 'admin@example.com', active: true },
};

function renderAt(path: string, state: AuthState = active) {
  return render(
    <AuthContext.Provider value={state}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const topBar = () => screen.getByRole('banner');
const option = (name: string) => within(topBar()).getByRole('link', { name });

afterEach(cleanup);

describe('HU-103 Navegar por el sistema interno', () => {
  it.each(['/contactos', '/posibles-ventas', '/avisos'])('la pantalla %s tiene la barra arriba', (path) => {
    const { container } = renderAt(path);
    expect(container.querySelector('header.topbar')).toBe(container.firstElementChild);
  });

  it('la pantalla de ingreso no lleva barra (no es pantalla interna)', () => {
    renderAt('/ingreso', { status: 'signedOut' });
    expect(screen.queryByRole('banner')).toBeNull();
  });

  it('muestra de izquierda a derecha: CANI Café, Contactos, Posibles ventas, Avisos y Cerrar sesión', () => {
    renderAt('/contactos');
    const items = [...topBar().querySelectorAll('a, button')].map((el) => el.textContent);
    expect(items).toEqual(['CANI Café', 'Contactos', 'Posibles ventas', 'Avisos', 'Cerrar sesión']);
  });

  it.each([
    ['Contactos', '/avisos'],
    ['Posibles ventas', '/contactos'],
    ['Avisos', '/contactos'],
  ])('clic en "%s" abre esa pantalla y la opción queda resaltada', async (name, startPath) => {
    const user = userEvent.setup();
    renderAt(startPath);
    await user.click(option(name));

    expect(screen.getByRole('heading', { level: 1, name })).toBeTruthy();
    expect(option(name).getAttribute('aria-current')).toBe('page');
    expect(option(name).classList.contains('active')).toBe(true);
    const others = ['Contactos', 'Posibles ventas', 'Avisos'].filter((n) => n !== name);
    for (const other of others) expect(option(other).getAttribute('aria-current')).toBeNull();
  });

  it('clic en "CANI Café" abre la pantalla Contactos', async () => {
    const user = userEvent.setup();
    renderAt('/avisos');
    await user.click(option('CANI Café'));

    expect(screen.getByRole('heading', { level: 1, name: 'Contactos' })).toBeTruthy();
    expect(option('Contactos').getAttribute('aria-current')).toBe('page');
  });

  it('la barra tiene el botón "Cerrar sesión"', () => {
    renderAt('/contactos');
    expect(within(topBar()).getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
  });
});
