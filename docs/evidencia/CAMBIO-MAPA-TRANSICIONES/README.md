# Evidencia: mapa de transiciones entre etapas

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-11-14 · **Rama:** `dylan-mapa-transiciones`

## Decisión

El profesor pidió trazabilidad entre etapas: una oportunidad de venta no debe saltarse etapas. Antes se podía pasar de cualquier etapa abierta a cualquier otra, hacia adelante o hacia atrás. Ahora cada etapa tiene una **lista fija de destinos permitidos**:

- Las etapas abiertas avanzan a la siguiente, vuelven a la anterior o se marcan como perdidas.
- "Venta ganada" solo se alcanza desde "Precio o cotización enviada" o desde "En negociación".

Es un **cambio de requisitos** sobre el criterio 2 de HU-310 y se registrará como cambio en la próxima entrega. No cambia ningún texto de la interfaz.

## Mapa de transiciones

Una etapa nunca pasa a sí misma.

| Etapa de origen | Destinos permitidos |
|---|---|
| Nuevo interesado | Contactado, Venta perdida |
| Contactado | Precio o cotización enviada, Nuevo interesado, Venta perdida |
| Precio o cotización enviada | En negociación, Venta ganada, Contactado, Venta perdida |
| En negociación | Venta ganada, Precio o cotización enviada, Venta perdida |
| Venta ganada | Ninguno: es definitiva (HU-313, sin cambios) |
| Venta perdida | Nuevo interesado, Contactado, Precio o cotización enviada, En negociación: se reabre (HU-312, sin cambios) |

En total hay 16 cambios permitidos de las 36 combinaciones posibles. Entre etapas abiertas, o desde una etapa abierta hacia "Venta ganada", quedan prohibidos 8 saltos:

- Nuevo interesado → Precio o cotización enviada
- Nuevo interesado → En negociación
- Nuevo interesado → Venta ganada
- Contactado → En negociación
- Contactado → Venta ganada
- Precio o cotización enviada → Nuevo interesado
- En negociación → Nuevo interesado
- En negociación → Contactado

## Qué cambió

| Archivo | Cambio |
|---|---|
| `src/sales/stageChange.ts` | Nuevo `ALLOWED_STAGE_TRANSITIONS` (`Record<SaleStage, readonly SaleStage[]>`), que es el **único lugar** donde se declara el mapa. `isValidStageChange(from, to)` lo consulta. Nueva `invalidStageChangeMessage(from, to)`. Se actualizaron los comentarios que decían "a cualquier otra, hacia adelante o hacia atrás". |
| `src/sales/salesRepository.ts` | `changeSaleStageIn()` ya usaba `isValidStageChange`. Ahora su error dice el origen y el destino con sus nombres: `Cambio de etapa no permitido: de "Contactado" (contactado) a "Venta ganada" (ganada).` El error se lanza **antes de leer o escribir nada**: un salto prohibido se rechaza aunque la etapa guardada sea otra. |
| `src/sales/ChangeStageDialog.tsx` | Solo cambia el comentario. La ventana ya usaba `stageOptions()`, así que muestra las seis etapas, pero solo deja elegir los destinos del mapa; las demás aparecen deshabilitadas, como ya pasaba con "Venta ganada" desde una perdida. |
| `src/sales/index.ts` | Exporta `ALLOWED_STAGE_TRANSITIONS`. |
| `scripts/seed/seedData.ts` | El historial de tres ventas tenía saltos que ahora no se permiten. Se agregaron los pasos intermedios, con la misma etapa final y la misma `stageChangedAt` (ver abajo). |

**No cambian:** `canChangeStage`, `firestore.rules`, el tablero (`board.ts`, `SalesBoardPage`, `SaleCard`), la creación de oportunidades (se sigue pudiendo crear en cualquiera de las cuatro etapas abiertas), `contacts`, `communications` y `formRequests`. El error del servicio no se muestra en pantalla: la ventana sigue mostrando "No se pudo cambiar la etapa. Intente de nuevo." si llegara a ocurrir, pero desde la ventana no se puede pedir un salto prohibido.

