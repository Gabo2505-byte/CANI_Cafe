// Script C: carga inicial de contactos desde un CSV (RT-02), con la sesión del administrador. Se usa una sola vez.
// La lógica está aquí para poder probarla; el punto de entrada de la terminal es cargarContactos.ts.
// Crea cada contacto con la misma forma de documento que createContactIn (src/contacts/contactsRepository.ts), pero con
// origen "carga_inicial" y la clasificación indicada en el archivo. Los datos del CSV nunca se copian a otro archivo.
import { addDoc, collection, getDocs, serverTimestamp, type DocumentData, type Firestore } from 'firebase/firestore';
import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js/min';
import { readFileSync } from 'node:fs';
import { CONTACT_LIMITS, isValidEmail, normalizeEmail } from '../../src/contacts/contactForm';
import { COLLECTIONS } from '../../src/shared/constants/collections';
import { DEFAULT_PHONE_COUNTRY, normalizePhoneDigits, phoneKey, validatePhoneNumber } from '../../src/shared/phone/phone';
import type { ContactClassification } from '../../src/shared/types';
import { toSortKey } from '../../src/shared/utils/text';
import {
  AbortoError,
  cerrarSesion,
  confirmarProyecto,
  iniciarSesion,
  mensajeFirestore,
  pedirContrasena,
  preparar,
  type Sesion,
  type Terminal,
} from './comun';

// ---------------------------------------------------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------------------------------------------------

export const COLUMNAS = ['nombre_completo', 'correo', 'telefono', 'codigo_pais', 'direccion', 'clasificacion'] as const;
export type Columna = (typeof COLUMNAS)[number];

export interface FilaCsv {
  /** Número de fila del archivo: el encabezado es la 1 y el primer contacto la 2 (como en Excel). */
  fila: number;
  valores: Record<Columna, string>;
}

/** Quita tildes y pasa a minúsculas: "Persona Interesada" y "persona interesada" son lo mismo. */
function plegar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Coma o punto y coma, según cuál aparece más en la primera línea (fuera de comillas). */
export function detectarSeparador(texto: string): ',' | ';' {
  let comas = 0;
  let puntosYComa = 0;
  let entreComillas = false;
  for (const c of texto) {
    if (c === '"') entreComillas = !entreComillas;
    else if (!entreComillas && (c === '\n' || c === '\r')) break;
    else if (!entreComillas && c === ',') comas++;
    else if (!entreComillas && c === ';') puntosYComa++;
  }
  return puntosYComa > comas ? ';' : ',';
}

/** Analizador de CSV (RFC 4180): campos entre comillas, "" como comilla, saltos de línea dentro de comillas. */
export function parsearCsv(texto: string, separador: ',' | ';'): string[][] {
  const registros: string[][] = [];
  let registro: string[] = [];
  let campo = '';
  let entreComillas = false;
  let hayContenido = false;

  const cerrarCampo = () => {
    registro.push(campo);
    campo = '';
  };
  const cerrarRegistro = () => {
    cerrarCampo();
    // Una línea completamente vacía no es un registro.
    if (hayContenido) registros.push(registro);
    registro = [];
    hayContenido = false;
  };

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else entreComillas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') {
      entreComillas = true;
      hayContenido = true;
    } else if (c === separador) {
      cerrarCampo();
      hayContenido = true;
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      cerrarRegistro();
    } else {
      campo += c;
      hayContenido = true;
    }
  }
  if (entreComillas) throw new AbortoError('El CSV tiene unas comillas sin cerrar.');
  if (hayContenido || campo !== '' || registro.length > 0) cerrarRegistro();
  return registros;
}

/**
 * Convierte el texto del CSV en filas con sus columnas. Aborta si el texto no es UTF-8, si falta la columna
 * nombre_completo, si hay una columna desconocida o repetida. Las filas con todas las celdas vacías se ignoran.
 */
export function leerFilasCsv(textoOriginal: string): FilaCsv[] {
  const texto = textoOriginal.replace(/^﻿/, '');
  if (texto.includes('�')) {
    throw new AbortoError('El archivo no está en UTF-8. En Excel use "CSV UTF-8 (delimitado por comas)" al guardarlo.');
  }
  const registros = parsearCsv(texto, detectarSeparador(texto));
  if (registros.length === 0) throw new AbortoError('El archivo está vacío: falta el encabezado.');

  const encabezado = registros[0].map(plegar);
  const indices = new Map<Columna, number>();
  encabezado.forEach((nombre, i) => {
    if (!(COLUMNAS as readonly string[]).includes(nombre)) {
      throw new AbortoError(`Columna desconocida en el encabezado: "${registros[0][i].trim()}". Columnas válidas: ${COLUMNAS.join(', ')}.`);
    }
    if (indices.has(nombre as Columna)) throw new AbortoError(`La columna "${nombre}" está repetida en el encabezado.`);
    indices.set(nombre as Columna, i);
  });
  if (!indices.has('nombre_completo')) throw new AbortoError('Falta la columna nombre_completo en el encabezado.');

  const filas: FilaCsv[] = [];
  registros.slice(1).forEach((registro, i) => {
    const valores = Object.fromEntries(
      COLUMNAS.map((columna) => [columna, (registro[indices.get(columna) ?? -1] ?? '').trim()]),
    ) as Record<Columna, string>;
    if (Object.values(valores).every((v) => v === '') && registro.every((c) => c.trim() === '')) return;
    filas.push({ fila: i + 2, valores });
  });
  return filas;
}

