# Evidencia: bitácora por contacto en la pantalla "Avisos"

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-11-15 · **Rama:** `dylan-bitacora-avisos`

## Decisión

El mentor sugirió que la pantalla de Avisos fuera más completa y mostrara una bitácora por cliente. El grupo decidió:

- Que sea la **misma pantalla "Avisos"**, sin una opción nueva en el menú.
- Una **línea de tiempo por contacto**, solo con los datos que ya existen: comunicaciones y cambios de etapa.
- **No mostrar quién hizo cada acción.**
- Un buscador por nombre, correo o teléfono y un filtro por tipo de evento.
- **Solo lectura.**

La pantalla queda con dos pestañas. "Avisos pendientes" es la que se ve al abrir y contiene la tabla de HU-316 sin cambios. "Bitácora" es la nueva.

No cambia ningún criterio de aceptación: HU-314, HU-315 y HU-316 se cumplen igual que antes. Se registrará como mejora en la próxima entrega.

## Cambio 2: lista de contactos al abrir la pestaña (2026-11-15)

Antes la pestaña "Bitácora" solo mostraba el buscador y había que escribir para ver contactos. Ahora, **al abrirla, se ve la lista de contactos** y se puede tocar uno o escribir para filtrarla.

**Cómo carga hoy la lista de contactos (HU-204, HU-205 y HU-504) y qué se reutiliza:**

- Una sola consulta, `listAllContactsIn`: toda la colección `contacts` ordenada por `nameSortKey`, **sin límite de lectura** y **con activos e inactivos**. No pagina en la consulta: lee todo una vez.
- En el navegador se filtra con `filterContacts` (HU-205), se ponen primero los que tienen etiqueta del formulario con `badgedFirst` (HU-504) y se pagina **de 20 en 20** (`CONTACTS_PAGE_SIZE`) con "Anterior", "Página X de Y" y "Siguiente".
- El selector anterior de la bitácora usaba esa misma consulta y la misma búsqueda, pero solo mostraba resultados al escribir (hasta 10, sin paginar ni etiqueta).

**Ahora la bitácora usa exactamente esa lógica:** `listAllContactsIn` (sin consultas nuevas), `filterContacts`, `badgedFirst`, `foundContactsMessage` y `CONTACTS_LIST_MESSAGES`, con la misma paginación de 20.

**Comportamiento:**

- Al abrir la pestaña, sin contacto elegido: el buscador, "Se encontraron N contactos." y la lista (nombre con su etiqueta del formulario si la tiene, correo y teléfono). Los contactos inactivos se incluyen.
- Cada fila es un botón: se elige con clic, toque, Enter o Espacio, tiene contorno visible al enfocarla con el teclado y mide al menos 3 rem de alto (75 px en 390 px de ancho).
- Escribir filtra la lista (nombre, correo o teléfono, sin distinguir mayúsculas ni tildes) y vuelve a la página 1. Sin resultados: "No se encontraron contactos.". Sin contactos en el sistema: "Aún no hay contactos registrados.".
- Al elegir un contacto se ve su línea de tiempo como antes, con el botón **"Cambiar contacto"**, que vuelve a la lista y quita de la URL el contacto y el filtro. El contacto y el filtro siguen en la URL (`?vista=bitacora&contacto=<id>&tipo=...`), así que "atrás" desde el detalle de una oportunidad vuelve a la misma bitácora con el mismo contacto.

**Textos nuevos de este cambio:** solo **"Cambiar contacto"**. Todo lo demás ya existía: "Se encontraron N contactos.", "No se encontraron contactos.", "Aún no hay contactos registrados.", "Anterior", "Siguiente" y "Página X de Y". La lista ya no se limita a 10 resultados; "Contactos encontrados" sigue siendo su nombre para lectores de pantalla.

**Lecturas al abrir la pestaña:** es la misma lectura de la lista de contactos, **un documento por contacto, una sola vez**. Con el seed: **5 lecturas**. Con 500 contactos: **500 lecturas** (igual que abrir la lista de contactos; la paginación de 20 es solo de pantalla, no de la consulta). Al elegir un contacto no se vuelven a leer los contactos. La línea de tiempo de cada contacto lee lo mismo que antes (tabla de "Datos y lecturas").

