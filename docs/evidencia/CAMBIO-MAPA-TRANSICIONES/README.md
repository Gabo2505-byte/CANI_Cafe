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

## Pruebas

- `npm run typecheck`: sin errores.
- `npm test`: 918/918 (869 anteriores + 49 nuevas).
- `npm run test:emulators`: 258/258 (246 anteriores + 12 nuevas).

| Archivo | Antes | Ahora | Qué prueba |
|---|---|---|---|
| `tests/unit/stageChange.test.ts` | 25 | 67 | Una tabla con las 36 combinaciones de origen y destino, cada una con su resultado. Además: que la tabla no repite ni omite ninguna combinación, que el mapa declarado coincide exactamente con ella, que ninguna etapa pasa a sí misma, desde dónde se llega a "Venta ganada" y a "Venta perdida", que una etapa desconocida no es válida, el texto del error y que las opciones de la ventana coinciden con el mapa en las seis etapas. |
| `tests/components/ChangeStage.test.tsx` | 27 | 34 | Para cada una de las cinco etapas que se pueden cambiar, la ventana deja elegir exactamente los destinos del mapa. Hacer clic en una etapa no permitida no la elige. Las pruebas de HU-310, HU-311 y HU-313 usan ahora transiciones válidas. El caso de HU-313 hace el recorrido completo: desde "Contactado" la opción "Venta ganada" está deshabilitada, se pasa a "Precio o cotización enviada" y desde ahí se gana. |
| `tests/sales/changeStage.emulator.test.ts` | 31 | 43 | Los cambios contra el emulador usan recorridos válidos (para ganar desde "Contactado" se pasa antes por "Precio o cotización enviada"). Las pruebas de conflicto usan transiciones válidas, así que fallan por conflicto y no por "no permitido". Casos nuevos: los 8 saltos prohibidos lanzan "no permitido", no son un conflicto y no escriben nada en la venta, el historial ni el contacto. También: el texto del error, que el salto prohibido se revisa antes que el conflicto, y que desde "Contactado" no se gana directo. |
| `tests/seed/seed.idempotent.test.ts` | 4 | 4 | Ahora cuenta 20 registros de `stageHistory` en vez de 15 y comprueba que cada cambio del historial del seed respeta el mapa. |
