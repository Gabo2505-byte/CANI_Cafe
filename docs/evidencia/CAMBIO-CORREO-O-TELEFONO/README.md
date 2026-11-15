# Evidencia: correo o teléfono en el formulario del sitio público (contrato v4)

**Responsable:** Dylan · **Revisa:** Gabriel (el procesamiento es suyo) · **Fecha:** 2026-11-15 · **Rama:** `dylan-contrato-correo-o-telefono`

## Decisión

El formulario del sitio público exigía el correo. El sistema interno, en cambio, pide **correo o teléfono, al menos uno** (HU-201, `src/contacts/contactForm.ts`, mensaje "Ingrese un correo electrónico o un teléfono."). Se igualan las dos reglas:

- Obligatorios: nombre completo y al menos un producto de interés.
- Correo y teléfono son opcionales cada uno, pero **debe venir al menos uno de los dos**.
- Si se escribe alguno, debe ser válido, con las mismas validaciones de hoy: correo como nombre@dominio.com, en minúsculas y de hasta 100 caracteres; teléfono con su país, de 8 dígitos en Costa Rica o de 6 a 14 en otros países.

Es un **cambio de requisitos** sobre HU-403, HU-501, HU-502 y HU-503, y se registrará como cambio en la próxima entrega (ver "Criterios afectados").

Este cambio **no toca `sitio-publico/`**. El formulario público sigue exigiendo el correo hasta que Danny lo adapte en su rama. El contrato, las reglas y el procesamiento ya aceptan solicitudes sin correo. El JS del sitio público compilado es idéntico byte a byte al de `main`.

## Qué cambió

| Archivo | Cambio |
|---|---|
| `src/shared/types/formRequest.ts` | `FormRequestData.email` pasa de `string` a `string \| null`: null si no dejó correo y, si lo dejó, en minúsculas y sin espacios alrededor. El comentario del contrato dice "correo o teléfono, al menos uno". |
| `firestore.rules` (`isValidFormRequest`) | El correo es `null` o el correo válido de hoy. El teléfono no cambia. Nuevo: `!(data.email == null && data.phoneNumber == null)`. Se reescribió sin duplicar condiciones. Con 72 productos y todos los campos al máximo, sigue dentro del tope de unas 1000 expresiones (ver las pruebas). |
| `src/formRequests/formRequestsRepository.ts` | `findPersonIn` busca por correo solo si viene. Si no hay coincidencia o no viene correo, busca por teléfono (búsqueda que ya existía). Nunca busca contactos con `email == null`. El contacto nuevo guarda `email: null` si la solicitud no trae correo. Si una solicitud llega sin correo ni teléfono (las reglas no lo permiten), se cierra como `rejected` sin tocar contactos. |
| `src/formRequests/formRequestProcessing.ts` | Nueva `hasEmailOrPhone()` y el motivo `REJECT_REASONS.noEmailOrPhone` ("La solicitud no trae correo ni teléfono."). `sentDifferences` acepta `email` null: si no vino correo, la nota no lleva "Correo: …" y no se borra el correo guardado (igual que pasaba con el teléfono vacío). |
| `docs/CONTRATO_FORMULARIO.md` | Pasa a la **v4 (15/11/2026)**: `email` en minúsculas, de 1 a 100 caracteres, o null; la regla "al menos uno de los dos (correo o teléfono)"; búsqueda por correo si viene y, si no hay coincidencia o no viene, por teléfono; las reglas y el rechazo nuevos. |

**Contactos con correo null:** se revisaron la lista, la búsqueda (`src/contacts/contactSearch.ts`), la ficha (`contactDetail.ts`), el formulario de edición (`contactForm.ts`), el selector de contacto de ventas (`src/sales/ContactPicker.tsx`, `src/sales/contactSearch.ts`) y la revisión de repetidos (`contactsRepository.ts`). Todos ya toleraban `email: null`, porque el tipo `Contact` lo permite desde HU-201 y la carga inicial ya tiene contactos así. No hay enlaces `mailto` en el código. **No hubo que corregir nada** en `src/contacts/`. El recorrido lo confirma.

**No cambian:** `sitio-publico/`, `src/contacts/`, `src/communications/`, las reglas de `contacts` y `communications`, el seed y los índices.

## Contrato v4: campos de `formRequests`