**Archivos de este cambio:** `src/sales/ContactTimeline.tsx`, `src/sales/AlertsPage.tsx` (nueva función para volver a la lista), `src/sales/timeline.ts` (el texto "Cambiar contacto"), `src/styles.css` (foco visible y altura mínima de la fila) y `tests/components/AlertsTimeline.test.tsx`. No se tocó la pestaña "Avisos pendientes", reglas, índices, el cambio de etapa, el tablero, `formRequests`, `sitio-publico/`, `src/contacts`, `src/communications` ni `src/auth`.

## Cambio 3: navegación de la pestaña "Bitácora" (2026-11-15)

- **Tocar la pestaña "Bitácora" con un contacto abierto vuelve a la lista**, igual que "Cambiar contacto": se quitan de la URL el contacto y el filtro (queda `/avisos?vista=bitacora`). Es una entrada nueva en el historial, así que "Atrás" vuelve al contacto. Si ya se está en la lista, no pasa nada (no se borra lo escrito en el buscador).
- **Foco y scroll.** Al volver a la lista (con la pestaña, con "Cambiar contacto" o con "Atrás"), el buscador queda vacío y con el foco; al elegir un contacto, el foco pasa al título de su bitácora (`h2`, con `tabIndex=-1`, no entra en el orden de Tab). En ambos casos la página vuelve arriba. Al abrir la pantalla con el contacto ya en la URL (enlace guardado o "Atrás" desde un detalle de otra pantalla) no se mueve el foco: solo se actúa cuando cambia el contacto estando en la pantalla.
- **"Avisos" del menú lateral desde la bitácora** ya abría la tabla de avisos pendientes (HU-316): el enlace va a `/avisos` sin parámetros, que es la pestaña "Avisos pendientes". **No se cambió nada**; solo se agregó la prueba y el recorrido.
- **"Atrás" del navegador** ya funcionaba entre lista, contacto elegido y detalle de oportunidad; no se cambió, se agregó la prueba y el recorrido.

**Textos nuevos:** ninguno.

**Archivos:** `src/sales/AlertsPage.tsx` (`showTab`: tocar la pestaña activa con contacto abierto llama a `clearContact`), `src/sales/ContactTimeline.tsx` (foco, scroll y reinicio del buscador al cambiar de contacto) y `tests/components/AlertsTimeline.test.tsx`. No se tocó la pestaña "Avisos pendientes", reglas, índices, cambio de etapa, tablero, `formRequests`, `sitio-publico/`, `src/contacts`, `src/communications` ni `src/auth`.

## Qué cambió

| Archivo | Cambio |
|---|---|
| `src/sales/AlertsPage.tsx` | Agrega dos pestañas: "Avisos pendientes" y "Bitácora". La tabla, sus columnas, colores, mensajes y clic al detalle **no cambian**; solo quedan dentro de la primera pestaña. La pestaña, el contacto elegido y el filtro se guardan en la URL (`?vista=bitacora&contacto=<id>&tipo=comunicaciones`), así que "atrás" vuelve a la misma bitácora. Las pestañas se cambian también con las flechas del teclado. |
| `src/sales/ContactTimeline.tsx` (nuevo) | Contenido de la pestaña "Bitácora": el buscador, los resultados (hasta 10), el encabezado del contacto con "Ver ficha del contacto", el filtro "Tipo de evento" y la línea de tiempo. Los contactos se cargan **solo al abrir la pestaña**. |
| `src/sales/timeline.ts` (nuevo) | Funciones puras: `buildTimeline` combina y ordena los eventos, aplica el tope y marca si hay más; `filterTimeline` aplica el filtro. También contiene los textos. |
| `src/sales/timelineRepository.ts` y `timelineApi.ts` (nuevos) | Las consultas por contacto (ver "Datos y lecturas"). |
| `src/styles.css` | Estilos de la bitácora al final de la sección 13 (Avisos). Usa los tokens existentes y las clases del historial de comunicaciones (`communication-card`, `record-meta`, `record-note`) y de la barra de filtros de contactos (`list-toolbar`, `list-search`, `list-filter`). |

