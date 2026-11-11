// HU-107: lectura del enlace y reglas de vencimiento (sin Firebase).
import { describe, expect, it } from 'vitest';
import {
  isResetRequestCurrent,
  newResetId,
  parseResetLink,
  RESET_LINK_MESSAGES,
  RESET_LINK_MINUTES,
  resetActionCodeSettings,
  resetLinkExpiresAt,
} from '../../src/auth/passwordResetLinks';

const at = (ms: number) => ({ toMillis: () => ms });
const T0 = Date.UTC(2026, 10, 3, 1, 0, 0);
const MIN = 60 * 1000;

describe('HU-107 enlace del correo', () => {
  it('mensaje literal del criterio', () => {
    expect(RESET_LINK_MESSAGES.invalid).toBe('El enlace ya no es válido. Solicite uno nuevo.');
    expect(RESET_LINK_MINUTES).toBe(30);
  });

  it('el rid es aleatorio, de 32 caracteres hexadecimales', () => {
    const a = newResetId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(newResetId()).not.toBe(a);
  });

  it('la continueUrl lleva a /nueva-contrasena con el usuario normalizado y el rid', () => {
    const { url } = resetActionCodeSettings('https://admin.cani.cr', ' Admin ', 'abc');
    expect(url).toBe('https://admin.cani.cr/nueva-contrasena?u=admin&rid=abc');
  });

  it('lee el enlace de Firebase (con continueUrl) y el de la acción personalizada', () => {
    const continueUrl = encodeURIComponent('https://admin.cani.cr/nueva-contrasena?u=admin&rid=abc');
    expect(parseResetLink(`?mode=resetPassword&oobCode=XYZ&apiKey=k&continueUrl=${continueUrl}&lang=es`)).toEqual({
      oobCode: 'XYZ',
      username: 'admin',
      rid: 'abc',
    });
    expect(parseResetLink('?mode=resetPassword&oobCode=XYZ&u=admin&rid=abc')).toEqual({
      oobCode: 'XYZ',
      username: 'admin',
      rid: 'abc',
    });
  });

  it('un enlace incompleto o de otra acción no se acepta', () => {
    expect(parseResetLink('')).toBeNull();
    expect(parseResetLink('?mode=verifyEmail&oobCode=XYZ&u=admin&rid=abc')).toBeNull();
    expect(parseResetLink('?mode=resetPassword&u=admin&rid=abc')).toBeNull();
    expect(parseResetLink('?mode=resetPassword&oobCode=XYZ&continueUrl=no-es-url')).toBeNull();
  });

  it('sirve antes de 30 minutos y deja de servir a los 30', () => {
    const req = { rid: 'abc', used: false, requestedAt: at(T0) };
    expect(isResetRequestCurrent(req, 'abc', T0 + 29 * MIN)).toBe(true);
    expect(isResetRequestCurrent(req, 'abc', T0 + 30 * MIN)).toBe(false);
    expect(resetLinkExpiresAt(at(T0)).getTime()).toBe(T0 + 30 * MIN);
  });

  it('no sirve si se pidió otro (rid distinto), si ya se usó o si no hay registro', () => {
    expect(isResetRequestCurrent({ rid: 'nuevo', used: false, requestedAt: at(T0) }, 'abc', T0)).toBe(false);
    expect(isResetRequestCurrent({ rid: 'abc', used: true, requestedAt: at(T0) }, 'abc', T0)).toBe(false);
    expect(isResetRequestCurrent({ rid: 'abc', used: false, requestedAt: null }, 'abc', T0)).toBe(false);
    expect(isResetRequestCurrent(null, 'abc', T0)).toBe(false);
  });
});
