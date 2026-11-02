// Escritura de la solicitud en Firestore Lite (HU-405). Recibe la instancia de Lite para poder probarla contra el
// emulador con otra instancia.
import { collection, doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore/lite';
import { FORM_REQUESTS_COLLECTION, type FormRequestData } from '../../../src/shared/types/formRequest';

/** Id nuevo, generado en el navegador (no hace ninguna petición). */
export function nuevoIdSolicitudIn(db: Firestore): string {
  return doc(collection(db, FORM_REQUESTS_COLLECTION)).id;
}

/**
 * Crea la solicitud con ese id. La fecha la pone el servidor y `processed` empieza en false. Si el documento ya existe,
 * las reglas lo tratan como "update" (no permitido sin sesión) y falla con permission-denied.
 */
export async function guardarSolicitudIn(db: Firestore, id: string, datos: FormRequestData): Promise<void> {
  await setDoc(doc(db, FORM_REQUESTS_COLLECTION, id), { ...datos, submittedAt: serverTimestamp(), processed: false });
}