**Se reutiliza (sin modificar):** la búsqueda de HU-205 (`matchesContactSearch` y el texto `CONTACT_SEARCH_LABEL`), la lectura de todos los contactos (`listAllContactsIn`), `SALE_STAGE_LABELS`, `mediumLabel`, `communicationDateLabel`, `communicationSaleLabel` y `lossReasonText`, y los formatos de fecha de `src/shared/utils/dates.ts`.

**No se tocó:** el servicio de cambio de etapa, el mapa de transiciones, el tablero y el arrastre, `firestore.rules`, `firestore.indexes.json`, `formRequests`, `sitio-publico/`, `src/auth/`, `src/contacts/` ni `src/communications/`. Tampoco se escribe nada en la base de datos.

## Contenido de la bitácora

- **Lista y buscador:** al abrir la pestaña se ve la lista de contactos (ver "Cambio 2"). El buscador "Buscar por nombre, correo o teléfono" la filtra con la misma lógica de HU-205: texto parcial, sin distinguir mayúsculas ni tildes, y teléfono con o sin guion o código de país.
- **Línea de tiempo:** del evento más reciente al más antiguo.
  - **Comunicación:** fecha (las del formulario web llevan además la hora del envío, como en la ficha), medio ("Otro: …" si aplica), origen ("Origen: formulario web" o "Origen: registro manual"), la oportunidad a la que corresponde (con enlace a su detalle) o "Todas sus oportunidades de venta", y la nota.
  - **Cambio de etapa:** fecha, la oportunidad (con enlace), "Etapa: anterior → nueva" y, si pasó a "Venta perdida", "Motivo de pérdida: …" (o "Sin motivo registrado"). La entrada inicial, que no tiene etapa anterior, se muestra como "Oportunidad creada" con "Etapa inicial: …".
- **Filtro "Tipo de evento":** Todos, Comunicaciones o Cambios de etapa.
- **No se muestra** quién registró cada comunicación ni quién cambió cada etapa.
- **No se agregan las solicitudes del formulario (`formRequests`)** como eventos aparte: cada formulario recibido ya tiene su comunicación.
- **El alta del contacto no se muestra como evento.** Así, el filtro tiene solo dos tipos y un contacto sin actividad muestra el estado vacío. La fecha de registro sigue en su ficha.

### Orden y empates

- Las comunicaciones del formulario web se ordenan por la fecha y hora exactas del envío.
- Las comunicaciones registradas a mano solo guardan el día (00:00). Si se registraron ese mismo día, se usa la hora del registro (`createdAt`) para ordenarlas bien frente a los cambios de etapa de ese día. Si se registraron otro día (con fecha anterior), se usa el día indicado.
- Si dos eventos tienen el mismo instante, el orden es: cambio de etapa, luego comunicación, luego creación de la oportunidad. Después se ordena por id. El resultado no depende del orden en que llegan los datos.

### Tope de eventos

Se muestran como máximo los **100 eventos más recientes** por contacto. Si hay más, aparece "Se muestran los 100 eventos más recientes.".

## Textos visibles nuevos

| Dónde | Texto |
|---|---|
| Pestañas | "Avisos pendientes", "Bitácora" |
| Introducción | "Busque un contacto para ver su bitácora: sus comunicaciones y los cambios de etapa de sus oportunidades de venta." |
| Buscador (reutilizado de HU-205) | "Buscar por nombre, correo o teléfono" |
| Volver a la lista (cambio 2) | "Cambiar contacto" |
| Mientras carga | "Cargando contactos…", "Cargando bitácora…" |
| Errores (en rojo) | "No se pudieron cargar los contactos. Intente de nuevo." (el mismo de HU-302), "No se pudo cargar la bitácora. Intente de nuevo." |
| Sin resultados y conteo (reutilizados de HU-205) | "No se encontraron contactos.", "Se encontraron N contactos.", "Aún no hay contactos registrados." |
| Encabezado del contacto | "Ver ficha del contacto" |
| Filtro | "Tipo de evento": "Todos", "Comunicaciones", "Cambios de etapa" |
| Eventos | "Comunicación", "Cambio de etapa", "Oportunidad creada", "Origen: formulario web", "Origen: registro manual", "Oportunidad de venta: …", "Etapa inicial: …", "Etapa: … → …", "Motivo de pérdida: …" |
| Estados vacíos | "Este contacto no tiene comunicaciones ni cambios de etapa registrados.", "Este contacto no tiene eventos de este tipo." |
| Tope | "Se muestran los 100 eventos más recientes." |
| Solo para lectores de pantalla | "Vistas de avisos", "Contactos encontrados", "Eventos de la bitácora" |

