// Uso (ver docs/CARGA_PRODUCCION.md):
//   npm run cuenta:nombre-visible -- --project <id> --email <correo> --env <archivo> --usuario <usuario> [--escribir] [--emulador]
// Sin --escribir solo informa. Nunca corrige users ni usernames: solo avisa de las diferencias.
import { terminalReal } from './comun';
import { ejecutarNombreVisible } from './nombreVisible';

const { codigo } = await ejecutarNombreVisible(process.argv.slice(2), terminalReal());
process.exit(codigo);