### Seed: historial corregido

| Venta | Etapa final | Antes | Ahora |
|---|---|---|---|
| `sale-002` | Precio o cotización enviada | Nuevo interesado → Precio o cotización enviada | Nuevo interesado → Contactado (24/09/2026) → Precio o cotización enviada |
| `sale-003` | Venta ganada | Nuevo interesado → En negociación → Venta ganada | Nuevo interesado → Contactado (26/09/2026) → Precio o cotización enviada (27/09/2026) → En negociación → Venta ganada |
| `sale-005` | Venta ganada | Nuevo interesado → Venta ganada | Nuevo interesado → Contactado (05/08/2026) → Precio o cotización enviada (12/08/2026) → Venta ganada |

`stageHistory` pasa de 15 a 20 registros. Los ids siguen el formato `${saleId}_${número de cambio}`. Algunos registros existentes cambiaron de número (por ejemplo, el paso a "Venta ganada" de `sale-003` pasó de `sale-003_03` a `sale-003_05`). Las fechas de los pasos que ya existían no cambiaron.

## Criterios afectados

| HU | Criterio | Texto del documento | Cómo queda |
|---|---|---|---|
| HU-310 | 2 | Desde una etapa abierta se puede pasar a cualquier otra etapa, hacia adelante o hacia atrás. | Desde una etapa abierta solo se puede pasar a los destinos del mapa: la etapa siguiente, la anterior y "Venta perdida". "Venta ganada" solo se alcanza desde "Precio o cotización enviada" o "En negociación". |
| HU-311 | — | Sin cambios | "Venta perdida" se sigue alcanzando desde las cuatro etapas abiertas. |
| HU-312 | — | Sin cambios | Una perdida se sigue reabriendo a cualquiera de las cuatro abiertas, nunca directo a "Venta ganada". |
| HU-313 | — | Sin cambios en el criterio | "Venta ganada" sigue siendo definitiva y sigue convirtiendo a la "Persona interesada" en "Cliente". Lo único distinto es desde dónde se llega a ella (HU-310). |

## Capturas (datos del seed, usuario `admin`, Microsoft Edge)

Escritorio a 1280 × 800, contra los emuladores con `npm run seed`. Las medidas tomadas en el navegador (opciones de cada ventana con su estado, destinos habilitados, etapa, franjas y filas de historial) están en [verificacion.json](verificacion.json). Los 19 pasos con su resultado están en [recorrido.json](recorrido.json). En ninguna pantalla hay desborde horizontal.

