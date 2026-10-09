import { describe, expect, it } from 'vitest';
import { loginPathFor, safeRedirect } from '../../src/app/routes';
import { usernameToAuthEmail } from '../../src/auth/username';

describe('safeRedirect', () => {
  it('acepta rutas internas', () => {
    expect(safeRedirect('/ventas/sale-001?tab=notas')).toBe('/ventas/sale-001?tab=notas');
  });

  it.each([null, '', 'https://otro-sitio.com', '//otro-sitio.com', '/\\otro-sitio.com', '/ingreso', '/ingreso?x=1', '/'])(
    'manda a Contactos ante %s',
    (target) => {
      expect(safeRedirect(target)).toBe('/contactos');
    },
  );
});

describe('loginPathFor', () => {
  it('recuerda la pantalla pedida', () => {
    expect(loginPathFor('/ventas?x=1')).toBe('/ingreso?redirect=%2Fventas%3Fx%3D1');
  });

  it('no agrega redirect para la pantalla por defecto', () => {
    expect(loginPathFor('/')).toBe('/ingreso');
    expect(loginPathFor('/contactos')).toBe('/ingreso');
  });
});

describe('usernameToAuthEmail', () => {
  it('normaliza el usuario', () => {
    expect(usernameToAuthEmail('  Admin ')).toBe('admin@usuarios.cani-crm.local');
  });
});
