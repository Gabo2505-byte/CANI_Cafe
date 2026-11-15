# Evidencia: arrastrar tarjetas en el tablero de Gestión de ventas

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-11-14 · **Rama:** `dylan-arrastrar-tarjetas`

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
- **Cambio directo:** la tarjeta pasa a la nueva columna en cuanto se suelta y se guarda en segundo plano. Mientras se guarda, esa tarjeta queda tenue y no se puede arrastrar otra vez. Si falla, vuelve a su columna y aparece el mensaje de error en rojo arriba del tablero ("No se pudo cambiar la etapa. Intente de nuevo." o el de HU-312). Si hubo un conflicto (otra pantalla ya le cambió la etapa), aparece el mensaje de conflicto y el tablero se vuelve a leer para mostrar la etapa real. Después de cada cambio se recalculan las campanas de aviso (HU-312, criterio 2: una venta reabierta vuelve a generar avisos).
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

### Textos nuevos

**Visibles:** ninguno. Los mensajes que aparecen en pantalla ya existían: "Etapa actualizada correctamente.", "Oportunidad de venta reabierta correctamente.", "Oportunidad de venta marcada como perdida.", "Venta ganada. [Nombre] ahora es cliente.", "Venta ganada correctamente.", "No se pudo cambiar la etapa. Intente de nuevo.", el de conflicto y el de título repetido de HU-312.

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

**Para revisar:** si hay un conflicto al soltar en el tablero, se muestra el mensaje que ya existía, "La etapa de esta oportunidad de venta cambió. Cierre esta ventana y vuelva a intentarlo.". En el tablero no hay ninguna ventana que cerrar. Si se quiere un texto propio para el tablero, hay que definirlo.

## Criterios afectados

| HU | Criterio | Texto del documento | Cómo queda |
|---|---|---|---|
| HU-310 | 1 | En el detalle de una posible venta abierta está el botón "Cambiar etapa". Abre una ventana con las seis etapas y la etapa actual marcada. | Sin cambios en el detalle. **Además**, la etapa se puede cambiar arrastrando la tarjeta en el tablero |
| HU-310 | 3 | (…) La tarjeta pasa a la columna de la nueva etapa en el tablero. | Al arrastrar, la tarjeta pasa a la nueva columna en cuanto se suelta. El cambio queda en el historial igual que desde el detalle (mismo servicio) |
| HU-311 | 1 a 3 | Al elegir "Venta perdida" en la ventana "Cambiar etapa" (…) | Sin cambios: al soltar en "Venta perdida" se abre esa misma ventana con la etapa elegida, la pregunta y el motivo |
| HU-312 | 1 | Para reabrir una posible venta perdida, se usa el botón "Cambiar etapa" y se elige una de las cuatro etapas abiertas. (…) | **Además** se puede reabrir arrastrando la tarjeta a una de las cuatro columnas abiertas. "Venta ganada" sigue bloqueada |
| HU-312 | 2 y 4 | Mensaje de reapertura; título repetido | Los mismos mensajes. Al reabrir se recalculan las campanas |
| HU-313 | 1, 2, 3 y 5 | Pregunta, conversión a cliente, mensajes y "Cancelar" | Sin cambios: al soltar en "Venta ganada" se abre la misma ventana con la etapa elegida |
| HU-313 | 4 | Una posible venta ganada ya no puede cambiar de etapa (…) | **Además**, su tarjeta no se puede arrastrar |
| HU-305 | — | Al dar clic en una tarjeta se abre su detalle | Sin cambios: el clic normal sigue abriendo el detalle |

## Pruebas automáticas

- `npm run typecheck`: sin errores.
- `npm test`: 1025/1025 (918 + 107 nuevas; ver la nota sobre la primera corrida abajo).
- `npm run test:emulators`: 258/258 (sin pruebas nuevas: el servicio no cambió).
- `npm run build:todo`: sin errores. El JS del sitio público es **idéntico byte a byte** al de `main` (`index-CSHMWcP8.js`, SHA-256 `70af2280…9d12`): `diff -r` de `dist-publico/` sin diferencias.

| Archivo | Pruebas | Qué prueba |
|---|---|---|
| `tests/unit/boardDrag.test.ts` | 84 (nuevo) | Una tabla escrita a mano con las 36 combinaciones de origen y destino y lo que hace `dropDecision` en cada una. Que solo 16 son posibles y todas están en el mapa, que soltar en la misma columna no hace nada, que "Venta ganada" y "Venta perdida" nunca cambian directo, una etapa desconocida, `canDragSale` en las seis etapas, `dropZoneState` en las 36 combinaciones y los anuncios |
| `tests/components/SalesBoardDrag.test.tsx` | 22 (nuevo) | Clic y Enter abren el detalle; las instrucciones en español; con teclado: columnas resaltadas y atenuadas, cambio a una permitida (franja verde, nueva columna, conteo y foco), no permitida (no cambia nada), misma columna, Escape, "Venta ganada" y "Venta perdida" abren la ventana con la etapa elegida (y aceptar guarda; "Cancelar" no cambia nada), reabrir directo, perdida → ganada bloqueada, ganada no se arrastra. Errores: fallo genérico (la tarjeta vuelve), conflicto (mensaje y se vuelve a leer el tablero), título repetido al reabrir, y que no se puede arrastrar otra vez mientras se guarda. Con ratón: menos de 6 px no arrastra, soltar en una permitida cambia la etapa y el clic que sigue no abre el detalle, soltar en una no permitida no cambia nada y soltar en "Venta perdida" abre la ventana |
| `tests/unit/publicBuild.test.ts` | +1 | El build del sitio público no incluye `@dnd-kit` |

**Qué no cubren las pruebas automáticas:** jsdom no calcula posiciones, así que las pruebas les dan a las columnas y a las tarjetas cajas simuladas (150 px de separación). Con eso se prueban de verdad los sensores de teclado y de ratón de dnd-kit, la detección de columna y toda la lógica. **No se prueban:** la posición real en pantalla (el CSS no se carga en jsdom), el desplazamiento automático del tablero al llegar al borde, el sensor táctil (pulsación de 250 ms) y si el navegador manda un clic al soltar. Por eso el recorrido se hace en Edge.

**Nota sobre `npm test`:** en las primeras corridas completas fallaron dos pruebas, una vez cada una:

- `NewSale.test.tsx` (flujo completo): la causa era la región en vivo del arrastre (`role="status"`). Se corrigió la prueba como se explica arriba.
- `NewContact.test.tsx` ("al guardar aparece la ficha…"): esa pantalla no tiene tablero. La prueba sola pasa 3 de 3 veces, tanto en esta rama como en `main`. Después pasaron tres corridas completas seguidas, 1025/1025. Es un problema de tiempos con la suite completa y no viene de este cambio.

## Tamaño del sistema interno

| JS de `dist/` | `main` | Esta rama | Diferencia |
|---|---|---|---|
| Sin comprimir | 1 034 624 B | 1 082 265 B | +47 641 B (+46,5 KiB, +4,6 %) |
| gzip | 304 082 B | 319 738 B | +15 656 B (+15,3 KiB, +5,1 %) |

La diferencia incluye la librería y el código nuevo del tablero. El CSS del sistema interno pasa de 40 371 B a 41 261 B (+890 B). El sitio público no cambia.
