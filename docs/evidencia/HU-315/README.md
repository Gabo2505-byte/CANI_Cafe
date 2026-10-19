# Evidencia HU-315: Aviso por falta de comunicación

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-19

> Como administrador quiero recibir un aviso cuando una posible venta lleve más de 10 días sin comunicaciones
> para que retome el contacto antes de perder la oportunidad.

## Datos de prueba

- Ambiente: Firebase Emulator Suite, proyecto `demo-cani-crm`, datos de `npm run seed`, usuario `admin`.
- Recorrido automático en Microsoft Edge (headless, 1366 × 768). Detalle en [recorrido.json](recorrido.json).
- Los avisos no se guardan: se calculan al abrir "Avisos" y el tablero. Para variar los casos, el recorrido cambió por REST la fecha de creación o de la última comunicación (días contados hacia atrás desde hoy) y volvió a abrir la pantalla.
- Con el seed (hoy 19/10/2026): `sale-001` (última comunicación 02/10) y `sale-002` (03/10) llevan más de 10 días sin comunicaciones; `sale-006` se creó el 10/10 y no tiene comunicaciones (9 días: aún no avisa).
- Las comunicaciones registradas desde la ficha del contacto (HU-211/HU-212, de Gabriel) actualizan `sales.lastCommunicationAt`; los casos con comunicaciones reales (sobre una venta y como "Todas sus posibles ventas") se prueban con `createCommunicationIn` contra el emulador.

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | Si una posible venta abierta pasa más de 10 días sin comunicaciones, aparece el aviso "[Contacto] – [título] no tiene comunicaciones desde hace [número] días.". | ✅ Cumple | [01](01-avisos-sin-comunicacion.png): "Bruno Ficticio Solís – Café en grano para cafetería (mock) no tiene comunicaciones desde hace 17 días." y "Carla Demo Vargas – … desde hace 16 días.". Con exactamente 10 días no avisa; con 11 sí. |
| 2 | Cuentan las comunicaciones sobre esa posible venta y las registradas como "Todas sus posibles ventas". Ejemplo: si la última fue el 01/10/2026, el aviso aparece el 12/10/2026. | ✅ Cumple | El ejemplo está en las pruebas: el 11/10 a las 23:59:59 no hay aviso y el 12/10 a las 00:00 sí. En el recorrido: última comunicación hace 10 días, sin aviso; hace 11 días, aviso. La última comunicación sale de `lastCommunicationAt`, que Gabriel mantiene en HU-212 también para "Todas" (prueba de emulador con `createCommunicationIn`). |
| 3 | Si la posible venta nunca ha tenido comunicaciones, los días se cuentan desde que se creó. El número de días del aviso se actualiza todos los días. | ✅ Cumple | [03](03-nunca-con-comunicaciones.png): `sale-006` creada hace 10 días no avisa; hace 11 días avisa "… desde hace 11 días." y hace 14 días dice "… desde hace 14 días.". Los días son calendario de Costa Rica. |
| 4 | El aviso desaparece al registrar una comunicación sobre esa posible venta o registrada como "Todas sus posibles ventas". | ✅ Cumple | [04](04-aviso-desaparece-al-registrar-comunicacion.png): con una comunicación de hoy en `sale-001` desaparece su aviso de falta de comunicación y siguen los demás. Prueba de emulador: sobre una venta quita solo el de esa venta; como "Todas" quita el de todas las abiertas del contacto. |
| 5 | Cada posible venta se revisa por separado. Solo generan este aviso las posibles ventas abiertas de contactos activos. | ✅ Cumple | Dos ventas del mismo contacto se evalúan cada una con su propia última comunicación. Una venta ganada o perdida y un contacto inactivo no generan aviso (recorrido, prueba de emulador y prueba unitaria con las seis etapas). |

## También comprobado

- **Campana del tablero (HU-305):** las tarjetas con algún aviso (seguimiento o falta de comunicación) muestran la campana ([02](02-tablero-con-campana.png)); `sale-006` sin aviso no. Una venta con los dos avisos muestra una sola campana. Si los avisos no se pueden calcular, el tablero se muestra igual, sin campanas.
- Una misma venta puede tener a la vez el aviso de seguimiento (HU-314) y el de falta de comunicación; el de falta de comunicación no se quita con el seguimiento ni al revés.

## Decisiones y puntos por confirmar

- **"Más de 10 días" = desde el día 11,** en días calendario de Costa Rica (ejemplo del documento: 01/10 → 12/10).
- **Fecha del aviso** (para el orden de HU-316): el día en que empezó a avisar, es decir, la referencia (última comunicación o creación) más 11 días.
- **"Todas sus posibles ventas":** HU-212 solo actualiza las ventas abiertas que tiene el contacto al registrar la comunicación. Una venta creada después de esa comunicación cuenta los días desde su creación. Es una decisión de HU-212, no de esta historia.
- **Pantalla "Avisos":** sigue siendo la lista simple; la tabla, los colores y el círculo rojo de la barra son de HU-316.

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores.
- `npm test`: 511/511 (487 anteriores + 24 nuevas: unitarias de falta de comunicación y de pantalla del tablero).
- `npm run test:emulators`: 126/126 (121 anteriores + 5 nuevas).
