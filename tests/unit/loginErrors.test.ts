import { describe, expect, it } from 'vitest';
import { LOGIN_MESSAGES, loginErrorFromAuth, validateLoginInput } from '../../src/auth/loginErrors';

describe('validateLoginInput', () => {
  it('sin errores cuando ambos campos tienen valor', () => {
    expect(validateLoginInput('admin', 'x')).toEqual({});
  });

  it('usuario con solo espacios cuenta como vacío', () => {
    expect(validateLoginInput('   ', 'x')).toEqual({ username: LOGIN_MESSAGES.emptyUsername });
  });

  it('ambos vacíos devuelve los dos mensajes', () => {
    expect(validateLoginInput('', '')).toEqual({
      username: LOGIN_MESSAGES.emptyUsername,
      password: LOGIN_MESSAGES.emptyPassword,
    });
  });
});

describe('loginErrorFromAuth', () => {
  it.each(['auth/user-not-found', 'auth/invalid-email'])('%s → usuario no existe', (code) => {
    expect(loginErrorFromAuth({ code })).toEqual({ username: LOGIN_MESSAGES.userNotFound });
  });

  it.each(['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials'])(
    '%s → contraseña incorrecta',
    (code) => {
      expect(loginErrorFromAuth({ code })).toEqual({ password: LOGIN_MESSAGES.wrongPassword });
    },
  );

  it('otros errores no se traducen', () => {
    expect(loginErrorFromAuth({ code: 'auth/network-request-failed' })).toBeNull();
    expect(loginErrorFromAuth(null)).toBeNull();
  });
});