"Todas sus oportunidades de venta", "Sin motivo registrado", los nombres de las etapas y los de los medios ya existían.

## Criterios afectados

| HU | Criterio | Cómo queda |
|---|---|---|
| HU-103 | 2 | Sin cambios: la barra sigue mostrando "Avisos". No se agregó ninguna opción al menú. |
| HU-314 / HU-315 | — | Sin cambios: el cálculo de los avisos no se tocó. |
| HU-316 | 1 | Sin cambios: el círculo rojo sigue igual. |
| HU-316 | 2, 3 y 4 | Sin cambios: la pantalla "Avisos" abre mostrando la misma tabla, con las mismas columnas, el mismo orden, los mismos colores, el mismo clic al detalle y el mismo "No hay avisos pendientes.". La única diferencia es que encima de la tabla están las dos pestañas. |
| HU-317 | — | Fuera de alcance; no se implementó. El filtro de la bitácora es solo para sus eventos, no para los avisos. |

## Datos y lecturas

Todas las consultas son de solo lectura y usan las reglas actuales.

| Consulta | Cuándo | Índice |
|---|---|---|
| `contacts` ordenado por `nameSortKey` (la misma de la lista de contactos, sin límite) | Una vez, al abrir la pestaña "Bitácora" (5 lecturas con el seed, 500 con 500 contactos) | Un solo campo (automático) |
| `communications` con `contactId ==`, ordenado por `date` desc y `createdAt` desc, `limit(101)` | Al elegir un contacto | **Ya existe:** `contactId` + `date` desc + `createdAt` desc (el del historial de la ficha, HU-213) |
| `sales` con `contactId ==`, sin orden | Al elegir un contacto, en paralelo con la anterior | No necesita índice compuesto (la ficha usa la misma consulta) |
| `stageHistory` con `saleId in [hasta 30]`, ordenado por `changedAt` desc, `limit(101)`, un lote por cada 30 oportunidades | Después de leer las oportunidades | **Ya existe:** `saleId` + `changedAt` desc (el del detalle de la venta, HU-308) |

**No hace falta ningún índice nuevo** y no se cambió `firestore.indexes.json`. Una prueba de emulador comprueba que los dos índices compuestos siguen declarados.

Lecturas por contacto del seed (documentos leídos; una consulta vacía cuenta como 1 lectura). Abrir la pestaña lee además los contactos una sola vez (5 con el seed, 500 con 500 contactos).

| Contacto | Comunicaciones | Oportunidades | Cambios de etapa | Lecturas | Eventos |
|---|---|---|---|---|---|
| Ana Prueba Mora (`contact-001`) | 2 | 1 | 3 | 6 | 5 |
| Bruno Ficticio Solís (`contact-002`) | 2 | 3 | 13 | 18 | 15 |
| Carla Demo Vargas (`contact-003`) | 1 | 1 | 3 | 5 | 4 |
| Diego Ejemplo Rojas (`contact-004`) | 0 | 0 | — (no se consulta) | 2 | 0 |
| Elena Muestra Castro (`contact-005`) | 1 | 1 | 1 | 3 | 2 |

Con el tope de 100, el máximo por contacto es de 101 comunicaciones, más las oportunidades, más 101 cambios de etapa por cada lote de 30 oportunidades.

## Capturas (datos del seed, usuario `admin`, Microsoft Edge)

Escritorio a 1366 × 768 y móvil a 390 × 844, contra los emuladores después de `npm run seed`. Las capturas se rehicieron con el cambio 2 (las anteriores se reemplazaron). Los datos medidos en el navegador están en [verificacion.json](verificacion.json): encabezados y filas de la tabla, pestañas, contactos de la lista, conteo, texto de cada evento, contorno de foco, altura de las filas, ruta, ancho de la ventana y del documento, y si hay desborde. Los pasos con su resultado están en [recorrido.json](recorrido.json) (14 del cambio 2 y 8 del cambio 3).