| Captura | Qué se ve |
|---|---|
| [01](01-dialogo-nuevo-interesado.png) | Ventana "Cambiar etapa" de `sale-006` (Nuevo interesado): solo se pueden elegir Contactado y Venta perdida |
| [02](02-dialogo-cotizacion-enviada.png) | `sale-002` (Precio o cotización enviada): se pueden elegir Contactado, En negociación, Venta ganada y Venta perdida; Nuevo interesado queda deshabilitado |
| [03](03-dialogo-en-negociacion.png) | `sale-001` (En negociación): se pueden elegir Precio o cotización enviada, Venta ganada y Venta perdida; Nuevo interesado y Contactado quedan deshabilitados |
| [04](04-dialogo-venta-perdida.png) | `sale-004` (Venta perdida): se pueden elegir las cuatro etapas abiertas; Venta ganada queda deshabilitada |
| [05](05-detalle-venta-ganada-sin-boton.png) | `sale-003` (Venta ganada): el encabezado solo tiene "Editar"; no hay "Cambiar etapa" |
| [06](06-historial-sale-005.png) | Historial de `sale-005` con los pasos que se agregaron al seed: Nuevo interesado → Contactado (05/08/2026) → Precio o cotización enviada (12/08/2026) → Venta ganada (20/08/2026) |
| [07](07-historial-sale-003.png) | Historial de `sale-003`: cinco registros, con Contactado (26/09/2026) y Precio o cotización enviada (27/09/2026) agregados |
| [08](08-dialogo-contactado-ganada-deshabilitada.png) | Recorrido 1: `sale-006` en Contactado; En negociación y Venta ganada aparecen apagadas |
| [09](09-dialogo-cotizacion-ganada-habilitada.png) | Recorrido 1: la misma venta en Precio o cotización enviada; ahora Venta ganada se puede elegir |
| [10](10-confirmacion-venta-ganada.png) | Recorrido 1: al elegir Venta ganada aparece la pregunta de confirmación |
| [11](11-detalle-ganada-contacto-cliente.png) | Recorrido 1: franja "Venta ganada. Elena Muestra Castro ahora es cliente.", etapa Venta ganada y sin "Cambiar etapa" |
| [12](12-ficha-contacto-cliente.png) | Recorrido 1: la ficha de Elena Muestra Castro ahora muestra "Cliente" |
| [13](13-historial-sale-006-tras-el-recorrido.png) | Recorrido 1: historial de `sale-006` con los tres cambios hechos |
| [14](14-confirmacion-venta-perdida.png) | Recorrido 2: `sale-001` (En negociación) → Venta perdida, con la pregunta y el motivo |
| [15](15-detalle-venta-perdida.png) | Recorrido 2: `sale-001` en Venta perdida; "Cambiar etapa" sigue disponible para reabrirla |
| [16](16-detalle-venta-reabierta.png) | Recorrido 2: `sale-001` reabierta en Contactado, con la pérdida y su motivo en el historial |

**Dos detalles de las capturas:**

- En Edge headless, `captureScreenshot` tarda unos 5 s, lo mismo que dura la franja verde, así que se apagaba antes de la captura. Solo en el navegador de prueba se anuló el temporizador de 5000 ms de la franja mientras duró el recorrido; el código de la aplicación no se modificó. Por eso la captura [09](09-dialogo-cotizacion-ganada-habilitada.png) muestra al fondo la franja del paso anterior ("Etapa actualizada correctamente."), que en uso real ya habría desaparecido.
- En las capturas [06](06-historial-sale-005.png), [07](07-historial-sale-003.png) y [13](13-historial-sale-006-tras-el-recorrido.png) la pantalla está desplazada hasta "Historial de etapas".

## Recorrido en el navegador

Contra emuladores con datos limpios: se borraron Firestore y Auth, se corrió `npm run seed` (20 registros en `stageHistory`) y se abrió una sesión nueva como `admin`. El seed no tiene ninguna venta en Contactado, así que `sale-006` (Nuevo interesado, contacto Elena Muestra Castro, "Persona interesada") se llevó a Contactado desde la ventana.

