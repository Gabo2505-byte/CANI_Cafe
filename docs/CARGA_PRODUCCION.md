# Carga de datos en producción: catálogo, nombre visible del administrador y contactos iniciales

Guía para la publicación real (tickets E5-040.1 y E5-050.2). Usa tres scripts de `scripts/produccion/`:

| Script npm | Qué hace | Archivo |
|---|---|---|
| `catalogo:cargar` | Carga o actualiza los 72 productos del catálogo oficial (9 variedades × 8 presentaciones) en `products`. | `scripts/produccion/cargarCatalogo.ts` |
| `cuenta:nombre-visible` | Pone el nombre visible (`displayName`) de la cuenta del administrador igual a su usuario, para que el correo de recuperación diga "Hola, admin:" (HU-107). Revisa `users` y `usernames`. | `scripts/produccion/cuentaNombreVisible.ts` |
| `contactos:cargar` | Carga única de los contactos iniciales de CANI Café desde un archivo CSV (RT-02). Ver la sección 9. | `scripts/produccion/cargarContactos.ts` |
| `pruebas:limpiar` | Limpieza única de los datos de prueba (RT-01): contactos "PRUEBA..." y todo lo que cuelga de ellos. Ver la sección 10. | `scripts/produccion/limpiarPruebas.ts` |

Los tres primeros usan el SDK de cliente de Firebase e inician sesión con el correo y la contraseña del administrador. Todo pasa por las reglas desplegadas, igual que desde el sistema interno. No usan Admin SDK ni claves de cuenta de servicio. La limpieza (sección 10) es la excepción: usa el Admin SDK con las credenciales de gcloud.

**Los tres primeros no borran nada.** Por defecto corren en **modo prueba**: leen y muestran lo que harían, sin escribir. Solo escriben con `--escribir` y después de que usted teclee el projectId exacto.

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

## 9. Carga inicial de contactos (RT-02)

Script de **una sola vez** para cargar los contactos que CANI Café ya tiene (hoja de cálculo, libreta) en el sistema. No es una función de la aplicación. Corre en modo prueba por defecto y no borra nada.

### 9.1 El archivo CSV

