// Partes puras del script de respaldo (scripts/produccion/respaldo.ts y respaldoFormato.ts): formato de los valores,
// argumentos, carpeta de salida, comparaciones y salvaguardas. No tocan la red: los casos que usan el proyecto real
// abortan antes de conectarse (los de conexión usan un proyecto demo-* y no llegan a abrir ninguna).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FieldValue, GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it, vi } from 'vitest';
import type { Terminal } from '../../scripts/produccion/comun';
import { comprobarCredenciales } from '../../scripts/produccion/limpieza';
import {
  analizarArgumentosRespaldo,
  carpetaPorDefecto,
  compararColecciones,
  compararCuentas,
  comprobarCarpetaSalida,
  ejecutarRespaldo,
  estaDentroDe,
  fechaLocal,
  nombreArchivoColeccion,
  sufijoFecha,
  type ColeccionRespaldo,
} from '../../scripts/produccion/respaldo';
import { canonico, checksumDatos, codificar, decodificar, type Json } from '../../scripts/produccion/respaldoFormato';

// Un Firestore falso: decodificar solo lo usa para crear referencias.
const dbFalsa = { doc: (ruta: string) => ({ path: ruta }) } as never;

describe('formato: codificar y decodificar', () => {
  it('conserva null, texto, booleanos, arreglos y mapas anidados', () => {
    // Con useBigInt los enteros de Firestore llegan como bigint.
    const valor = { a: null, b: 'texto con ñ y tildes áé', c: true, d: [1n, 'x', null, { e: false }], f: { g: { h: [] } } };
    const json = { ...valor, d: [1, 'x', null, { e: false }] };
    expect(codificar(valor)).toEqual(json);
    expect(decodificar(codificar(valor), dbFalsa)).toEqual(valor);
  });

  it('distingue enteros de decimales y no pierde los enteros grandes', () => {
    expect(codificar(150000n)).toBe(150000);
    expect(codificar(12.5)).toBe(12.5);
    expect(codificar(2)).toEqual({ __tipo: 'decimal', valor: '2' });
    expect(codificar(-0)).toEqual({ __tipo: 'decimal', valor: '-0' });
    expect(codificar(NaN)).toEqual({ __tipo: 'decimal', valor: 'NaN' });
    expect(codificar(Infinity)).toEqual({ __tipo: 'decimal', valor: 'Infinity' });
    const grande = codificar(9007199254740993n);
    expect(grande).toEqual({ __tipo: 'entero', valor: '9007199254740993' });
    expect(decodificar(grande, dbFalsa)).toBe(9007199254740993n);
    expect(decodificar(150000, dbFalsa)).toBe(150000n);
    expect(decodificar(12.5, dbFalsa)).toBe(12.5);
    expect(Object.is(decodificar(codificar(-0), dbFalsa), -0)).toBe(true);
    expect(decodificar(codificar(NaN), dbFalsa)).toBeNaN();
  });

  it('conserva Timestamp con nanosegundos, GeoPoint, referencias, bytes y vectores', () => {
    const marca = new Timestamp(1700000000, 123456000);
    const codificado = codificar(marca) as Record<string, Json>;
    expect(codificado).toMatchObject({ __tipo: 'timestamp', segundos: 1700000000, nanosegundos: 123456000 });
    const restaurado = decodificar(codificado, dbFalsa) as Timestamp;
    expect(restaurado.isEqual(marca)).toBe(true);

    expect(decodificar(codificar(new GeoPoint(10.5, -84.25)), dbFalsa)).toEqual(new GeoPoint(10.5, -84.25));
    expect(codificar(Buffer.from([0, 1, 255]))).toEqual({ __tipo: 'bytes', base64: 'AAH/' });
    expect(decodificar({ __tipo: 'bytes', base64: 'AAH/' }, dbFalsa)).toEqual(Buffer.from([0, 1, 255]));
    expect(decodificar({ __tipo: 'referencia', ruta: 'contacts/c-1' }, dbFalsa)).toEqual({ path: 'contacts/c-1' });
    expect(codificar(FieldValue.vector([1, 2.5]))).toEqual({ __tipo: 'vector', valor: [1, 2.5] });
  });

  it('un mapa con la clave "__tipo" se envuelve y vuelve igual', () => {
    const valor = { __tipo: 'timestamp', segundos: 'esto es un mapa real' };
    const codificado = codificar(valor);
    expect(codificado).toEqual({ __tipo: 'mapa', valor });
    expect(decodificar(codificado, dbFalsa)).toEqual(valor);
  });

  it('un tipo desconocido es un error, no un valor omitido', () => {
    expect(() => codificar(new Map())).toThrow('no soportado');
    expect(() => codificar(Symbol('x'))).toThrow('no soportado');
    expect(() => decodificar({ __tipo: 'raro' }, dbFalsa)).toThrow('desconocido');
  });

  it('el checksum no depende del orden de las claves y cambia con cualquier dato', () => {
    expect(canonico({ b: 1, a: { d: 1, c: [2, 1] } })).toBe('{"a":{"c":[2,1],"d":1},"b":1}');
    expect(checksumDatos({ a: 1, b: 2 })).toBe(checksumDatos({ b: 2, a: 1 }));
    expect(checksumDatos({ a: 1 })).not.toBe(checksumDatos({ a: 2 }));
    expect(checksumDatos({ a: null })).not.toBe(checksumDatos({}));
  });
});

