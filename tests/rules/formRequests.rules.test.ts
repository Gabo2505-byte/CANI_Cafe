// HU-405: reglas PROVISIONALES de formRequests (las reemplaza Gabriel en E5-020.1) y envío real del sitio público
// con Firestore Lite contra el emulador. Corre con: npm run test:emulators
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { connectFirestoreEmulator, getFirestore as getLiteFirestore, type Firestore as LiteFirestore } from 'firebase/firestore/lite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { aSolicitud, crearEnviador, TiempoAgotado } from '../../sitio-publico/src/formulario/envio';
import { guardarSolicitudIn, nuevoIdSolicitudIn } from '../../sitio-publico/src/formulario/guardarSolicitud';
import { valoresIniciales } from '../../sitio-publico/src/formulario/validacion';
import { FORM_REQUESTS_COLLECTION as COL } from '../../src/shared/types/formRequest';
import { filasDe } from '../helpers/filasProductos';

const PROJECT_ID = 'demo-cani-crm-formrequests';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;
let liteApp: FirebaseApp;
let lite: LiteFirestore;

const PRODUCTO = 'prod-01-villa-sarchi-0250-grano';

/** Solicitud mínima válida (sin teléfono ni mensaje). */
const valida = (cambios: Record<string, unknown> = {}) => ({
  fullName: 'Ana Prueba',
  email: 'ana.prueba@example.com',
  phoneCountry: null,
  phoneNumber: null,
  interests: [{ productId: PRODUCTO, quantity: 2 }],
  message: null,
  submittedAt: serverTimestamp(),
  processed: false,
  ...cambios,
});

const publico = () => testEnv.unauthenticatedContext().firestore();
const crear = (datos: Record<string, unknown>, id = 'sol-1') => setDoc(doc(publico(), COL, id), datos);

async function solicitudesGuardadas() {
  let ids: string[] = [];
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    ids = (await getDocs(collection(ctx.firestore(), COL))).docs.map((d) => d.id);
  });
  return ids;
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  // El sitio público escribe con Firestore Lite, sin sesión: cliente propio contra el mismo proyecto del emulador.
  liteApp = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-api-key' }, 'publico-lite-formrequests');
  lite = getLiteFirestore(liteApp);
  connectFirestoreEmulator(lite, host, Number(port));
});

afterAll(async () => {
  await deleteApp(liteApp);
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/active-user'), { username: 'activo', email: 'a@example.com', active: true });
    await setDoc(doc(ctx.firestore(), 'users/inactive-user'), { username: 'inactivo', email: 'i@example.com', active: false });
  });
});