| Captura | Qué se ve |
|---|---|
| [01](01-avisos-como-estaba.png) | "Avisos" al abrir: pestaña "Avisos pendientes" y la tabla de siempre, con 5 avisos y el círculo en 5 |
| [02](02-pestana-bitacora-lista.png) | Pestaña "Bitácora" al abrir: buscador, "Se encontraron 5 contactos." y la lista (incluye a Diego, inactivo) con paginación |
| [03](03-lista-filtrada-por-nombre.png) | "ANA prueba": "Se encontró 1 contacto." y solo Ana Prueba Mora |
| [04](04-lista-filtrada-por-telefono.png) | "0000-0002": solo Bruno Ficticio Solís |
| [05](05-lista-sin-resultados.png) | "zzzz": "No se encontraron contactos." |
| [06](06-contacto-elegido-ana.png) | Contacto elegido (Ana): su línea de tiempo con el botón "Cambiar contacto" y sin la lista |
| [07](07-filtro-comunicaciones.png) | Filtro "Comunicaciones" en Ana: solo sus 2 comunicaciones |
| [08](08-volver-a-la-lista.png) | Después de "Cambiar contacto": la lista completa otra vez |
| [09](09-foco-visible-en-una-fila.png) | Con la tecla Tab, la fila enfocada (Diego) tiene contorno dorado visible |
| [10](10-movil-390-lista.png) | 390 px: la lista de contactos, sin desborde; las filas miden 75 px de alto |
| [11](11-movil-390-lista-filtrada.png) | 390 px: lista filtrada por "ana" |
| [12](12-movil-390-contacto-elegido.png) | 390 px: contacto elegido con "Cambiar contacto" |
| [13](13-movil-390-avisos-pendientes.png) | 390 px: la pestaña de avisos no desborda la página; la tabla se desplaza dentro de su recuadro, como antes |
| [14](14-contacto-abierto-antes-de-tocar-la-pestana.png) | Cambio 3: bitácora de Ana abierta desde la URL con el filtro "Comunicaciones" (antes de tocar la pestaña) |
| [15](15-pestana-bitacora-vuelve-a-la-lista-con-foco.png) | Cambio 3: tras tocar la pestaña "Bitácora" se ve la lista, el buscador vacío y con el contorno dorado del foco |
| [16](16-contacto-elegido-con-foco-en-el-titulo.png) | Cambio 3: tras elegir a Bruno con Enter, el foco (contorno dorado) está en el título de su bitácora |
| [17](17-menu-avisos-desde-la-bitacora.png) | Cambio 3: "Avisos" del menú desde la bitácora con un contacto abierto: tabla de avisos pendientes |

**Detalle de los datos del seed:** la comunicación de formulario web de Ana (`comm-006`) es anterior a HU-502. Tiene medio "Otro: Formulario del sitio web" y hora 00:00, así que se ve "12/10/2026 12:00 a. m. · Otro: Formulario del sitio web". Las que crea el procesador del formulario tienen medio "Formulario web" y la hora real del envío; ese caso lo cubren las pruebas unitarias y de componente.

## Recorrido en el navegador

Contra emuladores con `npm run seed` y sesión como `admin`. El recorrido no modifica datos.

