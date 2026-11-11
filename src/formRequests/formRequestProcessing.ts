// HU-502 y HU-503: procesamiento de una solicitud del formulario del sitio web. Funciones puras (sin Firestore ni
// React; se prueban con Vitest). La escritura está en formRequestsRepository.ts.
import { formatPhone } from '../shared/phone/phone';
import type { CommunicationProduct, Contact, FormBadge, Product } from '../shared/types';
import { FORM_REQUEST_LIMITS, type FormRequest } from '../shared/types/formRequest';

/** Un reclamo vence a los 2 minutos: si el navegador que la tomó se cerró a la mitad, otro la retoma. */
export const CLAIM_TTL_MS = 2 * 60 * 1000;

/** Largo máximo de la nota de una comunicación del formulario (también en firestore.rules). */
export const FORM_NOTE_MAX = 8000;

export const FORM_PROCESSING_TEXTS = {
  /** HU-502 (criterio 4): texto literal cuando la persona no escribió mensaje. */
  noMessage: 'Sin mensaje',
  /** Texto no definido en la HU: encabezado de la lista de productos dentro de la nota. */
  productsHeader: 'Productos:',
  /** HU-503 (criterio 5): texto literal de la línea de diferencias. */
  differences: 'Datos enviados distintos a los registrados:',
  /** Contrato v3 (punto 9). */
  omitted: (n: number) => `Productos no disponibles omitidos: ${n}.`,
  /** Texto no definido en la HU: si la lista no cabe en la nota (no pasa con el catálogo actual). */
  more: (n: number) => `… y ${n} productos más.`,
} as const;

/** Motivos de rechazo (se guardan en `error` de la solicitud, hasta 500 caracteres). */
export const REJECT_REASONS = {
  noProducts: 'La solicitud no trae productos.',
  malformed: 'Un producto de la solicitud está mal formado.',
  quantity: `Una cantidad no es un número entero entre ${FORM_REQUEST_LIMITS.minQuantity} y ${FORM_REQUEST_LIMITS.maxQuantity}.`,
  repeated: 'Un producto viene repetido en la solicitud.',
  tooMany: `La solicitud trae más de ${FORM_REQUEST_LIMITS.maxInterests} productos.`,
  noneAvailable: 'Ninguno de los productos enviados existe en el catálogo.',
} as const;

export interface ValidInterest {
  productId: string;
  quantity: number;
}

export type InterestsCheck = { ok: true; interests: ValidInterest[] } | { ok: false; error: string };

/**
 * Contrato v3 (punto 9): las reglas solo revisan que `interests` sea una lista de 1 a 72, así que aquí se revisa cada
 * elemento. Una cantidad no entera o fuera de 1 a 9999, un elemento mal formado o un producto repetido rechazan la
 * solicitud completa.
 */
export function checkInterests(interests: unknown): InterestsCheck {
  if (!Array.isArray(interests) || interests.length === 0) return { ok: false, error: REJECT_REASONS.noProducts };
  if (interests.length > FORM_REQUEST_LIMITS.maxInterests) return { ok: false, error: REJECT_REASONS.tooMany };
  const seen = new Set<string>();
  const valid: ValidInterest[] = [];
  for (const item of interests) {
    if (typeof item !== 'object' || item === null) return { ok: false, error: REJECT_REASONS.malformed };
    const keys = Object.keys(item);
    const { productId, quantity } = item as Record<string, unknown>;
    if (keys.length !== 2 || typeof productId !== 'string' || productId.trim() === '' || typeof quantity !== 'number') {
      return { ok: false, error: REJECT_REASONS.malformed };
    }
    if (!Number.isInteger(quantity) || quantity < FORM_REQUEST_LIMITS.minQuantity || quantity > FORM_REQUEST_LIMITS.maxQuantity) {
      return { ok: false, error: REJECT_REASONS.quantity };
    }
    if (seen.has(productId)) return { ok: false, error: REJECT_REASONS.repeated };
    seen.add(productId);
    valid.push({ productId, quantity });
  }
  return { ok: true, interests: valid };
}

export interface ResolvedProducts {
  /** Los que existen en el catálogo (activos o no), con el nombre y la presentación de este momento. */
  products: CommunicationProduct[];
  /** Cuántos ya no existen. */
  omitted: number;
}

/**
 * Contrato v3 (punto 9): un producto que no existe se omite; uno inactivo se acepta (la persona lo vio activo al
 * enviar). Se respeta el orden en que llegaron (el del catálogo).
 */