| # | Paso | Resultado |
|---|---|---|
| 1 | `sale-006`: Nuevo interesado → Contactado | ✅ Franja "Etapa actualizada correctamente." y el detalle muestra Contactado |
| 2 | En Contactado, abrir "Cambiar etapa" | ✅ "En negociación" y "Venta ganada" están deshabilitadas; los destinos habilitados son Nuevo interesado, Precio o cotización enviada y Venta perdida ([08](08-dialogo-contactado-ganada-deshabilitada.png)). Hacer clic en "Venta ganada" no cambia la selección (sigue Contactado) |
| 3 | Pasar a Precio o cotización enviada | ✅ Franja "Etapa actualizada correctamente." y el detalle muestra la nueva etapa |
| 4 | Abrir "Cambiar etapa" otra vez | ✅ "Venta ganada" ya se puede elegir ([09](09-dialogo-cotizacion-ganada-habilitada.png)) |
| 5 | Elegir "Venta ganada" | ✅ Aparece "¿Confirma que esta venta fue ganada? El contacto pasará a ser cliente y la venta ya no podrá cambiar de etapa." ([10](10-confirmacion-venta-ganada.png)) |
| 6 | Aceptar | ✅ Franja "Venta ganada. Elena Muestra Castro ahora es cliente.", etapa Venta ganada y el encabezado solo tiene "Editar" (sin "Cambiar etapa"; [11](11-detalle-ganada-contacto-cliente.png)) |
| 7 | Ficha de Elena Muestra Castro | ✅ Pasó de "Persona interesada" a "Cliente" ([12](12-ficha-contacto-cliente.png)) |
| 8 | `sale-001`: En negociación → Venta perdida, con motivo | ✅ Pregunta "¿Está seguro de que desea marcar esta venta como perdida?" ([14](14-confirmacion-venta-perdida.png)). Franja "Oportunidad de venta marcada como perdida.". La venta queda en Venta perdida y conserva el botón "Cambiar etapa" ([15](15-detalle-venta-perdida.png)) |
| 9 | Reabrir `sale-001` pasándola a Contactado | ✅ Desde Venta perdida, "Venta ganada" estaba deshabilitada. Franja "Oportunidad de venta reabierta correctamente." y la venta queda en Contactado ([16](16-detalle-venta-reabierta.png)) |
| 10 | Historial de `sale-001` | ✅ Seis registros; arriba "Venta perdida → Contactado" y "En negociación → Venta perdida" con su motivo |

Además, en las ventanas de las cuatro etapas del seed (capturas 01 a 04) los destinos habilitados coinciden exactamente con el mapa, y en `sale-003` (Venta ganada) no aparece el botón.

**Datos usados:** los cambios del recorrido solo existen en el emulador, que se apagó al terminar. No se tocó ningún archivo del seed ni código de la aplicación.

## Pruebas

- Recorrido manual en el navegador: 19 comprobaciones, todas con resultado correcto (ver "Recorrido en el navegador", [recorrido.json](recorrido.json) y [verificacion.json](verificacion.json)).
- `npm run typecheck`: sin errores.
- `npm test`: 918/918 (869 anteriores + 49 nuevas).
- `npm run test:emulators`: 258/258 (246 anteriores + 12 nuevas).

| Archivo | Antes | Ahora | Qué prueba |
|---|---|---|---|
| `tests/unit/stageChange.test.ts` | 25 | 67 | Una tabla con las 36 combinaciones de origen y destino, cada una con su resultado. Además: que la tabla no repite ni omite ninguna combinación, que el mapa declarado coincide exactamente con ella, que ninguna etapa pasa a sí misma, desde dónde se llega a "Venta ganada" y a "Venta perdida", que una etapa desconocida no es válida, el texto del error y que las opciones de la ventana coinciden con el mapa en las seis etapas. |
| `tests/components/ChangeStage.test.tsx` | 27 | 34 | Para cada una de las cinco etapas que se pueden cambiar, la ventana deja elegir exactamente los destinos del mapa. Hacer clic en una etapa no permitida no la elige. Las pruebas de HU-310, HU-311 y HU-313 usan ahora transiciones válidas. El caso de HU-313 hace el recorrido completo: desde "Contactado" la opción "Venta ganada" está deshabilitada, se pasa a "Precio o cotización enviada" y desde ahí se gana. |
| `tests/sales/changeStage.emulator.test.ts` | 31 | 43 | Los cambios contra el emulador usan recorridos válidos (para ganar desde "Contactado" se pasa antes por "Precio o cotización enviada"). Las pruebas de conflicto usan transiciones válidas, así que fallan por conflicto y no por "no permitido". Casos nuevos: los 8 saltos prohibidos lanzan "no permitido", no son un conflicto y no escriben nada en la venta, el historial ni el contacto. También: el texto del error, que el salto prohibido se revisa antes que el conflicto, y que desde "Contactado" no se gana directo. |
| `tests/seed/seed.idempotent.test.ts` | 4 | 4 | Ahora cuenta 20 registros de `stageHistory` en vez de 15 y comprueba que cada cambio del historial del seed respeta el mapa. |