| Campo | Tipo | Regla |
|---|---|---|
| `fullName` | string | De 1 a 100 caracteres, sin contar los espacios de los extremos (sin cambios) |
| `email` | string \| null | **v4:** null, o en minúsculas, de hasta 100 caracteres y como nombre@dominio.com |
| `phoneCountry` | string \| null | ISO de 2 letras, o null (sin cambios) |
| `phoneNumber` | string \| null | Solo dígitos: 8 en CR, de 6 a 14 en otros países; o null. Va null junto con `phoneCountry` (sin cambios) |
| *(correo o teléfono)* | — | **v4:** al menos uno de los dos: `!(email == null && phoneNumber == null)` |
| `interests` | lista | De 1 a 72 elementos (sin cambios) |
| `message` | string \| null | De 1 a 1000 caracteres, o null (sin cambios) |
| `submittedAt` | timestamp | `request.time` (sin cambios) |
| `processed` | bool | false al crear (sin cambios) |

## Criterios afectados

Textos literales de `Requisitos_Proyecto_Producto.pdf`, para que Danny los registre como cambio de criterio:

| HU | Criterio | Texto del documento | Cómo queda |
|---|---|---|---|
| HU-403 | 3 | "Son obligatorios el nombre completo, el correo electrónico y al menos un producto de interés. El teléfono y el mensaje son opcionales." | Son obligatorios el nombre completo y al menos un producto de interés. El correo y el teléfono son opcionales, pero hay que llenar al menos uno de los dos. El mensaje es opcional. |
| HU-403 | 2 | "El formulario pide cinco datos: nombre completo, correo electrónico, teléfono, productos de interés y mensaje." | Sin cambio de texto: siguen siendo los cinco datos. |
| HU-403 | 4 y 5 | Topes de 100 caracteres y teléfono de 8 o de 6 a 14 dígitos | Sin cambios: se aplican si se escribe el dato. |
| HU-501 | 2 | "Si falta un dato obligatorio, aparece el mensaje "Este campo es obligatorio.". Si no se marcó ningún producto, aparece el mensaje "Seleccione al menos un producto."." | El correo deja de ser un dato obligatorio por sí solo. Si faltan los dos, el mensaje sería el del sistema interno (HU-201): "Ingrese un correo electrónico o un teléfono.". **El mensaje exacto lo define Danny** al adaptar el formulario. |
| HU-501 | 3 y 4 | "Ingrese un correo electrónico válido.", "El teléfono debe tener 8 dígitos." y "El teléfono debe tener entre 6 y 14 dígitos." | Sin cambios: se aplican si se escribe el dato. |
| HU-502 | 1 | "Primero la busca por su correo y, si no la encuentra, por su teléfono (mismo país y mismo número). También revisa los contactos inactivos." | La busca primero por su correo, **si lo envió**, y si no la encuentra o no envió correo, por su teléfono. |
| HU-502 | 2 | "Si la persona no está en el directorio, el sistema crea un contacto nuevo con su nombre, correo y teléfono." | El contacto se crea con los datos que envió: el correo o el teléfono que falte queda vacío. |
| HU-503 | 1 | "Si la persona ya está en el directorio (mismo correo o mismo teléfono), el sistema no crea un contacto nuevo." | Sin cambio de texto. Ahora también aplica cuando solo envió teléfono. |
| HU-503 | 5 | "El nombre, el correo y el teléfono guardados no se cambian. Si la persona envió datos distintos, se anotan al final de la nota…" | Sin cambio de texto. Un dato que no envió no cuenta como distinto y no borra el guardado. |

También lo menciona el ticket **E5-020.1** (documento de Danny): "…y el correo identifica a la persona, de modo que reenviar el formulario actualiza el interés existente sin duplicarlo…" y "…por ejemplo, usar el correo como identificador del registro." Con la v4, la persona se identifica por su correo o, si no lo envió, por su teléfono. El contrato ya no usaba el correo como id del documento (punto 5 del contrato).

Sin cambios: HU-401 (el correo que se pide ahí es el de CANI Café en el pie), HU-404 y HU-405.

## Capturas (usuario `admin`, Microsoft Edge headless)

