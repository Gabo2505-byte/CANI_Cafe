# Evidencia: arrastrar tarjetas en el tablero de Gestión de ventas

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-11-14 · **Rama:** `dylan-arrastrar-tarjetas` (commits `ea4371f`, `66f91da` y `c414bdc`, más el cierre descrito en "Ajustes de cierre")

## Decisión

El profesor pidió poder **mover las oportunidades de venta arrastrando sus tarjetas** por el tablero y que se vea a qué etapas se puede pasar y a cuáles no. Antes, la etapa solo se cambiaba con el botón "Cambiar etapa" del detalle. Ahora también se puede arrastrar la tarjeta a otra columna. El botón del detalle sigue igual.

Las reglas no cambian: el arrastre usa el mismo mapa de transiciones (`ALLOWED_STAGE_TRANSITIONS`, ver [CAMBIO-MAPA-TRANSICIONES](../CAMBIO-MAPA-TRANSICIONES/README.md)) y el mismo servicio de cambio de etapa (`changeSaleStage`, con `expectedStage` para detectar conflictos). Las confirmaciones de los requisitos se conservan:

| Al soltar en… | Qué pasa | Por qué |
|---|---|---|
| Una etapa abierta permitida | La etapa cambia de una vez y aparece la franja verde "Etapa actualizada correctamente." | HU-310 no pide confirmación |
| Una etapa abierta, desde "Venta perdida" | Se reabre de una vez: franja "Oportunidad de venta reabierta correctamente." | HU-312 no pide confirmación para reabrir. Si el contacto ya tiene otra abierta con el mismo título, aparece el mensaje de HU-312 y la tarjeta vuelve |
| "Venta ganada" (desde Precio o cotización enviada o En negociación) | Se abre la ventana "Cambiar etapa" con "Venta ganada" ya elegida y la pregunta de HU-313. Nada cambia hasta "Aceptar" | HU-313, criterios 1 y 5 |
| "Venta perdida" | Se abre la ventana con "Venta perdida" ya elegida, la pregunta y el motivo (opcional, hasta 250 caracteres) | HU-311, criterios 1 a 3 |
| Una etapa que el mapa no permite | No se acepta: la tarjeta vuelve a su columna y no cambia nada | Mapa de transiciones |
| Su misma columna | No hace nada | — |

Las tarjetas en "Venta ganada" no se pueden arrastrar: es definitiva y no tiene destinos (HU-313, criterio 4).

## Cómo funciona

- **La tarjeta sigue siendo un enlace al detalle.** Un clic normal lo abre. Con el ratón, el arrastre empieza solo después de mover el puntero 6 px con el botón sostenido. En pantallas táctiles empieza tras sostener el dedo 250 ms, para no estorbar el desplazamiento horizontal del tablero. Si el clic llega justo después de soltar (menos de 300 ms), no abre el detalle.
- **Mientras se arrastra**, una copia de la tarjeta sigue al puntero y la original queda tenue en su columna. Las columnas permitidas por el mapa llevan un borde dorado punteado. La que está bajo el puntero tiene un borde continuo y un fondo más claro. Las columnas no permitidas se atenúan y no aceptan la tarjeta.
- **Cambio directo:** la tarjeta pasa a la nueva columna en cuanto se suelta y se guarda en segundo plano. Mientras se guarda, esa tarjeta queda tenue y no se puede arrastrar otra vez. Si falla, vuelve a su columna y aparece el mensaje de error en rojo arriba del tablero ("No se pudo cambiar la etapa. Intente de nuevo." o el de HU-312). Si hubo un conflicto (otra pantalla ya le cambió la etapa), aparece "Esta oportunidad cambió de etapa mientras la movía. El tablero se actualizó; vuelva a intentarlo." y el tablero se vuelve a leer para mostrar la etapa real. Después de cada cambio se recalculan las campanas de aviso (HU-312, criterio 2: una venta reabierta vuelve a generar avisos).
- **Teclado:** con el foco en una tarjeta, la **barra espaciadora** la toma. Las **flechas izquierda y derecha** la mueven de columna en columna, y la **barra espaciadora o Enter** la sueltan. **Escape** cancela. **Enter** sin tomarla sigue abriendo el detalle. Al soltarla, el foco vuelve a la tarjeta en su nueva columna.
- **Lector de pantalla:** cada tarjeta arrastrable apunta (`aria-describedby`) a las instrucciones. Una región en vivo anuncia cada paso del arrastre (textos abajo).

