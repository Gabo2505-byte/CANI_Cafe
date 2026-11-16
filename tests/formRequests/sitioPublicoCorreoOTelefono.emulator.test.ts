// Contrato v4 de punta a punta desde el formulario del sitio público (HU-403.3, HU-501.2, HU-502.1, HU-502.2 y
// E5-020.1): valores del formulario → validación → aSolicitud → Firestore Lite sin sesión (pasa por las reglas) →
// procesamiento con la sesión de un administrador. Corre con: npm run test:emulators
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { doc, getDoc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { connectFirestoreEmulator, getFirestore as getLiteFirestore, type Firestore as LiteFirestore } from 'firebase/firestore/lite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { aSolicitud } from '../../sitio-publico/src/formulario/envio';
import { guardarSolicitudIn, nuevoIdSolicitudIn } from '../../sitio-publico/src/formulario/guardarSolicitud';
import { hayErrores, nuevaFila, validarFormulario, valoresIniciales, type ValoresFormulario } from '../../sitio-publico/src/formulario/validacion';
import { processRequestIn } from '../../src/formRequests/formRequestsRepository';
import { COLLECTIONS } from '../../src/shared/constants/collections';
import { FORM_REQUESTS_COLLECTION } from '../../src/shared/types/formRequest';

const PROJECT_ID = 'demo-cani-crm-sitio-v4';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
let testEnv: RulesTestEnvironment;
let liteApp: FirebaseApp;
let lite: LiteFirestore;

const admin = () => testEnv.authenticatedContext('admin-1').firestore() as unknown as Firestore;
const leer = async (coleccion: string, id: string) => (await getDoc(doc(admin(), coleccion, id))).data()!;

/** Formulario lleno como lo dejaría una persona: nombre, un producto y lo que cambie cada prueba. */
const formulario = (parcial: Partial<ValoresFormulario>) =>
  valoresIniciales({
    nombre: ' Persona Del Sitio ',
    filas: [nuevaFila({ variedad: 'Villa Sarchí', productoId: 'p1', cantidad: '3' })],
    ...parcial,
  });

/** Hace lo mismo que la página al presionar "Enviar": valida, arma la solicitud y la guarda sin sesión. */
async function enviarDesdeElSitio(valores: ValoresFormulario): Promise<string> {
  expect(hayErrores(validarFormulario(valores))).toBe(false);
  const id = nuevoIdSolicitudIn(lite);
  await guardarSolicitudIn(lite, id, aSolicitud(valores));
  return id;
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  liteApp = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-api-key' }, 'sitio-publico-v4');
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
    const fs = ctx.firestore();
    await setDoc(doc(fs, COLLECTIONS.users, 'admin-1'), { username: 'admin', email: 'admin@example.com', active: true });
    await setDoc(doc(fs, COLLECTIONS.products, 'p1'), {
      name: 'Villa Sarchí',
      presentation: 'Bolsa de 340 g, grano entero',
      description: '',
      active: true,
    });
  });
});

describe('contrato v4 de punta a punta desde el formulario del sitio público', () => {
  it('HU-502.2: solo teléfono → la solicitud se guarda con email null y se crea el contacto sin correo', async () => {
    const id = await enviarDesdeElSitio(formulario({ correo: '', paisTelefono: 'CR', telefono: '6000-1234' }));
    expect(await leer(FORM_REQUESTS_COLLECTION, id)).toMatchObject({
      email: null,
      phoneCountry: 'CR',
      phoneNumber: '60001234',
      processed: false,
    });
    const resultado = await processRequestIn(admin(), id, 'admin-1');
    expect(resultado).toMatchObject({ status: 'processed', outcome: 'created' });
    expect(await leer(COLLECTIONS.contacts, (resultado as { contactId: string }).contactId)).toMatchObject({
      fullName: 'Persona Del Sitio',
      email: null,
      phoneCountry: 'CR',
      phoneNumber: '60001234',
      origin: 'formulario_web',
      interests: [{ productId: 'p1', quantity: 3 }],
    });
  });

  it('HU-502.1: solo teléfono de una persona registrada → se encuentra por teléfono y no se le borra el correo', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), COLLECTIONS.contacts, 'ana'), {
        fullName: 'Persona Del Sitio',
        nameSortKey: 'persona del sitio',
        email: 'persona@example.com',
        phoneCountry: 'CR',
        phoneNumber: '60001234',
        address: null,
        classification: 'persona_interesada',
        status: 'activo',
        origin: 'referido',
        createdAt: Timestamp.fromDate(new Date('2026-09-01T15:00:00Z')),
      });
    });
    const id = await enviarDesdeElSitio(formulario({ correo: '', paisTelefono: 'CR', telefono: '60001234' }));
    expect(await processRequestIn(admin(), id, 'admin-1')).toMatchObject({ outcome: 'updated', contactId: 'ana' });
    expect(await leer(COLLECTIONS.contacts, 'ana')).toMatchObject({ email: 'persona@example.com', phoneNumber: '60001234' });
  });

  it('solo correo → se guarda en minúsculas con el teléfono null, como antes', async () => {
    const id = await enviarDesdeElSitio(formulario({ correo: ' Persona@Example.COM ', telefono: '' }));
    expect(await leer(FORM_REQUESTS_COLLECTION, id)).toMatchObject({
      email: 'persona@example.com',
      phoneCountry: null,
      phoneNumber: null,
    });
    const resultado = await processRequestIn(admin(), id, 'admin-1');
    expect(await leer(COLLECTIONS.contacts, (resultado as { contactId: string }).contactId)).toMatchObject({
      email: 'persona@example.com',
      phoneNumber: null,
    });
  });

  it('ninguno de los dos: el formulario no deja enviar, y si se forzara, las reglas lo rechazan', async () => {
    const valores = formulario({ correo: '', telefono: '' });
    expect(validarFormulario(valores).correoOTelefono).toBe('Ingrese un correo electrónico o un teléfono.');
    const datos = aSolicitud(valores);
    expect(datos).toMatchObject({ email: null, phoneCountry: null, phoneNumber: null });
    await expect(guardarSolicitudIn(lite, nuevoIdSolicitudIn(lite), datos)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });
});