// ---------------------------------------------------------------------------------------------------------------------
// Validación de cada fila (pura)
// ---------------------------------------------------------------------------------------------------------------------

/** Documento que se escribe: igual al de createContactIn, más origen y clasificación. */
export interface ContactoACargar {
  fullName: string;
  nameSortKey: string;
  email: string | null;
  phoneCountry: string | null;
  phoneNumber: string | null;
  address: string | null;
  classification: ContactClassification;
  status: 'activo';
  origin: 'carga_inicial';
}

export interface FilaOmitida {
  fila: number;
  nombre: string;
  motivo: string;
}

export const MOTIVOS = {
  sinNombre: 'No tiene nombre completo.',
  nombreLargo: `El nombre completo tiene más de ${CONTACT_LIMITS.fullName} caracteres.`,
  sinCorreoNiTelefono: 'No tiene un correo ni un teléfono.',
  correoInvalido: 'El correo no es válido.',
  correoLargo: `El correo tiene más de ${CONTACT_LIMITS.email} caracteres.`,
  direccionLarga: `La dirección tiene más de ${CONTACT_LIMITS.address} caracteres.`,
  telefonoSinDigitos: 'El teléfono no tiene dígitos.',
  telefonoCostaRica: 'El teléfono debe tener 8 dígitos (Costa Rica).',
  telefonoOtroPais: 'El teléfono debe tener entre 6 y 14 dígitos (otro país).',
  codigoPaisInvalido: 'El código de país no es válido: use solo dígitos, por ejemplo 506.',
  codigoPaisDesconocido: 'El código de país no corresponde a ningún país.',
  clasificacionInvalida: 'La clasificación debe ser "Persona interesada" o "Cliente".',
  correoRepetidoEnArchivo: (fila: number) => `El correo ya está en la fila ${fila} del archivo (se carga solo la primera).`,
  telefonoRepetidoEnArchivo: (fila: number) => `El teléfono ya está en la fila ${fila} del archivo (se carga solo la primera).`,
  correoYaExiste: 'Ya existe un contacto con este correo.',
  telefonoYaExiste: 'Ya existe un contacto con este teléfono.',
} as const;

/** País preferido cuando varios comparten el mismo código de llamada (+1, +7, +44...). */
const PAIS_PRINCIPAL: Record<string, string> = {
  '1': 'US', '7': 'RU', '39': 'IT', '44': 'GB', '47': 'NO', '61': 'AU', '64': 'NZ', '212': 'MA', '262': 'RE', '290': 'SH',
  '358': 'FI', '500': 'FK', '590': 'GP', '599': 'CW',
};

/** Código de llamada ("506") → país ISO ("CR"). null si ningún país lo usa. */
export function paisDeCodigo(codigo: string): string | null {
  const sinCeros = codigo.replace(/^0+/, '');
  const preferido = PAIS_PRINCIPAL[sinCeros];
  if (preferido) return preferido;
  return getCountries().find((pais) => getCountryCallingCode(pais as CountryCode) === sinCeros) ?? null;
}

export function clasificacionDe(texto: string): ContactClassification | null {
  const valor = plegar(texto);
  if (valor === '' || valor === 'persona interesada') return 'persona_interesada';
  if (valor === 'cliente') return 'cliente';
  return null;
}

/**
 * Valida una fila contra las reglas de RT-02 (nombre, correo o teléfono válido, largo del teléfono) y la convierte al
 * documento. Un dato escrito pero inválido omite la fila, igual que lo rechazaría el formulario del sistema.
 * No revisa repetidos: eso lo hace planificar.
 */
