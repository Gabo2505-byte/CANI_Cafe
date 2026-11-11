// HU-106: textos y correo enmascarado de la recuperación de contraseña.
import { describe, expect, it } from 'vitest';
import { maskEmail, RECOVERY_MESSAGES, RESEND_WAIT_SECONDS, sentMessage } from '../../src/auth/passwordRecovery';

describe('HU-106 maskEmail', () => {
  it('solo deja ver la primera letra y lo que va después de "@"', () => {
    expect(maskEmail('dylan.mendez@gmail.com')).toBe('d*****@gmail.com');
  });

  it('usa siempre cinco asteriscos, sin revelar el largo del nombre', () => {
    expect(maskEmail('a@cani.cr')).toBe('a*****@cani.cr');
    expect(maskEmail('administracion.general@cani.cr')).toBe('a*****@cani.cr');
  });

  it('un correo sin "@" no se muestra', () => {
    expect(maskEmail('sin-arroba')).toBe('*****');
  });
});

describe('HU-106 mensajes', () => {
  it('usa los textos literales del criterio', () => {
    expect(RECOVERY_MESSAGES.emptyUsername).toBe('Ingrese su usuario.');
    expect(RECOVERY_MESSAGES.userNotFound).toBe('El usuario ingresado no existe.');
    expect(sentMessage('d*****@gmail.com')).toBe('Se envió un enlace de recuperación a d*****@gmail.com.');
    expect(RESEND_WAIT_SECONDS).toBe(60);
  });
});
