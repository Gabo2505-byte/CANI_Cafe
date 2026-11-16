// Partes puras del cargador de contactos (RT-02): CSV, validación de cada fila, repetidos y plan. Datos ficticios.
import { describe, expect, it } from 'vitest';
import {
  clasificacionDe,
  describirPlan,
  detectarSeparador,
  indexarExistentes,
  leerFilasCsv,
  MOTIVOS,
  paisDeCodigo,
  parsearCsv,
  planificar,
  validarFila,
  type Columna,
  type Existentes,
} from '../../scripts/produccion/contactos';

const SIN_EXISTENTES: Existentes = { correos: new Set(), telefonos: new Set() };
const fila = (parcial: Partial<Record<Columna, string>>): Record<Columna, string> => ({
  nombre_completo: 'Ana Prueba',
  correo: '',
  telefono: '',
  codigo_pais: '',
  direccion: '',
  clasificacion: '',
  ...parcial,
});
const motivoDe = (parcial: Partial<Record<Columna, string>>) => {
  const r = validarFila(fila(parcial));
  return 'motivo' in r ? r.motivo : null;
};
const ENCABEZADO = 'nombre_completo,correo,telefono,codigo_pais,direccion,clasificacion';

describe('CSV: separador y analizador', () => {
  it('detecta coma y punto y coma', () => {
    expect(detectarSeparador(`${ENCABEZADO}\nA,b@c.com,,,,`)).toBe(',');
    expect(detectarSeparador(ENCABEZADO.replaceAll(',', ';'))).toBe(';');
  });

  it('campos entre comillas con separador, comilla doble y salto de línea', () => {
    const texto = 'a,b\n"Pérez, Ana","dice ""hola"""\n"línea 1\nlínea 2",x';
    expect(parsearCsv(texto, ',')).toEqual([['a', 'b'], ['Pérez, Ana', 'dice "hola"'], ['línea 1\nlínea 2', 'x']]);
  });

  it('acepta CRLF y un último registro sin salto de línea; ignora líneas vacías', () => {
    expect(parsearCsv('a,b\r\n\r\n1,2', ',')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('comillas sin cerrar abortan', () => {
    expect(() => parsearCsv('a,b\n"x,y', ',')).toThrow(/comillas sin cerrar/);
  });
});

describe('leerFilasCsv', () => {
  it('lee con coma, con BOM y numera las filas desde 2 (el encabezado es la 1)', () => {
    const filas = leerFilasCsv(`﻿${ENCABEZADO}\r\nAna Prueba,ANA@Ejemplo.com,88881111,506,"Calle 1, Naranjo",Cliente\r\nLuis Prueba,,,,,`);
    expect(filas.map((f) => f.fila)).toEqual([2, 3]);
    expect(filas[0].valores).toEqual({
      nombre_completo: 'Ana Prueba',
      correo: 'ANA@Ejemplo.com',
      telefono: '88881111',
      codigo_pais: '506',
      direccion: 'Calle 1, Naranjo',
      clasificacion: 'Cliente',
    });
  });

  it('lee con punto y coma', () => {
    const filas = leerFilasCsv(`${ENCABEZADO.replaceAll(',', ';')}\nAna Prueba;ana@ejemplo.com;;;;`);
    expect(filas).toHaveLength(1);
    expect(filas[0].valores.correo).toBe('ana@ejemplo.com');
  });

  it('solo nombre_completo es obligatorio como columna; el orden y las demás columnas pueden faltar', () => {
    const filas = leerFilasCsv('Correo,Nombre_Completo\nana@ejemplo.com,Ana Prueba');
    expect(filas[0].valores).toMatchObject({ nombre_completo: 'Ana Prueba', correo: 'ana@ejemplo.com', telefono: '' });
  });

  it('la numeración cuenta las filas vacías, que se ignoran', () => {
    const filas = leerFilasCsv(`${ENCABEZADO}\n,,,,,\nAna Prueba,a@b.com,,,,`);
    expect(filas.map((f) => f.fila)).toEqual([3]);
  });

  it('aborta: sin nombre_completo, columna desconocida o repetida, archivo vacío y texto que no es UTF-8', () => {
    expect(() => leerFilasCsv('correo,telefono\na@b.com,')).toThrow(/Falta la columna nombre_completo/);
    expect(() => leerFilasCsv('nombre_completo,edad\nAna,3')).toThrow(/Columna desconocida .*edad/);
    expect(() => leerFilasCsv('nombre_completo,correo,correo\nAna,a@b.com,c@d.com')).toThrow(/repetida/);
    expect(() => leerFilasCsv('')).toThrow(/vacío/);
    expect(() => leerFilasCsv(`${ENCABEZADO}\nJos� Prueba,a@b.com,,,,`)).toThrow(/UTF-8/);
  });
});

describe('validarFila', () => {
  it('forma del documento: igual al de la app, activo, origen "carga_inicial", correo en minúsculas', () => {
    const r = validarFila(fila({ nombre_completo: '  Álvaro Prueba ', correo: ' ALVARO@Ejemplo.COM ', telefono: '8888-1111', direccion: ' Naranjo ' }));
    expect(r).toEqual({
      contacto: {
        fullName: 'Álvaro Prueba',
        nameSortKey: 'alvaro prueba',
        email: 'alvaro@ejemplo.com',
        phoneCountry: 'CR',
        phoneNumber: '88881111',
        address: 'Naranjo',
        classification: 'persona_interesada',
        status: 'activo',
        origin: 'carga_inicial',
      },
    });
  });

  it('lo vacío queda en null y el código de país vacío es +506 (CR)', () => {
    const r = validarFila(fila({ correo: 'ana@ejemplo.com' }));
    expect(r).toMatchObject({ contacto: { phoneCountry: null, phoneNumber: null, address: null } });
    expect(validarFila(fila({ telefono: '88881111' }))).toMatchObject({ contacto: { phoneCountry: 'CR', email: null } });
  });

  it('código de país: 506 explícito, "+1" (US) y otro país con 6 a 14 dígitos', () => {
    expect(validarFila(fila({ telefono: '88881111', codigo_pais: '506' }))).toMatchObject({ contacto: { phoneCountry: 'CR' } });
    expect(validarFila(fila({ telefono: '3055551234', codigo_pais: '+1' }))).toMatchObject({
      contacto: { phoneCountry: 'US', phoneNumber: '3055551234' },
    });
    expect(validarFila(fila({ telefono: '123456', codigo_pais: '34' }))).toMatchObject({ contacto: { phoneCountry: 'ES' } });
  });

  it('clasificación: por defecto "Persona interesada"; sin distinguir mayúsculas ni tildes', () => {
    expect(clasificacionDe('')).toBe('persona_interesada');
    expect(clasificacionDe('PERSONA INTERESADA')).toBe('persona_interesada');
    expect(clasificacionDe('cliente')).toBe('cliente');
    expect(clasificacionDe('CLIENTE')).toBe('cliente');
    expect(clasificacionDe('Persona interesáda')).toBe('persona_interesada');
    expect(clasificacionDe('Distribuidor')).toBeNull();
    expect(validarFila(fila({ correo: 'a@b.com', clasificacion: 'Cliente' }))).toMatchObject({ contacto: { classification: 'cliente' } });
  });

  it('motivo: sin nombre completo', () => {
    expect(motivoDe({ nombre_completo: '   ', correo: 'a@b.com' })).toBe(MOTIVOS.sinNombre);
  });

  it('motivo: sin correo ni teléfono', () => {
    expect(motivoDe({})).toBe(MOTIVOS.sinCorreoNiTelefono);
  });

  it('motivo: correo inválido (aunque haya un teléfono válido)', () => {
    expect(motivoDe({ correo: 'sin-arroba', telefono: '88881111' })).toBe(MOTIVOS.correoInvalido);
    expect(motivoDe({ correo: 'a b@c.com' })).toBe(MOTIVOS.correoInvalido);
  });

  it('motivo: teléfono de largo inválido (8 en Costa Rica; 6 a 14 en otros países)', () => {
    expect(motivoDe({ telefono: '8888111' })).toBe(MOTIVOS.telefonoCostaRica);
    expect(motivoDe({ telefono: '888811112' })).toBe(MOTIVOS.telefonoCostaRica);
    expect(motivoDe({ correo: 'a@b.com', telefono: '1234' })).toBe(MOTIVOS.telefonoCostaRica); // el correo válido no lo salva
    expect(motivoDe({ telefono: '12345', codigo_pais: '1' })).toBe(MOTIVOS.telefonoOtroPais);
    expect(motivoDe({ telefono: '123456789012345', codigo_pais: '1' })).toBe(MOTIVOS.telefonoOtroPais);
    expect(motivoDe({ telefono: 'abc' })).toBe(MOTIVOS.telefonoSinDigitos);
  });

  it('motivo: código de país inválido o que no existe; la clasificación desconocida', () => {
    expect(motivoDe({ telefono: '88881111', codigo_pais: 'CR' })).toBe(MOTIVOS.codigoPaisInvalido);
    expect(motivoDe({ telefono: '88881111', codigo_pais: '12345' })).toBe(MOTIVOS.codigoPaisInvalido);
    expect(motivoDe({ telefono: '88881111', codigo_pais: '999' })).toBe(MOTIVOS.codigoPaisDesconocido);
    expect(motivoDe({ correo: 'a@b.com', clasificacion: 'Otro' })).toBe(MOTIVOS.clasificacionInvalida);
  });

  it('motivo: largos máximos del sistema (nombre 100, correo 100, dirección 250)', () => {
    expect(motivoDe({ nombre_completo: 'A'.repeat(101), correo: 'a@b.com' })).toBe(MOTIVOS.nombreLargo);
    expect(motivoDe({ correo: `${'a'.repeat(95)}@b.com` })).toBe(MOTIVOS.correoLargo);
    expect(motivoDe({ correo: 'a@b.com', direccion: 'x'.repeat(251) })).toBe(MOTIVOS.direccionLarga);
    expect(motivoDe({ nombre_completo: 'A'.repeat(100), correo: 'a@b.com', direccion: 'x'.repeat(250) })).toBeNull();
  });

  it('el código de país sin teléfono se ignora', () => {
    expect(validarFila(fila({ correo: 'a@b.com', codigo_pais: '999' }))).toMatchObject({ contacto: { phoneCountry: null } });
  });
});

describe('paisDeCodigo', () => {
  it('506 → CR; +1 → US; códigos que no existen → null', () => {
    expect(paisDeCodigo('506')).toBe('CR');
    expect(paisDeCodigo('1')).toBe('US');
    expect(paisDeCodigo('0506')).toBe('CR');
    expect(paisDeCodigo('999')).toBeNull();
  });
});

describe('planificar', () => {
  const filas = (...lista: Partial<Record<Columna, string>>[]) => lista.map((v, i) => ({ fila: i + 2, valores: fila(v) }));

  it('conserva el orden del archivo y reporta fila, nombre y motivo de las omitidas', () => {
    const plan = planificar(
      filas(
        { nombre_completo: 'Ana Uno', correo: 'ana@ejemplo.com' },
        { nombre_completo: '', correo: 'x@ejemplo.com' },
        { nombre_completo: 'Sin Datos' },
        { nombre_completo: 'Luis Tres', telefono: '88881111' },
      ),
      SIN_EXISTENTES,
    );
    expect(plan.cargar.map((c) => [c.fila, c.contacto.fullName])).toEqual([[2, 'Ana Uno'], [5, 'Luis Tres']]);
    expect(plan.omitidas).toEqual([
      { fila: 3, nombre: '', motivo: MOTIVOS.sinNombre },
      { fila: 4, nombre: 'Sin Datos', motivo: MOTIVOS.sinCorreoNiTelefono },
    ]);
  });

  it('correo repetido en el archivo (sin distinguir mayúsculas): se carga solo la primera fila', () => {
    const plan = planificar(
      filas({ nombre_completo: 'Ana Uno', correo: 'ana@ejemplo.com' }, { nombre_completo: 'Ana Dos', correo: 'ANA@ejemplo.com' }),
      SIN_EXISTENTES,
    );
    expect(plan.cargar.map((c) => c.fila)).toEqual([2]);
    expect(plan.omitidas).toEqual([{ fila: 3, nombre: 'Ana Dos', motivo: MOTIVOS.correoRepetidoEnArchivo(2) }]);
  });

  it('teléfono repetido en el archivo (mismo país y número, aunque cambie el formato)', () => {
    const plan = planificar(
      filas(
        { nombre_completo: 'Uno', telefono: '8888-1111' },
        { nombre_completo: 'Dos', telefono: '88881111', codigo_pais: '506', correo: 'otro@ejemplo.com' },
        { nombre_completo: 'Tres', telefono: '88881111', codigo_pais: '1' }, // 8 dígitos en otro país: es otro número
      ),
      SIN_EXISTENTES,
    );
    expect(plan.cargar.map((c) => c.fila)).toEqual([2, 4]);
    expect(plan.omitidas).toEqual([{ fila: 3, nombre: 'Dos', motivo: MOTIVOS.telefonoRepetidoEnArchivo(2) }]);
  });

  it('una fila omitida por otro motivo no reserva su correo: la siguiente con el mismo correo se carga', () => {
    const plan = planificar(
      filas({ nombre_completo: 'Uno', correo: 'ana@ejemplo.com', telefono: '123' }, { nombre_completo: 'Dos', correo: 'ana@ejemplo.com' }),
      SIN_EXISTENTES,
    );
    expect(plan.cargar.map((c) => c.fila)).toEqual([3]);
    expect(plan.omitidas).toHaveLength(1);
  });

  it('contactos que ya existen en Firestore (incluidos inactivos) se omiten por correo o por teléfono', () => {
    const existentes = indexarExistentes([
      { email: 'ana@ejemplo.com', phoneCountry: null, phoneNumber: null, status: 'activo' },
      { email: null, phoneCountry: 'CR', phoneNumber: '88881111', status: 'inactivo' },
    ]);
    const plan = planificar(
      filas(
        { nombre_completo: 'Ana', correo: 'ANA@ejemplo.com' },
        { nombre_completo: 'Luis', telefono: '88881111' },
        { nombre_completo: 'Nuevo', correo: 'nuevo@ejemplo.com', telefono: '88882222' },
      ),
      existentes,
    );
    expect(plan.cargar.map((c) => c.fila)).toEqual([4]);
    expect(plan.omitidas.map((o) => [o.fila, o.motivo])).toEqual([
      [2, MOTIVOS.correoYaExiste],
      [3, MOTIVOS.telefonoYaExiste],
    ]);
  });

  it('un teléfono existente de otro país con el mismo código de llamada cuenta como repetido (+1)', () => {
    const existentes = indexarExistentes([{ email: null, phoneCountry: 'CA', phoneNumber: '4165551234' }]);
    const plan = planificar(filas({ nombre_completo: 'Uno', telefono: '4165551234', codigo_pais: '1' }), existentes);
    expect(plan.cargar).toHaveLength(0);
    expect(plan.omitidas[0].motivo).toBe(MOTIVOS.telefonoYaExiste);
  });
});

describe('describirPlan', () => {
  it('cuántos se cargarían y la lista de omitidas con fila, nombre y motivo', () => {
    const plan = planificar(
      [
        { fila: 2, valores: fila({ correo: 'ana@ejemplo.com' }) },
        { fila: 3, valores: fila({ nombre_completo: '' }) },
        { fila: 4, valores: fila({ nombre_completo: 'Sin Datos' }) },
      ],
      SIN_EXISTENTES,
    );
    expect(describirPlan(plan, 3, false)).toEqual([
      'Filas con datos en el archivo: 3',
      'Se cargarían: 1',
      'NO se cargan: 2',
      `  fila 3 | (sin nombre) | ${MOTIVOS.sinNombre}`,
      `  fila 4 | Sin Datos | ${MOTIVOS.sinCorreoNiTelefono}`,
    ]);
    expect(describirPlan(plan, 3, true)[1]).toBe('Se cargarán: 1');
  });
});
