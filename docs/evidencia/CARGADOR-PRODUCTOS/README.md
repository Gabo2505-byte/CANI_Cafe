# Evidencia: cargador del catálogo y nombre visible del administrador (publicación)

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-11-15 · **Rama:** `dylan-cargador-productos`

> Tickets E5-050.2 (preparar y cargar productos) y E5-040.1 (publicar y cargar los datos iniciales).
> Dos scripts para la publicación real, escritos y probados **solo contra los emuladores**. No se ejecutaron contra
> ningún proyecto real de Firebase. Guía de uso: [docs/CARGA_PRODUCCION.md](../../CARGA_PRODUCCION.md).

## Qué se hizo

| Archivo | Contenido |
|---|---|
| `scripts/produccion/comun.ts` | Módulo compartido: análisis de argumentos, lectura del archivo de configuración web, protecciones de proyecto, contraseña con entrada oculta, confirmación del projectId, inicio y cierre de sesión con el SDK de cliente. |
| `scripts/produccion/catalogo.ts` y `cargarCatalogo.ts` | Script A (`npm run catalogo:cargar`): validación del catálogo, diferencias campo por campo, escritura producto por producto y verificación sin sesión. Reutiliza `buildCatalogProducts()` de `scripts/seed/catalogData.ts`, que arma los ids con `catalogProductId()`. |
| `scripts/produccion/nombreVisible.ts` y `cuentaNombreVisible.ts` | Script B (`npm run cuenta:nombre-visible`): `updateProfile` con `displayName` = usuario y revisión de `users/{uid}` y `usernames/{usuario}`. |
| `package.json` | Scripts npm `catalogo:cargar` y `cuenta:nombre-visible` (con `tsx`). |
| `vitest.emulators.config.ts` | Incluye `tests/produccion/`. |
| `tests/unit/produccionComun.test.ts`, `tests/unit/produccionCatalogo.test.ts` | Pruebas unitarias de las partes puras. |
| `tests/produccion/cargador.emulator.test.ts` | Pruebas de los dos scripts completos contra los emuladores, con el administrador del seed y las reglas del repo. |

**No cambian:** `src/`, `sitio-publico/`, `firestore.rules`, `firestore.indexes.json` y el seed.

## Decisiones

- **SDK de cliente con la sesión del administrador**, sin Admin SDK ni claves de cuenta de servicio (CC-01, costo 0). Las escrituras pasan por las reglas desplegadas. Cada script crea su propia app y no importa `src/shared/firebase/config.ts`, que depende de `import.meta.env` de Vite.
- **Solo escribe lo que cambia**: un `setDoc` por producto por crear o cambiar, en secuencia. Sin lote: las reglas hacen 2 lecturas por escritura y un lote de 72 se pasaría del tope. Como los ids son fijos, repetirlo deja el mismo estado y no escribe nada.
- **`setDoc` sin merge**: el documento queda exactamente con `name`, `presentation`, `description` y `active`. Un campo extra en Firestore, como un precio viejo, se informa como cambio (`-> (no existe)`).
- **Nunca borra**: los productos que sobran solo se listan. Si un sobrante está activo, el sitio público lo muestra: la verificación sin sesión lo señala y el código de salida es 1.
- **Script B no corrige `users` ni `usernames`**: solo informa las diferencias, porque esos documentos son del dominio de Gabriel.

## Criterios

