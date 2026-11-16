// Uso (ver docs/CARGA_PRODUCCION.md):
//   npm run contactos:cargar -- --project <id> --email <correo> --env <archivo> --archivo <contactos.csv> [--escribir] [--emulador]
// Carga única de los contactos iniciales (RT-02). Sin --escribir solo muestra lo que haría. Nunca borra contactos.
import { terminalReal } from './comun';
import { ejecutarCargadorContactos } from './contactos';

const { codigo } = await ejecutarCargadorContactos(process.argv.slice(2), terminalReal());
process.exit(codigo);
