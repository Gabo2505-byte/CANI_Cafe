import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Se ejecuta dentro de `firebase emulators:exec` (ver script test:emulators).
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts', 'tests/seed/**/*.test.ts'],
    environment: 'node',
    env: loadEnv('test', process.cwd(), ''),
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
