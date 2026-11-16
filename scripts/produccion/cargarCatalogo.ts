// Uso (ver docs/CARGA_PRODUCCION.md):
//   npm run catalogo:cargar -- --project <id> --email <correo> --env <archivo> [--escribir] [--emulador]
// Sin --escribir solo muestra lo que haría. Nunca borra productos.
import { terminalReal } from './comun';
import { ejecutarCargador } from './catalogo';

const { codigo } = await ejecutarCargador(process.argv.slice(2), terminalReal());
process.exit(codigo);
