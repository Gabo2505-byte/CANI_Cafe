// HU-502 y HU-503: mientras el administrador tiene la sesión abierta, las solicitudes del formulario se procesan solas,
// en su navegador (CC-01, costo 0). Montado en AppLayout: solo existe en las pantallas internas.
import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { CLAIM_TTL_MS } from './formRequestProcessing';
import { listenPendingFormRequests, processFormRequest } from './formRequestsApi';

/** Nombre del candado del navegador: con varias pestañas abiertas, procesa una sola. */
export const FORM_REQUESTS_LOCK = 'cani-formRequests';

/** Cada cuánto se revisan otra vez las pendientes que fallaron (un reclamo vencido se puede retomar). */
const RETRY_EVERY_MS = 60 * 1000;

/**
 * Escucha las solicitudes pendientes y las procesa UNA POR UNA, en orden de envío.
 * - Un solo procesador por navegador: navigator.locks.request mantiene el candado mientras el hook está montado. Si
 *   otra pestaña ya lo tiene, esta espera; si esa se cierra, esta toma el relevo. Sin navigator.locks, corre sin candado.
 * - Entre navegadores distintos, el reclamo de cada solicitud (transacción) evita procesarla dos veces.
 * - Si una falla (por ejemplo, sin conexión), se vuelve a intentar después de que venza su reclamo (2 minutos).
 */
export function useFormRequestProcessor(): void {
  const auth = useAuth();
  const uid = auth.status === 'active' ? auth.firebaseUser.uid : null;

  useEffect(() => {
    if (!uid) return;
    let stopped = false;
    let releaseLock: (() => void) | null = null;
    let unsubscribe: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;
    let pending: string[] = [];
    let running = false;
    /** Cuándo falló cada una (para no reintentar antes de que venza su reclamo). */
    const failedAt = new Map<string, number>();

    async function drain() {
      if (running) return;
      running = true;
      try {
        while (!stopped) {
          const now = Date.now();
          const next = pending.find((id) => {
            const failed = failedAt.get(id);
            return failed === undefined || now - failed >= CLAIM_TTL_MS;
          });
          if (!next) break;
          pending = pending.filter((id) => id !== next);
          try {
            await processFormRequest(next, uid!);
            failedAt.delete(next);
          } catch {
            failedAt.set(next, Date.now());
          }
        }
      } finally {
        running = false;
      }
    }

    function start() {
      unsubscribe = listenPendingFormRequests((ids) => {
        pending = ids;
        void drain();
      });
      retryTimer = setInterval(() => void drain(), RETRY_EVERY_MS);
    }

    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks) {
      void locks
        .request(FORM_REQUESTS_LOCK, () => {
          if (stopped) return undefined;
          start();
          // El candado se mantiene hasta que el hook se desmonte.
          return new Promise<void>((resolve) => {
            releaseLock = resolve;
          });
        })
        .catch(() => {});
    } else {
      start();
    }

    return () => {
      stopped = true;
      unsubscribe?.();
      if (retryTimer) clearInterval(retryTimer);
      releaseLock?.();
    };
  }, [uid]);
}
