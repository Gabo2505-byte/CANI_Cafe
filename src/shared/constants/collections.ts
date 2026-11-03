// Nombres de colecciones de Firestore. Contrato compartido: no cambiar sin avisar a Gabriel y Dylan.
export const COLLECTIONS = {
  users: 'users',
  /** HU-101 y HU-106: usuario → cuenta (id del documento = usuario normalizado). Ver src/auth/usernameDirectory.ts */
  usernames: 'usernames',
  /** HU-107: último enlace de recuperación pedido por cada usuario (id = usuario normalizado). Ver src/auth/passwordResetLinks.ts */
  passwordResets: 'passwordResets',
  contacts: 'contacts',
  communications: 'communications',
  products: 'products',
  sales: 'sales',
  saleProducts: 'saleProducts',
  stageHistory: 'stageHistory',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
