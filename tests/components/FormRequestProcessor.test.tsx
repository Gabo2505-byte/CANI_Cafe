// @vitest-environment jsdom
// HU-502 y HU-503: el procesador del formulario corre solo con la sesión activa y procesa una solicitud a la vez.
import { cleanup, render, waitFor } from '@testing-library/react';
import type { User as FirebaseUser } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../src/auth/AuthContext';
import type { AuthState } from '../../src/auth/useAuthUser';
import { listenPendingFormRequests, processFormRequest } from '../../src/formRequests/formRequestsApi';
import { useFormRequestProcessor } from '../../src/formRequests/useFormRequestProcessor';

// formRequestsApi ya está mockeado en tests/setup.ts.

const active: AuthState = {
  status: 'active',
  firebaseUser: { uid: 'admin-1' } as FirebaseUser,
  profile: { id: 'admin-1', username: 'admin', email: 'admin@example.com', active: true },
};

function Probe() {
  useFormRequestProcessor();
  return null;
}

const renderWith = (auth: AuthState) =>
  render(
    <AuthContext.Provider value={auth}>
      <Probe />
    </AuthContext.Provider>,
  );

let emit: (ids: string[]) => void;
const unsubscribe = vi.fn();

beforeEach(() => {
  unsubscribe.mockReset();
  vi.mocked(listenPendingFormRequests).mockReset().mockImplementation((onPending) => {
    emit = onPending;
    return unsubscribe;
  });
  vi.mocked(processFormRequest).mockReset().mockResolvedValue({ status: 'processed', outcome: 'created', contactId: 'c' });
});
afterEach(cleanup);

describe('useFormRequestProcessor', () => {
  it('sin sesión activa no escucha ni procesa', () => {
    renderWith({ status: 'signedOut' });
    renderWith({ status: 'loading' });
    expect(listenPendingFormRequests).not.toHaveBeenCalled();
  });

  it('con sesión activa procesa las pendientes una por una, en orden, con el uid del administrador', async () => {
    let finishFirst!: () => void;
    vi.mocked(processFormRequest).mockImplementationOnce(
      () => new Promise((resolve) => (finishFirst = () => resolve({ status: 'processed', outcome: 'created', contactId: 'c' }))),
    );
    renderWith(active);
    await waitFor(() => expect(listenPendingFormRequests).toHaveBeenCalled());
    emit(['s1', 's2']);
    await waitFor(() => expect(processFormRequest).toHaveBeenCalledTimes(1));
    expect(processFormRequest).toHaveBeenLastCalledWith('s1', 'admin-1');
    // Mientras la primera no termina, no empieza la segunda.
    await new Promise((r) => setTimeout(r, 20));
    expect(processFormRequest).toHaveBeenCalledTimes(1);
    finishFirst();
    await waitFor(() => expect(processFormRequest).toHaveBeenCalledTimes(2));
    expect(processFormRequest).toHaveBeenLastCalledWith('s2', 'admin-1');
  });

  it('si una falla, sigue con las demás (la fallida se reintenta cuando vence su reclamo)', async () => {
    vi.mocked(processFormRequest).mockRejectedValueOnce(new Error('unavailable'));
    renderWith(active);
    await waitFor(() => expect(listenPendingFormRequests).toHaveBeenCalled());
    emit(['s1', 's2']);
    await waitFor(() => expect(processFormRequest).toHaveBeenCalledTimes(2));
    expect(vi.mocked(processFormRequest).mock.calls.map((c) => c[0])).toEqual(['s1', 's2']);
    // Una nueva lista con la fallida todavía pendiente no la reintenta enseguida.
    emit(['s1']);
    await new Promise((r) => setTimeout(r, 20));
    expect(processFormRequest).toHaveBeenCalledTimes(2);
  });

  it('al salir de las pantallas internas deja de escuchar', async () => {
    const view = renderWith(active);
    await waitFor(() => expect(listenPendingFormRequests).toHaveBeenCalled());
    view.unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('con navigator.locks, escucha solo dentro del candado "cani-formRequests" y lo suelta al salir', async () => {
    let released = false;
    const request = vi.fn((_name: string, callback: () => Promise<void> | undefined) => {
      const held = callback();
      return Promise.resolve(held).then(() => {
        released = true;
      });
    });
    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });
    try {
      const view = renderWith(active);
      await waitFor(() => expect(listenPendingFormRequests).toHaveBeenCalled());
      expect(request).toHaveBeenCalledWith('cani-formRequests', expect.any(Function));
      expect(released).toBe(false);
      view.unmount();
      await waitFor(() => expect(released).toBe(true));
    } finally {
      delete (navigator as { locks?: unknown }).locks;
    }
  });
});
