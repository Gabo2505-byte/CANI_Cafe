// HU-502 y HU-503: procesamiento de las solicitudes del formulario en el navegador del administrador, con su sesión
// (CC-01, costo 0: sin Cloud Functions). Recibe la instancia de Firestore (se prueba contra el emulador).
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { COLLECTIONS } from '../shared/constants/collections';
import { isOpenSaleStage, type Contact, type Product, type SaleStage } from '../shared/types';
import { FORM_REQUESTS_COLLECTION, type FormRequest, type FormRequestOutcome } from '../shared/types/formRequest';
import { toSortKey } from '../shared/utils/text';
import {
  buildFormNote,
  checkInterests,
  contactInterests,
  isClaimable,
  nextFormBadge,
  REJECT_REASONS,
  resolveProducts,
  sentDifferences,
} from './formRequestProcessing';

/**
 * Escucha las solicitudes pendientes (processed == false), de la más antigua a la más nueva por submittedAt
 * (índice compuesto en firestore.indexes.json). Llama a `onPending` con sus ids cada vez que cambian.
 */
export function listenPendingRequestsIn(
  db: Firestore,
  onPending: (ids: string[]) => void,
  onError: (error: unknown) => void = () => {},
): Unsubscribe {
  const pending = query(collection(db, FORM_REQUESTS_COLLECTION), where('processed', '==', false), orderBy('submittedAt'));
  return onSnapshot(pending, (snap) => onPending(snap.docs.map((d) => d.id)), onError);
}

/**
 * Reclamo en una transacción: si ya está procesada o alguien la tomó hace menos de 2 minutos, devuelve null (se salta).
 * Si no, escribe claimedAt (hora del servidor) y claimedBy (uid) y devuelve la solicitud. Si otro navegador la reclama
 * al mismo tiempo, Firestore reintenta la transacción, que entonces ve el reclamo del otro y se salta.
 */
export async function claimRequestIn(
  db: Firestore,
  requestId: string,
  uid: string,
  nowMs: () => number = Date.now,
): Promise<FormRequest | null> {
  const ref = doc(db, FORM_REQUESTS_COLLECTION, requestId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const request = snap.data() as FormRequest;
    if (!isClaimable(request, nowMs())) return null;
    tx.update(ref, { claimedAt: serverTimestamp(), claimedBy: uid });
    return request;
  });
}

/** Contacto (también inactivo) con ese correo o, si no hay, con ese país y número de teléfono. */
export async function findPersonIn(
  db: Firestore,
  sent: Pick<FormRequest, 'email' | 'phoneCountry' | 'phoneNumber'>,
): Promise<Contact | null> {
  const contacts = collection(db, COLLECTIONS.contacts);
  const toContact = (snap: { id: string; data(): unknown }) => ({ ...(snap.data() as Omit<Contact, 'id'>), id: snap.id });
  // HU-502 (criterio 1): primero por correo. El contacto guarda el correo en minúsculas (HU-203), igual que la solicitud.
  const byEmail = await getDocs(query(contacts, where('email', '==', sent.email.trim().toLowerCase()), limit(1)));
  if (!byEmail.empty) return toContact(byEmail.docs[0]);
  // Después por teléfono: mismo país y mismo número (los dos se guardan igual: ISO y solo dígitos).
  if (!sent.phoneCountry || !sent.phoneNumber) return null;
  const byPhone = await getDocs(
    query(contacts, where('phoneCountry', '==', sent.phoneCountry), where('phoneNumber', '==', sent.phoneNumber), limit(1)),
  );
  return byPhone.empty ? null : toContact(byPhone.docs[0]);
}

export type ProcessResult =
  | { status: 'skipped' }
  | { status: 'processed'; outcome: FormRequestOutcome; contactId?: string; error?: string };

/**
 * HU-502 y HU-503: procesa UNA solicitud.
 * 1. La reclama (si no se puede, se salta).
 * 2. Revisa cada producto: si alguno está mal, la cierra como 'rejected' sin tocar contactos.
 * 3. Busca a la persona por correo y después por teléfono, también entre los inactivos.
 * 4. En un solo lote (todo o nada):
 *    - crea el contacto (HU-502) o actualiza el existente (HU-503);
 *    - agrega la comunicación;
 *    - actualiza lastCommunicationAt de sus ventas abiertas sin retroceder (como HU-212);
 *    - cierra la solicitud.
 *    Las reglas solo dejan cerrar una solicitud que sigue sin procesar: si otro navegador ya la cerró, el lote completo
 *    falla y no se duplica nada.
 */
