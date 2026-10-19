# Evidencia HU-314: Aviso de seguimiento programado

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-19

> Como administrador quiero recibir un aviso en el sistema cuando llegue el día de dar seguimiento a una posible venta
> para que no olvide comunicarme con el contacto.

## Datos de prueba

- Ambiente: Firebase Emulator Suite, proyecto `demo-cani-crm`, datos de `npm run seed`, usuario `admin`.
- Recorrido automático en Microsoft Edge (headless, 1366 × 768). Detalle en [recorrido.json](recorrido.json).
- Los avisos no se guardan: se calculan al abrir "Avisos". Para variar los casos, el recorrido cambió datos por REST (fecha de seguimiento, etapa, estado del contacto) y volvió a abrir la pantalla.
- Ventas usadas: `sale-001` (seguimiento 12/10/2026) y `sale-002` (09/10/2026), ambas del seed, y `sale-006` (sin fecha en el seed; se le puso la de hoy).

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | El día del próximo seguimiento, desde las 00:00, aparece "Seguimiento programado para hoy con [contacto] – [título].". | ✅ Cumple | [02](02-aviso-para-hoy.png): "Seguimiento programado para hoy con Elena Muestra Castro – Primer contacto con Elena (mock)." La prueba unitaria fija el límite: a las 23:59:59 del día anterior no hay aviso y a las 00:00 (hora de Costa Rica) sí. |
| 2 | Si pasa ese día y la fecha no se cambió, el aviso cambia a "Seguimiento vencido desde el [fecha] con [contacto] – [título].". | ✅ Cumple | [01](01-avisos-seguimientos-vencidos.png): "Seguimiento vencido desde el 09/10/2026 con Carla Demo Vargas – …" y "… desde el 12/10/2026 con Bruno Ficticio Solís – …", con la fecha en dd/mm/aaaa. Prueba unitaria: a las 23:59:59 sigue siendo "para hoy" y a las 00:00 del día siguiente pasa a "vencido". |
| 3 | El aviso desaparece si se programa una fecha nueva, si se borra la fecha, si la posible venta se gana o se pierde, o si el contacto se desactiva. Registrar una comunicación no quita el aviso. | ✅ Cumple | Fecha nueva (en 7 días): el aviso de hoy desaparece. Fecha borrada (`sale-001`): desaparece ([03](03-aviso-desaparece-al-cambiar-o-borrar-fecha.png)). `sale-002` a perdida o a ganada: desaparece. Contacto desactivado: desaparece ([04](04-sin-avisos.png)). Con una comunicación registrada hoy en `sale-006`, el aviso sigue. Al volver a abrir la venta o reactivar el contacto, el aviso vuelve. |
| 4 | Solo generan este aviso las posibles ventas abiertas de contactos activos. | ✅ Cumple | Las ganadas, las perdidas y las de contactos inactivos no aparecen (recorrido y prueba de emulador). Probado con las seis etapas en la prueba unitaria. |
| 5 | Los avisos solo se ven dentro del sistema interno. No se envían por correo, SMS ni WhatsApp. | ✅ Cumple | Solo existe la pantalla "Avisos" dentro del sistema, detrás del ingreso. No hay código de envío de correo, SMS ni WhatsApp. |

## También comprobado

- Al dar clic en un aviso se abre el detalle de la posible venta.
- Los avisos salen con los más antiguos primero.
- Sin avisos aparece "No hay avisos pendientes." ([04](04-sin-avisos.png)).

## Decisiones y puntos por confirmar

- **Pantalla "Avisos" provisional:** en HU-314 es una lista simple con el texto del aviso. La tabla con tipo, contacto, venta, etapa, detalle y fecha, los colores y el círculo rojo de la barra son de HU-316. "No hay avisos pendientes." es el literal de HU-316, usado aquí para el caso sin datos.
- **Contacto desactivado:** cualquier estado distinto de `activo` no genera aviso.
- **Una sola consulta de ventas abiertas:** se leen todas las ventas abiertas y se filtran en el cliente, así que no necesita índice nuevo.
- **Datos del seed:** solo hay seguimientos vencidos (09/10 y 12/10); no hay uno "para hoy" porque la fecha de hoy no puede ir fija en el seed. Las pruebas usan fecha inyectable.
- **Campana de la tarjeta del tablero:** se conectará al terminar HU-315.

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores.
- `npm test`: 487/487 (462 anteriores + 25 nuevas: 21 unitarias del cálculo y 4 de pantalla).
- `npm run test:emulators`: 121/121 (116 anteriores + 5 nuevas).