describe('formRequests: crear sin sesión (HU-405)', () => {
  it('acepta una solicitud mínima válida (sin teléfono ni mensaje)', async () => {
    await assertSucceeds(crear(valida()));
  });

  it('acepta teléfono de Costa Rica (8 dígitos), de otro país (6 a 14) y un mensaje de 1000 caracteres', async () => {
    await assertSucceeds(crear(valida({ phoneCountry: 'CR', phoneNumber: '88881234' }), 'cr'));
    await assertSucceeds(crear(valida({ phoneCountry: 'US', phoneNumber: '3055550104' }), 'us'));
    await assertSucceeds(crear(valida({ phoneCountry: 'MX', phoneNumber: '123456' }), 'mx6'));
    await assertSucceeds(crear(valida({ phoneCountry: 'MX', phoneNumber: '12345678901234' }), 'mx14'));
    await assertSucceeds(crear(valida({ message: 'm'.repeat(1000) }), 'msg'));
  });

  it('acepta los 72 productos del catálogo, cada uno con cantidad de 1 a 9999', async () => {
    const interests = Array.from({ length: 72 }, (_, i) => ({ productId: `prod-${i}`, quantity: i === 0 ? 1 : 9999 }));
    await assertSucceeds(crear(valida({ interests })));
  });

  it('acepta 72 productos con teléfono y mensaje largos (el caso más pesado para las reglas)', async () => {
    const interests = Array.from({ length: 72 }, (_, i) => ({ productId: `prod-${i}`, quantity: 9999 }));
    await assertSucceeds(
      crear(valida({ interests, phoneCountry: 'US', phoneNumber: '30555501041234', message: 'm'.repeat(1000), fullName: 'N'.repeat(100) })),
    );
  });

  it('límite conocido: las reglas no revisan cada producto (lo revisan el formulario y el procesamiento)', async () => {
    // Las reglas no tienen ciclos y tienen un tope de expresiones: revisar 72 productos uno por uno no cabe (ver
    // firestore.rules). Si Gabriel agrega esa revisión en E5-020.1, esta prueba debe cambiar a assertFails.
    await assertSucceeds(crear(valida({ interests: [{ productId: '', quantity: 0 }] })));
  });

  it('acepta nombre y correo de 100 caracteres', async () => {
    await assertSucceeds(crear(valida({ fullName: 'N'.repeat(100), email: `${'a'.repeat(88)}@example.com` })));
  });

  it.each([
    ['falta un campo', (() => { const { message: _m, ...resto } = valida(); return resto; })()],
    ['un campo de más', valida({ extra: 'x' })],
    ['nombre vacío', valida({ fullName: '   ' })],
    ['nombre de 101', valida({ fullName: 'N'.repeat(101) })],
    ['nombre que no es texto', valida({ fullName: 12 })],
    ['correo con mayúsculas', valida({ email: 'Ana@example.com' })],
    ['correo mal escrito', valida({ email: 'ana@example' })],
    ['correo con espacios', valida({ email: 'ana prueba@example.com' })],
    ['correo de 101', valida({ email: `${'a'.repeat(89)}@example.com` })],
    ['Costa Rica con 7 dígitos', valida({ phoneCountry: 'CR', phoneNumber: '8888123' })],
    ['otro país con 5 dígitos', valida({ phoneCountry: 'US', phoneNumber: '12345' })],
    ['otro país con 15 dígitos', valida({ phoneCountry: 'US', phoneNumber: '123456789012345' })],
    ['teléfono con guion', valida({ phoneCountry: 'CR', phoneNumber: '8888-1234' })],
    ['país sin número', valida({ phoneCountry: 'CR' })],
    ['número sin país', valida({ phoneNumber: '88881234' })],
    ['país mal escrito', valida({ phoneCountry: 'cr', phoneNumber: '88881234' })],
    ['sin productos', valida({ interests: [] })],
    ['73 productos', valida({ interests: Array.from({ length: 73 }, (_, i) => ({ productId: `p-${i}`, quantity: 1 })) })],
    ['productos que no son lista', valida({ interests: { [PRODUCTO]: 2 } })],
    ['mensaje vacío (debe ser null)', valida({ message: '' })],
    ['mensaje de 1001', valida({ message: 'm'.repeat(1001) })],
    ['fecha puesta por el navegador', valida({ submittedAt: Timestamp.fromDate(new Date('2026-01-01T12:00:00Z')) })],
    ['processed en true', valida({ processed: true })],
  ])('rechaza: %s', async (_caso, datos) => {
    await assertFails(crear(datos as Record<string, unknown>));
  });
});

describe('formRequests: sin sesión no se lee, cambia ni borra', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), COL, 'existente'), { ...valida(), submittedAt: Timestamp.now() });
    });
  });

  it('no se puede leer una solicitud ni listar la colección', async () => {
    await assertFails(getDoc(doc(publico(), COL, 'existente')));
    await assertFails(getDocs(collection(publico(), COL)));
  });

  it('no se puede cambiar ni borrar', async () => {
    await assertFails(updateDoc(doc(publico(), COL, 'existente'), { processed: true }));
    await assertFails(deleteDoc(doc(publico(), COL, 'existente')));
  });

  it('volver a escribir el mismo id (un reintento) se rechaza: cuenta como cambio, no como creación', async () => {
    await assertFails(crear(valida(), 'existente'));
  });

  it('un usuario inactivo tampoco puede leer', async () => {
    await assertFails(getDoc(doc(testEnv.authenticatedContext('inactive-user').firestore(), COL, 'existente')));
  });

  it('con sesión activa se puede leer y marcar como procesada (lo define Gabriel en E5-020.1)', async () => {
    const db = testEnv.authenticatedContext('active-user').firestore();
    await assertSucceeds(getDoc(doc(db, COL, 'existente')));
    await assertSucceeds(updateDoc(doc(db, COL, 'existente'), { processed: true }));
  });
});

