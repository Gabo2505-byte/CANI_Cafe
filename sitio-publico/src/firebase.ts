// Firebase del sitio público: SOLO Cloud Firestore Lite (sin Firebase Auth). Lite trabaja por REST: sin caché ni
// escrituras en cola, una operación sin conexión falla al momento (HU-405.4). No importa src/shared/firebase/config.ts,
// que inicializa también Auth para el sistema interno.
import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore/lite';

const env = import.meta.env;

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisá .env.example.`);
  }
  return value;
}

const firebaseApp = initializeApp({
  apiKey: required('VITE_FIREBASE_API_KEY', env.VITE_FIREBASE_API_KEY),
  projectId: required('VITE_FIREBASE_PROJECT_ID', env.VITE_FIREBASE_PROJECT_ID),
  appId: env.VITE_FIREBASE_APP_ID,
});

export const db = getFirestore(firebaseApp);

if (env.VITE_USE_EMULATORS === 'true') {
  const [host, port] = required('VITE_FIRESTORE_EMULATOR_HOST', env.VITE_FIRESTORE_EMULATOR_HOST).split(':');
  connectFirestoreEmulator(db, host, Number(port));
}