| # | Requisito | Resultado | Evidencia |
|---|---|---|---|
| A1 | Argumentos explícitos `--project` (obligatorio), `--email`, `--env`. Sin valores por defecto. | ✅ Cumple | Unitarias de `analizarArgumentos`: faltantes, desconocidas, repetidas, sin valor y con `=`. |
| A2 | Lee `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN` y `VITE_FIREBASE_PROJECT_ID` con su propio analizador. Aborta si el projectId no es igual a `--project`. | ✅ Cumple | Unitarias de `analizarArchivoEnv` y `configDesdeEnv` (BOM, CRLF, comillas, comentarios, clave repetida). Emulador: *"un projectId distinto al del archivo aborta antes de pedir la contraseña"*. |
| A3 | Contraseña por la terminal con entrada oculta: nunca por argumento, variable de entorno ni archivo. No se registra. | ✅ Cumple | Unitarias de `pedirOcultoEn`: no hace eco, admite retroceso, Ctrl+C cancela y rechaza una entrada que no es terminal. `--password` y sus variantes se rechazan. Emulador: la salida nunca contiene la contraseña. |
| A4 | `signInWithEmailAndPassword` al empezar; `signOut` y `deleteApp` al terminar. | ✅ Cumple | `iniciarSesion` y `cerrarSesion` en `comun.ts`, en un `finally`. La app de verificación sin sesión también se borra. |
| A5 | Muestra projectId y authDomain antes de escribir. | ✅ Cumple | Se muestran antes de pedir la contraseña. Unitaria de `preparar` y emulador. |
| A6 | `demo-*` sin `--emulador` aborta; `--emulador` con un proyecto real aborta. | ✅ Cumple | Unitarias de `comprobarDestino`. Emulador y terminal real (ver abajo). |
| A7 | Variables de emulador definidas con un proyecto real: aborta. | ✅ Cumple | Unitarias y terminal real con un archivo ficticio `cani-ejemplo`. Además aborta si el archivo dice `VITE_USE_EMULATORS=true`. |
| A8 | Para escribir, teclear el projectId exacto. | ✅ Cumple | Emulador: *"confirmación distinta al projectId: no escribe nada"*. |
| A9 | Modo prueba por defecto: crear, cambiar campo por campo, sin cambios y sobrantes. | ✅ Cumple | Unitarias de `calcularDiferencias`. Emulador: *"modo prueba: muestra los 72 por crear y no escribe nada"*. |
| A10 | `--escribir`: un `setDoc` por producto, en secuencia, informando cada uno. Idempotente. | ✅ Cumple | Emulador: escribe 72 (`[1/72]` a `[72/72]`). Al repetirlo no hay escrituras y los documentos no cambian (mismos datos y misma hora de actualización). |
| A11 | Nunca borra: los sobrantes solo se listan. | ✅ Cumple | Emulador: *"los productos sobrantes solo se listan: nunca se borran"*. Siguen 74 documentos. |
| A12 | Validación previa: 72, ids únicos, tipos, descripción ≤ 300, 9 × 8. | ✅ Cumple | Unitarias de `validarCatalogo`, con un error de cada tipo. |
| A13 | Verificación final sin sesión con `where('active','==',true)`: 9 variedades con 8 presentaciones. | ✅ Cumple | Emulador: `{ ok: true, activos: 72 }`. Con un sobrante activo: "Se esperaban 9 variedades y hay 10." y código 1. |
| A14 | Un campo cambiado se detecta y se corrige. | ✅ Cumple | Emulador: `description` y `active` cambiados y un `price` de más se detectan en modo prueba. `--escribir` corrige solo esos 2 productos. |
| B1 | Mismas reglas de argumentos, archivo, contraseña y protecciones que A, en un módulo compartido. | ✅ Cumple | Los dos usan `preparar`, `pedirContrasena`, `iniciarSesion`, `confirmarProyecto` y `cerrarSesion` de `comun.ts`. |
| B2 | `updateProfile` con `displayName` = `--usuario`. Prueba por defecto; `--escribir` con confirmación. | ✅ Cumple | Emulador: en modo prueba `displayName` sigue vacío; con `--escribir` queda `admin` (leído con el Admin SDK del emulador). Repetirlo no cambia nada. |
| B3 | Revisa `users/{uid}` (active true) y `usernames/{usuario}` (mismo uid y correo) y lo informa sin corregirlo. | ✅ Cumple | Emulador: un `username` distinto en `users` y otro correo en `usernames` se informan y quedan como estaban. Con `active: false` informa que las reglas niegan la lectura. |
| — | Los scripts no entran en ningún bundle. | ✅ Cumple | `npm run build:todo`: los JS de `dist/` y `dist-publico/` son idénticos byte a byte a los de `main` (sha256). Ningún texto de los scripts aparece en los bundles. |

