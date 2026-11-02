// @vitest-environment node
// Aislamiento del sitio público: su build no debe arrastrar código del sistema interno ni Firebase Auth, y el
// bundle no debe nombrar rutas, textos ni servicios del administrador.
import { resolve } from 'node:path';
import { build, type Plugin, type Rollup } from 'vite';
import { beforeAll, describe, expect, it } from 'vitest';

const FORBIDDEN_MODULES = [
  /[\\/]src[\\/](auth|sales|contacts|communications|app)[\\/]/,
  /[\\/]src[\\/]shared[\\/]firebase[\\/]config/,
  /[\\/]firebase[\\/]auth/,
  /@firebase[\\/]auth/,
  // El sitio público usa Firestore Lite: el SDK completo (con su canal en tiempo real y su cola de escrituras) no debe
  // entrar, ni por un import de "firebase/firestore" (sin /lite) ni a través de otro módulo.
  /[\\/]firebase[\\/]firestore[\\/](?!lite[\\/])/,
  /@firebase[\\/]firestore[\\/]dist[\\/](?!lite[\\/])/,
  // El canal en tiempo real del SDK completo. (Lite también usa @firebase/webchannel-wrapper/bloom-blob, que son solo
  // utilidades de hash: ese no se prohíbe.)
  /@firebase[\\/]webchannel-wrapper[\\/](dist[\\/])?webchannel-blob/,
];

const FORBIDDEN_TEXT = [
  'identitytoolkit.googleapis.com',
  'securetoken',
  '/ingreso',
  '/posibles-ventas',
  '/avisos',
  'Cerrar sesión',
  'Gestión de ventas',
  '₡',
];

// connectFirestoreEmulator (firebase/firestore) trae createMockUserToken de @firebase/util, que arma tokens falsos
// del emulador con este emisor: es un texto, no una llamada al servicio de tokens de Auth. Solo se tolera ese texto.
const ALLOWED_TEXT = ['https://securetoken.google.com/'];

const moduleIds = new Set<string>();
let bundleText = '';

/** Anota cada módulo que entra al grafo (incluidos los que luego se descartan por no usarse). */
const recordModules: Plugin = {
  name: 'registrar-modulos',
  enforce: 'pre',
  load(id) {
    moduleIds.add(id);
    return null;
  },
};

beforeAll(async () => {
  const result = await build({
    configFile: resolve('sitio-publico/vite.config.ts'),
    mode: 'production',
    logLevel: 'silent',
    plugins: [recordModules],
    build: { write: false },
  });
  const outputs = (Array.isArray(result) ? result : [result]) as Rollup.RollupOutput[];
  for (const { output } of outputs) {
    for (const file of output) {
      if (file.type === 'chunk') {
        file.moduleIds.forEach((id) => moduleIds.add(id));
        bundleText += file.code;
      } else if (typeof file.source === 'string') {
        bundleText += file.source;
      }
    }
  }
}, 60_000);

describe('build del sitio público', () => {
  it('recoge el grafo de módulos del sitio público', () => {
    const ids = [...moduleIds].map((id) => id.replaceAll('\\', '/'));
    expect(ids.some((id) => id.endsWith('sitio-publico/src/main.tsx'))).toBe(true);
    expect(bundleText.length).toBeGreaterThan(0);
  });

  it.each(FORBIDDEN_MODULES.map((pattern) => [String(pattern), pattern] as const))(
    'no incluye módulos que coincidan con %s',
    (_name, pattern) => {
      expect([...moduleIds].filter((id) => pattern.test(id))).toEqual([]);
    },
  );

  it.each(FORBIDDEN_TEXT)('el bundle no contiene "%s"', (text) => {
    const checked = ALLOWED_TEXT.reduce((acc, allowed) => acc.replaceAll(allowed, ''), bundleText);
    expect(checked.includes(text)).toBe(false);
  });
});