## Qué cambió

| Archivo | Cambio |
|---|---|
| `package.json`, `package-lock.json` | Nueva dependencia `@dnd-kit/core` 6.3.1 (con sus dependencias `@dnd-kit/utilities` y `@dnd-kit/accessibility`). Pide `react >= 16.8`, así que es compatible con React 19.3. No se agregó ninguna otra librería |
| `src/sales/board.ts` | Funciones puras nuevas: `dropDecision(venta, etapa)` (devuelve `no_permitido`, `cambio_directo`, `ventana_ganada` o `ventana_perdida`), `canDragSale(venta)`, `dropZoneState(origen, columna)` (`origen`, `permitida` o `bloqueada`) y los anuncios `BOARD_DRAG_MESSAGES`. Todas usan `isValidStageChange` y `ALLOWED_STAGE_TRANSITIONS` |
| `src/sales/SalesBoardPage.tsx` | `DndContext` con sensores de ratón, táctil y teclado. Cada columna recibe tarjetas (`useDroppable`). La copia que sigue al puntero va en `DragOverlay`. Hace el cambio directo con `changeSaleStage`, abre `ChangeStageDialog` para ganada y perdida, y muestra la franja verde y los errores. La lectura del tablero se movió a `loadBoard()`, sin cambios, para volver a leerlo tras un conflicto |
| `src/sales/SaleCard.tsx` | La tarjeta es arrastrable (`useDraggable`) salvo si está ganada o guardándose. Sigue siendo el mismo enlace. El contenido se separó en `SaleCardContent` para la copia que sigue al puntero |
| `src/sales/ChangeStageDialog.tsx` | **Único cambio:** nueva prop opcional `initialStage` (la etapa ya elegida al abrir). Sin ella, la ventana se comporta igual que antes |
| `src/styles.css` | Estilos del arrastre: columnas permitidas, bajo el puntero y bloqueadas; tarjeta tenue, guardándose y su copia. Respeta `prefers-reduced-motion` |
| `tests/unit/publicBuild.test.ts` | El build del sitio público tampoco puede incluir `@dnd-kit` |
| `tests/components/NewSale.test.tsx` | Al volver al tablero ahora hay dos `role="status"` (la franja y la región en vivo del arrastre). La prueba busca la franja por su texto y comprueba que sigue siendo `role="status"` con la clase `notice-success` |

**No cambian:** el servicio de cambio de etapa (`salesRepository.ts`, `salesApi.ts`), el mapa de transiciones y el resto de `stageChange.ts`, `firestore.rules`, el detalle de la venta (`SaleDetailPage.tsx`, con su botón "Cambiar etapa"), contactos, comunicaciones y `formRequests`.

## Ajustes de cierre

### HU-312 al reabrir arrastrando: la regla ya se cumplía

La regla "si el contacto ya tiene otra oportunidad abierta con el mismo título, se muestra un mensaje y no se reabre" vive en el **servicio**, no en la ventana. Está en `changeSaleStageIn` (`src/sales/salesRepository.ts`): cuando la etapa de origen es "Venta perdida", antes de la transacción lee la venta, busca los títulos de las otras oportunidades abiertas del contacto (`listOpenSaleTitlesIn`) y, si hay uno igual (sin distinguir mayúsculas ni espacios, con `isDuplicateTitle`), lanza `SaleReopenDuplicateTitleError` sin escribir nada. `ChangeStageDialog` y el tablero solo convierten ese error en el mensaje de HU-312.

Como el arrastre llama al mismo servicio (`changeSaleStage(id, 'perdida', destino)`), **no se saltaba la regla** y no hizo falta cambiar el código. Se agregaron pruebas que lo demuestran: de componente con el ratón (con duplicado no cambia nada y sale el mensaje; sin duplicado reabre) y de emuladores con la misma llamada que hace el tablero para las cuatro etapas abiertas (con duplicado no escribe nada en la venta, el historial ni la otra oportunidad; sin duplicado reabre y agrega el registro). Además se comprobó en Edge (paso l). El botón "Cambiar etapa" no cambió.

### Mensaje de conflicto propio del tablero

Al soltar una tarjeta cuya etapa ya había cambiado en otra pantalla, el tablero mostraba el mensaje de la ventana, que dice "Cierre esta ventana y vuelva a intentarlo." aunque en el tablero no hay ventana. Ahora el tablero muestra su propio texto, `BOARD_MESSAGES.dropConflict` en `board.ts`:

> Esta oportunidad cambió de etapa mientras la movía. El tablero se actualizó; vuelva a intentarlo.

La ventana "Cambiar etapa" conserva su mensaje ("La etapa de esta oportunidad de venta cambió. Cierre esta ventana y vuelva a intentarlo."), también cuando se abre desde el tablero para ganar o perder. Archivos: `src/sales/board.ts` y `src/sales/SalesBoardPage.tsx` (una línea).

### Textos nuevos

**Visible (uno):** "Esta oportunidad cambió de etapa mientras la movía. El tablero se actualizó; vuelva a intentarlo." (en rojo arriba del tablero, solo al haber conflicto al soltar).

Los demás mensajes que aparecen en pantalla ya existían: "Etapa actualizada correctamente.", "Oportunidad de venta reabierta correctamente.", "Oportunidad de venta marcada como perdida.", "Venta ganada. [Nombre] ahora es cliente.", "Venta ganada correctamente.", "No se pudo cambiar la etapa. Intente de nuevo." y el de título repetido de HU-312.

**Solo para lector de pantalla** (`BOARD_DRAG_MESSAGES` en `board.ts`, no se ven):

| Momento | Texto |
|---|---|
| Instrucciones de cada tarjeta | Para mover esta oportunidad de venta a otra etapa, presione la barra espaciadora, use las flechas izquierda y derecha para cambiar de columna y presione la barra espaciadora o Enter para soltarla. Presione Escape para cancelar. Presione Enter sin arrastrar para abrir el detalle. |
| Al tomarla | Se tomó la oportunidad de venta "[título]" de la columna [etapa]. |
| Sobre su columna | Sobre su columna de origen, [etapa]. |
| Sobre una permitida | Sobre la columna [etapa]. Se puede soltar aquí. |
| Sobre una no permitida | Sobre la columna [etapa]. No se puede pasar a esta etapa. |
| Al soltar en una permitida | Se soltó la oportunidad de venta "[título]" en la columna [etapa]. |
| Al soltar donde no se puede | La oportunidad de venta "[título]" volvió a la columna [etapa]. |
| Al cancelar con Escape | Se canceló el movimiento. La oportunidad de venta "[título]" volvió a la columna [etapa]. |

## Criterios afectados

| HU | Criterio | Texto del documento | Cómo queda |
|---|---|---|---|
| HU-310 | 1 | En el detalle de una posible venta abierta está el botón "Cambiar etapa". Abre una ventana con las seis etapas y la etapa actual marcada. | Sin cambios en el detalle. **Además**, la etapa se puede cambiar arrastrando la tarjeta en el tablero |
| HU-310 | 3 | (…) La tarjeta pasa a la columna de la nueva etapa en el tablero. | Al arrastrar, la tarjeta pasa a la nueva columna en cuanto se suelta. El cambio queda en el historial igual que desde el detalle (mismo servicio) |
| HU-311 | 1 a 3 | Al elegir "Venta perdida" en la ventana "Cambiar etapa" (…) | Sin cambios: al soltar en "Venta perdida" se abre esa misma ventana con la etapa elegida, la pregunta y el motivo |
| HU-312 | 1 | Para reabrir una posible venta perdida, se usa el botón "Cambiar etapa" y se elige una de las cuatro etapas abiertas. (…) | **Además** se puede reabrir arrastrando la tarjeta a una de las cuatro columnas abiertas. "Venta ganada" sigue bloqueada |
| HU-312 | 2 y 4 | Mensaje de reapertura; título repetido | Los mismos mensajes. Al reabrir se recalculan las campanas. El título repetido se revisa en el servicio, así que también bloquea la reapertura por arrastre |
| HU-313 | 1, 2, 3 y 5 | Pregunta, conversión a cliente, mensajes y "Cancelar" | Sin cambios: al soltar en "Venta ganada" se abre la misma ventana con la etapa elegida |
| HU-313 | 4 | Una posible venta ganada ya no puede cambiar de etapa (…) | **Además**, su tarjeta no se puede arrastrar |
| HU-305 | — | Al dar clic en una tarjeta se abre su detalle | Sin cambios: el clic normal sigue abriendo el detalle |

## Capturas (datos del seed, usuario `admin`, Microsoft Edge)