## Pruebas

| Capa | Resultado |
|---|---|
| `npm run typecheck` | ✅ sin errores |
| `npm test` | ✅ 68 archivos, 1071 pruebas. Nuevas: `produccionComun` y `produccionCatalogo`, con 37 pruebas. |
| `npm run test:emulators` | ✅ 26 archivos, 303 pruebas. Nuevo: `tests/produccion/cargador.emulator.test.ts`, con 13 pruebas. |
| `npm run build:todo` | ✅ JS de los dos sitios idénticos a `main` |

La prueba de emuladores usa el proyecto por defecto de `emulators:exec` (`demo-cani-crm-test`, el de `.env.test`). El emulador de Auth atiende al SDK de cliente con ese proyecto, y el seed crea la cuenta del administrador con el Admin SDK: los dos deben coincidir. Solo la prueba del seed usa ese proyecto, y lo reinicia al empezar. El archivo `--env` de la prueba se escribe con BOM y CRLF, como lo dejaría PowerShell.

## Protecciones desde la terminal real

Rutas que abortan **antes de usar la red**. Se ejecutaron con `npm run` en la terminal:

```
> npm run catalogo:cargar -- --project demo-cani-crm --email admin@cani-crm.test --env .env.development
ABORTADO: "demo-cani-crm" es un proyecto demo-*: solo existe en los emuladores. Agregue --emulador.

> ... --env .env.development --emulador --password x
ABORTADO: La contraseña no se pasa por argumento: el script la pide por la terminal, sin mostrarla.

> ... --project demo-cani-crm --env .env.test --emulador
ABORTADO: El archivo de configuración es del proyecto "demo-cani-crm-test" y se pidió --project "demo-cani-crm". No se hace nada.

> ... --env .env.development --emulador   (con la entrada redirigida, sin terminal)
ABORTADO: La contraseña solo se pide en una terminal interactiva (no desde una tubería ni un archivo).

> $env:FIRESTORE_EMULATOR_HOST definida; --project cani-ejemplo con un archivo ficticio de cani-ejemplo
ABORTADO: Hay variables de emulador definidas (FIRESTORE_EMULATOR_HOST) y el destino es el proyecto real "cani-ejemplo". ...

> --project cani-ejemplo ... --emulador
ABORTADO: --emulador solo se usa con proyectos demo-*, y "cani-ejemplo" es un proyecto real.

> cuenta:nombre-visible ... --env no-existe.env
ABORTADO: No se pudo leer el archivo de configuración "no-existe.env".
```

Todas terminan con código de salida 1. Los argumentos después de `--` llegan bien con `npm` (npm.ps1) y con `npm.cmd` en PowerShell 5.1.

## Corrida contra el emulador (salida resumida)

Emuladores de desarrollo (`npm run emulators`, proyecto `demo-cani-crm`) con `npm run seed`. Para simular un proyecto recién creado, antes de la corrida se quitaron los productos del seed y el `displayName` del administrador con el Admin SDK, solo en el emulador. El administrador `admin@cani-crm.test` es la cuenta ficticia del seed.

Las funciones de los scripts se llamaron con una terminal que entrega la contraseña de `SEED_ADMIN_PASSWORD` y responde la confirmación. Este entorno no tiene una terminal interactiva para teclear la contraseña oculta. El resto del flujo es el real: argumentos, archivo `.env.development`, protecciones, inicio de sesión, reglas, escritura y verificación.

