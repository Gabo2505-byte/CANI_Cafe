import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Unitarias: no necesitan emuladores.
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
