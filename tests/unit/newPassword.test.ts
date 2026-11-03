// HU-108: regla de la nueva contraseña y mensajes (sin Firebase).
import { describe, expect, it } from 'vitest';
import { isValidNewPassword, NEW_PASSWORD_MESSAGES, validateNewPassword } from '../../src/auth/newPassword';

describe('HU-108 regla de la nueva contraseña', () => {
  it('mensajes literales de los criterios', () => {
    expect(NEW_PASSWORD_MESSAGES.weak).toBe('La contraseña debe tener al menos 8 caracteres, una letra y un número.');
    expect(NEW_PASSWORD_MESSAGES.mismatch).toBe('Las contraseñas no coinciden.');
    expect(NEW_PASSWORD_MESSAGES.saved).toBe('Contraseña actualizada correctamente. Ya puede iniciar sesión.');
  });

  it.each(['cafe2026', 'abcdefg1', '1234567a', 'Café 2026', 'ñandu123', 'una clave larga 9'])('cumple: %s', (pw) => {
    expect(isValidNewPassword(pw)).toBe(true);
  });

  it.each([
    ['', 'vacía'],
    ['abc123', 'corta'],
    ['abcdef1', '7 caracteres'],
    ['abcdefgh', 'sin número'],
    ['12345678', 'sin letra'],
    ['!!!!????', 'sin letra ni número'],
  ])('no cumple: "%s" (%s)', (pw) => {
    expect(isValidNewPassword(pw)).toBe(false);
  });

  it('cuenta caracteres, no unidades UTF-16', () => {
    // 7 caracteres (un emoji ocupa 2 unidades UTF-16): no llega a 8.
    expect(isValidNewPassword('ab1234😀')).toBe(false);
    expect(isValidNewPassword('ab12345😀')).toBe(true);
  });

  it('válida e iguales → sin errores', () => {
    expect(validateNewPassword('cafe2026', 'cafe2026')).toEqual({});
  });

  it('no cumple la regla → mensaje en el primer campo', () => {
    expect(validateNewPassword('corta1', 'corta1')).toEqual({ password: NEW_PASSWORD_MESSAGES.weak });
  });

  it('distintas → mensaje en la confirmación', () => {
    expect(validateNewPassword('cafe2026', 'cafe2027')).toEqual({ confirm: NEW_PASSWORD_MESSAGES.mismatch });
  });

  it('las dos fallas a la vez → los dos mensajes', () => {
    expect(validateNewPassword('abc', '')).toEqual({
      password: NEW_PASSWORD_MESSAGES.weak,
      confirm: NEW_PASSWORD_MESSAGES.mismatch,
    });
  });
});