describe('analizarArgumentosRespaldo', () => {
  const base = ['--project', 'cani-cafe', '--env', '.env.production.local'];

  it('lee --project y --env, y las opciones opcionales', () => {
    expect(analizarArgumentosRespaldo(base)).toEqual({ project: 'cani-cafe', env: '.env.production.local', salida: null, verificar: null, emulador: false });
    expect(analizarArgumentosRespaldo([...base, '--salida', 'C:\\r', '--emulador'])).toMatchObject({ salida: 'C:\\r', emulador: true });
    expect(analizarArgumentosRespaldo([...base, '--verificar', 'C:\\r'])).toMatchObject({ verificar: 'C:\\r' });
  });

  it('rechaza lo que escribiría, lo desconocido, lo repetido y lo incompleto', () => {
    expect(() => analizarArgumentosRespaldo([...base, '--borrar'])).toThrow('solo lee');
    expect(() => analizarArgumentosRespaldo([...base, '--escribir'])).toThrow('solo lee');
    expect(() => analizarArgumentosRespaldo([...base, '--email', 'x@y.com'])).toThrow('no usa --email');
    expect(() => analizarArgumentosRespaldo([...base, '--todo'])).toThrow('Opción desconocida: --todo.');
    expect(() => analizarArgumentosRespaldo([...base, '--emulador', '--emulador'])).toThrow('está repetida');
    expect(() => analizarArgumentosRespaldo([...base, '--salida'])).toThrow('Falta el valor de --salida.');
    expect(() => analizarArgumentosRespaldo(['--env', 'a'])).toThrow('Falta la opción obligatoria --project.');
    expect(() => analizarArgumentosRespaldo([...base, '--salida', 'a', '--verificar', 'b'])).toThrow('use solo una');
  });
});

describe('carpeta de salida', () => {
  it('por defecto queda fuera del repositorio, con proyecto, fecha y hora de Costa Rica', () => {
    const ahora = new Date('2026-11-16T15:30:00Z'); // 09:30 en Costa Rica (UTC-6)
    expect(sufijoFecha(ahora)).toBe('20261116-0930');
    expect(fechaLocal(ahora)).toBe('2026-11-16 09:30 (America/Costa_Rica)');
    const repo = resolve('C:\\trabajo\\CANI_Cafe');
    const carpeta = carpetaPorDefecto('cani-cafe', ahora, repo);
    expect(carpeta).toBe(resolve(repo, '..', 'respaldos', 'cani-cafe-20261116-0930'));
    expect(estaDentroDe(carpeta, repo)).toBe(false);
  });

  it('a medianoche de Costa Rica el día es el de Costa Rica, no el de UTC', () => {
    expect(sufijoFecha(new Date('2026-11-17T05:59:00Z'))).toBe('20261116-2359');
    expect(sufijoFecha(new Date('2026-11-17T06:00:00Z'))).toBe('20261117-0000');
  });

  it('aborta si la carpeta está dentro del repositorio o ya tiene archivos', () => {
    const repo = resolve('.');
    expect(estaDentroDe(resolve(repo, 'respaldos', 'x'), repo)).toBe(true);
    expect(estaDentroDe(repo, repo)).toBe(true);
    expect(estaDentroDe(resolve(repo, '..', 'respaldos'), repo)).toBe(false);
    expect(estaDentroDe(resolve(repo, '..', 'CANI_Cafe_otro'), repo)).toBe(false);
    expect(() => comprobarCarpetaSalida(resolve(repo, 'dentro'), repo)).toThrow('dentro del repositorio');
    expect(() => comprobarCarpetaSalida(resolve(repo, 'scripts'), resolve(repo, '..', 'otra-raiz'))).toThrow('ya tiene archivos');
    expect(() => comprobarCarpetaSalida(resolve(repo, '..', 'respaldos-que-no-existe-xyz'), repo)).not.toThrow();
  });

  it('nombres de archivo seguros para Windows, sin chocar entre sí', () => {
    const usados = new Set<string>();
    expect(nombreArchivoColeccion('contacts', usados)).toBe('contacts.json');
    expect(nombreArchivoColeccion('sales/abc/notas', usados)).toBe('sales__abc__notas.json');
    expect(nombreArchivoColeccion('colección: a*b?', usados)).toBe('colecci_n__a_b_.json');
    expect(nombreArchivoColeccion('colecci_n__a_b_', usados)).toBe('colecci_n__a_b_-2.json');
    expect(nombreArchivoColeccion('CONTACTS', usados)).toBe('CONTACTS-2.json');
  });
});

