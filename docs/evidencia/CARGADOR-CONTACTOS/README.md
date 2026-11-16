# Evidencia: cargador de los contactos iniciales (RT-02)

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-11-16 · **Rama:** `dylan-cargador-contactos`

> Script de **una sola vez** para cargar los contactos iniciales de CANI Café desde un CSV, con el mismo patrón del
> cargador de productos. No es una función de la aplicación ni se agrega a la interfaz. Escrito y probado **solo contra
> los emuladores**; no se ejecutó contra ningún proyecto real de Firebase. Guía de uso:
> [docs/CARGA_PRODUCCION.md](../../CARGA_PRODUCCION.md), sección 9.

## Decisión

Un tercer script en `scripts/produccion/` que reutiliza `comun.ts` (argumentos, archivo de configuración web,
protecciones de proyecto, contraseña oculta, confirmación del projectId, sesión del administrador con el SDK de cliente) y
las funciones de normalización y validación de la propia aplicación. Sin cambios en `firestore.rules`: las reglas de
`contacts` solo piden un usuario activo y no restringen `origin` ni `classification`, así que "Carga inicial"
(`carga_inicial`, ya existente en `CONTACT_ORIGINS`) se puede crear con las reglas actuales.

## Qué hace

| Archivo | Contenido |
|---|---|
| `scripts/produccion/contactos.ts` | Lógica: lectura del CSV (coma o punto y coma, BOM, comillas), validación de cada fila, detección de repetidos (en el archivo y en Firestore), plan, escritura y flujo completo. |
| `scripts/produccion/cargarContactos.ts` | Punto de entrada: `npm run contactos:cargar -- --project <id> --email <correo> --env <archivo> --archivo <csv> [--escribir] [--emulador]`. |
| `package.json` | Script npm `contactos:cargar`. |
| `.gitignore` | Ignora `*.csv`: los contactos reales nunca se versionan. |
| `tests/unit/produccionContactos.test.ts` | Pruebas unitarias del analizador y las reglas. |
| `tests/produccion/contactos.emulator.test.ts` | Pruebas del flujo completo contra los emuladores. |
| `docs/CARGA_PRODUCCION.md` | Sección 9: uso, columnas, ejemplo ficticio y qué se omite. |

**No cambian:** `src/`, `sitio-publico/`, `firestore.rules`, `firestore.indexes.json`, el seed y el cargador de productos.

### Reutilizado de la aplicación (sin copiar)

- `isValidEmail`, `normalizeEmail` y `CONTACT_LIMITS` (`src/contacts/contactForm.ts`): formato y largos del correo, el nombre y la dirección.
- `normalizePhoneDigits`, `validatePhoneNumber`, `phoneKey` y `DEFAULT_PHONE_COUNTRY` (`src/shared/phone/phone.ts`): solo dígitos, 8 en Costa Rica y 6 a 14 en otros países, y la clave código + número para comparar teléfonos.
- `toSortKey` (`src/shared/utils/text.ts`) para `nameSortKey`.
- El documento tiene los mismos campos que `createContactIn` (`fullName`, `nameSortKey`, `email`, `phoneCountry`, `phoneNumber`, `address`, `classification`, `status`, `origin`, `createdAt` con `serverTimestamp()`), con `status: 'activo'`, `origin: 'carga_inicial'` y la clasificación indicada en el archivo.

### Decisiones de detalle

- **Un dato escrito pero inválido omite la fila**, igual que lo rechazaría el formulario del sistema: un correo mal escrito no se descarta en silencio aunque la fila traiga un teléfono válido. Se informa para que CANI Café lo corrija.
- **Repetidos dentro del archivo**: se compara solo contra las filas que sí se cargan. Si la primera fila con un correo se omite por otro motivo, la siguiente con ese correo ocupa su lugar.
- **Repetidos contra Firestore**: se lee la colección `contacts` completa una vez (activos e inactivos) y se comparan el correo en minúsculas y el teléfono por código de llamada + número (`phoneKey`). Una consulta por fila costaría dos lecturas por contacto.
- **Código de país → país ISO**: `506` → `CR`; para los códigos compartidos se usa el país principal (`1` → `US`, `44` → `GB`, `7` → `RU`...). Un código que ningún país usa omite la fila.
- **Sin ids fijos**: cada contacto es un `addDoc`. La idempotencia viene de omitir lo que ya existe (si se corta a la mitad, repetir el comando es seguro). Un solo `addDoc` por contacto, en secuencia, como el cargador de productos, porque las reglas hacen 2 lecturas por escritura.
- **Privacidad**: el script solo lee el CSV de la ruta dada. No crea copias ni archivos. La salida muestra número de fila, nombre y motivo, y nunca correos ni teléfonos. Las pruebas generan su CSV ficticio en una carpeta temporal.

