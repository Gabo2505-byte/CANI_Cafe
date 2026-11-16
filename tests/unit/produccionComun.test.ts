// Partes puras del módulo común de los scripts de publicación (scripts/produccion/comun.ts): argumentos, archivo de
// configuración, protecciones de proyecto y entrada oculta. No tocan la red.
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import {
  AbortoError,
  analizarArchivoEnv,
  analizarArgumentos,
  comprobarDestino,
  configDesdeEnv,
  leerConfigWeb,
  pedirOcultoEn,
  preparar,
  type ConfigWeb,
  type Terminal,
} from '../../scripts/produccion/comun';

const BASE = ['--project', 'cani-real', '--email', 'admin@example.com', '--env', '.env.production.local'];

describe('analizarArgumentos', () => {
  it('lee las tres opciones obligatorias y las banderas', () => {
    expect(analizarArgumentos(BASE)).toEqual({
      project: 'cani-real',
      email: 'admin@example.com',
      env: '.env.production.local',
      escribir: false,
      emulador: false,
      extras: {},
    });
    const conBanderas = analizarArgumentos([...BASE, '--escribir', '--emulador']);
    expect(conBanderas.escribir).toBe(true);
    expect(conBanderas.emulador).toBe(true);
  });

  it('exige --project, --email y --env (sin valores por defecto)', () => {
    expect(() => analizarArgumentos(BASE.slice(2))).toThrow('Falta la opción obligatoria --project.');
    expect(() => analizarArgumentos([...BASE.slice(0, 2), ...BASE.slice(4)])).toThrow('--email');
    expect(() => analizarArgumentos(BASE.slice(0, 4))).toThrow('--env');
  });

  it('exige las opciones extra del script (--usuario)', () => {
    expect(() => analizarArgumentos(BASE, { extras: ['usuario'] })).toThrow('--usuario');
    expect(analizarArgumentos([...BASE, '--usuario', 'admin'], { extras: ['usuario'] }).extras).toEqual({ usuario: 'admin' });
  });

  it('nunca acepta la contraseña por argumento', () => {
    for (const opcion of ['--password', '--contrasena', '--contraseña', '--clave', '--PASSWORD']) {
      expect(() => analizarArgumentos([...BASE, opcion, 'secreta'])).toThrow(/no se pasa por argumento/);
    }
  });

  it('rechaza opciones desconocidas, repetidas, sin valor, con "=" o valores sueltos', () => {
    expect(() => analizarArgumentos([...BASE, '--borrar'])).toThrow('Opción desconocida: --borrar.');
    expect(() => analizarArgumentos([...BASE, '--project', 'otro'])).toThrow('repetida');
    expect(() => analizarArgumentos([...BASE, '--escribir', '--escribir'])).toThrow('repetida');
    expect(() => analizarArgumentos(['--project', '--email', 'a@b.com', '--env', 'x'])).toThrow('Falta el valor de --project.');
    expect(() => analizarArgumentos(['--project=cani-real'])).toThrow(/con espacio/);
    expect(() => analizarArgumentos([...BASE, 'suelto'])).toThrow('Argumento inesperado');
  });

  it('los errores son AbortoError', () => {
    expect(() => analizarArgumentos([])).toThrow(AbortoError);
  });
});

describe('analizarArchivoEnv', () => {
  it('lee CLAVE=valor con BOM, CRLF, comentarios, comillas y export', () => {
    const texto =
      '﻿# Config de producción\r\n' +
      'VITE_FIREBASE_API_KEY="clave-de-ejemplo"\r\n' +
      "export VITE_FIREBASE_AUTH_DOMAIN='ejemplo.firebaseapp.com'\r\n" +
      '\r\n' +
      'VITE_FIREBASE_PROJECT_ID=cani-real # comentario\r\n' +
      'VITE_USE_EMULATORS=false\r\n';
    expect(analizarArchivoEnv(texto)).toEqual({
      VITE_FIREBASE_API_KEY: 'clave-de-ejemplo',
      VITE_FIREBASE_AUTH_DOMAIN: 'ejemplo.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'cani-real',
      VITE_USE_EMULATORS: 'false',
    });
  });

  it('un valor con "=" se conserva completo', () => {
    expect(analizarArchivoEnv('A=b=c')).toEqual({ A: 'b=c' });
  });

  it('aborta con líneas que no son CLAVE=valor o con una clave obligatoria repetida', () => {
    expect(() => analizarArchivoEnv('hola')).toThrow('Línea 1');
    expect(() => analizarArchivoEnv('VITE_FIREBASE_PROJECT_ID=a\nVITE_FIREBASE_PROJECT_ID=b')).toThrow('más de una vez');
  });
});

