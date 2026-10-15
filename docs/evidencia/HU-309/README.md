# Evidencia HU-309: Editar una posible venta

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-15

> Como administrador quiero actualizar los datos de una posible venta
> para que su información se mantenga al día.

## Datos de prueba

- Ambiente: Firebase Emulator Suite, proyecto `demo-cani-crm`, datos de `npm run seed`, usuario `admin`.
- Recorrido automático en Microsoft Edge (headless, 1366 × 768). Detalle en [recorrido.json](recorrido.json). Se ejecutó dos veces seguidas con datos limpios y dio el mismo resultado.
- Ventas usadas: `sale-001` (en negociación, con seguimiento ya vencido y 2 productos), `sale-003` (ganada) y una segunda venta abierta del mismo contacto, creada para probar el título repetido.

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | En el detalle, arriba a la derecha, el botón "Editar". Permite cambiar título, monto, productos, fecha del próximo seguimiento y notas. | ✅ Cumple | [01](01-detalle-con-editar.png): el botón está arriba, a 24 px del borde derecho, junto al título. [02](02-formulario-edicion.png): el formulario trae los datos guardados (título, monto, seguimiento, notas y las dos filas de productos). No muestra la etapa ni el contacto: no se cambian aquí. |
| 2 | Reglas: título obligatorio, hasta 100 caracteres y sin repetir el de otra posible venta abierta del contacto; monto de ₡ 0 a ₡ 999 999 999; seguimiento no anterior a hoy; cada producto con cantidad de 1 a 9999. | ✅ Cumple | [04](04-errores.png): "Ingrese el título.", "Ingrese un monto válido.", "La fecha de seguimiento no puede ser anterior a hoy.", "Ingrese una cantidad entre 1 y 9999." y "Este producto ya fue agregado.". [05](05-titulo-repetido.png): "Este contacto ya tiene una posible venta abierta con este título." (escrito con otras mayúsculas). Los límites de 100 y 1000 caracteres, los montos de borde y la regla de hoy se comprueban en pruebas. |
| 3 | Si un dato no cumple las reglas, el mensaje aparece debajo de ese dato y no se guarda. | ✅ Cumple | Los mensajes salen en rojo bajo cada dato ([04](04-errores.png)). Tras esos intentos el título y las notas guardados en Firestore no cambiaron. Cada mensaje desaparece al corregir su dato. |
| 4 | Al guardar: "Cambios guardados correctamente.". "Cancelar" descarta los cambios. | ✅ Cumple | [07](07-guardado.png): franja verde con el mensaje, que desaparece a los 5 s, y el detalle ya actualizado (título, ₡ 520 000, seguimiento, notas y productos nuevos). Cancelar vuelve al detalle con el título original y no escribe nada. En Firestore: etapa, última comunicación y las 4 entradas del historial quedaron intactas. |
| 5 | Si la posible venta está ganada, solo se pueden cambiar las notas. | ✅ Cumple | [08](08-ganada-solo-notas.png): el formulario solo tiene "Notas". [09](09-ganada-guardada.png): se guardan con el mensaje de confirmación y título, monto y etapa no cambian. El guardado también lo impide en la base: aunque se pidan otros cambios, una ganada solo guarda las notas (prueba contra emulador). |

## Decisiones y puntos por confirmar

- **Lo que no se tocó no se vuelve a revisar.** Un seguimiento ya vencido, o un título igual al de otra venta abierta, no impiden guardar un cambio en las notas ([03](03-guardado-notas.png)). Si se cambian, aplican las reglas completas. El PDF no lo precisa; es la decisión que quedó pendiente de HU-303. **Por confirmar.**
- **Un seguimiento sin cambios conserva su fecha y hora originales.** Uno nuevo se guarda a las 00:00 de Costa Rica.
- **Productos:** se reemplazan en una sola escritura (se borran los quitados, se actualizan cantidades y se agregan los nuevos). Un producto inactivo que la venta ya tenía sigue en la lista para que no desaparezca; los demás inactivos no se ofrecen.
- **Título y notas:** el título se guarda sin espacios a los lados.
- **Una venta perdida sí se puede editar completa** (el PDF solo restringe las ganadas). Para reabrirla está HU-312.
- **Texto sin literal en el PDF:** "No se pudieron guardar los cambios. Intente de nuevo.".
- **"Cancelar"** vuelve al detalle sin pedir confirmación, como en el resto de formularios de ventas.
- El formulario reutiliza los campos de HU-303 y las filas de HU-304 (el selector de etapa se oculta al editar).

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores.
- `npm test`: 316/316 (287 anteriores + 29 nuevas).
- `npm run test:emulators`: 59/59 (52 anteriores + 7 nuevas).
