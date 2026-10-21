# Evidencia: "Nueva oportunidad" y el término "oportunidad de venta"

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-20 · **Rama:** `dylan-oportunidades`

## Decisión

Por el feedback del mentor, el equipo decidió una segunda pasada sobre las etiquetas (la primera está en [CAMBIO-ETIQUETAS](../CAMBIO-ETIQUETAS/README.md)). Es un **cambio de requisitos**: estos textos prevalecen sobre los del documento de requisitos y se registrarán como cambio en la próxima entrega.

1. El botón y el título del formulario pasan de "Nuevo registro" a **"Nueva oportunidad"**. El botón se ve "+ Nueva oportunidad" (en el tablero y en la pestaña de la ficha) y su nombre accesible es exactamente "Nueva oportunidad" (el "+" es decorativo, `aria-hidden`).
2. En todo lo que ve el administrador, la entidad que se llamaba "posible venta" pasa a llamarse **"oportunidad de venta"** (género femenino, igual que antes: los artículos no cambian).

**No cambian:** las etapas; "Venta ganada. [Nombre] ahora es cliente." y "Venta ganada correctamente."; "Gestión de ventas"; "← Volver a gestión de ventas"; los nombres de código (`Sale`, `sales`, `salesRepository`…), las colecciones, las rutas y URL (`/posibles-ventas`…); los errores internos que no se muestran (los `throw new Error` de `salesRepository.ts`); la evidencia histórica de `docs/evidencia/`; ni lógica alguna.

## Textos (antes → después)

| Dónde | Antes | Después |
|---|---|---|
| Botón del tablero y de la pestaña de la ficha | "+ Nuevo registro" | "+ Nueva oportunidad" (nombre accesible "Nueva oportunidad") |
| Título de la pantalla del formulario | "Nuevo registro" | "Nueva oportunidad" |
| Ficha, pestaña | "Posibles ventas (n)" | "Oportunidades de venta (n)" |
| Ficha, pestaña sin datos | "Este contacto no tiene posibles ventas." | "Este contacto no tiene oportunidades de venta." |
| Ficha, tarjeta de comunicación | "Posible venta: …" | "Oportunidad de venta: …" |
| Ficha, tarjeta (sin venta en particular) y diálogo, opción | "Todas sus posibles ventas" | "Todas sus oportunidades de venta" |
| Diálogo Registrar comunicación, campo | "Posible venta" | "Oportunidad de venta" |
| Diálogo, ayuda bajo el campo | Elija "Todas sus posibles ventas" si la conversación no fue sobre una en particular. | Elija "Todas sus oportunidades de venta" si la conversación no fue sobre una en particular. |
| Diálogo, validación (venta vacía) | Seleccione la posible venta. | Seleccione la oportunidad de venta. |
| Diálogo, validación (venta ya cerrada) | La posible venta elegida ya no está abierta. Elija otra o "Todas sus posibles ventas". | La oportunidad de venta elegida ya no está abierta. Elija otra o "Todas sus oportunidades de venta". |
| Avisos, columna | "Posible venta" | "Oportunidad de venta" |
| Tablero, columna vacía | "Sin posibles ventas." | "Sin oportunidades de venta." |
| Tablero, cargando | "Cargando posibles ventas…" | "Cargando oportunidades de venta…" |
| Tablero, error de carga | "No se pudieron cargar las posibles ventas. Intente de nuevo." | "No se pudieron cargar las oportunidades de venta. Intente de nuevo." |
| Nueva oportunidad, éxito | "Posible venta registrada correctamente." | "Oportunidad de venta registrada correctamente." |
| Nueva oportunidad, error al guardar | "No se pudo registrar la posible venta. Intente de nuevo." | "No se pudo registrar la oportunidad de venta. Intente de nuevo." |
| Nueva oportunidad y edición, título repetido | "Este contacto ya tiene una posible venta abierta con este título." | "Este contacto ya tiene una oportunidad de venta abierta con este título." |
| Detalle, no encontrada | "No se encontró la posible venta." | "No se encontró la oportunidad de venta." |
| Detalle, error de carga | "No se pudo cargar la posible venta. Intente de nuevo." | "No se pudo cargar la oportunidad de venta. Intente de nuevo." |
| Cambiar etapa, reabrir | "Posible venta reabierta correctamente." | "Oportunidad de venta reabierta correctamente." |
| Cambiar etapa, reabrir con título repetido | "Este contacto ya tiene una posible venta abierta con este título. Cambie el título antes de reabrirla." | "Este contacto ya tiene una oportunidad de venta abierta con este título. Cambie el título antes de reabrirla." |
| Cambiar etapa, marcar perdida | "Posible venta marcada como perdida." | "Oportunidad de venta marcada como perdida." |
| Cambiar etapa, conflicto | "La etapa de esta posible venta cambió. Cierre esta ventana y vuelva a intentarlo." | "La etapa de esta oportunidad de venta cambió. Cierre esta ventana y vuelva a intentarlo." |

