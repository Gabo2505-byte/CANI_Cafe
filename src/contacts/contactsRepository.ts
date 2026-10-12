// Acceso a la colección `contacts`. Recibe la instancia de Firestore (se prueba contra el emulador).
import { addDoc, collection, doc, getDoc, serverTimestamp, type Firestore } from 'firebase/firestore';
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