## Criterios (RT-02)

| # | Requisito | Resultado | Evidencia |
|---|---|---|---|
| C1 | Archivo CSV UTF-8, separador coma o punto y coma; columnas `nombre_completo`, `correo`, `telefono`, `codigo_pais`, `direccion`, `clasificacion`. | ✅ Cumple | Unitarias: separador, BOM, CRLF, comillas con separador y saltos de línea, columnas en otro orden o ausentes, columna desconocida o repetida, archivo vacío o no UTF-8. |
| C2 | No se carga la fila sin nombre completo. | ✅ Cumple | Unitaria de `validarFila`; emulador (fila 5). |
| C3 | No se carga la fila sin un correo o un teléfono válido. | ✅ Cumple | Unitarias: sin ninguno, correo inválido. Emulador (fila 6). |
| C4 | No se carga la fila con teléfono de largo inválido (8 en Costa Rica; 6 a 14 en otros países). | ✅ Cumple | Unitarias: 7 y 9 dígitos en CR, 5 y 15 en otro país, aunque el correo sea válido. Emulador (fila 7). |
| C5 | Si un correo o teléfono (mismo país y número) se repite en el archivo, solo se carga la primera fila. | ✅ Cumple | Unitarias: correo con otras mayúsculas, teléfono con otro formato, mismo número en otro país (no es repetido). Emulador (fila 8). |
| C6 | No se carga si ya existe en Firestore un contacto con ese correo o teléfono, incluidos los inactivos. | ✅ Cumple | Emulador: contacto inactivo (fila 9), y un homónimo con el teléfono en otro formato. |
| C7 | Quedan activos, con origen "Carga inicial", la clasificación indicada y la misma forma de documento que la app. | ✅ Cumple | Emulador: los 4 documentos con exactamente los campos de la app, `status: activo`, `origin: carga_inicial`, `createdAt` con `Timestamp`. Correo en minúsculas. |
| C8 | `codigo_pais` vacío es 506; `clasificacion` vacía es "Persona interesada"; `clasificacion` sin distinguir mayúsculas ni tildes. | ✅ Cumple | Unitarias. Emulador: `CLIENTE` y `persona interesada` en el mismo archivo. |
| C9 | El resultado imprime cuántos se cargarían y la lista de no cargadas con fila, nombre y motivo. | ✅ Cumple | Unitaria de `describirPlan`; emulador: `Se cargarían: 4`, `NO se cargan: 5` y una línea `fila N \| nombre \| motivo` por cada una. |
| C10 | Prueba por defecto: no escribe nada. Con `--escribir` pide teclear el projectId exacto. | ✅ Cumple | Emulador: en modo prueba solo existe el contacto inicial y no se pide la confirmación; una confirmación distinta no escribe nada. |
| C11 | Volver a correr con `--escribir` no duplica nada. | ✅ Cumple | Emulador: segunda corrida sin escrituras, 5 contactos y los mismos documentos. |
| C12 | La pantalla de contactos puede leer los contactos cargados. | ✅ Cumple | Emulador: `listAllContactsIn` con la sesión del administrador devuelve los 4 más el inactivo, en orden alfabético. |
| C13 | Mismas protecciones del cargador de productos (sesión, contraseña oculta, projectId, demo-*, emulador). | ✅ Cumple | Usa `preparar`, `pedirContrasena`, `iniciarSesion` y `confirmarProyecto` de `comun.ts`. Emulador: `--archivo` obligatorio, archivo inexistente, sin encabezado válido, no UTF-8, projectId distinto y contraseña incorrecta abortan antes de leer o escribir. |
| C14 | Los datos reales no quedan en el repositorio. | ✅ Cumple | El script no copia el archivo; `*.csv` en `.gitignore`; las pruebas usan datos ficticios en una carpeta temporal. |

## Pruebas

| Capa | Resultado |
|---|---|
| `npm run typecheck` | ✅ sin errores |
| `npm test` | ✅ 71 archivos, 1199 pruebas. Nuevo: `produccionContactos`, con 28 pruebas. |
| `npm run test:emulators` | ✅ 29 archivos, 326 pruebas. Nuevo: `contactos.emulator.test.ts`, con 9 pruebas. |
| `npm run build:todo` | ✅ JS y CSS de los dos sitios idénticos a `main` (sha256) |

No hay capturas ni recorrido en el navegador: es un script de terminal sin pantalla.

## Qué no se probó

- No se corrió contra un proyecto real de Firebase ni con una terminal interactiva real (la contraseña se simuló; la entrada oculta ya está probada en `produccionComun`).
- No se probó con el CSV real de CANI Café: su codificación y sus columnas deben revisarse con el modo prueba antes de escribir.
