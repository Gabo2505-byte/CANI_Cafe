# Carga de datos en producción: catálogo y nombre visible del administrador

Guía para la publicación real (tickets E5-040.1 y E5-050.2). Usa dos scripts de `scripts/produccion/`:

| Script npm | Qué hace | Archivo |
|---|---|---|
| `catalogo:cargar` | Carga o actualiza los 72 productos del catálogo oficial (9 variedades × 8 presentaciones) en `products`. | `scripts/produccion/cargarCatalogo.ts` |
| `cuenta:nombre-visible` | Pone el nombre visible (`displayName`) de la cuenta del administrador igual a su usuario, para que el correo de recuperación diga "Hola, admin:" (HU-107). Revisa `users` y `usernames`. | `scripts/produccion/cuentaNombreVisible.ts` |

Los dos usan el SDK de cliente de Firebase e inician sesión con el correo y la contraseña del administrador. Todo pasa por las reglas desplegadas, igual que desde el sistema interno. No usan Admin SDK ni claves de cuenta de servicio.

**Ninguno borra nada.** Por defecto corren en **modo prueba**: leen y muestran lo que harían, sin escribir. Solo escriben con `--escribir` y después de que usted teclee el projectId exacto.

---

## 1. Requisitos

1. **Proyecto real de Firebase creado**, con Firestore y con Authentication habilitado para correo y contraseña.
2. **Reglas e índices desplegados** desde este repo:
   ```powershell
   npx firebase deploy --only firestore:rules,firestore:indexes --project <projectId>
   ```
   Sin las reglas del repo el cargador no puede escribir `products` y el sitio público no puede leerlos.
3. **Administrador ya creado** (lo crea el procedimiento de E5-040.1; estos scripts no lo crean):
   - una cuenta de Authentication con su correo real y su contraseña;
   - `users/{uid}` con `username`, `email` y `active: true`;
   - `usernames/{usuario}` (por ejemplo `usernames/admin`) con `uid` y `email` de esa cuenta.
4. **Archivo con la configuración web** del proyecto, por ejemplo `.env.production.local` en la raíz del repo. Se copia de `.env.example` y se completa con los valores de *Consola de Firebase > Configuración del proyecto > Tus apps > Web*. Los scripts leen solo estas tres claves:
   ```
   VITE_FIREBASE_API_KEY=<apiKey de la app web>
   VITE_FIREBASE_AUTH_DOMAIN=<projectId>.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=<projectId>
   VITE_USE_EMULATORS=false
   ```
   `.env.production.local` está en `.gitignore`: **no se versiona**. La apiKey web no es una contraseña, pero tampoco se pega en documentos ni chats.
5. Node 20 o más y `npm install` hecho en el repo.

## 2. Antes de empezar (PowerShell)

Abra una terminal de PowerShell **nueva** en la raíz del repo y quite cualquier variable de emulador que haya quedado de otra sesión. Contra un proyecto real, el script se niega a correr si alguna está definida:

```powershell
Remove-Item Env:FIRESTORE_EMULATOR_HOST -ErrorAction SilentlyContinue
Remove-Item Env:FIREBASE_AUTH_EMULATOR_HOST -ErrorAction SilentlyContinue
```

En los comandos de abajo, reemplace:

- `<projectId>`: el id del proyecto real, por ejemplo `cani-cafe-xxxxx`. Debe ser igual al `VITE_FIREBASE_PROJECT_ID` del archivo.
- `<correo-admin>`: el correo de la cuenta del administrador.

La contraseña **nunca** va en el comando. El script la pide por la terminal y no la muestra mientras se escribe.

## 3. Ensayo contra los emuladores (recomendado)

Corre el mismo flujo sobre los datos de prueba, sin tocar Firebase real:

```powershell
npm run emulators        # en una terminal aparte; déjela abierta
npm run seed             # en esta terminal
npm run catalogo:cargar -- --project demo-cani-crm --email admin@cani-crm.test --env .env.development --emulador
npm run cuenta:nombre-visible -- --project demo-cani-crm --email admin@cani-crm.test --env .env.development --usuario admin --emulador
```

La contraseña del administrador de prueba es `SEED_ADMIN_PASSWORD` de `.env.development`. Como el seed ya carga el catálogo, el cargador debería decir "Sin cambios: 72".

`--emulador` solo se acepta con proyectos `demo-*`, y un proyecto `demo-*` solo se acepta con `--emulador`.

## 4. Catálogo de productos

### 4.1 Modo prueba (no escribe)

```powershell
npm run catalogo:cargar -- --project <projectId> --email <correo-admin> --env .env.production.local
```

Salida esperada en un proyecto recién creado:

```
Proyecto:    <projectId>
authDomain:  <projectId>.firebaseapp.com
Destino:     FIREBASE REAL
Cuenta:      <correo-admin>
Modo:        prueba (no escribe nada)
Catálogo válido: 72 productos, 9 variedades × 8 presentaciones.
Contraseña del administrador (no se muestra):
Sesión iniciada (uid ...).

Se crearían: 72
  + prod-01-villa-sarchi-0250-grano  (Villa Sarchí, Bolsa de 250 g, grano entero)
  ...
Cambiarían: 0
Sin cambios: 0
Sobran (están en Firestore y no en el catálogo; NO se borran): 0

Modo prueba: no se escribió nada. Para aplicar 72 escrituras, repita con --escribir.
Verificación sin sesión: NO cuadra (0 productos activos).
  - Se esperaban 9 variedades y hay 0.
```

**Revise que `Proyecto` y `authDomain` sean los del proyecto real** antes de seguir. En modo prueba, la verificación muestra el estado actual: antes de cargar es normal que diga "NO cuadra".

Lo que significa cada grupo:

- **Se crearían**: productos del catálogo que no existen en Firestore.
- **Cambiarían**: productos que existen con algún campo distinto. Se muestra cada campo con `antes -> después`. Un campo que sobra en Firestore (por ejemplo un precio viejo) aparece como `-> (no existe)`, porque al escribir se reemplaza el documento entero.
- **Sin cambios**: ya están iguales al catálogo.
- **Sobran**: están en Firestore con un id que no es del catálogo. **Solo se listan; nunca se borran.**

### 4.2 Escritura

```powershell
npm run catalogo:cargar -- --project <projectId> --email <correo-admin> --env .env.production.local --escribir
```

Después de mostrar las diferencias, pide teclear el projectId exacto:

```
Para escribir en "<projectId>", escriba el projectId exacto: <projectId>
  [1/72] escrito prod-01-villa-sarchi-0250-grano
  ...
  [72/72] escrito prod-09-geisha-1000-molido
Escritura terminada: 72 productos. Firestore coincide con el catálogo.
Verificación sin sesión: OK. 72 productos activos, 9 variedades con 8 presentaciones cada una.
```

- Solo escribe los productos que hay que crear o cambiar: un `setDoc` por producto, en secuencia. No usa un lote porque las reglas hacen 2 lecturas por escritura y un lote de 72 pasaría el tope de lecturas por operación.
- Los ids son fijos (`prod-<nn>-<variedad>-<peso>-<formato>`). **Repetirlo es seguro**: la segunda vez dice "Todo está al día: no hay nada que escribir." Si se corta a la mitad, se vuelve a correr y termina lo que faltaba.
- Al final relee la colección **sin sesión** (como el sitio público, con `where('active', '==', true)`) y comprueba que salen 9 variedades con 8 presentaciones cada una. Si no cuadra, el código de salida es 1.

### 4.3 Comprobaciones antes de escribir

1. Argumentos explícitos: `--project`, `--email` y `--env` son obligatorios. Se rechazan opciones desconocidas o repetidas y cualquier intento de pasar la contraseña por argumento.
2. El `VITE_FIREBASE_PROJECT_ID` del archivo debe ser igual a `--project`.
3. Proyecto `demo-*` sin `--emulador`, o `--emulador` con un proyecto real: aborta.
4. Proyecto real con `FIRESTORE_EMULATOR_HOST` o `FIREBASE_AUTH_EMULATOR_HOST` definidas, o con `VITE_USE_EMULATORS=true` en el archivo: aborta.
5. Muestra `projectId` y `authDomain` antes de pedir la contraseña.
6. Valida el catálogo: 72 productos, ids únicos, `active` booleano, `name` y `presentation` de texto, `description` de 300 caracteres o menos, 9 variedades con 8 presentaciones cada una.
7. Contraseña con entrada oculta, solo en una terminal interactiva (no acepta tuberías ni archivos).
8. Para escribir, hay que teclear el projectId exacto. Cualquier otra respuesta cancela sin escribir.

## 5. Nombre visible del administrador

### 5.1 Modo prueba

```powershell
npm run cuenta:nombre-visible -- --project <projectId> --email <correo-admin> --env .env.production.local --usuario admin
```

Salida esperada:

```
...
Usuario:     admin
Contraseña del administrador (no se muestra):
Sesión iniciada (uid ...).
users/<uid> y usernames/admin: correctos (active true, mismo uid y correo).
displayName actual: (vacío) -> deseado: "admin"
Modo prueba: no se cambió nada. Para aplicarlo, repita con --escribir.
```

Si `users/{uid}` no existe, no tiene `active: true` o tiene otro `username` o correo, o si `usernames/{usuario}` no existe o apunta a otro uid o correo, lo informa bajo "Diferencias en users o usernames (NO se corrigen; ...)". **El script no corrige esas diferencias.** Se arreglan con el procedimiento de creación del administrador (Gabriel).

### 5.2 Escritura

```powershell
npm run cuenta:nombre-visible -- --project <projectId> --email <correo-admin> --env .env.production.local --usuario admin --escribir
```

