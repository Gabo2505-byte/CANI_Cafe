import { beforeEach, vi } from 'vitest';

// La hora de última actividad (HU-105) vive en localStorage: cada prueba arranca limpia.
beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear();
});

// HU-316: la barra superior cuenta los avisos en todas las pantallas. Las pruebas de pantalla no consultan
// Firestore: sin avisos por defecto (las de HU-314/315/316 lo reemplazan con sus propios avisos).
vi.mock('../src/sales/alertsApi', () => ({ listAlerts: vi.fn().mockResolvedValue([]) }));
