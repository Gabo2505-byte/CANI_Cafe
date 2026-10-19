# Evidencia HU-310: Cambiar la etapa de una posible venta

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-19

> Como administrador quiero mover una posible venta a otra etapa
> para que refleje cómo va realmente.

## Datos de prueba

- Ambiente: Firebase Emulator Suite, proyecto `demo-cani-crm`, datos de `npm run seed`, usuario `admin`.
- Recorrido automático en Microsoft Edge (headless, 1366 × 768). Detalle en [recorrido.json](recorrido.json).
- Ventas usadas: `sale-001` (en negociación, con 4 cambios de etapa), una segunda venta abierta del mismo contacto (Bruno) creada para el recorrido, `sale-003` (ganada) y `sale-004` (perdida).

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | En el detalle de una posible venta abierta está el botón "Cambiar etapa". Abre una ventana con las seis etapas y la etapa actual marcada. | ✅ Cumple | [01](01-detalle-con-cambiar-etapa.png): el botón está junto a "Editar". [02](02-ventana-cambiar-etapa.png): las seis etapas en el orden del tablero, con "En negociación" marcada y con la etiqueta "Etapa actual". Una venta ganada o perdida no tiene el botón ([06](06-venta-perdida-sin-cambiar-etapa.png)). "Guardar" queda apagado hasta elegir una etapa distinta. |
| 2 | Desde una etapa abierta se puede pasar a cualquier otra etapa, hacia adelante o hacia atrás. | ✅ Cumple (para las etapas abiertas) | En el navegador: En negociación → Precio o cotización enviada (hacia atrás) y luego → Nuevo interesado (saltando etapas). En pruebas se comprueban las 12 combinaciones entre las cuatro etapas abiertas. "Venta ganada" y "Venta perdida" aparecían deshabilitadas en este recorrido; "Venta perdida" se habilitó después con HU-311 y "Venta ganada" lo hará con HU-313 (ver "Decisiones"). |
| 3 | Cada cambio queda en el historial con su fecha, sin borrar los anteriores. La tarjeta pasa a la columna de la nueva etapa en el tablero. | ✅ Cumple | [04](04-historial-con-los-cambios.png): el historial pasó de 4 a 6 registros; los anteriores siguen intactos y los nuevos van arriba ("Precio o cotización enviada → Nuevo interesado", "En negociación → Precio o cotización enviada"). `stageChangedAt` de la venta coincide con la fecha del último registro. [05](05-tablero-tarjeta-en-la-nueva-columna.png): la tarjeta pasó a "Nuevo interesado · 2 · ₡ 450 000" y "En negociación" quedó en "0 · ₡ 0". "Cancelar" no cambia nada. |
| 4 | Cambiar la etapa de una posible venta no afecta a las demás posibles ventas del mismo contacto. | ✅ Cumple | La otra venta abierta de Bruno quedó idéntica (etapa "Contactado", sin registros nuevos). Prueba contra emulador equivalente. |

## Cómo funciona

- **Una sola transacción:** actualiza `sales.stage` y `sales.stageChangedAt` y agrega un registro a `stageHistory` (`previousStage`, `newStage`, `changedAt`, `lossReason: null`). O se guarda todo o nada.
- **Solo esa venta:** no se toca ninguna otra, ni la última comunicación, ni los productos.
- **Protección contra cambios simultáneos:** si la etapa guardada ya no es la que se veía (otra pestaña la cambió), no se escribe nada y se avisa.
- `stageChangedAt` es el campo que usa el tablero para mostrar solo las ganadas y perdidas de los últimos 30 días.

## Decisiones y puntos por confirmar

- **"Venta perdida" se habilitó con HU-311 (2026-10-19); "Venta ganada" se habilitó después con HU-313 (2026-10-19).** Cada una tiene su propia regla en el PDF: confirmación y motivo (HU-311) y conversión del contacto a cliente (HU-313). Al hacer HU-313 se quita el texto provisional "Marcar una posible venta como ganada estará disponible pronto.". Cuando se hizo este recorrido (2026-10-19, antes de HU-311) las dos estaban deshabilitadas.
- **Confirmación en franja verde (agregada el 2026-10-19, a pedido de Dylan).** HU-310 no da un texto; tras cambiar de etapa aparece "Etapa actualizada correctamente." durante 5 segundos y el detalle muestra la nueva etapa y el historial. Se comprueba en pruebas de pantalla.
- **Textos sin literal en el PDF:** "Etapa actual", "No se pudo cambiar la etapa. Intente de nuevo." y "La etapa de esta posible venta cambió. Cierre esta ventana y vuelva a intentarlo.".
- **Accesibilidad:** la ventana se cierra con Escape y la etapa actual se lee como "En negociación Etapa actual".

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores.
- `npm test`: 432/432 (409 anteriores + 23 nuevas).
- `npm run test:emulators`: 92/92 (85 anteriores + 7 nuevas).