## Historias afectadas

Criterios cuyo texto literal cambia (el documento de requisitos dice "posible venta"; ahora la pantalla dice "oportunidad de venta"):

| HU | Criterio | Texto del documento | Cómo queda |
|---|---|---|---|
| HU-207 | 5 | Pestañas "Comunicaciones", "Posibles ventas" y "Productos de interés" | Pestaña "Oportunidades de venta" |
| HU-208 | 1 | La pestaña "Posibles ventas" muestra una tabla… | Pestaña "Oportunidades de venta" |
| HU-208 | 4 | "Este contacto no tiene posibles ventas." | "Este contacto no tiene oportunidades de venta." |
| HU-212 | 2, 4 y 5 | Opción "Todas sus posibles ventas" | Opción "Todas sus oportunidades de venta" (el campo se llama "Oportunidad de venta") |
| HU-213 | 2 | La posible venta de la que se habló (o "Todas sus posibles ventas") | "Oportunidad de venta: …" o "Todas sus oportunidades de venta" |
| HU-301 | 1 | Botón "Nueva posible venta" (ya cambiado a "+ Nuevo registro" en la primera pasada) | Botón "+ Nueva oportunidad", en "Gestión de ventas" y en la pestaña "Oportunidades de venta" |
| HU-301 | 4 | "Posible venta registrada correctamente." | "Oportunidad de venta registrada correctamente." |
| HU-303 | 2 | "Este contacto ya tiene una posible venta abierta con este título." | "Este contacto ya tiene una oportunidad de venta abierta con este título." |
| HU-305 | 5 | "Sin posibles ventas." | "Sin oportunidades de venta." |
| HU-308 | 3 | Registrada como "Todas sus posibles ventas" (fecha de la última comunicación) | "Todas sus oportunidades de venta" |
| HU-312 | 2 | "Posible venta reabierta correctamente." | "Oportunidad de venta reabierta correctamente." |
| HU-312 | 4 | "Este contacto ya tiene una posible venta abierta con este título. Cambie el título antes de reabrirla." | Igual con "oportunidad de venta" |
| HU-315 | 2 y 4 | Comunicaciones registradas como "Todas sus posibles ventas" | "Todas sus oportunidades de venta" (el aviso y su cálculo no cambian) |
| HU-316 | 2 | Columnas: tipo, contacto, posible venta, … | Columna "Oportunidad de venta" |

Historias con textos que el documento no trae literales y que cambian por el término: HU-301 (error al guardar), HU-305 (cargando y error de carga), HU-308 (error de carga y "no encontrada"), HU-310 (conflicto de etapa), HU-311 (marcar perdida), HU-212 (validaciones del diálogo). Quedan señalados para confirmar con Gabriel, igual que antes.

Historias que solo nombran la entidad en prosa, sin texto literal en pantalla (sin cambio de pantalla): HU-302, HU-304, HU-309, HU-313, HU-314. HU-103 no cambia en esta pasada (su criterio 2 ya se actualizó en la primera: "Gestión de ventas").

## Capturas (1366 × 768, Microsoft Edge, datos del seed)

| Captura | Qué se ve |
|---|---|
| [01](01-ficha-pestana-oportunidades.png) | Ficha: pestaña "Oportunidades de venta (3)" y botón "+ Nueva oportunidad" |
| [02](02-ficha-tarjetas-comunicacion.png) | Tarjetas de comunicación: "Oportunidad de venta: Todas sus oportunidades de venta" |
| [03](03-dialogo-registrar-comunicacion.png) | Diálogo Registrar comunicación: campo, opciones y ayuda |
| [04](04-tablero-columna-vacia.png) | Tablero con la columna "Contactado" vacía ("Sin oportunidades de venta.") y el botón |
| [05](05-avisos.png) | Avisos con la columna "Oportunidad de venta" |
| [06](06-formulario-nueva-oportunidad.png) | Pantalla del formulario "NUEVA OPORTUNIDAD" |
| [07](07-franja-exito.png) | Franja verde "Oportunidad de venta registrada correctamente." |
| [08](08-error-titulo-repetido.png) | Error en rojo bajo el título repetido |
| [09](09-detalle.png) | Detalle con el enlace "← Volver a gestión de ventas" |
| [10](10-mensaje-reabrir.png) | Franja verde "Oportunidad de venta reabierta correctamente." |
| [11](11-detalle-no-encontrada.png) | "No se encontró la oportunidad de venta." |

