// @vitest-environment jsdom
// HU-105: temporizador de inactividad (30 minutos sin clic ni teclado)
import { act, cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INACTIVITY_LIMIT_MS, readLastActivity, writeLastActivity } from '../../src/auth/inactivity';
import { useInactivityTimeout } from '../../src/auth/useInactivityTimeout';

const MIN = 60 * 1000;
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-10-12T09:00:00-06:00') });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('HU-105 temporizador de inactividad', () => {
  it('no cierra a los 29:59 y sí al cumplir 30 minutos sin actividad', () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimeout(true, onTimeout));

    advance(30 * MIN - 1000);
    expect(onTimeout).not.toHaveBeenCalled();

    advance(15 * 1000); // la revisión es cada 15 s
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('un clic reinicia el contador', () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimeout(true, onTimeout));

    advance(20 * MIN);
    fireEvent.pointerDown(document.body);
    advance(25 * MIN); // 45 min desde el inicio, 25 desde el clic
    expect(onTimeout).not.toHaveBeenCalled();

    advance(5 * MIN + 15 * 1000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('escribir (teclado) reinicia el contador', () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimeout(true, onTimeout));

    advance(29 * MIN);
    fireEvent.keyDown(document.body, { key: 'a' });
    advance(10 * MIN);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('mover el mouse o hacer scroll NO cuenta como actividad', () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimeout(true, onTimeout));

    advance(20 * MIN);
    fireEvent.mouseMove(document.body);
    fireEvent.scroll(window);
    advance(10 * MIN + 15 * 1000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('la actividad en otra pestaña (localStorage compartido) también cuenta', () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimeout(true, onTimeout));

    advance(25 * MIN);
    writeLastActivity(); // otra pestaña registró un clic
    advance(25 * MIN);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('al abrir con una sesión recordada y vencida, se cierra de inmediato', () => {
    writeLastActivity(Date.now() - INACTIVITY_LIMIT_MS - MIN);
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimeout(true, onTimeout));
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('sin sesión no se cierra nada, pero los clics en el ingreso sí se registran', () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimeout(false, onTimeout));

    fireEvent.pointerDown(document.body);
    expect(readLastActivity()).toBe(Date.now());
    advance(60 * MIN);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