Escritorio a 1280 × 800 y móvil a 390 × 844, contra los emuladores con datos limpios (`npm run seed`, 20 registros en `stageHistory`). El arrastre es real: el script mueve el ratón con el botón sostenido (`mouse.down`, varios `mouse.move` y `mouse.up`) o pulsa las teclas, igual que una persona. Las capturas "en pleno arrastre" se tomaron con el botón todavía sostenido. Lo que se midió en cada captura (zona y opacidad de cada columna, tarjetas por columna, franja, ventana, anuncio para lector de pantalla, desborde) está en [verificacion.json](verificacion.json). Los 14 pasos con su resultado están en [recorrido.json](recorrido.json) (a a k del recorrido principal; l y m de los ajustes de cierre).

| Captura | Paso | Qué se ve |
|---|---|---|
| [01](01-tablero-en-reposo.png) | a | Tablero en reposo: seis columnas, ninguna marcada |
| [02](02-arrastre-columnas-permitidas.png) | b | `sale-006` (Nuevo interesado) en pleno arrastre sobre Contactado. Contactado tiene borde continuo (bajo el puntero), Venta perdida tiene borde punteado (permitida) y Precio o cotización enviada, En negociación y Venta ganada están atenuadas (opacidad 0,4). La tarjeta original queda tenue en su columna |
| [03](03-soltar-en-contactado-franja.png) | c | Tras soltar: la tarjeta está en Contactado y aparece la franja "Etapa actualizada correctamente." |
| [04](04-sobre-columna-no-permitida.png) | d | La tarjeta encima de En negociación, que está atenuada y sin borde: no la acepta |
| [05](05-no-permitida-vuelve.png) | d | Tras soltar ahí: la tarjeta sigue en Contactado, sin franja y sin ventana |
| [06](06-teclado-sobre-cotizacion.png) | i | Con teclado (Espacio y flecha derecha): la tarjeta sobre Precio o cotización enviada, con borde continuo |
| [07](07-teclado-soltado-franja.png) | i | Tras Espacio: la tarjeta está en Precio o cotización enviada, con la franja verde y el foco de vuelta en la tarjeta |
| [08](08-ventana-venta-ganada.png) | e | Al soltar en Venta ganada se abre "Cambiar etapa" con "Venta ganada" elegida y la pregunta de HU-313 |
| [09](09-ganada-franja-cliente.png) | e | Tras "Aceptar": franja "Venta ganada. Elena Muestra Castro ahora es cliente." y la tarjeta en Venta ganada |
| [10](10-ficha-elena-cliente.png) | e | La ficha de Elena Muestra Castro dice "Cliente" |
| [11](11-ventana-venta-perdida.png) | f | Al soltar `sale-001` en Venta perdida: ventana con "Venta perdida" elegida, la pregunta y el motivo escrito |
| [12](12-perdida-franja.png) | f | Tras "Aceptar": franja "Oportunidad de venta marcada como perdida." y la tarjeta en Venta perdida |
| [13](13-arrastre-desde-perdida.png) | g | Arrastre desde Venta perdida: las cuatro columnas abiertas se pueden elegir; Venta ganada está atenuada |
| [14](14-reabierta-franja.png) | g | Tras soltar en Contactado: franja "Oportunidad de venta reabierta correctamente." y la tarjeta en Contactado, sin ventana |
| [15](15-ganada-no-se-arrastra.png) | h | Intento de arrastrar la tarjeta ganada con el botón sostenido: ninguna columna marcada y no hay copia que siga al puntero |
| [16](16-clic-abre-detalle.png) | j | Un clic normal en la tarjeta de `sale-002` abrió su detalle |
| [17](17-movil-390-inicio.png) | k | Móvil a 390 px: la página no se desborda; el tablero (1140 px) se desplaza dentro de su ancho (295 px) |
| [18](18-movil-390-desplazado.png) | k | El mismo tablero desplazado 600 px a la derecha |
| [19](19-duplicado-antes.png) | l | Antes: `sale-001` en Venta perdida y otra oportunidad abierta de Bruno Ficticio Solís con el mismo título en Contactado |
| [20](20-duplicado-mensaje.png) | l | Tras arrastrar `sale-001` a Contactado y soltar: mensaje de HU-312 en rojo; la tarjeta sigue en Venta perdida |
| [21](21-conflicto-arrastre-en-curso.png) | m | Ventana A: `sale-002` (Precio o cotización enviada) en pleno arrastre sobre Contactado, con el botón sostenido |
| [22](22-conflicto-otra-pestana.png) | m | Ventana B, mientras tanto: la misma venta pasa a En negociación con "Cambiar etapa" |
| [23](23-conflicto-mensaje-tablero.png) | m | Ventana A tras soltar: el mensaje de conflicto del tablero y la tarjeta en su etapa real (En negociación) |

