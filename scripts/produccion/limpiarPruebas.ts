// Uso (ver docs/CARGA_PRODUCCION.md, sección 10):
//   npm run pruebas:limpiar -- --project cani-cafe --env .env.production.local [--borrar]
//   npm run pruebas:limpiar -- --project demo-cani-crm --env .env.development --emulador [--borrar]
// Limpieza única de los datos de prueba (RT-01): contactos "PRUEBA..." y todo lo que cuelga de ellos. Sin --borrar solo
// muestra lo que borraría. Usa las credenciales de gcloud (gcloud auth application-default login), nunca archivos de clave.
import { terminalReal } from './comun';
import { ejecutarLimpieza } from './limpieza';

const { codigo } = await ejecutarLimpieza(process.argv.slice(2), terminalReal());
process.exit(codigo);