describe('configDesdeEnv y leerConfigWeb', () => {
  const variables = {
    VITE_FIREBASE_API_KEY: 'k',
    VITE_FIREBASE_AUTH_DOMAIN: 'cani-real.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'cani-real',
  };

  it('devuelve la configuración cuando el projectId coincide con --project', () => {
    expect(configDesdeEnv(variables, 'cani-real')).toMatchObject({
      apiKey: 'k',
      authDomain: 'cani-real.firebaseapp.com',
      projectId: 'cani-real',
      usaEmuladores: false,
    });
  });

  it('aborta si el projectId del archivo no es igual a --project', () => {
    expect(() => configDesdeEnv(variables, 'cani-otro')).toThrow(/es del proyecto "cani-real" y se pidió --project "cani-otro"/);
  });

  it('aborta si falta una de las tres claves', () => {
    expect(() => configDesdeEnv({ ...variables, VITE_FIREBASE_API_KEY: '' }, 'cani-real')).toThrow('Falta VITE_FIREBASE_API_KEY');
    const { VITE_FIREBASE_AUTH_DOMAIN: _, ...sinDominio } = variables;
    expect(() => configDesdeEnv(sinDominio, 'cani-real')).toThrow('Falta VITE_FIREBASE_AUTH_DOMAIN');
  });

  it('aborta si no puede leer el archivo', () => {
    const leer = () => {
      throw new Error('ENOENT');
    };
    expect(() => leerConfigWeb('no-existe.env', 'cani-real', leer)).toThrow('No se pudo leer el archivo de configuración "no-existe.env".');
  });
});

