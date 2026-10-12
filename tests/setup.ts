import { beforeEach } from 'vitest';

// La hora de última actividad (HU-105) vive en localStorage: cada prueba arranca limpia.
beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear();
});
