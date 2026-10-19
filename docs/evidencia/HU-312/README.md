# Evidencia HU-312: Reabrir una posible venta perdida

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-19

> Como administrador quiero reabrir una posible venta perdida cuando la persona vuelve a mostrar interés
> para que no tenga que registrarla de nuevo.

## Datos de prueba

- Ambiente: Firebase Emulator Suite, proyecto `demo-cani-crm`, datos de `npm run seed`, usuario `admin`.
- Recorrido automático en Microsoft Edge (headless, 1366 × 768). Detalle en [recorrido.json](recorrido.json).
- Venta usada: `sale-004` (perdida en el seed, contacto `contact-001`). Para el criterio 4 se creó por REST una segunda venta abierta del mismo contacto con el mismo título escrito en mayúsculas (`sale-duplicada`) y se borró al terminar.

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | Para reabrir una posible venta perdida, se usa el botón "Cambiar etapa" y se elige una de las cuatro etapas abiertas. Desde "Venta perdida" no se puede pasar directamente a "Venta ganada". | ✅ Cumple | [01](01-venta-perdida-con-boton.png): la venta perdida muestra "Cambiar etapa" junto a "Editar". [02](02-ventana-desde-perdida.png): la ventana marca "Venta perdida · Etapa actual", deja elegir las cuatro abiertas y "Venta ganada" aparece deshabilitada. No pide motivo ni confirmación. En la base, `perdida → ganada` se rechaza sin escribir nada. |
| 2 | Al reabrirla, aparece el mensaje "Posible venta reabierta correctamente." y la posible venta vuelve a generar avisos. | ✅ Cumple (avisos: ver nota) | [04](04-venta-reabierta.png): franja verde "Posible venta reabierta correctamente.", la etapa pasa a "En negociación" y el historial suma "Venta perdida → En negociación" sin motivo. [05](05-tablero-venta-reabierta.png): la tarjeta vuelve a la columna "En negociación". Los avisos se calculan al consultar según la etapa (HU-314/315): una venta abierta entra en el cálculo y una perdida no. |
| 3 | Si se reabre y luego se vuelve a perder, se guarda la nueva pérdida con su fecha y motivo, sin borrar las anteriores. | ✅ Cumple | [06](06-segunda-perdida-historial.png): el historial conserva la pérdida del 08/10/2026 con "El cliente eligió otro proveedor." y suma la del 19/10/2026 con "Volvió a decidir que no por el precio.". En Firestore hay dos registros `perdida`, cada uno con su fecha y motivo. |
| 4 | Si el contacto ya tiene otra posible venta abierta con el mismo título, no se puede reabrir. Aparece el mensaje "Este contacto ya tiene una posible venta abierta con este título. Cambie el título antes de reabrirla.". | ✅ Cumple | [03](03-no-se-puede-reabrir-titulo-repetido.png): el mensaje sale en rojo dentro de la ventana, que sigue abierta. La venta sigue en `perdida` y el historial no gana registros. El título se compara sin mayúsculas ni tildes ni espacios a los lados, igual que HU-303. Una abierta de otro contacto, o una ganada o perdida con el mismo título, no lo impide (prueba de emulador). |

## También comprobado

- **Cancelar al reabrir** no cambia nada: la ventana se cierra, la etapa sigue "Venta perdida" y no hay registros nuevos.
- **Ganada sigue siendo definitiva (HU-313):** "Cambiar etapa" no aparece en una venta ganada.
- **Cambio en la ventana:** al abrirla en una venta perdida, "Venta perdida" es la etapa actual, así que no se muestra la pregunta ni el motivo de la pérdida (HU-311) hasta que se elija otra etapa y se vuelva a elegir "Venta perdida".
- **Conflicto de etapa (HU-310):** si otra pestaña ya reabrió la venta, la ventana avisa y no escribe nada.

## Decisiones y puntos por confirmar

- **Franja verde al reabrir:** se usa siempre "Posible venta reabierta correctamente." (literal del PDF), sin importar a cuál de las cuatro etapas se reabra.
- **El título repetido se revisa antes de la transacción,** porque Firestore no permite consultas dentro de una transacción. Si dos pestañas reabrieran a la vez dos ventas con el mismo título podría pasar una de las dos; en un sistema de una sola persona administradora lo consideramos aceptable.
- **El registro de la reapertura no lleva motivo** (el motivo solo existe en pérdidas).
- **Avisos (criterio 2, "vuelve a generar avisos"):** no hay nada que reactivar porque los avisos no se guardan, se calculan al consultar. Se verá en pantalla cuando se cierren HU-314 y HU-315.

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores.
- `npm test`: 462/462 (456 anteriores + 6 nuevas de HU-312, entre unitarias y de pantalla; se ajustaron 2 que decían que una perdida no tenía el botón).
- `npm run test:emulators`: 116/116 (108 anteriores + 8 nuevas).
