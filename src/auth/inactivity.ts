// HU-105: cierre de sesión por inactividad (30 minutos sin clic ni teclado).
// Se guarda la hora de la última actividad en localStorage (no un contador) para que:
//  - la actividad en otra pestaña también cuente,
//  - el tiempo con la computadora suspendida se mida bien,
//  - al reabrir el navegador después de 30 min la sesión se cierre (Firebase la recuerda).
export const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
export const INACTIVITY_CHECK_MS = 15 * 1000;

/** Solo "dar clic" y "escribir" cuentan como actividad (mover el mouse o hacer scroll no). */
export const ACTIVITY_EVENTS = ['pointerdown', 'keydown'] as const;

const LAST_ACTIVITY_KEY = 'caniCafe.lastActivityAt';
const SIGN_OUT_REASON_KEY = 'caniCafe.signOutReason';

export type SignOutReason = 'user' | 'inactivity';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readLastActivity(): number | null {
  const raw = storage()?.getItem(LAST_ACTIVITY_KEY);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : null;
}

export function writeLastActivity(at: number = Date.now()): void {
  storage()?.setItem(LAST_ACTIVITY_KEY, String(at));
}

export function isInactive(lastActivityAt: number, now: number = Date.now()): boolean {
  return now - lastActivityAt >= INACTIVITY_LIMIT_MS;
}

/** El motivo "inactividad" se guarda para que lo vean otras pestañas y sobreviva a una recarga. */
export function readStoredSignOutReason(): SignOutReason | null {
  return storage()?.getItem(SIGN_OUT_REASON_KEY) === 'inactivity' ? 'inactivity' : null;
}

export function storeSignOutReason(reason: SignOutReason | null): void {
  if (reason === 'inactivity') storage()?.setItem(SIGN_OUT_REASON_KEY, reason);
  else storage()?.removeItem(SIGN_OUT_REASON_KEY);
}
