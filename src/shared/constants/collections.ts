// Nombres de colecciones de Firestore. Contrato compartido: no cambiar sin avisar a Gabriel y Dylan.
export const COLLECTIONS = {
  users: 'users',
  /** HU-101 y HU-106: usuario → cuenta (id del documento = usuario normalizado). Ver src/auth/usernameDirectory.ts */
  usernames: 'usernames',
  contacts: 'contacts',
  communications: 'communications',
  products: 'products',
  sales: 'sales',
  saleProducts: 'saleProducts',
  stageHistory: 'stageHistory',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