Pide el projectId exacto y luego:

```
Nombre visible actualizado: "admin". El correo de recuperación dirá "Hola, admin:".
```

Si el nombre visible ya es el correcto, dice "El nombre visible ya es el correcto: no hay nada que cambiar." y no pide confirmación.

## 6. Cómo verificar

**Consola de Firebase**

- *Firestore Database > products*: 72 documentos, de `prod-01-villa-sarchi-0250-grano` a `prod-09-geisha-1000-molido`. Cada uno tiene `name`, `presentation`, `description` y `active: true`, sin otros campos.
- *Authentication > Usuarios*: la cuenta del administrador sigue igual. La consola no muestra el nombre visible; se comprueba con el correo de recuperación (abajo).

**Sitio público** (después de publicar el hosting `publico`)

- La sección del catálogo muestra 9 tarjetas, una por variedad, en el orden del documento del cliente (Villa Sarchí primero, Geisha al final).
- El selector "Presentación" de cada tarjeta tiene 8 opciones: 250 g, 340 g, 500 g y 1 kg, cada una en grano entero y molida.
- "Me interesa" abre Contáctenos con ese producto ya elegido.

**Sistema interno**

- En "+ Nueva oportunidad", el selector de productos ofrece las 9 variedades y sus 8 presentaciones.
- En la pantalla de ingreso, "¿Olvidó su contraseña?" con el usuario `admin` envía un correo que empieza con "Hola, admin:" (requiere la plantilla de `docs/HU-107-plantilla-correo.md`).

## 7. Errores comunes

| Mensaje | Causa | Qué hacer |
|---|---|---|
| `El archivo de configuración es del proyecto "X" y se pidió --project "Y".` | El archivo `--env` es de otro proyecto. | Revise el archivo o el `--project`. |
| `Hay variables de emulador definidas (...) y el destino es el proyecto real` | La terminal tiene variables de una sesión con emuladores. | Ejecute los `Remove-Item Env:...` del punto 2 o abra una terminal nueva. |
| `"demo-..." es un proyecto demo-*: solo existe en los emuladores.` | Se usó un archivo de desarrollo sin `--emulador`. | Para producción use `.env.production.local`. Para ensayar, agregue `--emulador`. |
| `La contraseña solo se pide en una terminal interactiva` | Se redirigió la entrada (`<`, tubería) o se corrió desde un programa sin terminal. | Ejecútelo directamente en PowerShell. |
| `No se pudo iniciar sesión: Correo o contraseña incorrectos.` | Correo o contraseña equivocados. | Revise los datos. Tras varios intentos Firebase bloquea unos minutos ("Demasiados intentos"). |
| `No se pudo iniciar sesión: La API key del archivo de configuración no es válida.` | `VITE_FIREBASE_API_KEY` mal copiada. | Cópiela de nuevo desde la consola. |
| `Permiso denegado por las reglas: ...` | Falta `users/{uid}` con `active: true` o las reglas del repo no están desplegadas. | Corra `cuenta:nombre-visible` en modo prueba para ver qué falta y despliegue las reglas (punto 1). |
| `Firestore no responde (...)` | Sin conexión, o el emulador está apagado en un ensayo. | Revise la red o levante `npm run emulators`. |
| `Falló la escritura de prod-... (n/72)` | Se cortó la conexión o cambió un permiso a la mitad. | Corrija la causa y repita el mismo comando: continúa sin duplicar. |
| `Verificación sin sesión: NO cuadra` tras escribir | Hay productos activos que sobran (por ejemplo de pruebas) y el sitio público los muestra. | Revise la lista "Sobran". Si no deben verse, desactívelos o bórrelos a mano en la consola: el script nunca lo hace. |
| `La confirmación no coincide con el projectId.` | Se tecleó otra cosa al confirmar. | Repita el comando y teclee el projectId exacto. |

## 8. Cómo volver atrás

Los scripts **no borran** documentos ni cuentas, así que no hay nada que restaurar por un borrado.

- **Antes de escribir**, corra el modo prueba y guarde lo que muestra: ahí están los valores anteriores (`antes -> después`) de cada producto que va a cambiar.
- **Primera carga en un proyecto vacío**: para deshacerla, borre a mano los documentos `prod-...` de `products` en la consola, o márquelos con `active: false` para ocultarlos del sitio público sin perderlos. Antes de borrar, confirme que ninguna oportunidad de venta los usa en `saleProducts`.
- **Producto cambiado por error**: corrija `scripts/seed/catalogData.ts`, que es la fuente del catálogo, y vuelva a correr el cargador. También se puede editar a mano en la consola con el valor anterior que mostró el modo prueba.
- **Nombre visible**: es solo el texto del saludo del correo. No da ni quita acceso. Para cambiarlo, vuelva a correr el script con otro `--usuario`.

Nunca versione `.env.production.local` ni pegue contraseñas en documentos, comandos o chats.
