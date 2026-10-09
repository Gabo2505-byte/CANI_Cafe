/** Colección `users`. El id del documento es el uid de Firebase Auth. */
export interface User {
  id: string;
  username: string;
  email: string;
  /** Solo usuarios activos pueden leer/escribir (ver firestore.rules). */
  active: boolean;
}