describe('envío real del sitio público con Firestore Lite', () => {
  const datos = () =>
    aSolicitud(
      valoresIniciales({
        nombre: '  Ana Prueba ',
        correo: ' Ana.Prueba@Example.com ',
        paisTelefono: 'CR',
        telefono: '8888-1234',
        filas: filasDe({ 'prod-09-geisha-1000-molido': '3', [PRODUCTO]: '12' }),
        mensaje: '',
      }),
    );

  it('guarda la solicitud con el id del navegador, la fecha del servidor y processed en false', async () => {
    const id = nuevoIdSolicitudIn(lite);
    await guardarSolicitudIn(lite, id, datos());
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const guardada = (await getDoc(doc(ctx.firestore(), COL, id))).data()!;
      expect(guardada).toMatchObject({
        fullName: 'Ana Prueba',
        email: 'ana.prueba@example.com',
        phoneCountry: 'CR',
        phoneNumber: '88881234',
        interests: [
          { productId: PRODUCTO, quantity: 12 },
          { productId: 'prod-09-geisha-1000-molido', quantity: 3 },
        ],
        message: null,
        processed: false,
      });
      expect(guardada.submittedAt).toBeInstanceOf(Timestamp);
    });
  });

  it('un segundo envío con el mismo id falla con permission-denied', async () => {
    const id = nuevoIdSolicitudIn(lite);
    await guardarSolicitudIn(lite, id, datos());
    await expect(guardarSolicitudIn(lite, id, datos())).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('regla a: en el primer intento, un rechazo de las reglas es error (no se da por enviado)', async () => {
    const enviar = crearEnviador({ nuevoId: () => nuevoIdSolicitudIn(lite), guardar: (id, d) => guardarSolicitudIn(lite, id, d) });
    const invalida = { ...datos(), email: 'ANA@EXAMPLE.COM' }; // las reglas exigen el correo en minúsculas
    expect(await enviar(invalida)).toBe('error');
    expect(await solicitudesGuardadas()).toEqual([]);
  });

  /**
   * Enviador con el guardado real, donde el primer intento SÍ se guarda pero la respuesta "se pierde" (como cuando vence
   * el tiempo límite de 10 s con la petición ya enviada). Anota los ids usados.
   */
  function enviadorConPrimeraRespuestaPerdida() {
    const ids: string[] = [];
    let primera = true;
    const enviar = crearEnviador({
      nuevoId: () => {
        ids.push(nuevoIdSolicitudIn(lite));
        return ids.at(-1)!;
      },
      guardar: async (id, d) => {
        await guardarSolicitudIn(lite, id, d);
        if (primera) {
          primera = false;
          throw new TiempoAgotado();
        }
      },
    });
    return { enviar, ids };
  }

  it('regla b: si el primer intento venció el tiempo pero sí se guardó, el reintento con el mismo id da éxito y no duplica', async () => {
    const { enviar, ids } = enviadorConPrimeraRespuestaPerdida();
    expect(await enviar(datos())).toBe('error');
    expect(await solicitudesGuardadas()).toEqual([ids[0]]);
    expect(await enviar(datos())).toBe('ok'); // el mismo id choca con lo guardado: permission-denied = éxito
    expect(ids).toHaveLength(1);
    expect(await solicitudesGuardadas()).toEqual([ids[0]]);
  });

  it('regla c: si la persona cambia un dato después del error, el envío usa un id nuevo (y se guarda lo nuevo)', async () => {
    const { enviar, ids } = enviadorConPrimeraRespuestaPerdida();
    expect(await enviar(datos())).toBe('error');
    const cambiada = { ...datos(), message: 'Ahora con mensaje' };
    expect(await enviar(cambiada)).toBe('ok');
    expect(new Set(ids).size).toBe(2);
    expect((await solicitudesGuardadas()).sort()).toEqual([...ids].sort());
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      expect((await getDoc(doc(ctx.firestore(), COL, ids[1]))).data()!.message).toBe('Ahora con mensaje');
    });
  });

  it('el tiempo límite real corta la espera aunque la escritura siga en camino', async () => {
    const enviar = crearEnviador({
      nuevoId: () => nuevoIdSolicitudIn(lite),
      guardar: (id, d) => guardarSolicitudIn(lite, id, d),
      limiteMs: 1,
    });
    expect(await enviar(datos())).toBe('error');
    await expect.poll(solicitudesGuardadas, { timeout: 10_000 }).toHaveLength(1);
  });
});
