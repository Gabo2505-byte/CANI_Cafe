// HU-403 y HU-501: validación del formulario "Envíenos su consulta" del sitio público (lógica pura).
import { describe, expect, it } from 'vitest';
import { isValidEmail, normalizeEmail } from '../../src/shared/validation/email';
import { parseQuantity } from '../../src/shared/validation/quantity';
import {
  hayErrores,
  LIMITES,
  MENSAJES,
  valoresIniciales,
  type ValoresFormulario,
  validarFormulario,
} from '../../sitio-publico/src/formulario/validacion';

const valido = (parcial: Partial<ValoresFormulario> = {}) =>
  valoresIniciales({ nombre: 'Ana Pérez', correo: 'ana@example.com', intereses: { 'prod-1': '1' }, ...parcial });

describe('HU-403 valores y topes', () => {
  it('empieza vacío, con Costa Rica elegida y sin productos', () => {
    expect(valoresIniciales()).toEqual({ nombre: '', correo: '', paisTelefono: 'CR', telefono: '', intereses: {}, mensaje: '' });
  });

  it('los topes son 100 (nombre y correo) y 1000 (mensaje)', () => {
    expect(LIMITES).toEqual({ nombre: 100, correo: 100, mensaje: 1000 });
  });
});

describe('HU-501 mensajes literales', () => {
  it('son exactamente los de los criterios', () => {
    expect(MENSAJES).toEqual({
      obligatorio: 'Este campo es obligatorio.',
      correoInvalido: 'Ingrese un correo electrónico válido.',
      sinProductos: 'Seleccione al menos un producto.',
      cantidad: 'Ingrese una cantidad entre 1 y 9999.',
      revisar: 'Revise los campos marcados en rojo.',
    });
  });
});

describe('HU-501 criterio 2: datos obligatorios', () => {
  it('un formulario completo no tiene errores', () => {
    const errores = validarFormulario(valido());
    expect(hayErrores(errores)).toBe(false);
  });

  it('nombre vacío o solo espacios: "Este campo es obligatorio."', () => {
    expect(validarFormulario(valido({ nombre: '' })).nombre).toBe('Este campo es obligatorio.');
    expect(validarFormulario(valido({ nombre: '   ' })).nombre).toBe('Este campo es obligatorio.');
  });

  it('correo vacío: "Este campo es obligatorio."', () => {
    expect(validarFormulario(valido({ correo: '' })).correo).toBe('Este campo es obligatorio.');
    expect(validarFormulario(valido({ correo: '  ' })).correo).toBe('Este campo es obligatorio.');
  });

  it('ningún producto marcado: "Seleccione al menos un producto."', () => {
    const errores = validarFormulario(valido({ intereses: {} }));
    expect(errores.intereses).toBe('Seleccione al menos un producto.');
    expect(hayErrores(errores)).toBe(true);
  });

  it('el teléfono y el mensaje son opcionales', () => {
    const errores = validarFormulario(valido({ telefono: '', mensaje: '' }));
    expect(errores.telefono).toBeUndefined();
    expect(hayErrores(errores)).toBe(false);
  });

  it('un formulario vacío marca nombre, correo y productos, pero no teléfono', () => {
    const errores = validarFormulario(valoresIniciales());
    expect(Object.keys(errores).sort()).toEqual(['cantidades', 'correo', 'intereses', 'nombre']);
  });
});

describe('HU-501 criterio 3: correo nombre@dominio.com', () => {
  it.each(['ana', 'ana@', 'ana@example', '@example.com', 'ana@@example.com', 'a na@example.com', 'ana@exa mple.com'])(
    '"%s" no es válido',
    (correo) => {
      expect(validarFormulario(valido({ correo })).correo).toBe('Ingrese un correo electrónico válido.');
    },
  );

  it.each(['ana@example.com', 'Ana.Perez+cafe@Example.CO.cr', '  ana@example.com  '])('"%s" es válido', (correo) => {
    expect(validarFormulario(valido({ correo })).correo).toBeUndefined();
  });

  it('el correo se normaliza a minúsculas y sin espacios alrededor', () => {
    expect(normalizeEmail('  Ana@Example.COM ')).toBe('ana@example.com');
    expect(isValidEmail('ana@example.com')).toBe(true);
  });
});

describe('HU-501 criterio 4: teléfono por país', () => {
  it('Costa Rica: 8 dígitos (con espacios o guion se cuentan solo los números)', () => {
    expect(validarFormulario(valido({ telefono: '88881234' })).telefono).toBeUndefined();
    expect(validarFormulario(valido({ telefono: '8888-1234' })).telefono).toBeUndefined();
    expect(validarFormulario(valido({ telefono: '8888 1234' })).telefono).toBeUndefined();
  });

  it.each(['1234567', '888812345', '12'])('Costa Rica con "%s": "El teléfono debe tener 8 dígitos."', (telefono) => {
    expect(validarFormulario(valido({ telefono })).telefono).toBe('El teléfono debe tener 8 dígitos.');
  });

  it('otro país: de 6 a 14 dígitos', () => {
    for (const telefono of ['123456', '30555501041234', '3055550104']) {
      expect(validarFormulario(valido({ paisTelefono: 'US', telefono })).telefono).toBeUndefined();
    }
  });

  it.each(['12345', '123456789012345'])('otro país con "%s": "El teléfono debe tener entre 6 y 14 dígitos."', (telefono) => {
    expect(validarFormulario(valido({ paisTelefono: 'US', telefono })).telefono).toBe(
      'El teléfono debe tener entre 6 y 14 dígitos.',
    );
  });

  it('texto sin números también se revisa (no se ignora en silencio)', () => {
    expect(validarFormulario(valido({ telefono: 'abc' })).telefono).toBe('El teléfono debe tener 8 dígitos.');
  });

  it('el mismo número es válido o no según el país elegido', () => {
    expect(validarFormulario(valido({ paisTelefono: 'CR', telefono: '123456' })).telefono).toBeDefined();
    expect(validarFormulario(valido({ paisTelefono: 'MX', telefono: '123456' })).telefono).toBeUndefined();
  });
});

describe('HU-501 criterio 4: cantidad de 1 a 9999', () => {
  it.each(['1', '9999', '250', ' 5 '])('"%s" es válida', (cantidad) => {
    const errores = validarFormulario(valido({ intereses: { 'prod-1': cantidad } }));
    expect(errores.cantidades).toEqual({});
  });

  it.each(['', '0', '10000', '-1', '1.5', 'abc', '1e3', '12 3'])('"%s": "Ingrese una cantidad entre 1 y 9999."', (cantidad) => {
    const errores = validarFormulario(valido({ intereses: { 'prod-1': cantidad } }));
    expect(errores.cantidades).toEqual({ 'prod-1': 'Ingrese una cantidad entre 1 y 9999.' });
    expect(hayErrores(errores)).toBe(true);
  });

  it('el error es por producto: solo se marca el que está mal', () => {
    const errores = validarFormulario(valido({ intereses: { a: '3', b: '0', c: '20000' } }));
    expect(Object.keys(errores.cantidades)).toEqual(['b', 'c']);
  });

  it('parseQuantity devuelve el número o null', () => {
    expect(parseQuantity('12')).toBe(12);
    expect(parseQuantity('0')).toBeNull();
    expect(parseQuantity('10000')).toBeNull();
  });
});
