// Uso (ver docs/CARGA_PRODUCCION.md, sección 11):
//   npm run bd:respaldar -- --project cani-cafe --env .env.production.local [--salida <carpeta>]
//   npm run bd:respaldar -- --project cani-cafe --env .env.production.local --verificar <carpeta>
//   npm run bd:respaldar -- --project demo-cani-crm --env .env.development --emulador
// Copia de la base de datos de producción a archivos JSON (RT-06). SOLO LECTURA: nunca escribe en Firestore ni en
// Authentication. Usa las credenciales de gcloud (gcloud auth application-default login), nunca archivos de clave.
import { terminalReal } from './comun';
import { ejecutarRespaldo } from './respaldo';

const { codigo } = await ejecutarRespaldo(process.argv.slice(2), terminalReal());
process.exit(codigo);
