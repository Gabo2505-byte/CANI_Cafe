import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Unitarias y de componentes (jsdom): no necesitan emuladores.
    include: ['tests/unit/**/*.test.ts', 'tests/components/**/*.test.tsx'],
    environment: 'node',
  },
});
