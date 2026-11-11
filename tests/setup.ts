import { beforeEach, vi } from 'vitest';

// La hora de última actividad (HU-105) vive en localStorage: cada prueba arranca limpia.
beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear();
});

// HU-316: la barra superior cuenta los avisos en todas las pantallas. Las pruebas de pantalla no consultan
// Firestore: sin avisos por defecto (las de HU-314/315/316 lo reemplazan con sus propios avisos).
vi.mock('../src/sales/alertsApi', () => ({ listAlerts: vi.fn().mockResolvedValue([]) }));

// Al ingresar se llega a "Contactos": las pruebas que no mockean los contactos (ingreso, barra, avisos, protección)
// intentaban conectarse a Firestore y su aviso de conexión a veces llegaba cuando Vitest ya cerraba ("Closing rpc
// while onUserConsoleLog was pending"). Por defecto no hay contactos; las pruebas de contactos usan su propio mock.
vi.mock('../src/contacts/contactsApi', () => ({
  createContact: vi.fn(),
  getContact: vi.fn().mockResolvedValue(null),
  updateContact: vi.fn(),
  findDuplicateContacts: vi.fn().mockResolvedValue({}),
  listAllContacts: vi.fn().mockResolvedValue([]),
}));

// HU-504: la barra superior cuenta los contactos con etiqueta y la ficha quita la etiqueta al abrirse. Por defecto no
// hay etiquetas y quitarla no hace nada (las pruebas de HU-504 lo reemplazan).
vi.mock('../src/contacts/formBadgesApi', () => ({
  listenFormBadgeCount: vi.fn((onCount: (count: number) => void) => {
    onCount(0);
    return () => {};
  }),
  clearFormBadge: vi.fn().mockResolvedValue(undefined),
}));

// HU-502 y HU-503: las pantallas internas procesan el formulario del sitio web (AppLayout). En las pruebas de pantalla
// no hay solicitudes pendientes ni se consulta Firestore; las del procesador usan su propio mock.
vi.mock('../src/formRequests/formRequestsApi', () => ({
  listenPendingFormRequests: vi.fn(() => () => {}),
  processFormRequest: vi.fn().mockResolvedValue({ status: 'skipped' }),
}));
