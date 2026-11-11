// @vitest-environment jsdom
// HU-106: Solicitar la recuperación de la contraseña
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { User as FirebaseUser } from 'firebase/auth';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/AppRoutes';
import { AuthContext } from '../../src/auth/AuthContext';
import { requestPasswordReset } from '../../src/auth/requestPasswordReset';
import { SessionProvider } from '../../src/auth/SessionContext';
import type { AuthState } from '../../src/auth/useAuthUser';

vi.mock('../../src/auth/requestPasswordReset', () => ({ requestPasswordReset: vi.fn() }));
vi.mock('../../src/auth/signInWithUsername', () => ({ signInWithUsername: vi.fn() }));
vi.mock('../../src/auth/signOutUser', () => ({ signOutUser: vi.fn() }));

const signedOut: AuthState = { status: 'signedOut' };

function renderAt(path: string, state: AuthState = signedOut) {
  return render(
    <AuthContext.Provider value={state}>
      <SessionProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </SessionProvider>
    </AuthContext.Provider>,
  );
}

/** Escribe el usuario y presiona "Enviar enlace", esperando la respuesta. */
async function submit(username: string) {
  fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: username } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
  });
}

beforeEach(() => {
  vi.mocked(requestPasswordReset).mockReset().mockResolvedValue({ ok: true, maskedEmail: 'd*****@gmail.com' });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('HU-106 Solicitar la recuperación de la contraseña', () => {
  it('"¿Olvidó su contraseña?" abre "Recuperar contraseña" con Usuario, Enviar enlace y Volver al inicio de sesión', () => {
    renderAt('/ingreso');
    fireEvent.click(screen.getByRole('link', { name: '¿Olvidó su contraseña?' }));
    expect(screen.getByRole('heading', { name: 'Recuperar contraseña' })).toBeTruthy();
    expect(screen.getByLabelText('Usuario')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver al inicio de sesión' })).toBeTruthy();
  });

  it('"Volver al inicio de sesión" regresa a la pantalla de ingreso', () => {
    renderAt('/recuperar-contrasena');
    fireEvent.click(screen.getByRole('link', { name: 'Volver al inicio de sesión' }));
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeTruthy();
  });

  it('usuario vacío o inexistente: muestra el mensaje que devuelve la solicitud', async () => {
    vi.mocked(requestPasswordReset).mockResolvedValueOnce({ ok: false, message: 'Ingrese su usuario.' });
    renderAt('/recuperar-contrasena');
    await submit('');
    expect(screen.getByRole('alert').textContent).toBe('Ingrese su usuario.');
    expect(screen.getByLabelText('Usuario').getAttribute('aria-invalid')).toBe('true');

    vi.mocked(requestPasswordReset).mockResolvedValueOnce({ ok: false, message: 'El usuario ingresado no existe.' });
    await submit('nadie');
    expect(screen.getByRole('alert').textContent).toBe('El usuario ingresado no existe.');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('usuario existente: pide el envío y muestra el correo enmascarado', async () => {
    renderAt('/recuperar-contrasena');
    await submit('Admin');
    expect(requestPasswordReset).toHaveBeenCalledWith('Admin');
    expect(screen.getByRole('status').textContent).toBe('Se envió un enlace de recuperación a d*****@gmail.com.');
  });

  it('"Reenviar enlace" muestra los segundos que faltan y solo se puede usar después de 60 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    renderAt('/recuperar-contrasena');
    await submit('admin');

    const resend = () => screen.getByRole('button', { name: /^Reenviar enlace/ }) as HTMLButtonElement;
    expect(resend().textContent).toBe('Reenviar enlace (60 s)');
    expect(resend().disabled).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(59_000);
    });
    expect(resend().textContent).toBe('Reenviar enlace (1 s)');
    expect(resend().disabled).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    expect(resend().textContent).toBe('Reenviar enlace');
    expect(resend().disabled).toBe(false);

    await act(async () => {
      fireEvent.click(resend());
    });
    expect(requestPasswordReset).toHaveBeenCalledTimes(2);
    expect(requestPasswordReset).toHaveBeenLastCalledWith('admin');
    expect(resend().textContent).toBe('Reenviar enlace (60 s)');
  });

  it('con sesión activa no muestra la recuperación y pasa al sistema', () => {
    const active: AuthState = {
      status: 'active',
      firebaseUser: { uid: 'u1' } as FirebaseUser,
      profile: { id: 'u1', username: 'admin', email: 'admin@example.com', active: true },
    };
    renderAt('/recuperar-contrasena', active);
    expect(screen.queryByRole('heading', { name: 'Recuperar contraseña' })).toBeNull();
  });
});