export async function processRequestIn(
  db: Firestore,
  requestId: string,
  uid: string,
  nowMs: () => number = Date.now,
): Promise<ProcessResult> {
  const request = await claimRequestIn(db, requestId, uid, nowMs);
  if (!request) return { status: 'skipped' };
  const requestRef = doc(db, FORM_REQUESTS_COLLECTION, requestId);

  const check = checkInterests(request.interests);
  if (!check.ok) return reject(db, requestRef, check.error);

  // Solo los productos indicados, no todo el catálogo.
  const productSnaps = await Promise.all(check.interests.map((i) => getDoc(doc(db, COLLECTIONS.products, i.productId))));
  const catalog = new Map(
    productSnaps.filter((s) => s.exists()).map((s) => [s.id, { ...(s.data() as Omit<Product, 'id'>), id: s.id }]),
  );
  const { products, omitted } = resolveProducts(check.interests, catalog);
  if (products.length === 0) return reject(db, requestRef, REJECT_REASONS.noneAvailable);

  const existing = await findPersonIn(db, request);
  const contactRef = existing ? doc(db, COLLECTIONS.contacts, existing.id) : doc(collection(db, COLLECTIONS.contacts));
  const submittedAt = request.submittedAt;
  const interests = contactInterests(products);
  const batch = writeBatch(db);

  if (existing) {
    // HU-503: no se crea otro contacto; clasificación, nombre, correo y teléfono no cambian; si estaba inactivo,
    // vuelve a quedar activo; los productos de interés se reemplazan.
    batch.update(contactRef, {
      interests,
      interestsUpdatedAt: submittedAt,
      status: 'activo',
      formBadge: nextFormBadge(existing.formBadge),
    });
  } else {
    // HU-502: contacto nuevo con nombre, correo y teléfono, "Persona interesada" y origen "Formulario web".
    const fullName = request.fullName.trim();
    batch.set(contactRef, {
      fullName,
      nameSortKey: toSortKey(fullName),
      email: request.email.trim().toLowerCase(),
      phoneCountry: request.phoneNumber ? request.phoneCountry : null,
      phoneNumber: request.phoneNumber ?? null,
      address: null,
      classification: 'persona_interesada',
      status: 'activo',
      origin: 'formulario_web',
      createdAt: submittedAt,
      interests,
      interestsUpdatedAt: submittedAt,
      formBadge: 'Nuevo',
    });
  }

  batch.set(doc(collection(db, COLLECTIONS.communications)), {
    contactId: contactRef.id,
    saleId: null,
    appliesToAllSales: true,
    date: submittedAt,
    medium: 'formulario_web',
    otherMedium: null,
    note: buildFormNote({
      message: request.message,
      products,
      omitted,
      differences: existing ? sentDifferences(existing, request) : [],
    }),
    source: 'formulario_web',
    userId: null,
    createdAt: serverTimestamp(),
    products,
  });

  // HU-502 (criterio 5): no se crea ninguna posible venta. Las abiertas que ya tiene se dan por comunicadas.
  if (existing) {
    const sales = await getDocs(query(collection(db, COLLECTIONS.sales), where('contactId', '==', existing.id)));
    for (const sale of sales.docs) {
      if (!isOpenSaleStage(sale.get('stage') as SaleStage)) continue;
      const current = sale.get('lastCommunicationAt') as Timestamp | null | undefined;
      if (!current || current.toMillis() < submittedAt.toMillis()) batch.update(sale.ref, { lastCommunicationAt: submittedAt });
    }
  }

  const outcome: FormRequestOutcome = existing ? 'updated' : 'created';
  batch.update(requestRef, { processed: true, processedAt: serverTimestamp(), outcome, contactId: contactRef.id });
  await batch.commit();
  return { status: 'processed', outcome, contactId: contactRef.id };
}

async function reject(db: Firestore, requestRef: DocumentReference, error: string): Promise<ProcessResult> {
  const batch = writeBatch(db);
  batch.update(requestRef, { processed: true, processedAt: serverTimestamp(), outcome: 'rejected', error });
  await batch.commit();
  return { status: 'processed', outcome: 'rejected', error };
}
