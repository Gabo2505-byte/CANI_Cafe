// Acceso a la colección `contacts`. Recibe la instancia de Firestore (se prueba contra el emulador).
import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where,
  type DocumentSnapshot,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '../shared/constants/collections';
import type { Contact } from '../shared/types';
import { toSortKey } from '../shared/utils/text';

/** Datos que vienen del formulario. Clasificación, estado, origen y fecha los pone el sistema. */
export type NewContactInput = Pick<Contact, 'fullName' | 'email' | 'phoneCountry' | 'phoneNumber' | 'address'>;

/** HU-201: registra el contacto como "Persona interesada". Devuelve su id. */
export async function createContactIn(db: Firestore, input: NewContactInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.contacts), {
    ...input,
    nameSortKey: toSortKey(input.fullName),
    classification: 'persona_interesada',
    status: 'activo',
    origin: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getContactIn(db: Firestore, id: string): Promise<Contact | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.contacts, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Contact) : null;
}

/** HU-204: contactos por página. */
export const CONTACTS_PAGE_SIZE = 20;

/** Cursor opaco: el último contacto de la página anterior. */
export type ContactsCursor = DocumentSnapshot;

export interface ContactsPage {
  contacts: Contact[];
  /** Para pedir la página siguiente; null si no hay más. */
  nextCursor: ContactsCursor | null;
}

/**
 * HU-204: una página de contactos en orden alfabético por nombre (nameSortKey; en empate, por id).
 * La consulta trae solo `pageSize` documentos (+1 para saber si hay otra página).
 */
export async function listContactsPageIn(
  db: Firestore,
  after: ContactsCursor | null,
  pageSize: number = CONTACTS_PAGE_SIZE,
): Promise<ContactsPage> {
  const constraints = [orderBy('nameSortKey'), ...(after ? [startAfter(after)] : []), limit(pageSize + 1)];
  const snap = await getDocs(query(collection(db, COLLECTIONS.contacts), ...constraints));
  const docs = snap.docs.slice(0, pageSize);
  return {
    contacts: docs.map((d) => ({ id: d.id, ...d.data() }) as Contact),
    nextCursor: snap.docs.length > pageSize ? docs[docs.length - 1] : null,
  };
}

/** HU-204: total de contactos (conteo en el servidor, sin descargar los documentos). */
export async function countContactsIn(db: Firestore): Promise<number> {
  const snap = await getCountFromServer(collection(db, COLLECTIONS.contacts));
  return snap.data().count;
}

/** id del primer contacto que cumple los filtros, sin contar `excludeId` (al editar, el propio contacto). */
async function firstMatchId(
  db: Firestore,
  filters: ReturnType<typeof where>[],
  excludeId?: string,
): Promise<string | undefined> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.contacts), ...filters, limit(2)));
  return snap.docs.find((d) => d.id !== excludeId)?.id;
}

/**
 * HU-203: contactos ya existentes con el mismo correo, o con el mismo país + número de teléfono.
 * Firestore no tiene restricciones de unicidad: se consulta antes de guardar.
 * (El correo se guarda normalizado en minúsculas, así que la comparación es exacta.)
 */
export async function findDuplicateContactsIn(
  db: Firestore,
  input: Pick<NewContactInput, 'email' | 'phoneCountry' | 'phoneNumber'>,
  excludeId?: string,
): Promise<{ email?: string; phone?: string }> {
  const [email, phone] = await Promise.all([
    input.email ? firstMatchId(db, [where('email', '==', input.email)], excludeId) : undefined,
    input.phoneCountry && input.phoneNumber
      ? firstMatchId(
          db,
          [where('phoneCountry', '==', input.phoneCountry), where('phoneNumber', '==', input.phoneNumber)],
          excludeId,
        )
      : undefined,
  ]);
  return { ...(email && { email }), ...(phone && { phone }) };
}
