import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const env = import.meta.env;

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisá .env.example.`);
  }
  return value;
}

function splitHost(hostAndPort: string): { host: string; port: number } {
  const [host, port] = hostAndPort.split(':');
  return { host, port: Number(port) };
}

export const firebaseApp = initializeApp({
  apiKey: required('VITE_FIREBASE_API_KEY', env.VITE_FIREBASE_API_KEY),
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: required('VITE_FIREBASE_PROJECT_ID', env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

export const usingEmulators = env.VITE_USE_EMULATORS === 'true';

if (usingEmulators) {
  const authHost = required('VITE_AUTH_EMULATOR_HOST', env.VITE_AUTH_EMULATOR_HOST);
  const firestore = splitHost(required('VITE_FIRESTORE_EMULATOR_HOST', env.VITE_FIRESTORE_EMULATOR_HOST));
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
  connectFirestoreEmulator(db, firestore.host, firestore.port);
} else if (firebaseApp.options.projectId?.startsWith('demo-')) {
  console.warn('Proyecto demo-* sin emuladores: activá VITE_USE_EMULATORS=true.');
}
