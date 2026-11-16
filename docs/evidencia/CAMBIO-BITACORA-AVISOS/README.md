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

- **Buscador:** "Buscar por nombre, correo o teléfono". Busca en todos los contactos, activos e inactivos, con la misma lógica de la lista de contactos (HU-205): texto parcial, sin distinguir mayúsculas ni tildes, y teléfono con o sin guion o código de país. Muestra hasta 10 resultados con el nombre, el correo y el teléfono.
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
| Mientras carga | "Cargando contactos…", "Cargando bitácora…" |
| Errores (en rojo) | "No se pudieron cargar los contactos. Intente de nuevo." (el mismo de HU-302), "No se pudo cargar la bitácora. Intente de nuevo." |
| Sin resultados (reutilizado de HU-302) | "No se encontraron contactos." |
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
| `contacts` ordenado por `nameSortKey` (la misma de la lista de contactos) | Una vez, al abrir la pestaña "Bitácora" | Un solo campo (automático) |
| `communications` con `contactId ==`, ordenado por `date` desc y `createdAt` desc, `limit(101)` | Al elegir un contacto | **Ya existe:** `contactId` + `date` desc + `createdAt` desc (el del historial de la ficha, HU-213) |
| `sales` con `contactId ==`, sin orden | Al elegir un contacto, en paralelo con la anterior | No necesita índice compuesto (la ficha usa la misma consulta) |
| `stageHistory` con `saleId in [hasta 30]`, ordenado por `changedAt` desc, `limit(101)`, un lote por cada 30 oportunidades | Después de leer las oportunidades | **Ya existe:** `saleId` + `changedAt` desc (el del detalle de la venta, HU-308) |

**No hace falta ningún índice nuevo** y no se cambió `firestore.indexes.json`. Una prueba de emulador comprueba que los dos índices compuestos siguen declarados.

Lecturas por contacto del seed (documentos leídos; una consulta vacía cuenta como 1 lectura). Abrir la pestaña lee además los 5 contactos una vez.

| Contacto | Comunicaciones | Oportunidades | Cambios de etapa | Lecturas | Eventos |
|---|---|---|---|---|---|
| Ana Prueba Mora (`contact-001`) | 2 | 1 | 3 | 6 | 5 |
| Bruno Ficticio Solís (`contact-002`) | 2 | 3 | 13 | 18 | 15 |
| Carla Demo Vargas (`contact-003`) | 1 | 1 | 3 | 5 | 4 |
| Diego Ejemplo Rojas (`contact-004`) | 0 | 0 | — (no se consulta) | 2 | 0 |
| Elena Muestra Castro (`contact-005`) | 1 | 1 | 1 | 3 | 2 |

Con el tope de 100, el máximo por contacto es de 101 comunicaciones, más las oportunidades, más 101 cambios de etapa por cada lote de 30 oportunidades.

## Capturas (datos del seed, usuario `admin`, Microsoft Edge)

Escritorio a 1366 × 768 y móvil a 390 × 844, contra los emuladores después de `npm run seed`. Los datos medidos en el navegador están en [verificacion.json](verificacion.json): encabezados y filas de la tabla, pestañas, resultados de cada búsqueda, texto de cada evento, ruta, ancho de la ventana y del documento, y si hay desborde. Los 13 pasos con su resultado están en [recorrido.json](recorrido.json).

| Captura | Qué se ve |
|---|---|
| [01](01-avisos-como-estaba.png) | "Avisos" al abrir: pestaña "Avisos pendientes" seleccionada y la tabla de siempre, con 5 avisos y el círculo en 5 |
| [02](02-pestana-bitacora.png) | Pestaña "Bitácora": introducción y buscador |
| [03](03-buscar-por-nombre.png) | "ANA prueba" encuentra a Ana Prueba Mora (sin distinguir mayúsculas) |
| [04](04-linea-de-tiempo-ana.png) | Línea de tiempo de Ana: comunicación del formulario web ("Origen: formulario web"), cambio a "Venta perdida" con su motivo y llamada "Origen: registro manual"; más abajo, el cambio a Contactado y la creación de la oportunidad |
| [05](05-buscar-por-telefono.png) | "0000-0002" encuentra a Bruno Ficticio Solís por su teléfono |
| [06](06-linea-de-tiempo-bruno.png) | Bruno: 15 eventos de sus tres oportunidades y dos comunicaciones (se ve el principio de la lista) |
| [07](07-filtro-comunicaciones.png) | Filtro "Comunicaciones": solo sus 2 comunicaciones |
| [08](08-filtro-cambios-de-etapa.png) | Filtro "Cambios de etapa": solo los 13 cambios, de sus tres oportunidades |
| [09](09-contacto-sin-eventos.png) | Diego Ejemplo Rojas: "Este contacto no tiene comunicaciones ni cambios de etapa registrados." |
| [10](10-movil-390-bitacora.png) | 390 px: bitácora de Ana sin desborde horizontal |
| [11](11-movil-390-buscador.png) | 390 px: buscador con resultados sin desborde |
| [12](12-movil-390-avisos-pendientes.png) | 390 px: la pestaña de avisos no desborda la página; la tabla se desplaza dentro de su recuadro, como antes |

**Detalle de los datos del seed:** la comunicación de formulario web de Ana (`comm-006`) es anterior a HU-502. Tiene medio "Otro: Formulario del sitio web" y hora 00:00, así que se ve "12/10/2026 12:00 a. m. · Otro: Formulario del sitio web". Las que crea el procesador del formulario tienen medio "Formulario web" y la hora real del envío; ese caso lo cubren las pruebas unitarias y de componente. La ficha del contacto muestra esa comunicación igual.

## Recorrido en el navegador