**Verificación en el navegador real:** está en [verificacion.json](verificacion.json).
- El botón se llama exactamente "Nueva oportunidad" en el tablero y en la ficha; su "+" tiene `aria-hidden="true"`.
- **Textos más largos:** a 1366 × 768 no hay desborde horizontal de la página y ningún elemento visible queda cortado en la pestaña de la ficha, las tarjetas de comunicación, la tabla de Avisos, el diálogo (campo, opciones y ayuda; la ayuda pasa a dos líneas sin cortarse), el tablero ni los formularios. La única coincidencia del detector es el texto oculto para lectores de pantalla del logo (`sr-only`), que es intencional. No hizo falta cambiar el CSS (solo se actualizó un comentario).

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/shared/constants/labels.ts` | `SALES_LABELS.newRecord` y `newRecordTitle` pasan a `newOpportunity` y `newOpportunityTitle` ("Nueva oportunidad") |
| `src/shared/ui/AddButtonLabel.tsx` | Solo el comentario (texto del botón) |
| `src/sales/SalesBoardPage.tsx` | Botón con la constante nueva; comentario |
| `src/sales/NewSalePage.tsx` | Título con la constante nueva; comentario |
| `src/sales/board.ts` | Textos del tablero |
| `src/sales/alerts.ts` | Columna "Oportunidad de venta" |
| `src/sales/saleDetail.ts` | Mensajes del detalle |
| `src/sales/saleForm.ts` | Mensajes de crear y editar |
| `src/sales/stageChange.ts` | Mensajes de cambiar etapa |
| `src/contacts/contactDetail.ts` (Gabriel) | Pestaña, mensaje sin datos y opción "Todas sus oportunidades de venta" |
| `src/contacts/ContactDetailPage.tsx` (Gabriel) | Línea "Oportunidad de venta: …" y comentario del botón |
| `src/communications/communicationForm.ts` (Gabriel) | Opción, validaciones y comentarios |
| `src/communications/RegisterCommunicationDialog.tsx` (Gabriel) | Campo "Oportunidad de venta" y su ayuda |
| `src/styles.css` | Solo un comentario |
| `tests/components/`: `Alerts`, `ChangeStage`, `ContactNewSaleButton`, `ContactSales`, `NewSale`, `SaleDataFields`, `SaleDetail`, `SaleEdit`, `SaleProductsField`, `SalesBoard`; de Gabriel: `CommunicationHistory`, `CommunicationSale`, `ContactDetail`, `RegisterCommunication` | Textos nuevos; dos casos nuevos del botón en la ficha (`ContactNewSaleButton`) |
| `tests/unit/`: `alerts`, `saleEdit`, `saleForm`, `saleStages`, `stageChange`; de Gabriel: `communicationForm`, `contactDetail` | Textos nuevos |
| `tests/sales/*.emulator.test.ts` (5) y de Gabriel `tests/communications/*.emulator.test.ts` (2) | Textos nuevos |
| `docs/evidencia/CAMBIO-OPORTUNIDAD/` (nuevo) | Esta evidencia |

Los archivos de Gabriel (`src/contacts`, `src/communications` y sus pruebas) solo cambian textos visibles; no hay cambios de lógica. Quedan marcados para su revisión.

La evidencia anterior (`docs/evidencia/HU-1xx` … `HU-3xx`, `CAMBIO-ETIQUETAS`, `DISENO`, `PRODUCTOS`) no se reescribe: registra lo que se verificó en su momento con los textos de entonces.

## Pruebas automatizadas

- `npm run typecheck`: sin errores.
- `npm test`: 549/549 (las pruebas mantienen los textos literales; se suman dos casos del botón en la ficha: nombre accesible exactamente "Nueva oportunidad" y "+" con `aria-hidden`).
- `npm run test:emulators`: 126/126.