Escritorio a 1366 × 768, contra los emuladores con `npm run seed`. Las medidas tomadas en el navegador (filas de la lista con su etiqueta, barra de arriba, datos de la ficha, comunicaciones y valores del formulario de edición) están en [verificacion.json](verificacion.json). Los 23 pasos con su resultado están en [recorrido.json](recorrido.json). En ninguna pantalla hay desborde horizontal.

| Captura | Qué se ve |
|---|---|
| [01](01-lista-contactos.png) | Lista de contactos después del procesamiento: "Bruno Ficticio Solís" con "Nuevo mensaje"; "Fabián Solo Teléfono" (sin correo, "—") y "Gloria Solo Correo" (sin teléfono, "—") con "Nuevo", los tres arriba. Además "Elena Muestra Castro", del seed, sin correo. Barra de arriba: "Contactos (3)" |
| [02](02-busqueda-telefono-sin-correo.png) | Búsqueda "60001234": aparece solo Fabián, el contacto sin correo |
| [03](03-ficha-contacto-sin-correo.png) | Ficha de Fabián: "Persona interesada", correo "No registrado", teléfono +506 6000-1234, origen "Formulario web" y la comunicación del formulario con el mensaje y el producto |
| [04](04-editar-contacto-sin-correo.png) | "Editar contacto" de Fabián: el correo vacío y el teléfono cargado; la pantalla abre sin errores |
| [05](05-ficha-existente-conserva-correo.png) | Ficha de Bruno, actualizado por teléfono: conserva su correo bruno.ficticio@example.com, su teléfono y su clasificación "Cliente". Tiene una comunicación nueva "Formulario web" sin "Datos enviados distintos" |
| [06](06-lista-tras-abrir-fichas.png) | Lista después de abrir las dos fichas: las etiquetas de Fabián y Bruno desaparecen y solo Gloria sigue con "Nuevo" |

## Recorrido en el navegador

**Cómo se simularon las solicitudes.** El sitio público todavía exige el correo, así que no se usó su pantalla. Las solicitudes se escribieron directamente en el emulador, sin sesión y con el mismo método que usa el formulario público: el SDK de cliente (Firestore Lite) y las funciones `nuevoIdSolicitudIn` y `guardarSolicitudIn` de `sitio-publico/src/formulario/guardarSolicitud.ts`. Pasan por las reglas reales de `firestore.rules`. Después se abrió el sistema interno como `admin`, y el procesador (montado en AppLayout) las tomó solo.

| Caso | Solicitud | Resultado |
|---|---|---|
| A | "Fabián Solo Teléfono", sin correo, CR 60001234, con mensaje | ✅ Se guarda. Al procesarse: `created`; contacto con `email: null`, "Persona interesada", origen "Formulario web", etiqueta "Nuevo" |
| B | "Bruno Ficticio Solís", sin correo, CR 00000002 (el teléfono de `contact-002`) | ✅ Se guarda. Al procesarse: `updated` sobre `contact-002`. **Conserva su correo** bruno.ficticio@example.com, su teléfono y su clasificación; los productos de interés se reemplazan (Geisha 1 kg molido, 5); etiqueta "Nuevo mensaje". La nota no anota "Correo:" |
| C | "Gloria Solo Correo", gloria.solo.correo@example.com, sin teléfono | ✅ Se guarda. Al procesarse: `created`, como antes del cambio; teléfono null y etiqueta "Nuevo" |
| D | Sin correo ni teléfono | ✅ Las reglas la rechazan (`permission-denied`) y no se guarda |

| # | Paso | Resultado |
|---|---|---|
| 1 | Solicitudes en el emulador antes de abrir el sistema interno | ✅ Tres pendientes (A, B, C); la D no existe |
| 2–5 | Abrir la sesión de `admin` | ✅ Las tres quedan procesadas: A `created`, B `updated` sobre `contact-002`, C `created` |
| 6–8 | Datos en Firestore | ✅ A con `email: null`; B con su correo y teléfono intactos y "Nuevo mensaje"; C con teléfono null |
| 9–14 | Lista de contactos ([01](01-lista-contactos.png)) | ✅ Etiquetas "Nuevo" y "Nuevo mensaje", los tres arriba, "—" donde falta el correo o el teléfono, y "Contactos (3)" |
| 15–16 | Buscar "60001234" y "solo" ([02](02-busqueda-telefono-sin-correo.png)) | ✅ La búsqueda funciona con contactos sin correo |
| 17–19 | Ficha de Fabián ([03](03-ficha-contacto-sin-correo.png)) | ✅ Correo "No registrado", su teléfono y la comunicación; al abrirla se quita "Nuevo" (HU-504) |
| 20 | "Editar contacto" de Fabián ([04](04-editar-contacto-sin-correo.png)) | ✅ Correo vacío y teléfono 60001234 |
| 21–22 | Ficha de Bruno ([05](05-ficha-existente-conserva-correo.png)) | ✅ Conserva su correo; nueva comunicación sin "Correo:" ni "Datos enviados distintos" |
| 23 | Lista tras abrir las fichas ([06](06-lista-tras-abrir-fichas.png)) | ✅ Solo Gloria conserva "Nuevo" |