| # | Paso | Resultado |
|---|---|---|
| 1 | Abrir "Avisos" | ✅ Abre en "Avisos pendientes" con la tabla de siempre: mismas columnas, 5 avisos y círculo en 5 ([01](01-avisos-como-estaba.png)) |
| 2 | Abrir la pestaña "Bitácora" | ✅ Se ve el buscador y la lista de los 5 contactos en orden alfabético, con Diego (inactivo) y "Se encontraron 5 contactos."; URL `/avisos?vista=bitacora` ([02](02-pestana-bitacora-lista.png)) |
| 3 | Escribir "ANA prueba" | ✅ Solo Ana Prueba Mora, "Se encontró 1 contacto." ([03](03-lista-filtrada-por-nombre.png)) |
| 4 | Escribir "0000-0002" | ✅ Solo Bruno Ficticio Solís ([04](04-lista-filtrada-por-telefono.png)) |
| 5 | Escribir "zzzz" | ✅ "No se encontraron contactos." y ninguna fila ([05](05-lista-sin-resultados.png)) |
| 6 | Limpiar el buscador y tocar la fila de Ana | ✅ 5 eventos (formulario web, pérdida con motivo…), botón "Cambiar contacto", la lista ya no se ve; URL `...&contacto=contact-001` ([06](06-contacto-elegido-ana.png)) |
| 7 | Filtro "Comunicaciones" | ✅ Solo 2 comunicaciones; la URL lleva `&tipo=comunicaciones` ([07](07-filtro-comunicaciones.png)) |
| 8 | "Cambiar contacto" | ✅ Vuelve la lista completa; la URL queda `/avisos?vista=bitacora` ([08](08-volver-a-la-lista.png)) |
| 9 | Con Tab llegar a la fila de Diego y Enter | ✅ La fila enfocada tiene contorno sólido de 2 px ([09](09-foco-visible-en-una-fila.png)); Enter abre su bitácora vacía: "Este contacto no tiene comunicaciones ni cambios de etapa registrados." |
| 10 | En la bitácora de Ana, clic en una oportunidad y "atrás" | ✅ Abre `/posibles-ventas/sale-004`; "atrás" vuelve a `/avisos?vista=bitacora&contacto=contact-001` |
| 11 | 390 px, lista de contactos | ✅ Sin desborde (documento 375 px en ventana de 390 px); filas de 75 px de alto ([10](10-movil-390-lista.png)) |
| 12 | 390 px, lista filtrada | ✅ Sin desborde ([11](11-movil-390-lista-filtrada.png)) |
| 13 | 390 px, contacto elegido | ✅ Sin desborde ([12](12-movil-390-contacto-elegido.png)) |
| 14 | 390 px, pestaña "Avisos pendientes" | ✅ La página no desborda; la tabla se desplaza dentro de su recuadro ([13](13-movil-390-avisos-pendientes.png)) |
| 15 | Cambio 3: abrir `/avisos?vista=bitacora&contacto=contact-001&tipo=comunicaciones`, bajar la página 400 px | ✅ Bitácora de Ana; el foco sigue en `body` ([14](14-contacto-abierto-antes-de-tocar-la-pestana.png)) |
| 16 | Tocar la pestaña "Bitácora" (ya activa) | ✅ Vuelve la lista de 5 contactos; URL `/avisos?vista=bitacora`; buscador vacío y con el foco (contorno sólido de 2 px); página arriba (scroll 400 → 0) ([15](15-pestana-bitacora-vuelve-a-la-lista-con-foco.png)) |
| 17 | Escribir "bruno" y tocar otra vez la pestaña (ya en la lista) | ✅ No cambia nada: la URL es la misma, el buscador conserva "bruno" y sigue 1 fila |
| 18 | Bajar la página, enfocar la fila y Enter | ✅ Abre la bitácora de Bruno; el foco está en su título (contorno de 2 px); scroll 400 → 0 ([16](16-contacto-elegido-con-foco-en-el-titulo.png)) |
| 19 | "Atrás" del navegador | ✅ Vuelve a la lista (`/avisos?vista=bitacora`, 5 contactos) |
| 20 | "Adelante" | ✅ Vuelve al contacto (`...&contacto=contact-002`) |
| 21 | Clic en una oportunidad del contacto y "atrás" | ✅ Abre `/posibles-ventas/sale-003`; "atrás" vuelve al mismo contacto |
| 22 | "Avisos" del menú lateral con un contacto abierto | ✅ Abre `/avisos` en "Avisos pendientes" con la tabla de 5 avisos ([17](17-menu-avisos-desde-la-bitacora.png)). Ya funcionaba; no se cambió |

Nota del cambio 3: para que hubiera algo que desplazar, el script agrega `min-height: 2000px` al `body` antes de bajar la página (las pantallas del seed caben en 768 px). El scroll de los pasos 16 y 18 es el de esa página alargada.

## Pruebas