```
===== A1. catalogo:cargar (prueba) =====
Proyecto:    demo-cani-crm
authDomain:  demo-cani-crm.firebaseapp.com
Destino:     EMULADORES locales
Cuenta:      admin@cani-crm.test
Modo:        prueba (no escribe nada)
Catálogo válido: 72 productos, 9 variedades × 8 presentaciones.
Contraseña del administrador (no se muestra):
Sesión iniciada (uid seed-admin-001).

Se crearían: 72
  + prod-01-villa-sarchi-0250-grano  (Villa Sarchí, Bolsa de 250 g, grano entero)
  ... (72 líneas)
Cambiarían: 0
Sin cambios: 0
Sobran (están en Firestore y no en el catálogo; NO se borran): 0

Modo prueba: no se escribió nada. Para aplicar 72 escrituras, repita con --escribir.
Verificación sin sesión: NO cuadra (0 productos activos).
  - Se esperaban 9 variedades y hay 0.

===== A2. catalogo:cargar --escribir =====
...
Se crearían: 72
Para escribir en "demo-cani-crm", escriba el projectId exacto: demo-cani-crm
  [1/72] escrito prod-01-villa-sarchi-0250-grano
  [2/72] escrito prod-01-villa-sarchi-0250-molido
  ...
  [72/72] escrito prod-09-geisha-1000-molido
Escritura terminada: 72 productos. Firestore coincide con el catálogo.
Verificación sin sesión: OK. 72 productos activos, 9 variedades con 8 presentaciones cada una.

===== A3. catalogo:cargar --escribir (repetido) =====
...
Se crearían: 0
Cambiarían: 0
Sin cambios: 72
Todo está al día: no hay nada que escribir.
Verificación sin sesión: OK. 72 productos activos, 9 variedades con 8 presentaciones cada una.

===== A4. prueba, con un campo cambiado y un sobrante (preparados en el emulador) =====
Cambiarían: 1
  ~ prod-03-catuai-0500-molido
      description: "Texto viejo" -> "Variedad reconocida por su versatilidad y consistencia. En taza pue..."
      price: 4500 -> (no existe)
Sin cambios: 71
Sobran (están en Firestore y no en el catálogo; NO se borran): 1
  ? prueba-sobrante  (Producto de prueba, Bolsa, active=false)
Modo prueba: no se escribió nada. Para aplicar 1 escritura, repita con --escribir.

===== A5. catalogo:cargar --escribir =====
  [1/1] escrito prod-03-catuai-0500-molido
Escritura terminada: 1 producto. Firestore coincide con el catálogo.
Verificación sin sesión: OK. 72 productos activos, 9 variedades con 8 presentaciones cada una.
(prueba-sobrante sigue en Firestore: true)

===== B1. cuenta:nombre-visible (prueba) =====
Usuario:     admin
users/seed-admin-001 y usernames/admin: correctos (active true, mismo uid y correo).
displayName actual: (vacío) -> deseado: "admin"
Modo prueba: no se cambió nada. Para aplicarlo, repita con --escribir.

===== B2. cuenta:nombre-visible --escribir =====
Para escribir en "demo-cani-crm", escriba el projectId exacto: demo-cani-crm
Nombre visible actualizado: "admin". El correo de recuperación dirá "Hola, admin:".
(displayName en Auth: admin)

===== B3. prueba, con usernames/admin apuntando a otro correo (preparado en el emulador) =====
Diferencias en users o usernames (NO se corrigen; avísele a Gabriel):
  - usernames/admin: email es "otro@example.com" (la cuenta es "admin@cani-crm.test").
displayName actual: "admin" -> deseado: "admin"
El nombre visible ya es el correcto: no hay nada que cambiar.
```

Todos los pasos terminaron con código de salida 0. Después se restauró `usernames/admin`, se borró `prueba-sobrante` y se apagaron los emuladores.

## Lo que no se pudo probar

- **Contra Firebase real**: no existe todavía el proyecto de producción y la tarea lo prohíbe. Quedan sin probar: los mensajes de error reales de Auth (por ejemplo, una API key inválida) y el tope de lecturas de las reglas en producción, ya que el emulador no lo impone igual.
- **Teclear la contraseña oculta en una terminal interactiva**: este entorno no tiene una. La lógica de entrada oculta se probó con una entrada falsa en modo crudo, y la negativa a leer sin terminal se probó con la terminal real. Conviene hacer el ensayo del punto 3 de la guía en PowerShell antes de la carga real.
- **El correo "Hola, admin:"**: depende de la plantilla de Firebase Auth de `docs/HU-107-plantilla-correo.md`, que se configura en la consola del proyecto real. El emulador no envía correos.