describe('credenciales: GOOGLE_CLOUD_PROJECT solo si es igual a --project', () => {
  const real = { project: 'cani-cafe', emulador: false };

  it('si las credenciales no traen el projectId, acepta la variable cuando coincide', () => {
    expect(() => comprobarCredenciales(null, real, { entorno: { GOOGLE_CLOUD_PROJECT: 'cani-cafe' } })).not.toThrow();
    expect(() => comprobarCredenciales(null, real, { entorno: { GOOGLE_CLOUD_PROJECT: 'otro-proyecto' } })).toThrow(
      'No se pudo saber el projectId',
    );
    expect(() => comprobarCredenciales(null, real, { entorno: {} })).toThrow('No se pudo saber el projectId');
    expect(() => comprobarCredenciales(null, real)).toThrow('No se pudo saber el projectId');
  });

  it('si las credenciales traen otro proyecto, la variable no lo arregla', () => {
    expect(() => comprobarCredenciales('otro-proyecto', real, { entorno: { GOOGLE_CLOUD_PROJECT: 'cani-cafe' } })).toThrow(
      'Las credenciales de gcloud son del proyecto "otro-proyecto"',
    );
  });

  it('el mensaje de --project distinto dice "respalda"', () => {
    expect(() => comprobarCredenciales('x', { project: 'cani-otro', emulador: false }, { accion: 'respalda' })).toThrow(
      'Este script solo respalda en "cani-cafe"',
    );
  });
});

describe('comparaciones contra la base viva', () => {
  const doc = (id: string, datos: Json) => ({ id, ruta: `c/${id}`, datos, sha256: checksumDatos(datos) });
  const coleccion = (ruta: string, ...docs: ReturnType<typeof doc>[]): ColeccionRespaldo => ({ ruta, documentos: docs, sinCampos: [] });

  it('iguales: todo OK', () => {
    const c = coleccion('c', doc('1', { a: 1 }), doc('2', { b: null }));
    const r = compararColecciones([c], [c]);
    expect(r).toEqual([{ texto: 'c: 2 en el respaldo y 2 en la base viva; checksums iguales', ok: true }]);
  });

  it('detecta documentos que faltan, que sobran, contenido distinto y colecciones nuevas o borradas', () => {
    const respaldo = [coleccion('c', doc('1', { a: 1 }), doc('2', { a: 2 }), doc('3', { a: 3 })), coleccion('vieja', doc('1', {}))];
    const vivas = [coleccion('c', doc('1', { a: 1 }), doc('2', { a: 999 }), doc('4', { a: 4 })), coleccion('nueva', doc('1', {}))];
    const r = compararColecciones(respaldo, vivas);
    expect(r.every((x) => !x.ok)).toBe(true);
    const texto = r.map((x) => x.texto).join('\n');
    expect(texto).toContain('c: solo en la base viva: 4; solo en el respaldo: 3; contenido distinto: 2');
    expect(texto).toContain('nueva: existe en la base viva (1 documentos) y no está en el respaldo');
    expect(texto).toContain('vieja: está en el respaldo (1 documentos) y ya no existe en la base viva');
  });

  it('cuentas: compara uid, correo y fecha de creación', () => {
    const cuenta = (uid: string, email: string) => ({ uid, email, displayName: null, disabled: false, createdAt: '2026-10-01T00:00:00.000Z' });
    expect(compararCuentas([cuenta('a', 'a@x.com')], [cuenta('a', 'a@x.com')]).ok).toBe(true);
    const distinta = compararCuentas([cuenta('a', 'a@x.com')], [cuenta('a', 'otro@x.com'), cuenta('b', 'b@x.com')]);
    expect(distinta.ok).toBe(false);
    expect(distinta.texto).toContain('solo en la base viva: b');
    expect(distinta.texto).toContain('datos distintos: a');
  });
});

