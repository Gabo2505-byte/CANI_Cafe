// Acceso a la colección `contacts`. Recibe la instancia de Firestore (se prueba contra el emulador).
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { COLLECTIONS } from '../shared/constants/collections';
import { FORM_BADGES, type Contact } from '../shared/types';
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

/**
 * HU-210: guarda los datos editados del contacto (nombre, correo, teléfono con país y dirección) y recalcula
 * nameSortKey (HU-204). Clasificación, origen, fecha de registro, estado y los campos del formulario
 * (interests, interestsUpdatedAt) no se tocan: updateDoc solo cambia los campos que recibe.
 */
export async function updateContactIn(db: Firestore, id: string, input: NewContactInput): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.contacts, id), {
    fullName: input.fullName,
    nameSortKey: toSortKey(input.fullName),
    email: input.email,
    phoneCountry: input.phoneCountry,
    phoneNumber: input.phoneNumber,
    address: input.address,
  });
}

export async function getContactIn(db: Firestore, id: string): Promise<Contact | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.contacts, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Contact) : null;
}

/** HU-204: contactos por página. */
export const CONTACTS_PAGE_SIZE = 20;

/**
 * HU-204, HU-205 y HU-504: todos los contactos (activos e inactivos) en orden alfabético (nameSortKey). La lista los
 * ordena (con etiqueta primero), busca, filtra y pagina en el navegador: ver la decisión en contactSearch.ts.
 */
export async function listAllContactsIn(db: Firestore): Promise<Contact[]> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.contacts), orderBy('nameSortKey')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Contact);
}

/**
 * HU-504: cuántos contactos tienen etiqueta ("Nuevo" o "Nuevo mensaje"), en vivo: cambia cuando el procesamiento del
 * formulario pone una etiqueta o cuando se abre una ficha y se quita.
 */
export function listenFormBadgeCountIn(
  db: Firestore,
  onCount: (count: number) => void,
  onError: (error: unknown) => void = () => {},
): Unsubscribe {
  const badged = query(collection(db, COLLECTIONS.contacts), where('formBadge', 'in', [...FORM_BADGES]));
  return onSnapshot(badged, (snap) => onCount(snap.size), onError);
}

/** HU-504: al abrir la ficha, la etiqueta desaparece. */
export async function clearFormBadgeIn(db: Firestore, id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.contacts, id), { formBadge: null });
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