Contra emuladores con `npm run seed` y sesión como `admin`. El recorrido no modifica datos.

| # | Paso | Resultado |
|---|---|---|
| 1 | Abrir "Avisos" | ✅ Abre en "Avisos pendientes" con la tabla de siempre: columnas Tipo, Contacto, Oportunidad de venta, Etapa, Detalle y Fecha del aviso; 5 avisos y el círculo en 5 ([01](01-avisos-como-estaba.png)) |
| 2 | Abrir la pestaña "Bitácora" | ✅ Buscador "Buscar por nombre, correo o teléfono"; la URL es `/avisos?vista=bitacora` ([02](02-pestana-bitacora.png)) |
| 3 | Buscar "ANA prueba" | ✅ Un resultado: Ana Prueba Mora · ana.prueba@example.com · +506 0000-0001 ([03](03-buscar-por-nombre.png)) |
| 4 | Elegir a Ana | ✅ 5 eventos del más reciente al más antiguo; no aparece "Registrado por" ([04](04-linea-de-tiempo-ana.png)) |
| 5 | Buscar "0000-0002" | ✅ Un resultado: Bruno Ficticio Solís ([05](05-buscar-por-telefono.png)) |
| 6 | Elegir a Bruno | ✅ 15 eventos: 2 comunicaciones y 13 cambios de etapa, con 3 creaciones ([06](06-linea-de-tiempo-bruno.png)) |
| 7 | Filtro "Comunicaciones" | ✅ Solo 2 eventos, los dos comunicaciones; la URL lleva `&tipo=comunicaciones` ([07](07-filtro-comunicaciones.png)) |
| 8 | Filtro "Cambios de etapa" | ✅ Solo 13 eventos, todos cambios de etapa ([08](08-filtro-cambios-de-etapa.png)) |
| 9 | Buscar y elegir a Diego | ✅ Estado vacío con el mensaje de contacto sin eventos ([09](09-contacto-sin-eventos.png)) |
| 10 | En la bitácora de Ana, clic en una oportunidad y luego "atrás" | ✅ Abre `/posibles-ventas/sale-004`; "atrás" vuelve a `/avisos?vista=bitacora&contacto=contact-001` |
| 11 | 390 px, bitácora de Ana | ✅ Sin desborde horizontal: documento de 375 px en una ventana de 390 px ([10](10-movil-390-bitacora.png)) |
| 12 | 390 px, buscador con resultados | ✅ Sin desborde horizontal ([11](11-movil-390-buscador.png)) |
| 13 | 390 px, pestaña "Avisos pendientes" | ✅ La página no desborda; la tabla se desplaza dentro de su recuadro ([12](12-movil-390-avisos-pendientes.png)) |

## Pruebas

- `npm run typecheck`: sin errores.
- `npm test`: 1103/1103 (1071 anteriores + 32 nuevas). `tests/components/Alerts.test.tsx` y `tests/unit/alerts.test.ts` pasan **sin cambios**.
- `npm run test:emulators`: 313/313 (303 anteriores + 10 nuevas). `tests/sales/alerts.emulator.test.ts` pasa sin cambios.
- `npm run build:todo`: correcto. El JS y el CSS del sitio público tienen el mismo SHA-256 que los de `main` compilado en ese momento (`index-CSHMWcP8.js` e `index-DjGTDoei.css`).
- Recorrido en el navegador: 13/13 pasos correctos.

| Archivo | Pruebas | Qué prueba |
|---|---|---|
| `tests/unit/timeline.test.ts` (nuevo) | 18 | Orden combinado; comunicación del mismo día frente a un cambio de etapa (hora de registro); comunicación registrada días después (día indicado); hora exacta del formulario web; empates y que el resultado no depende del orden de entrada; la entrada inicial como creación; motivo de pérdida, también vacío ("Sin motivo registrado"); oportunidad desconocida ("—"); comunicación con oportunidad, para todas o sin ninguna; medio "Otro: …"; origen del formulario web con hora; que no aparece el usuario; tope y aviso de que hay más; sin datos; filtro; filtro leído de la URL. |
| `tests/components/AlertsTimeline.test.tsx` (nuevo) | 14 | Al abrir se ve "Avisos pendientes" y no se cargan contactos; cambiar de pestaña con clic y con flechas; URL; buscar por nombre sin tildes, por correo y por teléfono con guion; sin coincidencias; error al cargar contactos; elegir un contacto y ver su línea de tiempo en orden, sin "Registrado por"; enlaces al detalle y a la ficha; filtro con sus tres opciones y la URL; contacto sin eventos; filtro sin resultados; aviso de tope; error al cargar la bitácora. |
| `tests/sales/timeline.emulator.test.ts` (nuevo) | 10 | Con los datos del seed y las reglas del repo: contactos para el buscador, la línea de tiempo exacta de Ana (formulario web, pérdida con motivo, creación), Bruno con tres oportunidades, Carla, Elena, Diego sin eventos, un id que no existe, el tope, que sin sesión las reglas niegan la lectura, y que los dos índices compuestos que usan las consultas están en `firestore.indexes.json`. |

## Lo que no se probó

- **Las lecturas contra producción.** Los números de "Datos y lecturas" son los documentos que devuelve cada consulta. El emulador no exige índices; que los índices existentes sirven se comprueba porque están declarados y porque las consultas tienen la misma forma que las de la ficha (HU-213) y el detalle (HU-308), que ya funcionan en producción.
- **El tope de 100 con datos reales.** El seed no tiene contactos con más de 100 eventos. Se probó con un tope menor (3) contra el emulador y con datos simulados.
- **El caso de más de 30 oportunidades** (más de un lote de `stageHistory`) no está en el seed. Se usa la misma partición en lotes de 30 que los avisos.