describe('comprobarDestino', () => {
  const real: ConfigWeb = { apiKey: 'k', authDomain: 'cani-real.firebaseapp.com', projectId: 'cani-real', usaEmuladores: false };
  const demo: ConfigWeb = { ...real, projectId: 'demo-cani-crm', authDomain: 'demo-cani-crm.firebaseapp.com', usaEmuladores: true };

  it('permite un proyecto real sin --emulador y sin variables de emulador', () => {
    expect(() => comprobarDestino(real, { emulador: false }, {})).not.toThrow();
  });

  it('permite un proyecto demo-* con --emulador', () => {
    expect(() => comprobarDestino(demo, { emulador: true }, { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })).not.toThrow();
  });

  it('aborta con un proyecto demo-* sin --emulador', () => {
    expect(() => comprobarDestino(demo, { emulador: false }, {})).toThrow(/demo-\*: solo existe en los emuladores/);
  });

  it('aborta con --emulador y un proyecto real', () => {
    expect(() => comprobarDestino(real, { emulador: true }, {})).toThrow(/--emulador solo se usa con proyectos demo-\*/);
  });

  it('aborta contra un proyecto real si hay variables de emulador definidas', () => {
    expect(() => comprobarDestino(real, { emulador: false }, { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })).toThrow(
      /FIRESTORE_EMULATOR_HOST/,
    );
    expect(() => comprobarDestino(real, { emulador: false }, { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' })).toThrow(
      /FIREBASE_AUTH_EMULATOR_HOST/,
    );
    // Vacía cuenta como no definida.
    expect(() => comprobarDestino(real, { emulador: false }, { FIRESTORE_EMULATOR_HOST: '' })).not.toThrow();
  });

  it('aborta contra un proyecto real si el archivo dice VITE_USE_EMULATORS=true', () => {
    expect(() => comprobarDestino({ ...real, usaEmuladores: true }, { emulador: false }, {})).toThrow(/VITE_USE_EMULATORS=true/);
  });

  it('aborta con un projectId con formato inválido', () => {
    expect(() => comprobarDestino({ ...real, projectId: 'Cani Real' }, { emulador: false }, {})).toThrow(/formato/);
  });
});

describe('preparar (todo antes de pedir la contraseña)', () => {
  function terminal(archivo: string, entorno: Record<string, string> = {}) {
    const lineas: string[] = [];
    const t: Terminal = {
      log: (m) => lineas.push(m),
      error: (m) => lineas.push(m),
      pedirOculto: vi.fn(async () => {
        throw new Error('no debe pedir la contraseña');
      }),
      pedirLinea: vi.fn(async () => ''),
      entorno,
      leerArchivo: () => archivo,
    };
    return { t, lineas };
  }
  const archivoReal = 'VITE_FIREBASE_API_KEY=k\nVITE_FIREBASE_AUTH_DOMAIN=cani-real.firebaseapp.com\nVITE_FIREBASE_PROJECT_ID=cani-real\n';

  it('muestra projectId, authDomain, destino y modo', () => {
    const { t, lineas } = terminal(archivoReal);
    preparar([...BASE, '--escribir'], t);
    expect(lineas.join('\n')).toMatch(/Proyecto: +cani-real/);
    expect(lineas.join('\n')).toMatch(/authDomain: +cani-real\.firebaseapp\.com/);
    expect(lineas.join('\n')).toMatch(/FIREBASE REAL/);
    expect(lineas.join('\n')).toMatch(/ESCRITURA/);
  });

  it('aborta sin mostrar el destino si el archivo es de otro proyecto', () => {
    const { t, lineas } = terminal(archivoReal.replace('PROJECT_ID=cani-real', 'PROJECT_ID=cani-otro'));
    expect(() => preparar(BASE, t)).toThrow(AbortoError);
    expect(lineas).toEqual([]);
    expect(t.pedirOculto).not.toHaveBeenCalled();
  });
});

describe('pedirOcultoEn', () => {
  function entradaFalsa(isTTY = true) {
    const e = new EventEmitter() as EventEmitter & {
      isTTY: boolean;
      setRawMode: ReturnType<typeof vi.fn<(modo: boolean) => void>>;
      setEncoding: ReturnType<typeof vi.fn<(c: BufferEncoding) => void>>;
      resume: ReturnType<typeof vi.fn<() => void>>;
      pause: ReturnType<typeof vi.fn<() => void>>;
    };
    e.isTTY = isTTY;
    e.setRawMode = vi.fn<(modo: boolean) => void>();
    e.setEncoding = vi.fn<(c: BufferEncoding) => void>();
    e.resume = vi.fn<() => void>();
    e.pause = vi.fn<() => void>();
    return e;
  }

  it('devuelve lo tecleado sin escribirlo en la salida, con retroceso, y restaura la terminal', async () => {
    const entrada = entradaFalsa();
    let salida = '';
    const promesa = pedirOcultoEn('Contraseña: ', entrada, { write: (t: string) => (salida += t) });
    entrada.emit('data', 'secretx');
    entrada.emit('data', '\u007f');
    entrada.emit('data', 'o1\r');
    await expect(promesa).resolves.toBe('secreto1');
    expect(salida).toBe('Contraseña: \n');
    expect(entrada.setRawMode).toHaveBeenNthCalledWith(1, true);
    expect(entrada.setRawMode).toHaveBeenLastCalledWith(false);
    expect(entrada.listenerCount('data')).toBe(0);
  });

  it('Ctrl+C cancela', async () => {
    const entrada = entradaFalsa();
    const promesa = pedirOcultoEn('Contraseña: ', entrada, { write: () => true });
    entrada.emit('data', 'abc\u0003');
    await expect(promesa).rejects.toThrow('Cancelado');
    expect(entrada.setRawMode).toHaveBeenLastCalledWith(false);
  });

  it('aborta si la entrada no es una terminal interactiva (tubería o archivo)', async () => {
    await expect(pedirOcultoEn('Contraseña: ', entradaFalsa(false), { write: () => true })).rejects.toThrow(
      /terminal interactiva/,
    );
  });
});
