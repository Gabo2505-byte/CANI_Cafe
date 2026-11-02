import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sitio público (HU-401 a HU-405): segunda aplicación del mismo repositorio. Las rutas son relativas a la raíz del
// repositorio (los scripts de package.json corren desde ahí). Lee los mismos .env que el sistema interno.
export default defineConfig({
  plugins: [react()],
  root: 'sitio-publico',
  envDir: '..',
  build: {
    outDir: '../dist-publico',
    emptyOutDir: true,
  },
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
});
