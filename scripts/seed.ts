// Uso: npm run seed  (con los emuladores levantados: npm run emulators)
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { SEED_ADMIN } from './seed/seedData';
import { runSeed } from './seed/runSeed';

const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;

if (!projectId || !adminPassword) {
  console.error('Faltan VITE_FIREBASE_PROJECT_ID o SEED_ADMIN_PASSWORD en .env.development');
  process.exit(1);
}

const app = initializeApp({ projectId }, 'seed');

try {
  const summary = await runSeed(app, { adminPassword });
  console.log(`Seed listo en ${projectId}:`, summary);
  console.log(`Admin de prueba: usuario "${SEED_ADMIN.username}" (contraseña: SEED_ADMIN_PASSWORD en .env.development)`);
} catch (error) {
  console.error('Error en el seed:', error instanceof Error ? error.message : error);
  if (error instanceof Error && /ECONNREFUSED/.test(String(error.stack))) {
    console.error('¿Están levantados los emuladores? Corré `npm run emulators` en otra terminal.');
  }
  process.exitCode = 1;
} finally {
  await deleteApp(app);
}
