// Etiquetas de navegación y de la gestión de ventas que cambiaron por decisión del equipo (2026-10-20, tras el
// feedback del mentor). Prevalecen sobre las del documento de requisitos (HU-103, HU-301, HU-305 y HU-308).
// Los demás textos con "posible venta" (mensajes, pestaña de la ficha, columnas) no cambiaron y siguen en su módulo.

/** Opciones de la barra superior (HU-103). En pantalla van en mayúsculas por CSS. */
export const NAV_LABELS = {
  contacts: 'Contactos',
  sales: 'Gestión de ventas',
  alerts: 'Avisos',
} as const;

export const SALES_LABELS = {
  /** Título de la pantalla del tablero (HU-305). */
  boardTitle: 'Gestión de ventas',
  /** Botón para crear una venta, en el tablero y en la ficha del contacto (HU-301). El "+" es decorativo: AddButtonLabel. */
  newRecord: 'Nuevo registro',
  /** Título de la pantalla del formulario (HU-301). */
  newRecordTitle: 'Nuevo registro',
  /** Enlace de regreso al tablero desde el detalle (HU-308) y desde el formulario. */
  backToBoard: '← Volver a gestión de ventas',
} as const;
