# Evidencia HU-316: Consultar los avisos pendientes

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-19

> Como administrador quiero ver en una sola pantalla todos los avisos pendientes
> para que sepa qué seguimientos debo atender.

## Datos de prueba

- Ambiente: Firebase Emulator Suite, proyecto `demo-cani-crm`, datos de `npm run seed`, usuario `admin`.
- Recorrido automático en Microsoft Edge (headless, 1366 × 768). Detalle en [recorrido.json](recorrido.json).
- Con el seed (hoy 19/10/2026) hay 4 avisos: dos seguimientos vencidos (`sale-002` del 09/10 y `sale-001` del 12/10) y dos de falta de comunicación (`sale-001` y `sale-002`). Para ver los tres tipos, el recorrido puso por REST el seguimiento de `sale-006` en hoy (5 avisos). Al final se quitaron las fechas y se registró una comunicación en las tres ventas para ver la pantalla sin avisos.

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | En la barra de arriba, junto a "Avisos", aparece un círculo rojo con la cantidad de avisos pendientes. Si no hay avisos, el círculo no aparece. | ✅ Cumple | [01](01-circulo-rojo-en-la-barra.png): en la pantalla Contactos la barra muestra "Avisos" con un círculo rojo con "5". También se ve en [02](02-tabla-de-avisos.png). Sin avisos no aparece ([04](04-sin-avisos.png)). Cada aviso cuenta por separado: una venta con seguimiento vencido y falta de comunicación suma 2. El número se recalcula al abrir cada pantalla. |
| 2 | La pantalla "Avisos" muestra una tabla con estas columnas: tipo, contacto, posible venta, etapa, detalle y fecha del aviso. Los avisos más antiguos aparecen primero. | ✅ Cumple | [02](02-tabla-de-avisos.png): columnas Tipo, Contacto, Posible venta, Etapa, Detalle y Fecha del aviso. Orden: 09/10, 12/10, 13/10, 14/10 y 19/10/2026. La fecha de un aviso de seguimiento es el día del seguimiento; la de "Sin comunicación" es el día en que empezó a avisar (última comunicación o creación + 11 días). |
| 3 | El tipo se muestra con un color: "Seguimiento vencido" en rojo, "Seguimiento para hoy" en naranja y "Sin comunicación" en amarillo. | ✅ Cumple | [02](02-tabla-de-avisos.png): rojo `rgb(198, 40, 40)`, naranja `rgb(255, 152, 0)` y amarillo `rgb(253, 216, 53)`. Además cada tipo lleva su texto, para que no dependa solo del color. |
| 4 | Al dar clic en un aviso, se abre el detalle de la posible venta. Si no hay avisos, aparece el mensaje "No hay avisos pendientes.". | ✅ Cumple | [03](03-detalle-desde-un-aviso.png): clic en la fila del primer aviso abre `/posibles-ventas/sale-002`. El título de la venta además es un enlace (se puede abrir con teclado). [04](04-sin-avisos.png): "No hay avisos pendientes." y sin tabla. |

## Cambio en un archivo de Gabriel

- `src/app/TopBar.tsx`: se agregaron el uso del hook `useAlertCount` y, junto a la etiqueta "Avisos", el círculo (`<span class="topbar-count">`) solo cuando hay avisos. El OK para tocarlo lo dio Dylan. El hook y todo el cálculo están en `src/sales/`; la barra no consulta Firestore directamente.
- Si no se pueden calcular los avisos, la barra sigue funcionando sin círculo.
- Las pruebas de pantalla no consultan Firestore: `tests/setup.ts` simula `listAlerts` sin avisos por defecto (las de avisos lo reemplazan). Sin eso, una prueba de HU-201 de Gabriel se volvía inestable por las consultas reales.

## Decisiones y puntos por confirmar

- **Cantidad del círculo:** cuenta avisos, no ventas.
- **Actualización del número:** se recalcula al cambiar de pantalla, no en tiempo real mientras se mira una pantalla.
- **Fila completa clicable y enlace en el título:** el PDF dice "al dar clic en un aviso"; así funciona con ratón y teclado.
- **Filtros y búsqueda:** son HU-317 (evolutiva), fuera de alcance.

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores.
- `npm test`: 524/524 (511 anteriores + 13 nuevas: tabla, colores, clic, caso vacío y círculo de la barra).
- `npm run test:emulators`: 126/126 (sin cambios; los avisos ya se probaban contra el emulador).
