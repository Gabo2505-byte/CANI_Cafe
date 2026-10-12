// Acceso a la colección `contacts`. Recibe la instancia de Firestore (se prueba contra el emulador).
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '../shared/constants/collections';
import type { Contact } from '../shared/types';

/** Datos que vienen del formulario. Clasificación, estado, origen y fecha los pone el sistema. */
export type NewContactInput = Pick<Contact, 'fullName' | 'email' | 'phoneCountry' | 'phoneNumber' | 'address'>;

/** HU-201: registra el contacto como "Persona interesada". Devuelve su id. */
export async function createContactIn(db: Firestore, input: NewContactInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.contacts), {
    ...input,
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
