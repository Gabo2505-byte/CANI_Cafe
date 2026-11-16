# Evidencia: el teléfono primero en los formularios y al mostrar un contacto

**Responsable:** Dylan · **Revisa:** Gabriel (los formularios de contacto son de su dominio) · **Fecha:** 2026-11-15 · **Rama:** `dylan-ux-telefono`

## Decisión

El cliente trabaja sobre todo con números de teléfono. Por eso el sistema pone el teléfono antes que el correo:

- En los formularios de contacto ("Nuevo contacto" y "Editar contacto"), el **Teléfono** (con su selector de país) va **antes** del **Correo electrónico**. El aviso "Ingrese al menos uno: correo electrónico o teléfono." queda justo encima de ese bloque.
- En el selector "Contacto" de **Nueva oportunidad**, cada resultado muestra debajo del nombre **primero el teléfono y después el correo**. Si el contacto solo tiene uno, se muestra solo ese, sin separador.
- El mismo selector **también busca por teléfono**. Usa la misma comparación del buscador de la lista de contactos (HU-205, `matchesContactSearch`) sobre los contactos activos que ya se leían. **No hay consultas ni lecturas nuevas.**

**No cambia la validación.** Sigue siendo obligatorio "al menos uno: correo o teléfono". Los mensajes de error, los límites, la revisión de repetidos y lo que se guarda son los mismos.

## Qué cambió

| Archivo | Cambio |
|---|---|
| `src/contacts/ContactFormFields.tsx` | Orden: nombre → aviso → teléfono (país y número, con su error) → correo (con contador y error) → error "correo o teléfono" → dirección. Se movió el bloque sin cambiar ningún atributo, texto ni validación. |
| `src/sales/contactSearch.ts` | `searchContacts` usa `matchesContactSearch` (nombre, correo y teléfono; el teléfono por dígitos, con y sin el código del país). Se mantienen el mínimo de 2 caracteres, el tope de 10, solo activos y el orden por nombre. Nuevos: `CONTACT_SEARCH_MESSAGES.placeholder` y `contactSecondaryLine()`, que arma "teléfono · correo". |
| `src/sales/ContactPicker.tsx` | Usa el texto de ayuda nuevo y la línea secundaria (teléfono primero). |
| `src/styles.css` | La clase `.contact-picker-email` pasa a llamarse `.contact-picker-detail`, con el mismo estilo. |

**Sin cambios:** la validación (`contactForm.ts`), el servicio de cambio de etapa, el mapa de transiciones, el tablero y su arrastre, `firestore.rules`, `firestore.indexes.json`, `formRequests`, `sitio-publico/`, la pestaña "Avisos pendientes" y el seed.

### Dónde se muestra un contacto con correo y teléfono

| Lugar | Orden | ¿Cambió? |
|---|---|---|
| Resultados del selector "Contacto" (Nueva oportunidad) | Antes: solo el correo, y nada si no tenía correo. Ahora: teléfono · correo | **Sí** |
| Lista de contactos (`ContactsPage`), columnas | Nombre completo, Correo electrónico, Teléfono… | **No:** el orden de las columnas lo fija HU-204, criterio 1 |
| Ficha, recuadro "Datos del contacto" (`contactDetail.ts`) | Correo electrónico, Teléfono, Dirección… | **No:** el orden lo fija HU-207, criterio 4 |
| Tarjetas del tablero, detalle de la oportunidad, Avisos e historial de comunicaciones | Solo el nombre del contacto, sin correo ni teléfono | No aplica |

### Textos nuevos o modificados

| Lugar | Antes | Ahora |
|---|---|---|
| Ayuda del campo "Contacto" (Nueva oportunidad) | "Escriba al menos 2 letras del nombre o del correo" | "Escriba al menos 2 caracteres del nombre, correo o teléfono" |
| Línea debajo del nombre en los resultados del selector | El correo (o nada) | "+506 8888-8888 · nombre@dominio.com", o solo el dato que tenga |