export function resolveProducts(interests: ValidInterest[], catalog: ReadonlyMap<string, Product>): ResolvedProducts {
  const products: CommunicationProduct[] = [];
  let omitted = 0;
  for (const { productId, quantity } of interests) {
    const product = catalog.get(productId);
    if (!product) omitted += 1;
    else products.push({ productId, name: product.name, presentation: product.presentation, quantity });
  }
  return { products, omitted };
}

type ContactData = Pick<Contact, 'fullName' | 'email' | 'phoneCountry' | 'phoneNumber'>;
type SentData = Pick<FormRequest, 'fullName' | 'email' | 'phoneCountry' | 'phoneNumber'>;

const sameText = (a: string | null, b: string) => (a ?? '').trim().toLowerCase() === b.trim().toLowerCase();

/**
 * HU-503 (criterio 5): datos enviados distintos a los guardados, con etiquetas fijas: "Nombre: X.", "Correo: Y.",
 * "Teléfono: +506 8811-2233.". Nombre y correo no distinguen mayúsculas. Un dato guardado vacío y uno enviado con valor
 * cuenta como distinto; un dato que no se envió (teléfono opcional), no.
 */
export function sentDifferences(stored: ContactData, sent: SentData): string[] {
  const parts: string[] = [];
  if (!sameText(stored.fullName, sent.fullName)) parts.push(`Nombre: ${sent.fullName.trim()}.`);
  if (!sameText(stored.email, sent.email)) parts.push(`Correo: ${sent.email.trim()}.`);
  if (sent.phoneCountry && sent.phoneNumber) {
    const same = stored.phoneCountry === sent.phoneCountry && stored.phoneNumber === sent.phoneNumber;
    if (!same) parts.push(`Teléfono: ${formatPhone(sent.phoneCountry, sent.phoneNumber)}.`);
  }
  return parts;
}

/** Una línea por producto: "- Villa Sarchí (Bolsa de 340 g, grano entero): 2". */
export function productLine(product: Pick<CommunicationProduct, 'name' | 'presentation' | 'quantity'>): string {
  return `- ${product.name} (${product.presentation}): ${product.quantity}`;
}

/**
 * HU-502 (criterio 4) y HU-503 (criterios 3 y 5): la nota de la comunicación.
 *   el mensaje (o "Sin mensaje")
 *   "Productos:" y una línea por producto con su cantidad
 *   "Productos no disponibles omitidos: N." (si hubo)
 *   al final, "Datos enviados distintos a los registrados: …" (si hubo)
 * Nunca pasa de FORM_NOTE_MAX: si la lista de productos no cabe, se corta con "… y N productos más.".
 */
export function buildFormNote(input: {
  message: string | null;
  products: CommunicationProduct[];
  omitted: number;
  differences: string[];
}): string {
  const message = input.message?.trim() ? input.message.trim() : FORM_PROCESSING_TEXTS.noMessage;
  const tail: string[] = [];
  if (input.omitted > 0) tail.push(FORM_PROCESSING_TEXTS.omitted(input.omitted));
  if (input.differences.length > 0) tail.push(`${FORM_PROCESSING_TEXTS.differences} ${input.differences.join(' ')}`);

  const assemble = (lines: string[]) =>
    [message, [FORM_PROCESSING_TEXTS.productsHeader, ...lines].join('\n'), ...tail].join('\n\n');

  const lines = input.products.map(productLine);
  let note = assemble(lines);
  for (let shown = lines.length - 1; note.length > FORM_NOTE_MAX && shown > 0; shown -= 1) {
    note = assemble([...lines.slice(0, shown), FORM_PROCESSING_TEXTS.more(lines.length - shown)]);
  }
  return note;
}

/** ¿Se puede tomar ahora? No si ya se procesó o si alguien la tomó hace menos de 2 minutos. */
export function isClaimable(
  request: Pick<FormRequest, 'processed'> & { claimedAt?: { toMillis(): number } | null },
  nowMs: number,
): boolean {
  if (request.processed) return false;
  if (!request.claimedAt) return true;
  return nowMs - request.claimedAt.toMillis() >= CLAIM_TTL_MS;
}

/** HU-504: la etiqueta que queda. Un contacto con 'Nuevo' sin abrir sigue en 'Nuevo' (todavía no se revisó). */
export function nextFormBadge(current: FormBadge | null | undefined): FormBadge {
  return current === 'Nuevo' ? 'Nuevo' : 'Nuevo mensaje';
}

/** Productos de interés que se guardan en el contacto (HU-209): solo los que existen, con su cantidad. */
export function contactInterests(products: CommunicationProduct[]): ValidInterest[] {
  return products.map(({ productId, quantity }) => ({ productId, quantity }));
}