- `npm run typecheck`: sin errores.
- `npm test`: 1119/1119 (1111 anteriores + 8 nuevas del cambio 3, en `tests/components/AlertsTimeline.test.tsx`: 30 pruebas en ese archivo). `tests/components/Alerts.test.tsx` y `tests/unit/alerts.test.ts` pasan **sin cambios**.
- `npm run test:emulators`: en verde (sin pruebas nuevas en este cambio; las 10 de la bitácora siguen pasando). `tests/sales/alerts.emulator.test.ts` pasa sin cambios.
- `npm run build:todo`: correcto. El JS y el CSS del sitio público tienen el mismo SHA-256 que los de `main` compilado en ese momento (`index-CSHMWcP8.js` e `index-DjGTDoei.css`); se comprobó de nuevo en el cambio 3.
- Recorrido en el navegador: 22/22 pasos correctos (14 + 8 del cambio 3).

| Archivo | Pruebas | Qué prueba |
|---|---|---|
| `tests/unit/timeline.test.ts` (nuevo) | 18 | Orden combinado; comunicación del mismo día frente a un cambio de etapa (hora de registro); comunicación registrada días después (día indicado); hora exacta del formulario web; empates y que el resultado no depende del orden de entrada; la entrada inicial como creación; motivo de pérdida, también vacío ("Sin motivo registrado"); oportunidad desconocida ("—"); comunicación con oportunidad, para todas o sin ninguna; medio "Otro: …"; origen del formulario web con hora; que no aparece el usuario; tope y aviso de que hay más; sin datos; filtro; filtro leído de la URL. |
| `tests/components/AlertsTimeline.test.tsx` (nuevo) | 22 | Al abrir se ve "Avisos pendientes" y no se cargan contactos; cambiar de pestaña con clic y con flechas; URL. **Cambio 2:** la lista de contactos (activos e inactivos, con correo y teléfono) al abrir, etiqueta del formulario primero, paginación de 20 en 20, lista vacía, tocar una fila, Enter y Espacio, "Cambiar contacto" y abrir con la URL guardada. Buscar por nombre sin tildes, por correo y por teléfono con guion; sin coincidencias y volver a la lista al borrar; error al cargar contactos; elegir un contacto y ver su línea de tiempo en orden, sin "Registrado por"; enlaces al detalle y a la ficha; filtro con sus tres opciones y la URL; contacto sin eventos; filtro sin resultados; aviso de tope; error al cargar la bitácora. |
**Cambio 3 (8 pruebas nuevas en `AlertsTimeline.test.tsx`):** tocar la pestaña con contacto abierto vuelve a la lista y quita contacto y filtro; tocarla en la lista no cambia nada (conserva el texto buscado); al volver, el buscador queda vacío, con el foco y con `scrollTo(0, 0)`; "Cambiar contacto" hace lo mismo; al elegir un contacto el foco pasa al título y se sube la página; con el contacto ya en la URL no se mueve el foco; "Avisos" del menú desde la bitácora abre la tabla; "Atrás" recorre lista, contacto y detalle de oportunidad.

| `tests/sales/timeline.emulator.test.ts` (nuevo) | 10 | Con los datos del seed y las reglas del repo: contactos para el buscador, la línea de tiempo exacta de Ana (formulario web, pérdida con motivo, creación), Bruno con tres oportunidades, Carla, Elena, Diego sin eventos, un id que no existe, el tope, que sin sesión las reglas niegan la lectura, y que los dos índices compuestos que usan las consultas están en `firestore.indexes.json`. |

## Lo que no se probó

- **Las lecturas contra producción.** Los números de "Datos y lecturas" son los documentos que devuelve cada consulta. El emulador no exige índices; que los índices existentes sirven se comprueba porque están declarados y porque las consultas tienen la misma forma que las de la ficha (HU-213) y el detalle (HU-308), que ya funcionan en producción.
- **El tope de 100 con datos reales.** El seed no tiene contactos con más de 100 eventos. Se probó con un tope menor (3) contra el emulador y con datos simulados.
- **La paginación de la lista con muchos contactos en el navegador:** el seed solo tiene 5 contactos; se probó con 25 en la prueba de componente.
- **El caso de más de 30 oportunidades** (más de un lote de `stageHistory`) no está en el seed. Se usa la misma partición en lotes de 30 que los avisos.