describe('ejecutarRespaldo: aborta antes de conectarse', () => {
  function terminal(proyectoArchivo = 'cani-cafe') {
    const salida: string[] = [];
    const t: Terminal = {
      log: (m) => salida.push(m),
      error: (m) => salida.push(m),
      pedirOculto: vi.fn(async () => ''),
      pedirLinea: vi.fn(async () => ''),
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
  const argv = ['--project', 'cani-cafe', '--env', '.env.production.local'];

  it('credenciales de gcloud de otro proyecto', async () => {
    const { t, texto } = terminal();
    const r = await ejecutarRespaldo(argv, t, { proyectoDeCredenciales: async () => 'otro-proyecto' });
    expect(r.codigo).toBe(1);
    expect(texto()).toContain('ABORTADO: Las credenciales de gcloud son del proyecto "otro-proyecto"');
  });

  it('credenciales sin projectId y GOOGLE_CLOUD_PROJECT distinto de --project', async () => {
    const { t, texto } = terminal();
    t.entorno = { GOOGLE_CLOUD_PROJECT: 'otro-proyecto' };
    const r = await ejecutarRespaldo(argv, t, { proyectoDeCredenciales: async () => null });
    expect(r.codigo).toBe(1);
    expect(texto()).toContain('ABORTADO: No se pudo saber el projectId de las credenciales');
  });

  it('archivo --env de otro proyecto', async () => {
    const { t, texto } = terminal('cani-otro');
    const credenciales = vi.fn(async () => 'cani-cafe');
    const r = await ejecutarRespaldo(argv, t, { proyectoDeCredenciales: credenciales });
    expect(r.codigo).toBe(1);
    expect(texto()).toContain('El archivo de configuración es del proyecto "cani-otro"');
    expect(credenciales).not.toHaveBeenCalled();
  });

  it('--project distinto de cani-cafe contra un proyecto real', async () => {
    const { t, texto } = terminal('cani-otro');
    const r = await ejecutarRespaldo(['--project', 'cani-otro', '--env', 'x'], t, { proyectoDeCredenciales: async () => 'cani-otro' });
    expect(r.codigo).toBe(1);
    expect(texto()).toContain('Este script solo respalda en "cani-cafe"');
  });

  it('variables de emulador definidas contra el proyecto real', async () => {
    for (const nombre of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
      const { t, texto } = terminal();
      t.entorno = { [nombre]: '127.0.0.1:8080' };
      const r = await ejecutarRespaldo(argv, t, { proyectoDeCredenciales: async () => 'cani-cafe' });
      expect(r.codigo).toBe(1);
      expect(texto()).toContain('Hay variables de emulador definidas');
    }
  });

  it('carpeta de salida dentro del repositorio o con archivos (proyecto demo-*, sin conexión)', async () => {
    const demo = ['--project', 'demo-cani-crm', '--env', 'x', '--emulador'];
    const dentro = terminal('demo-cani-crm');
    const r1 = await ejecutarRespaldo([...demo, '--salida', resolve('respaldos', 'x')], dentro.t, { raizRepo: resolve('.') });
    expect(r1.codigo).toBe(1);
    expect(dentro.texto()).toContain('está dentro del repositorio');

    const conArchivos = terminal('demo-cani-crm');
    const r2 = await ejecutarRespaldo([...demo, '--salida', resolve('scripts')], conArchivos.t, { raizRepo: resolve('..', 'otra-raiz') });
    expect(r2.codigo).toBe(1);
    expect(conArchivos.texto()).toContain('ya tiene archivos');
  });

  it('--verificar con una carpeta que no es un respaldo', async () => {
    const { t, texto } = terminal('demo-cani-crm');
    const r = await ejecutarRespaldo(['--project', 'demo-cani-crm', '--env', 'x', '--emulador', '--verificar', resolve('scripts')], t);
    expect(r.codigo).toBe(1);
    expect(texto()).toContain('No se pudo leer respaldo-manifiesto.json');
  });
});

describe('solo lectura', () => {
  it('respaldo.ts y respaldoFormato.ts no usan ninguna operación de escritura de Firestore ni de Authentication', () => {
    const prohibidas = /\.collection\([^)]*\)\.add\(|\.(set|update|delete|create|commit|bulkWriter|recursiveDelete|runTransaction|createUser|updateUser|deleteUser|deleteUsers|importUsers|setCustomUserClaims)\(|\.batch\(|\.bulkWriter\(/;
    for (const archivo of ['respaldo.ts', 'respaldoFormato.ts', 'respaldarBd.ts']) {
      const lineas = readFileSync(resolve('scripts', 'produccion', archivo), 'utf8').split(/\r?\n/);
      // createHash(...).update(...) es el cálculo del checksum, no una escritura.
      const codigo = lineas.filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.includes('createHash'));
      expect(codigo.filter((l) => prohibidas.test(l)), archivo).toEqual([]);
    }
  });

  it('el archivo de Authentication no copia contraseñas ni hashes', () => {
    const fuente = readFileSync(resolve('scripts', 'produccion', 'respaldo.ts'), 'utf8');
    expect(fuente).not.toMatch(/passwordHash|passwordSalt|providerData|customClaims/);
  });
});
