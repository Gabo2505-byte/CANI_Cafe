// Restauración de un respaldo (RT-06) en un EMULADOR vacío. Solo para pruebas: demuestra que el formato guarda todo lo
// necesario para volver a crear la base sin pérdida. La restauración real en producción es manual y está documentada en
// docs/CARGA_PRODUCCION.md, sección 11.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAuth } from 'firebase-admin/auth';
import type { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { DocumentoRespaldo, Manifiesto } from '../../scripts/produccion/respaldo';
import { decodificar } from '../../scripts/produccion/respaldoFormato';

const leer = <T>(ruta: string): T => JSON.parse(readFileSync(ruta, 'utf8')) as T;

/**
 * Escribe todos los documentos del respaldo en `app` (un proyecto del emulador). Aborta si no hay emulador de Firestore
 * definido, para no escribir nunca en un proyecto real. Las cuentas se crean sin contraseña (el respaldo no la trae).
 */
export async function restaurarRespaldo(carpeta: string, app: App, opciones: { cuentas?: boolean } = {}): Promise<number> {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('restaurarRespaldo solo corre contra el emulador de Firestore.');
  const db = getFirestore(app);
  const manifiesto = leer<Manifiesto>(join(carpeta, 'respaldo-manifiesto.json'));
  let restaurados = 0;
  for (const entrada of manifiesto.colecciones) {
    const { documentos } = leer<{ documentos: DocumentoRespaldo[] }>(join(carpeta, entrada.archivo));
    for (let i = 0; i < documentos.length; i += 400) {
      const lote = db.batch();
      for (const d of documentos.slice(i, i + 400)) lote.set(db.doc(d.ruta), decodificar(d.datos, db) as Record<string, unknown>);
      await lote.commit();
    }
    restaurados += documentos.length;
  }
  if (opciones.cuentas) {
    if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Las cuentas solo se restauran en el emulador de Authentication.');
    const { cuentas } = leer<{ cuentas: { uid: string; email: string | null; displayName: string | null; disabled: boolean }[] }>(
      join(carpeta, manifiesto.authentication.archivo),
    );
    for (const c of cuentas) {
      await getAuth(app).createUser({ uid: c.uid, email: c.email ?? undefined, displayName: c.displayName ?? undefined, disabled: c.disabled });
    }
  }
  return restaurados;
}