- Se guarda desde Excel como **"CSV UTF-8 (delimitado por comas)"**. El separador puede ser coma o punto y coma (se detecta solo). Si el archivo no está en UTF-8 el script se detiene y lo dice.
- **El archivo con los contactos reales no se guarda en el repositorio.** Déjelo fuera de la carpeta del proyecto (por ejemplo en `C:\Users\<usuario>\Documents\`). El script solo lo lee: no hace copias. Además `.gitignore` ignora todo `*.csv` por si se deja dentro por error.
- La primera fila es el encabezado, con estas columnas (en cualquier orden; solo `nombre_completo` debe existir, y no se aceptan otras columnas):

| Columna | Qué lleva | Si está vacía |
|---|---|---|
| `nombre_completo` | Nombre completo (hasta 100 caracteres). | **No se carga la fila.** |
| `correo` | Correo con formato `nombre@dominio.com` (hasta 100). Se guarda en minúsculas. | Sin correo. |
| `telefono` | Número sin el código de país; se aceptan espacios y guiones (`8888-1111`). | Sin teléfono. |
| `codigo_pais` | Solo dígitos del código de llamada, por ejemplo `506` (se acepta `+506`). | `506` (Costa Rica). |
| `direccion` | Dirección (hasta 250). | Sin dirección. |
| `clasificacion` | `Persona interesada` o `Cliente`, sin distinguir mayúsculas ni tildes. | `Persona interesada`. |

Ejemplo (datos ficticios):

```csv
nombre_completo,correo,telefono,codigo_pais,direccion,clasificacion
Ana Prueba,ANA@ejemplo.com,8888-1111,506,"Calle 1, Naranjo",Cliente
Luis Ejemplo,,88882222,,,
Marta Muestra,marta@ejemplo.com,3055551234,1,,Persona interesada
Sin Datos,,,,,
```

### 9.2 Qué se carga y qué no

Cada contacto queda **activo**, con origen **"Carga inicial"**, la clasificación indicada y el mismo formato de documento que crea la pantalla "Nuevo contacto" (nombre para ordenar, correo en minúsculas, teléfono con país y solo dígitos, fecha de registro).

**No se carga** (y se informa con su número de fila, el nombre y el motivo, para avisar a CANI Café):

| Motivo | Detalle |
|---|---|
| Sin nombre completo | La celda está vacía. |
| Sin correo ni teléfono | Debe tener al menos uno. |
| Correo no válido | Aunque la fila traiga un teléfono válido: se informa para que CANI Café lo corrija. |
| Teléfono de largo inválido | 8 dígitos en Costa Rica; entre 6 y 14 en otros países. Aplica aunque el correo sea válido. |
| Código de país no válido | No son solo dígitos, o ningún país usa ese código. |
| Clasificación no reconocida | Solo `Persona interesada` o `Cliente`. |
| Repetido en el archivo | Un correo o un teléfono (mismo país y número) que ya aparece en una fila anterior que sí se carga: se carga solo la primera. |
| Ya existe en el sistema | Un contacto con ese correo o teléfono, **activo o inactivo**. |

El número de fila es el de la hoja de cálculo: el encabezado es la fila 1 y el primer contacto la fila 2. Con el código `1` el teléfono se guarda con país `US` (el código de llamada es el mismo para Estados Unidos, Canadá y el Caribe, y los repetidos se comparan por código y número).

### 9.3 Modo prueba (no escribe)

```powershell
npm run contactos:cargar -- --project <projectId> --email <correo-admin> --env .env.production.local --archivo "C:\ruta\fuera-del-repo\contactos.csv"
```

Pide la contraseña del administrador (sin mostrarla) e imprime:

```
Filas con datos en el archivo: 4
Se cargarían: 3
NO se cargan: 1
  fila 5 | Sin Datos | No tiene un correo ni un teléfono.

Modo prueba: no se escribió nada. Para cargar 3 contactos, repita con --escribir.
```

Envíe a CANI Café la lista de "NO se cargan" para que corrijan o completen esas filas.

### 9.4 Escritura

Agregue `--escribir` al mismo comando. El script pide teclear el projectId exacto y crea los contactos uno por uno (`[n/total] cargada la fila N`). Para ensayar contra los emuladores, use `--project demo-cani-crm --env .env.development --emulador` (ver la sección 3).

**Volver a correrlo no duplica nada**: los contactos ya cargados se omiten como "Ya existe un contacto con este correo/teléfono". Si el script se corta a la mitad, repita el mismo comando. Una fila que se corrige en el CSV después de haber sido omitida se carga en la siguiente corrida.

Para deshacer una carga hay que borrar los contactos a mano en la consola de Firebase (filtre `origin == carga_inicial`); el script nunca borra.

## 10. Limpieza de los datos de prueba (RT-01)

Borra, **una sola vez**, los contactos cuyo nombre empieza por "PRUEBA" (sin distinguir mayúsculas) y todo lo que cuelga de ellos. Nunca toca los contactos de la carga inicial ni ningún otro.

| Colección | Qué se borra |
|---|---|
| `contacts` | Los contactos cuyo nombre empieza por "PRUEBA". |
| `sales` | Sus oportunidades de venta (`contactId`). |
| `saleProducts`, `stageHistory` | Los productos y el historial de etapas de esas oportunidades (`saleId`). |
| `communications` | Sus comunicaciones (`contactId`) y las ligadas a esas oportunidades (`saleId`). |
| `formRequests` | Las solicitudes de esos contactos (`contactId`) y las que tienen un nombre que empieza por "PRUEBA", aunque no tengan contacto. |
| Bitácora y avisos | No se guardan: se calculan al consultar. El modo prueba muestra cuántos avisos tiene hoy cada contacto, y estos desaparecen al borrar sus oportunidades. |

No hay subcolecciones en el sistema.

### 10.1 Por qué usa el Admin SDK

Las reglas desplegadas no permiten borrar `communications` (HU-211) ni `formRequests`, y no se cambian para esto. El Admin SDK **ignora las reglas**, así que el script trae sus propias protecciones:

- Usa las credenciales de gcloud (*Application Default Credentials*). Nunca usa archivos de clave ni guarda credenciales en el repo.
- Solo corre contra `cani-cafe`: `--project`, el `VITE_FIREBASE_PROJECT_ID` del archivo `--env` y el proyecto de las credenciales de gcloud deben ser `cani-cafe`. Si no, aborta antes de leer nada.
- Aborta sin borrar nada si algún contacto seleccionado no empieza por "PRUEBA", si alguno tiene origen `carga_inicial`, si se seleccionan más de 10 contactos o si no hay exactamente 18 contactos con origen `carga_inicial`.
- Por defecto corre en modo prueba. Con `--borrar` hay que teclear `cani-cafe`.
- Al final verifica que quedan 18 contactos con origen `carga_inicial`, que no queda ninguno con nombre "PRUEBA" y que nada apunta a un contacto o a una oportunidad borrados.

### 10.2 Requisitos

1. [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) instalado y una cuenta con acceso de propietario o editor al proyecto `cani-cafe`.
2. Credenciales y proyecto (una vez por equipo; se guardan en el perfil del usuario, fuera del repo):
   ```powershell
   gcloud auth application-default login
   gcloud config set project cani-cafe
   gcloud auth application-default set-quota-project cani-cafe
   ```
3. El mismo `.env.production.local` de la sección 1 y la terminal sin variables de emulador (sección 2). Si definió `GOOGLE_CLOUD_PROJECT` o `GOOGLE_APPLICATION_CREDENTIALS` en esa terminal, el script usa esos valores. Quítelos si no apuntan a `cani-cafe`.

### 10.3 Modo prueba (no borra)

```powershell
npm run pruebas:limpiar -- --project cani-cafe --env .env.production.local
```

Imprime cada contacto que se borraría con sus conteos, por ejemplo:

```
Contactos con origen "carga_inicial": 18 (se esperan 18; no se tocan)
Se borrarían: 2 contactos con nombre PRUEBA
  PRUEBA Uno (abc123)
    sales 2 | saleProducts 3 | stageHistory 3 | communications 2 | formRequests 1 | avisos 2 (calculados, no se guardan)
  ...
Se borrarían además: 1 formRequest con nombre PRUEBA sin contacto seleccionado
Total: contacts 2 | sales 2 | saleProducts 3 | stageHistory 3 | communications 3 | formRequests 2

Modo prueba: no se borró nada. Para borrar 15 documentos, repita con --borrar.
```

Revise la lista antes de seguir.

### 10.4 Borrado

```powershell
npm run pruebas:limpiar -- --project cani-cafe --env .env.production.local --borrar
```

El script pide teclear `cani-cafe`. Primero borra lo que cuelga de los contactos, después las oportunidades y al final los contactos. Luego imprime la verificación (`[OK]` o `[FALLA]` en cada línea). Si se corta a la mitad, repita el mismo comando: lo que quedó se vuelve a encontrar.

Para ensayar contra los emuladores (no necesita gcloud), use `--project demo-cani-crm --env .env.development --emulador` con `npm run emulators` encendido y `FIRESTORE_EMULATOR_HOST` definido, o use el host del archivo.

**El borrado no se puede deshacer.** Si quiere un respaldo previo, exporte Firestore desde la consola de Google Cloud (*Firestore > Importar/Exportar*) antes de correr `--borrar`.
