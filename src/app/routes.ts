export const ROUTES = {
  login: '/ingreso',
  contacts: '/contactos',
  newContact: '/contactos/nuevo',
  contactDetail: '/contactos/:contactId',
  salesBoard: '/posibles-ventas',
  newSale: '/posibles-ventas/nueva',
  saleDetail: '/posibles-ventas/:saleId',
  alerts: '/avisos',
  forgotPassword: '/recuperar-contrasena',
} as const;

/** Ruta de la ficha de un contacto. */
export function contactPath(contactId: string): string {
  return `${ROUTES.contacts}/${encodeURIComponent(contactId)}`;
}

/** Formulario de nueva posible venta; con contactId (desde la ficha) el contacto viene elegido. */
export function newSalePath(contactId?: string): string {
  return contactId ? `${ROUTES.newSale}?contactId=${encodeURIComponent(contactId)}` : ROUTES.newSale;
}

/** Detalle de una posible venta. */
export function saleDetailPath(saleId: string): string {
  return `${ROUTES.salesBoard}/${encodeURIComponent(saleId)}`;
}

/** Pantalla a la que se llega después de ingresar si no se pidió otra. */
export const DEFAULT_ROUTE = ROUTES.contacts;

/**
 * Ruta segura para redirigir después del ingreso. Solo acepta rutas internas
 * (evita redirecciones a otros sitios) y nunca vuelve a la pantalla de ingreso.
 */
export function safeRedirect(target: string | null | undefined): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return DEFAULT_ROUTE;
  }
  const path = target.split(/[?#]/)[0];
  if (path === ROUTES.login || path === '/') return DEFAULT_ROUTE;
  return target;
}

/** URL de ingreso que recuerda la pantalla que la persona intentó abrir. */
export function loginPathFor(target: string): string {
  const redirect = safeRedirect(target);
  return redirect === DEFAULT_ROUTE ? ROUTES.login : `${ROUTES.login}?redirect=${encodeURIComponent(redirect)}`;
}
