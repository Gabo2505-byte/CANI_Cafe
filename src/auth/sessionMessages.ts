// HU-104: mensajes del cierre de sesión.
export const LOGOUT_SUCCESS_MESSAGE = 'Sesión cerrada correctamente.';
export const LOGOUT_ERROR_MESSAGE = 'No se pudo cerrar la sesión. Intente de nuevo.';

/** Estado que se pasa a la pantalla de ingreso al navegar (React Router `state`). */
export interface LoginLocationState {
  notice?: string;
}
