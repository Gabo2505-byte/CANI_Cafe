// HU-104: mensajes del cierre de sesión.
export const LOGOUT_SUCCESS_MESSAGE = 'Sesión cerrada correctamente.';
export const LOGOUT_ERROR_MESSAGE = 'No se pudo cerrar la sesión. Intente de nuevo.';

// HU-105: protección del sistema interno.
export const LOGIN_REQUIRED_MESSAGE = 'Debe iniciar sesión para acceder al sistema.';
export const INACTIVITY_MESSAGE = 'Su sesión se cerró por inactividad. Ingrese de nuevo.';

/** Estado que se pasa a la pantalla de ingreso al navegar (React Router `state`). */
export interface LoginLocationState {
  notice?: string;
}