export function validarFila(valores: Record<Columna, string>): { contacto: ContactoACargar } | { motivo: string } {
  const fullName = valores.nombre_completo.trim();
  if (fullName === '') return { motivo: MOTIVOS.sinNombre };
  if (fullName.length > CONTACT_LIMITS.fullName) return { motivo: MOTIVOS.nombreLargo };

  const classification = clasificacionDe(valores.clasificacion);
  if (!classification) return { motivo: MOTIVOS.clasificacionInvalida };

  const correoTexto = valores.correo.trim();
  const telefonoTexto = valores.telefono.trim();
  if (correoTexto === '' && telefonoTexto === '') return { motivo: MOTIVOS.sinCorreoNiTelefono };

  let email: string | null = null;
  if (correoTexto !== '') {
    if (correoTexto.length > CONTACT_LIMITS.email) return { motivo: MOTIVOS.correoLargo };
    if (!isValidEmail(correoTexto)) return { motivo: MOTIVOS.correoInvalido };
    email = normalizeEmail(correoTexto);
  }

  let phoneCountry: string | null = null;
  let phoneNumber: string | null = null;
  if (telefonoTexto !== '') {
    const codigo = valores.codigo_pais.replace(/^\+/, '').trim();
    let pais = DEFAULT_PHONE_COUNTRY as string;
    if (codigo !== '') {
      if (!/^\d{1,4}$/.test(codigo)) return { motivo: MOTIVOS.codigoPaisInvalido };
      const encontrado = paisDeCodigo(codigo);
      if (!encontrado) return { motivo: MOTIVOS.codigoPaisDesconocido };
      pais = encontrado;
    }
    const digitos = normalizePhoneDigits(telefonoTexto);
    if (digitos === '') return { motivo: MOTIVOS.telefonoSinDigitos };
    if (validatePhoneNumber(pais, digitos)) {
      return { motivo: pais === DEFAULT_PHONE_COUNTRY ? MOTIVOS.telefonoCostaRica : MOTIVOS.telefonoOtroPais };
    }
    phoneCountry = pais;
    phoneNumber = digitos;
  }

  const direccion = valores.direccion.trim();
  if (direccion.length > CONTACT_LIMITS.address) return { motivo: MOTIVOS.direccionLarga };

  return {
    contacto: {
      fullName,
      nameSortKey: toSortKey(fullName),
      email,
      phoneCountry,
      phoneNumber,
      address: direccion || null,
      classification,
      status: 'activo',
      origin: 'carga_inicial',
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Repetidos y plan (puros)
// ---------------------------------------------------------------------------------------------------------------------

/** Correos y teléfonos que ya existen en Firestore (activos e inactivos). */
export interface Existentes {
  correos: ReadonlySet<string>;
  telefonos: ReadonlySet<string>;
}

/** Arma el índice de repetidos a partir de los documentos de `contacts`. Teléfono = código de llamada + número. */
export function indexarExistentes(documentos: readonly DocumentData[]): Existentes {
  const correos = new Set<string>();
  const telefonos = new Set<string>();
  for (const d of documentos) {
    if (typeof d.email === 'string' && d.email.trim() !== '') correos.add(normalizeEmail(d.email));
    if (typeof d.phoneCountry === 'string' && typeof d.phoneNumber === 'string' && d.phoneNumber !== '') {
      telefonos.add(phoneKey(d.phoneCountry, d.phoneNumber));
    }
  }
  return { correos, telefonos };
}

export interface ContactoConFila {
  fila: number;
  contacto: ContactoACargar;
}

export interface Plan {
  cargar: ContactoConFila[];
  omitidas: FilaOmitida[];
}

/**
 * Decide qué filas se cargan, en el orden del archivo. Una fila repetida dentro del archivo se compara solo contra las
 * filas que sí se cargan: si la primera se omitió por otro motivo, la segunda ocupa su lugar.
 */
export function planificar(filas: readonly FilaCsv[], existentes: Existentes): Plan {
  const plan: Plan = { cargar: [], omitidas: [] };
  const correosVistos = new Map<string, number>();
  const telefonosVistos = new Map<string, number>();

  for (const { fila, valores } of filas) {
    const nombre = valores.nombre_completo.trim();
    const omitir = (motivo: string) => plan.omitidas.push({ fila, nombre, motivo });

    const resultado = validarFila(valores);
    if ('motivo' in resultado) {
      omitir(resultado.motivo);
      continue;
    }
    const { contacto } = resultado;
    const claveTelefono = contacto.phoneCountry && contacto.phoneNumber ? phoneKey(contacto.phoneCountry, contacto.phoneNumber) : null;

    const correoEn = contacto.email ? correosVistos.get(contacto.email) : undefined;
    const telefonoEn = claveTelefono ? telefonosVistos.get(claveTelefono) : undefined;
    if (correoEn !== undefined) {
      omitir(MOTIVOS.correoRepetidoEnArchivo(correoEn));
      continue;
    }
    if (telefonoEn !== undefined) {
      omitir(MOTIVOS.telefonoRepetidoEnArchivo(telefonoEn));
      continue;
    }
    if (contacto.email && existentes.correos.has(contacto.email)) {
      omitir(MOTIVOS.correoYaExiste);
      continue;
    }
    if (claveTelefono && existentes.telefonos.has(claveTelefono)) {
      omitir(MOTIVOS.telefonoYaExiste);
      continue;
    }

    if (contacto.email) correosVistos.set(contacto.email, fila);
    if (claveTelefono) telefonosVistos.set(claveTelefono, fila);
    plan.cargar.push({ fila, contacto });
  }
  return plan;
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

export function describirPlan(plan: Plan, totalFilas: number, escribir: boolean): string[] {
  const lineas: string[] = [];
  lineas.push(`Filas con datos en el archivo: ${totalFilas}`);
  lineas.push(`${escribir ? 'Se cargarán' : 'Se cargarían'}: ${plan.cargar.length}`);
  lineas.push(`NO se cargan: ${plan.omitidas.length}`);
  for (const { fila, nombre, motivo } of plan.omitidas) {
    lineas.push(`  fila ${fila} | ${nombre === '' ? '(sin nombre)' : nombre} | ${motivo}`);
  }
  return lineas;
}

// ---------------------------------------------------------------------------------------------------------------------
// Firestore
// ---------------------------------------------------------------------------------------------------------------------

export async function leerExistentes(db: Firestore): Promise<Existentes> {
  const snap = await getDocs(collection(db, COLLECTIONS.contacts));
  return indexarExistentes(snap.docs.map((d) => d.data()));
}

export interface ResultadoContactos {
  codigo: 0 | 1;
  plan?: Plan;
  /** ids de los contactos creados. */
  escritos: string[];
}

/** Flujo completo del script C. Nunca lanza: devuelve el código de salida y lo que hizo. */
export async function ejecutarCargadorContactos(argv: readonly string[], terminal: Terminal): Promise<ResultadoContactos> {
  const escritos: string[] = [];
  let sesion: Sesion | undefined;
  let plan: Plan | undefined;
  try {
    const { args, config } = preparar(argv, terminal, { extras: ['archivo'] });

    let texto: string;
    try {
      texto = (terminal.leerArchivo ?? ((ruta) => readFileSync(ruta, 'utf8')))(args.extras.archivo);
    } catch {
      throw new AbortoError(`No se pudo leer el archivo CSV "${args.extras.archivo}".`);
    }
    const filas = leerFilasCsv(texto);
    terminal.log(`Archivo:     ${args.extras.archivo} (${plural(filas.length, 'fila con datos', 'filas con datos')})`);

    const contrasena = await pedirContrasena(terminal);
    sesion = await iniciarSesion(config, { emulador: args.emulador, entorno: terminal.entorno }, args.email, contrasena);
    terminal.log(`Sesión iniciada (uid ${sesion.user.uid}).`);

    let existentes: Existentes;
    try {
      existentes = await leerExistentes(sesion.db);
    } catch (error) {
      throw new AbortoError(`No se pudo leer la colección contacts: ${mensajeFirestore(error)}`);
    }
    plan = planificar(filas, existentes);
    terminal.log('');
    for (const linea of describirPlan(plan, filas.length, args.escribir)) terminal.log(linea);
    terminal.log('');

    if (!args.escribir) {
      terminal.log(
        `Modo prueba: no se escribió nada. Para cargar ${plural(plan.cargar.length, 'contacto', 'contactos')}, repita con --escribir.`,
      );
    } else if (plan.cargar.length === 0) {
      terminal.log('No hay contactos nuevos que cargar.');
    } else {
      await confirmarProyecto(terminal, config.projectId);
      // Un addDoc por contacto, en secuencia: las reglas hacen 2 lecturas por escritura. Si se corta a la mitad, repetir
      // el comando es seguro: los ya cargados se omiten como "ya existe".
      for (const [i, { fila, contacto }] of plan.cargar.entries()) {
        try {
          const ref = await addDoc(collection(sesion.db, COLLECTIONS.contacts), { ...contacto, createdAt: serverTimestamp() });
          escritos.push(ref.id);
        } catch (error) {
          throw new AbortoError(
            `Falló la escritura de la fila ${fila} (${i + 1}/${plan.cargar.length}): ${mensajeFirestore(error)}. ` +
              `Se cargaron ${escritos.length}; puede repetir el comando sin riesgo de duplicar.`,
          );
        }
        terminal.log(`  [${i + 1}/${plan.cargar.length}] cargada la fila ${fila}`);
      }
      terminal.log(`Carga terminada: ${plural(escritos.length, 'contacto cargado', 'contactos cargados')}.`);
    }
    return { codigo: 0, plan, escritos };
  } catch (error) {
    terminal.error(error instanceof AbortoError ? `ABORTADO: ${error.message}` : `ERROR: ${mensajeFirestore(error)}`);
    return { codigo: 1, plan, escritos };
  } finally {
    await cerrarSesion(sesion);
  }
}