**Detalles de las capturas:**

- En Edge headless, una captura tarda unos 5 s, lo mismo que dura la franja verde. Como en CAMBIO-MAPA-TRANSICIONES, solo en el navegador de prueba se anuló el temporizador de 5000 ms de la franja (`evaluateOnNewDocument`). El código de la aplicación no se modificó.
- Las ventas ganadas y perdidas del seed tienen más de 30 días, así que no aparecen en el tablero. Por eso el recorrido va en este orden: `sale-006` pasa por Contactado (c), Precio o cotización enviada (i) y Venta ganada (e), y `sale-001` se pierde (f) y se reabre (g). La tarjeta ganada de `sale-006` es la que se usa en el paso h.
- En el paso k, el desplazamiento se hizo con la rueda del ratón y Mayús sobre el tablero.
- Paso l: la otra oportunidad abierta del mismo contacto (`sale-e2e-duplicada`) se creó directo en el emulador, copiando `sale-001` con etapa Contactado. El formulario "Nueva oportunidad" también lo permitiría, porque `sale-001` ya estaba perdida. `sale-001` se había marcado como perdida arrastrándola a Venta perdida y aceptando la ventana.
- Paso m: la segunda pantalla se abrió como **otra ventana** del mismo navegador, con la misma sesión. Una pestaña en segundo plano no se dibuja en headless y no recibía los clics. Mientras A sostenía la tarjeta, B cambió la etapa. Después A soltó, con el arrastre todavía activo (`seguiaArrastrandoAlSoltar: true` en verificacion.json).
- Los pasos l y m se corrieron en otra sesión del emulador, también con datos limpios y `npm run seed`.

## Recorrido en el navegador

| # | Paso | Resultado |
|---|---|---|
| a | Tablero en reposo a 1280 px | ✅ Seis columnas sin marcas; la página no se desborda ([01](01-tablero-en-reposo.png)) |
| b | Arrastrar `sale-006` (Nuevo interesado) con el ratón y sostenerla sobre Contactado | ✅ Origen: Nuevo interesado. Permitidas: Contactado y Venta perdida. Bloqueadas (opacidad 0,4): las otras tres. Bajo el puntero: Contactado ([02](02-arrastre-columnas-permitidas.png)) |
| c | Soltar en Contactado | ✅ La tarjeta queda en Contactado, aparece la franja "Etapa actualizada correctamente." y en Firestore `stage = contactado` ([03](03-soltar-en-contactado-franja.png)) |
| d | Arrastrarla a En negociación (no permitida) y soltar | ✅ La columna estaba bloqueada y no se marcó. Al soltar no cambió nada (Firestore sigue en `contactado`, sin franja ni ventana) y se anunció "La oportunidad de venta "Primer contacto con Elena (mock)" volvió a la columna Contactado." ([04](04-sobre-columna-no-permitida.png), [05](05-no-permitida-vuelve.png)) |
| i | Teclado: foco en la tarjeta, Espacio, flecha derecha, Espacio | ✅ Sobre la columna se anunció "Sobre la columna Precio o cotización enviada. Se puede soltar aquí.". Al soltar, la tarjeta pasó a Precio o cotización enviada, apareció la franja verde, Firestore quedó en `cotizacion_enviada` y el foco volvió a la tarjeta ([06](06-teclado-sobre-cotizacion.png), [07](07-teclado-soltado-franja.png)) |
| e | Arrastrar `sale-006` (Precio o cotización enviada) a Venta ganada, aceptar | ✅ Se abrió la ventana con "Venta ganada" elegida y la pregunta. Al aceptar: franja "Venta ganada. Elena Muestra Castro ahora es cliente.", `contact-005` pasó de `persona_interesada` a `cliente` y la ficha dice "Cliente" ([08](08-ventana-venta-ganada.png) a [10](10-ficha-elena-cliente.png)) |
| f | Arrastrar `sale-001` (En negociación) a Venta perdida, escribir el motivo y aceptar | ✅ Ventana con "Venta perdida" elegida, la pregunta y el campo del motivo. Al aceptar: franja "Oportunidad de venta marcada como perdida." y en el historial "en_negociacion → perdida (motivo: Eligió otro proveedor (prueba))" ([11](11-ventana-venta-perdida.png), [12](12-perdida-franja.png)) |
| g | Arrastrar `sale-001` de Venta perdida a Contactado | ✅ Durante el arrastre, las cuatro abiertas estaban permitidas y Venta ganada bloqueada. Al soltar, la venta se reabrió sin ventana: franja "Oportunidad de venta reabierta correctamente." y en el historial "perdida → contactado" ([13](13-arrastre-desde-perdida.png), [14](14-reabierta-franja.png)) |
| h | Intentar arrastrar la tarjeta de `sale-006` (Venta ganada) | ✅ Con el botón sostenido y el puntero sobre otra columna, ninguna columna se marcó y no apareció la copia. Sigue ganada. La tarjeta no tiene la clase `is-draggable` ni `aria-describedby`, y su cursor es el de enlace (`pointer`) ([15](15-ganada-no-se-arrastra.png)) |
| j | Clic normal en la tarjeta de `sale-002` | ✅ Abrió `/posibles-ventas/sale-002` ("Distribución mensual de café molido (mock)") ([16](16-clic-abre-detalle.png)) |
| k | Tablero a 390 px | ✅ La página no se desborda en horizontal. El tablero mide 1140 px dentro de 295 px y su `scrollLeft` pasó de 0 a 600 ([17](17-movil-390-inicio.png), [18](18-movil-390-desplazado.png)) |

