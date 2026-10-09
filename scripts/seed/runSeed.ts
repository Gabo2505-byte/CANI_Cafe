import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '../../src/shared/constants/collections';
import {
  SEED_ADMIN,
  seedCommunications,
  seedContacts,
  seedSales,
  seedUsers,
  type Seeded,
} from './seedData';

export interface SeedSummary {
  users: number;
  contacts: number;
  communications: number;
  sales: number;
}

/** Aborta si no estamos contra los emuladores con un proyecto demo-*. */
export function assertEmulatorTarget(projectId: string): void {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('El seed solo corre contra los emuladores: faltan FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST.');
  }
  if (!projectId.startsWith('demo-')) {
    throw new Error(`El seed solo corre en proyectos demo-* (recibido: "${projectId}").`);
  }
}

async function ensureAdminAuthUser(app: App, password: string): Promise<void> {
  const auth = getAuth(app);
  const profile = { email: SEED_ADMIN.email, password, displayName: SEED_ADMIN.username, emailVerified: true };
  try {
    await auth.getUser(SEED_ADMIN.uid);
    await auth.updateUser(SEED_ADMIN.uid, profile);
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    await auth.createUser({ uid: SEED_ADMIN.uid, ...profile });
  }
}

/**
 * Carga los datos de prueba. Idempotente: IDs fijos + set() (sobrescribe), así que correrlo
 * varias veces deja exactamente el mismo estado, sin duplicados.
 */
export async function runSeed(app: App, options: { adminPassword: string }): Promise<SeedSummary> {
  const projectId = app.options.projectId ?? '';
  assertEmulatorTarget(projectId);

  await ensureAdminAuthUser(app, options.adminPassword);

  const db = getFirestore(app);
  const batch = db.batch();
  const put = <T extends { id: string }>(collection: string, docs: Seeded<T>[]) => {
    for (const { id, data } of docs) batch.set(db.collection(collection).doc(id), data);
  };

  put(COLLECTIONS.users, seedUsers);
  put(COLLECTIONS.contacts, seedContacts);
  put(COLLECTIONS.sales, seedSales);
  put(COLLECTIONS.communications, seedCommunications);
  await batch.commit();

  return {
    users: seedUsers.length,
    contacts: seedContacts.length,
    communications: seedCommunications.length,
    sales: seedSales.length,
  };
}
