import type { Timestamp } from 'firebase/firestore';

/** Colección `users`. El id del documento es el uid de Firebase Auth. */
export interface User {
  id: string;
  username: string;
  email: string;
  /** Solo usuarios activos pueden leer/escribir (ver firestore.rules). */
  active: boolean;
}

/**
 * Colección `usernames`: el id del documento es el usuario normalizado (src/auth/username.ts).
 * La pantalla de ingreso pide "Usuario", pero Firebase Auth autentica por correo: este índice dice qué correo
 * tiene la cuenta de ese usuario. Sin sesión solo se puede leer un documento por su id exacto (ver firestore.rules).
 */
export interface UsernameEntry {
  /** uid de Firebase Auth (= id de users/{uid}). */
  uid: string;
  /** Correo real de la cuenta en Firebase Auth: ahí llega el enlace de recuperación (HU-107). */
  email: string;
}

/**
 * Colección `passwordResets` (HU-107): el último enlace de recuperación que pidió cada usuario.
 * El id es el usuario normalizado. Un enlace solo sirve si es este (mismo `rid`), no se usó y no pasaron 30 minutos.
 */
export interface PasswordResetRequest {
  /** Identificador aleatorio del enlace; viaja dentro del enlace del correo. */
  rid: string;
  /** Hora del servidor al pedirlo. */
  requestedAt: Timestamp;
  /** true cuando ya se creó la nueva contraseña con ese enlace. */
  used: boolean;
}
