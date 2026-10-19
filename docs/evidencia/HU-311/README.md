# Evidencia HU-311: Marcar una posible venta como perdida

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-19

> Como administrador quiero marcar como perdida una posible venta que no se concretó
> para que el tablero muestre las oportunidades reales.

## Datos de prueba

- Ambiente: Firebase Emulator Suite, proyecto `demo-cani-crm`, datos de `npm run seed`, usuario `admin`.
- Recorrido automático en Microsoft Edge (headless, 1366 × 768). Detalle en [recorrido.json](recorrido.json).
- Ventas usadas: `sale-001` (en negociación, para la pérdida con motivo), `sale-002` (cotización enviada, para la pérdida sin motivo) y `sale-006` (para la franja verde de HU-310).

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | Al elegir "Venta perdida" en la ventana "Cambiar etapa", el sistema pregunta "¿Está seguro de que desea marcar esta venta como perdida?". | ✅ Cumple | [01](01-pregunta-y-motivo.png): al elegir "Venta perdida" aparece la pregunta, en rojo, dentro de la misma ventana. Con las otras etapas no aparece. El botón pasa de "Guardar" a "Aceptar" y el cursor queda en el motivo. |
| 2 | En esa misma ventana se puede escribir el motivo de la pérdida. Es opcional y acepta como máximo 250 caracteres. | ✅ Cumple | Campo "Motivo de la pérdida (opcional)" con contador "0/250". Al escribir 300 caracteres solo quedan 250 ([02](02-motivo-maximo-250.png)). Aceptar sin escribirlo funciona y queda como "Sin motivo registrado" en el historial ([04](04-venta-perdida-sin-motivo.png)). En la base: 250 caracteres se guardan; 251 se rechazan sin escribir nada. |
| 3 | Al aceptar, la posible venta pasa a "Venta perdida" y se guardan la fecha y el motivo. Al dar clic en "Cancelar", la posible venta se queda en su etapa. | ✅ Cumple | [03](03-venta-perdida-con-motivo.png): la venta pasa a "Venta perdida" y el historial muestra "19/10/2026 · En negociación → Venta perdida · El cliente eligió otro proveedor.". En Firestore: etapa `perdida`, `stageChangedAt` y el registro con `lossReason` (sin espacios a los lados). Cancelar: la ventana se cierra, la etapa sigue "En negociación" y el historial conserva sus 4 registros. En el tablero las ventas pasan a la columna "Venta perdida" ([05](05-tablero-ventas-perdidas.png)). |

## También comprobado en este recorrido

- **HU-310, franja verde:** al cambiar `sale-006` a una etapa abierta aparece "Etapa actualizada correctamente." ([06](06-franja-verde-cambio-de-etapa.png)).
- **HU-308, "Sin motivo registrado":** ahora se ve en el navegador con una pérdida real sin motivo ([04](04-venta-perdida-sin-motivo.png)).
- **HU-305, regla de 30 días:** la pérdida lleva la fecha del cambio (`stageChangedAt`), con la que el tablero la muestra durante 30 días.
- La confirmación en franja verde desaparece a los 5 s.

## Decisiones y puntos por confirmar

- **La confirmación es parte de la misma ventana,** como pide el criterio 2 ("en esa misma ventana"): no hay una segunda ventana.
- **Botón "Aceptar":** el criterio dice "Al aceptar", así que el botón se llama así al elegir "Venta perdida"; con las demás etapas sigue siendo "Guardar".
- **Texto sin literal en el PDF:** la franja verde "Posible venta marcada como perdida." y el aviso "El motivo acepta como máximo 250 caracteres." (solo alcanzable pegando texto sin el tope del campo; el campo ya limita a 250).
- **Una venta perdida no mostraba "Cambiar etapa"** cuando se hizo este recorrido; HU-312 lo habilita para reabrirla (a una de las cuatro etapas abiertas).
- **"Venta ganada" seguía deshabilitada** en la ventana cuando se hizo este recorrido (con un texto provisional); se habilitó después con HU-313.
- Si se reabre y se vuelve a perder (HU-312), cada pérdida se guarda como un registro nuevo del historial, sin borrar las anteriores (ya funciona así).

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores.
- `npm test`: 444/444 (434 anteriores + 10 nuevas de HU-311, entre unitarias y de pantalla).
- `npm run test:emulators`: 98/98 (92 anteriores + 6 nuevas).
