import { useEffect, useRef } from 'react';
import {
  ACTIVITY_EVENTS,
  INACTIVITY_CHECK_MS,
  isInactive,
  readLastActivity,
  writeLastActivity,
} from './inactivity';

/**
 * Registra la actividad (clic / teclado) siempre, incluso en la pantalla de ingreso, para que un
 * ingreso nuevo arranque con la hora actual. Mientras `active` sea true, revisa periódicamente y
 * llama a `onTimeout` cuando pasan 30 minutos sin actividad.
 */
export function useInactivityTimeout(active: boolean, onTimeout: () => void): void {
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    const markActivity = () => writeLastActivity();
    for (const type of ACTIVITY_EVENTS) document.addEventListener(type, markActivity, true);
    return () => {
      for (const type of ACTIVITY_EVENTS) document.removeEventListener(type, markActivity, true);
    };
  }, []);

  useEffect(() => {
    if (!active) return;

    let fired = false;
    const check = () => {
      if (fired) return;
      const last = readLastActivity();
      if (last === null) {
        writeLastActivity();
        return;
      }
      if (isInactive(last)) {
        fired = true;
        onTimeoutRef.current();
      }
    };

    check(); // al abrir con una sesión recordada que ya venció
    const interval = window.setInterval(check, INACTIVITY_CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, [active]);
}