En la primera corrida, el paso de la barra de arriba falló por la comprobación del script, no por la aplicación. La barra muestra el texto en mayúsculas con CSS, así que el script leía "CONTACTOS (3)". Se corrigió la comprobación para no distinguir mayúsculas, se borraron los datos del emulador, se volvió a correr `npm run seed`, se escribieron otra vez las solicitudes y se repitió el recorrido completo. Las capturas y los JSON son de esa segunda corrida, con 23 de 23 pasos correctos.

**Datos usados:** las solicitudes y los contactos del recorrido solo existen en el emulador, que se apagó al terminar. Son ficticios.

## Pruebas

- `npm run typecheck`: sin errores.
- `npm test`: 1034/1034 (1028 anteriores + 6 nuevas). En 2 de 5 corridas completas falló por tiempo una prueba que este cambio no toca: `tests/components/NewContact.test.tsx`, "al guardar aparece la ficha…" (`findByRole` del encabezado). Aislada pasa 3 de 3 veces en esta rama y 3 de 3 en `main`. Es un fallo intermitente bajo carga, ajeno a este cambio.
- `npm run test:emulators`: 290/290 (266 anteriores + 24 nuevas).
- `npm run build:todo`: correcto. Los archivos de `dist-publico/` (JS, CSS, HTML y recursos) son idénticos byte a byte (sha256) a los de `main`.
- Las pruebas del sitio público pasan sin cambios: `tests/unit/publicBuild.test.ts`, `publicForm.test.ts`, `publicSubmit.test.ts`, `tests/components/ConsultaForm.test.tsx`, `EnvioFormulario.test.tsx` y el envío real con Firestore Lite en `tests/rules/formRequests.rules.test.ts`.

| Archivo | Nuevas | Qué prueba |
|---|---|---|
| `tests/rules/formRequests.rules.test.ts` | 16 | Acepta solo correo, solo teléfono (CR y otro país) y los dos. Rechaza la solicitud sin ninguno de los dos. Sin correo, sigue rechazando el teléfono inválido o a medias. Con teléfono válido, sigue rechazando el correo vacío, en mayúsculas, mal escrito, con espacios, de 101 caracteres o que no es texto. **Tope de expresiones:** acepta 72 productos con los dos datos, nombre y mensaje al máximo, y 72 solo con teléfono; rechaza 72 sin ninguno de los dos (por la regla, no por el tope). Con Firestore Lite y sin sesión, se guarda una solicitud sin correo y se rechaza una sin ninguno. |
| `tests/formRequests/processor.emulator.test.ts` | 8 | Sin correo y con coincidencia por teléfono: actualiza el contacto (HU-503), no le borra el correo y no anota "Correo:". Sin correo y sin coincidencia: crea el contacto con `email: null` (HU-502). Sin correo no coincide con otro contacto sin correo, pero sí coincide por teléfono con uno de la carga inicial sin correo. Solo con correo: coincide por correo como antes y no borra el teléfono guardado; sin coincidencia, crea el contacto sin teléfono. Sin ninguno de los dos: las reglas no la dejan crear y, si llega, se rechaza con su motivo sin tocar contactos. De extremo a extremo: Firestore Lite sin correo y el procesamiento. |
| `tests/unit/formRequestProcessing.test.ts` | 6 | `sentDifferences` con correo null: no cuenta como diferencia, tenga o no correo el contacto, y el teléfono distinto se sigue anotando. `hasEmailOrPhone`: acepta solo correo, solo teléfono o los dos; rechaza ninguno, el correo en blanco y el teléfono a medias. Texto del motivo de rechazo. |