| l | HU-312 por arrastre: `sale-001` en Venta perdida, con otra abierta del mismo contacto y mismo título; arrastrarla a Contactado | ✅ Contactado aparecía como permitida (la regla del título no es del mapa). Al soltar salió "Este contacto ya tiene una oportunidad de venta abierta con este título. Cambie el título antes de reabrirla.". La venta siguió en `perdida` en Firestore, el historial quedó igual (5 registros), la tarjeta siguió en Venta perdida y no hubo franja ni ventana ([19](19-duplicado-antes.png), [20](20-duplicado-mensaje.png)) |
| m | Conflicto: arrastrar `sale-002` hacia Contactado; mientras tanto, en otra ventana, pasarla a En negociación; soltar | ✅ La otra ventana mostró "Etapa actualizada correctamente." (Firestore: `en_negociacion`). Al soltar en A apareció "Esta oportunidad cambió de etapa mientras la movía. El tablero se actualizó; vuelva a intentarlo.", sin franja verde. La venta no pasó a Contactado y el tablero, ya actualizado, la muestra en En negociación ([21](21-conflicto-arrastre-en-curso.png) a [23](23-conflicto-mensaje-tablero.png)) |

**Datos usados:** los cambios del recorrido solo existen en el emulador, que se apagó al terminar. Historial final del recorrido principal: `sale-006` Nuevo interesado → Contactado → Precio o cotización enviada → Venta ganada; `sale-001` En negociación → Venta perdida (con motivo) → Contactado.

## Pruebas automáticas

- `npm run typecheck`: sin errores.
- `npm test`: 1028/1028 (918 + 110 nuevas), cinco corridas seguidas en verde (ver la nota abajo).
- `npm run test:emulators`: 266/266 (258 + 8 nuevas de reabrir por arrastre; el servicio no cambió).
- `npm run build:todo`: sin errores. El JS del sitio público es **idéntico byte a byte** al de `main` (`index-CSHMWcP8.js`, SHA-256 `70af2280…9d12`): `diff -r` de `dist-publico/` sin diferencias.

