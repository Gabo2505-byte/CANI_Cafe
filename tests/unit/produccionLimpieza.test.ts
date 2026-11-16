// Partes puras del script de limpieza de datos de prueba (scripts/produccion/limpieza.ts): argumentos, selección,
// protecciones y comprobación de credenciales. No tocan la red: los casos de credenciales abortan antes de conectarse.
import { describe, expect, it, vi } from 'vitest';
import type { Terminal } from '../../scripts/produccion/comun';
import {
  analizarArgumentosLimpieza,
  comprobarCredenciales,
  comprobarSeleccion,
  ejecutarLimpieza,
  empiezaPorPrueba,
  MAX_CONTACTOS,
  seleccionarContactos,
  type ArgumentosLimpieza,
  type ContactoLeido,
} from '../../scripts/produccion/limpieza';

const REAL: ArgumentosLimpieza = { project: 'cani-cafe', env: '.env.production.local', borrar: false, emulador: false };

describe('analizarArgumentosLimpieza', () => {
  it('lee --project, --env y las banderas', () => {
    expect(analizarArgumentosLimpieza(['--project', 'cani-cafe', '--env', '.env.production.local'])).toEqual(REAL);
    expect(analizarArgumentosLimpieza(['--project', 'demo-x', '--env', 'a', '--borrar', '--emulador'])).toMatchObject({
      borrar: true,
      emulador: true,
    });
  });

  it('rechaza --email, --escribir, opciones desconocidas, repetidas o sin valor', () => {
    const base = ['--project', 'cani-cafe', '--env', 'a'];
    expect(() => analizarArgumentosLimpieza([...base, '--email', 'x@y.com'])).toThrow('no usa --email');
    expect(() => analizarArgumentosLimpieza([...base, '--escribir'])).toThrow('usa --borrar, no --escribir');
    expect(() => analizarArgumentosLimpieza([...base, '--todo'])).toThrow('Opción desconocida: --todo.');
    expect(() => analizarArgumentosLimpieza([...base, '--borrar', '--borrar'])).toThrow('está repetida');
    expect(() => analizarArgumentosLimpieza(['--project', '--env', 'a'])).toThrow('Falta el valor de --project.');
    expect(() => analizarArgumentosLimpieza(['--env', 'a'])).toThrow('Falta la opción obligatoria --project.');
  });
});

describe('selección de contactos', () => {
  it('empiezaPorPrueba no distingue mayúsculas y exige que sea el inicio del nombre', () => {
    expect(empiezaPorPrueba('PRUEBA Uno')).toBe(true);
    expect(empiezaPorPrueba('prueba dos')).toBe(true);
    expect(empiezaPorPrueba('  Pruebas Sitio')).toBe(true);
    expect(empiezaPorPrueba('Ana Prueba')).toBe(false);
    expect(empiezaPorPrueba('Prue')).toBe(false);
    expect(empiezaPorPrueba(null)).toBe(false);
  });

  it('selecciona solo los "PRUEBA..."', () => {
    const contactos: ContactoLeido[] = [
      { id: 'a', fullName: 'PRUEBA Uno', origin: 'formulario_web' },
      { id: 'b', fullName: 'Ana Prueba', origin: 'carga_inicial' },
      { id: 'c', fullName: 'Luis', origin: null },
    ];
    expect(seleccionarContactos(contactos).map((c) => c.id)).toEqual(['a']);
  });

  it('aborta si alguno no empieza por PRUEBA, si alguno es de la carga inicial o si son más de 10', () => {
    expect(() => comprobarSeleccion([{ id: 'x', fullName: 'Luis', origin: null }])).toThrow('no empieza por "PRUEBA"');
    expect(() => comprobarSeleccion([{ id: 'y', fullName: 'PRUEBA Real', origin: 'carga_inicial' }])).toThrow(
      'origen "carga_inicial": PRUEBA Real (y)',
    );
    const muchos = Array.from({ length: MAX_CONTACTOS + 1 }, (_, i) => ({ id: `p${i}`, fullName: `PRUEBA ${i}`, origin: null }));
    expect(() => comprobarSeleccion(muchos)).toThrow('Se seleccionaron 11 contactos y el máximo es 10.');
    expect(() => comprobarSeleccion(muchos.slice(0, MAX_CONTACTOS))).not.toThrow();
    expect(() => comprobarSeleccion([])).not.toThrow();
  });
});

describe('comprobarCredenciales', () => {
  it('exige cani-cafe en --project y en las credenciales de gcloud', () => {
    expect(() => comprobarCredenciales('cani-cafe', REAL)).not.toThrow();
    expect(() => comprobarCredenciales('otro-proyecto', REAL)).toThrow('Las credenciales de gcloud son del proyecto "otro-proyecto"');
    expect(() => comprobarCredenciales(null, REAL)).toThrow('No se pudo saber el projectId de las credenciales');
    expect(() => comprobarCredenciales('cani-otro', { ...REAL, project: 'cani-otro' })).toThrow('Este script solo borra en "cani-cafe"');
  });

  it('con --emulador no se revisan credenciales', () => {
    expect(() => comprobarCredenciales(null, { ...REAL, project: 'demo-cani', emulador: true })).not.toThrow();
  });
});

describe('ejecutarLimpieza: aborta antes de conectarse', () => {
  function terminal(proyectoArchivo = 'cani-cafe') {
    const salida: string[] = [];
    const t: Terminal = {
      log: (m) => salida.push(m),
      error: (m) => salida.push(m),
      pedirOculto: vi.fn(async () => ''),
      pedirLinea: vi.fn(async () => 'cani-cafe'),
      entorno: {},
      leerArchivo: () =>
        [
          'VITE_FIREBASE_API_KEY=clave-web',
          `VITE_FIREBASE_AUTH_DOMAIN=${proyectoArchivo}.firebaseapp.com`,
          `VITE_FIREBASE_PROJECT_ID=${proyectoArchivo}`,
          'VITE_USE_EMULATORS=false',
        ].join('\n'),
    };
    return { t, texto: () => salida.join('\n') };
  }
  const argv = ['--project', 'cani-cafe', '--env', '.env.production.local', '--borrar'];

  it('credenciales de gcloud de otro proyecto', async () => {
    const { t, texto } = terminal();
    const r = await ejecutarLimpieza(argv, t, { proyectoDeCredenciales: async () => 'otro-proyecto' });
    expect(r).toEqual({ codigo: 1, plan: undefined, borrados: 0 });
    expect(texto()).toContain('ABORTADO: Las credenciales de gcloud son del proyecto "otro-proyecto"');
    expect(t.pedirLinea).not.toHaveBeenCalled();
  });

  it('archivo --env de otro proyecto', async () => {
    const { t, texto } = terminal('cani-otro');
    const credenciales = vi.fn(async () => 'cani-cafe');
    const r = await ejecutarLimpieza(argv, t, { proyectoDeCredenciales: credenciales });
    expect(r.codigo).toBe(1);
    expect(texto()).toContain('El archivo de configuración es del proyecto "cani-otro"');
    expect(credenciales).not.toHaveBeenCalled();
  });

  it('variables de emulador definidas contra el proyecto real', async () => {
    const { t, texto } = terminal();
    t.entorno = { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' };
    const r = await ejecutarLimpieza(argv, t, { proyectoDeCredenciales: async () => 'cani-cafe' });
    expect(r.codigo).toBe(1);
    expect(texto()).toContain('Hay variables de emulador definidas');
  });
});