El aviso "Ingrese al menos uno: correo electrónico o teléfono." y todos los mensajes de error **no cambian**. Solo cambia su posición.

## Criterios afectados

Textos literales de `Requisitos_Proyecto_Producto.pdf`, para que Danny los registre como cambio:

| HU | Criterio | Texto del documento | Cómo queda |
|---|---|---|---|
| HU-201 | 2 | "El formulario pide cuatro datos: nombre completo, correo electrónico, teléfono y dirección." | Los mismos cuatro datos, en pantalla en este orden: nombre completo, teléfono, correo electrónico y dirección. |
| HU-210 | 2 | "Se pueden cambiar el nombre completo, el correo, el teléfono (con su país) y la dirección." | Los mismos datos. En pantalla, el teléfono (con su país) va antes del correo. |
| HU-302 | 1 | "Para elegir el contacto, se escriben al menos 2 letras de su nombre o su correo. Aparece una lista con hasta 10 contactos activos que coinciden." | Se escriben al menos 2 caracteres de su nombre, su correo o su teléfono. Sigue apareciendo una lista con hasta 10 contactos activos que coinciden; cada uno muestra su teléfono y su correo, primero el teléfono. |

**Sin tocar, porque su orden es literal:** HU-204.1 (columnas de la lista: nombre completo, correo electrónico, teléfono, clasificación y fecha de registro) y HU-207.4 (recuadro "Datos del contacto": correo, teléfono, dirección, fecha de registro y origen). Si el cliente también quiere el teléfono primero ahí, es otro cambio de criterio.

## Capturas (usuario `admin`, Microsoft Edge headless)

Contra los emuladores con `npm run seed`. Escritorio a 1366 × 768 y móvil a 390 px de ancho. Las medidas tomadas en el navegador (orden de los campos, posición vertical de cada uno, opciones del selector con su línea secundaria y desborde horizontal) están en [verificacion.json](verificacion.json). Los 18 pasos con su resultado están en [recorrido.json](recorrido.json). En ninguna pantalla hay desborde horizontal.

| Captura | Qué se ve |
|---|---|
| [01](01-nuevo-contacto.png) | "Nuevo contacto": nombre, el aviso, **Teléfono** con "CR (+506)", **Correo electrónico** y dirección |
| [02](02-nuevo-contacto-error-correo-o-telefono.png) | Solo con el nombre y "Guardar": el mensaje de siempre, "Ingrese un correo electrónico o un teléfono.", debajo del bloque de teléfono y correo; el contacto no se guarda |
| [03](03-editar-contacto.png) | "Editar contacto" de Bruno: el mismo orden, con su teléfono 0000-0002 y su correo cargados |
| [04](04-nueva-oportunidad-buscar-nombre.png) | Nueva oportunidad, búsqueda por nombre "ca": Carla (solo correo) con su correo y Elena (solo teléfono) con "+506 0000-0005" |
| [05](05-nueva-oportunidad-buscar-telefono.png) | Búsqueda por teléfono "0000-0005": solo Elena, que no tiene correo, con su teléfono |
| [06](06-movil-390-nuevo-contacto.png) | "Nuevo contacto" a 390 px: el mismo orden, sin desborde |
| [07](07-movil-390-nueva-oportunidad-telefono.png) | Nueva oportunidad a 390 px, búsqueda "0000": Ana y Bruno con "teléfono · correo" (la línea se parte en dos renglones) y Elena con solo el teléfono; todo cabe |

## Recorrido en el navegador