| Archivo | Pruebas | Qué prueba |
|---|---|---|
| `tests/unit/boardDrag.test.ts` | 84 (nuevo) | Una tabla escrita a mano con las 36 combinaciones de origen y destino y lo que hace `dropDecision` en cada una. Que solo 16 son posibles y todas están en el mapa, que soltar en la misma columna no hace nada, que "Venta ganada" y "Venta perdida" nunca cambian directo, una etapa desconocida, `canDragSale` en las seis etapas, `dropZoneState` en las 36 combinaciones y los anuncios |
| `tests/components/SalesBoardDrag.test.tsx` | 25 (nuevo) | Clic y Enter abren el detalle; las instrucciones en español; con teclado: columnas resaltadas y atenuadas, cambio a una permitida (franja verde, nueva columna, conteo y foco), no permitida (no cambia nada), misma columna, Escape, "Venta ganada" y "Venta perdida" abren la ventana con la etapa elegida (y aceptar guarda; "Cancelar" no cambia nada), reabrir directo, perdida → ganada bloqueada, ganada no se arrastra. Errores: fallo genérico (la tarjeta vuelve), conflicto (texto propio del tablero y se vuelve a leer el tablero), conflicto dentro de la ventana (conserva el texto de la ventana), título repetido al reabrir, y que no se puede arrastrar otra vez mientras se guarda. Con ratón: menos de 6 px no arrastra, soltar en una permitida cambia la etapa y el clic que sigue no abre el detalle, soltar en una no permitida no cambia nada, soltar en "Venta perdida" abre la ventana, y reabrir con título repetido (no cambia nada y sale el mensaje) o sin él (reabre) |
| `tests/sales/changeStage.emulator.test.ts` | +8 | Contra el emulador, con la misma llamada que hace el tablero al reabrir (`perdida` → cada una de las cuatro abiertas, sin motivo): con otra abierta del mismo contacto y mismo título lanza el error de HU-312 y no escribe nada (venta, historial y la otra oportunidad intactos); sin duplicado, reabre y agrega el registro al historial |
| `tests/unit/publicBuild.test.ts` | +1 | El build del sitio público no incluye `@dnd-kit` |

**Qué no cubren las pruebas automáticas:** jsdom no calcula posiciones, así que las pruebas les dan a las columnas y a las tarjetas cajas simuladas (150 px de separación). Con eso se prueban de verdad los sensores de teclado y de ratón de dnd-kit, la detección de columna y toda la lógica. **No se prueban:** la posición real en pantalla (el CSS no se carga en jsdom), el desplazamiento automático del tablero al llegar al borde, el sensor táctil (pulsación de 250 ms) y si el navegador manda un clic al soltar. Por eso el recorrido se hace en Edge.

### Lo que no se pudo probar

- **Arrastre táctil real:** no se probó en ningún lado. En jsdom no hay sensor táctil simulado. En Edge headless el recorrido usó ratón y teclado, y a 390 px solo se comprobó el desplazamiento horizontal (con la rueda), no un dedo. Queda pendiente probar en un teléfono o tableta real que la pulsación de 250 ms toma la tarjeta y que deslizar sin sostener sigue desplazando el tablero.
- El desplazamiento automático del tablero cuando se arrastra una tarjeta hasta su borde.

**Nota sobre `npm test` (pruebas intermitentes):** en esta rama se corrió la suite completa 12 veces. Fallaron dos pruebas, nunca las dos en la misma corrida:

- `NewSale.test.tsx` (HU-301, flujo completo): falló 2 de las 4 corridas anteriores a su corrección y 0 de las 8 posteriores. La causa era la región en vivo del arrastre (`role="status"`, fija en dnd-kit), que aparece en el tablero junto a la franja verde. La prueba buscaba "el" `role="status"` y, según cuándo se montaba la región, encontraba dos. Se corrigió la prueba como se explica arriba.
- `NewContact.test.tsx` ("al guardar aparece la ficha…", HU-201): falló 1 de 12 (la cuarta corrida). Esa pantalla no tiene tablero ni dnd-kit. La causa probable es de tiempos en la propia prueba: espera la franja verde con `findByText` y enseguida busca el título de la ficha con `getByRole` (que no espera). La franja llega con la navegación, pero el título depende de que se resuelva la carga del contacto simulado (`getContact`). Con la suite completa en paralelo, a veces esa carga termina un instante después. No se corrigió porque es de Gabriel (`tests/components/NewContact.test.tsx`). La corrección sería esperar el título con `findByRole`.
- En el diagnóstico final, cinco corridas seguidas de `npm test` dieron 1028/1028 las cinco veces (entre 44 y 51 s cada una), sin ningún fallo.

## Tamaño del sistema interno

| JS de `dist/` | `main` | Esta rama | Diferencia |
|---|---|---|---|
| Sin comprimir | 1 034 624 B | 1 082 385 B | +47 761 B (+46,6 KiB, +4,6 %) |
| gzip | 304 082 B | 319 792 B | +15 710 B (+15,3 KiB, +5,2 %) |

La diferencia incluye la librería y el código nuevo del tablero. El CSS del sistema interno pasa de 40 371 B a 41 261 B (+890 B). El sitio público no cambia.