| # | Paso | Resultado |
|---|---|---|
| 1 | Ingreso con `admin` | ✅ |
| 2–4 | Nuevo contacto ([01](01-nuevo-contacto.png)): orden de las etiquetas, posición en pantalla (aviso 275 px, teléfono 332 px, correo 413 px, dirección 519 px) y país CR (+506) | ✅ |
| 5–6 | Sin correo ni teléfono ([02](02-nuevo-contacto-error-correo-o-telefono.png)): mismo mensaje, debajo del bloque, se queda en el formulario | ✅ |
| 7–8 | Editar contacto ([03](03-editar-contacto.png)): mismo orden y datos actuales de Bruno | ✅ |
| 9 | Texto de ayuda nuevo del campo "Contacto" | ✅ |
| 10 | Búsqueda por nombre "ca" ([04](04-nueva-oportunidad-buscar-nombre.png)): solo correo y solo teléfono | ✅ |
| 11 | Búsqueda por nombre "bruno": "+506 0000-0002 · bruno.ficticio@example.com" | ✅ |
| 12 | Búsqueda por teléfono "0000-0005" ([05](05-nueva-oportunidad-buscar-telefono.png)): solo Elena | ✅ |
| 13 | Búsqueda con el código del país "+506 0000-0001": solo Ana | ✅ |
| 14 | "+1 305" (el teléfono de Diego, que está **inactivo**): "No se encontraron contactos." | ✅ |
| 15 | Un número de nadie, "7777": "No se encontraron contactos." | ✅ |
| 16 | Buscar "00000005" y elegir con Enter: queda "Elena Muestra Castro" | ✅ |
| 17 | 390 px, Nuevo contacto ([06](06-movil-390-nuevo-contacto.png)): mismo orden, sin desborde | ✅ |
| 18 | 390 px, Nueva oportunidad con "0000" ([07](07-movil-390-nueva-oportunidad-telefono.png)): la lista y las líneas caben | ✅ |

**Corridas anteriores.** Las dos primeras corridas fallaron por el script, no por la aplicación:

- En la primera, un error de programación en una comprobación cortó el recorrido después del paso 4.
- En la segunda, el script no vaciaba el campo entre búsquedas, así que los textos se acumularon (por ejemplo "cbrun0000-000…"). Se cambió el borrado a Ctrl+A y Retroceso, con una comprobación de que el campo quede vacío.
- Además, un paso esperaba encontrar a Diego con "+1 305". Diego está inactivo en el seed y el selector solo ofrece contactos activos (HU-302), así que la expectativa era incorrecta. Ese paso ahora comprueba que **no** aparezca, y se agregó la búsqueda "+506 0000-0001" (Ana, activa) para probar el código del país.

Antes de cada corrida se borraron los datos del emulador y se volvió a correr `npm run seed`. Las capturas y los JSON son de la última corrida, con 18 de 18 pasos correctos.

**Datos usados:** los contactos del seed (ficticios). El recorrido no guardó nada en el emulador, que se apagó al terminar.

## Pruebas

- `npm run typecheck`: sin errores.
- `npm test`: 1084/1084 (13 nuevas y 1 actualizada).
- `npm run test:emulators`: 303/303 (sin pruebas nuevas: el cambio no toca reglas, consultas ni datos).
- `npm run build:todo`: correcto. Los archivos de `dist-publico/` (JS, CSS, HTML y recursos) son idénticos byte a byte (sha256) a los de `main`.

| Archivo | Nuevas | Qué prueba |
|---|---|---|
| `tests/components/NewContact.test.tsx` | 1 | Orden en "Nuevo contacto": nombre → aviso → país → teléfono → correo → dirección. Lo que sigue al aviso es la etiqueta "Teléfono". |
| `tests/components/EditContact.test.tsx` | 1 (+1 actualizada) | El mismo orden en "Editar contacto". La prueba del criterio 2 espera ahora `fullName, phone, email, address`. |
| `tests/components/ContactPicker.test.tsx` | 6 | Texto de ayuda nuevo. Búsqueda por teléfono con guion y elección del contacto sin correo. Línea secundaria con los dos datos (teléfono primero), solo con correo, solo con teléfono y sin ninguno (solo el nombre). Un número de nadie da "No se encontraron contactos.". |
| `tests/unit/contactSearch.test.ts` | 5 | Búsqueda por parte del número, con guion, con "+506" y de otro país. Con 1 dígito no busca y con 2 sí. Los inactivos no aparecen por teléfono. Nombre y correo siguen funcionando. `contactSecondaryLine` con los dos datos, con uno, con ninguno y con un correo en blanco. |
