# Evidencia HU-308: Consultar el detalle de una posible venta

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-15

> Como administrador quiero ver toda la información de una posible venta
> para que conozca cómo va.

## Datos de prueba

- Ambiente: Firebase Emulator Suite, proyecto `demo-cani-crm`, datos de `npm run seed`, usuario `admin`.
- Recorrido automático en Microsoft Edge (headless, 1366 × 768). Detalle en [recorrido.json](recorrido.json).
- Ventas del seed usadas: `sale-001` (en negociación, 2 productos, 4 cambios de etapa, con comunicación), `sale-004` (perdida con motivo), `sale-006` (sin comunicaciones, sin seguimiento y sin productos) y `sale-003` (ganada).

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | Arriba, el enlace "← Volver a posibles ventas", el título y el nombre del contacto; al dar clic en el nombre se abre la ficha del contacto. | ✅ Cumple | [01](01-detalle-completo.png). El enlace vuelve al tablero. El clic en "Bruno Ficticio Solís" abre `/contactos/contact-002` con su ficha ([02](02-ficha-del-contacto.png)). Se llega al detalle desde el tablero haciendo clic en una tarjeta (cierra HU-305 criterio 5). |
| 2 | Se muestran: etapa, monto estimado, productos, fecha del próximo seguimiento, notas, fecha de creación y fecha de la última comunicación. | ✅ Cumple | [01](01-detalle-completo.png): En negociación, ₡ 450 000, productos con presentación y cantidad, 12/10/2026, notas, 15/09/2026 y 02/10/2026. Sin seguimiento, sin productos o sin notas, lo dice ([04](04-detalle-sin-datos.png)). Los productos se muestran aunque sean inactivos. |
| 3 | La última comunicación es la más reciente sobre esa posible venta o registrada como "Todas sus posibles ventas". Si no hay ninguna: "Sin comunicaciones". | ✅ Cumple | Con comunicación: "02/10/2026". Sin ella: "Sin comunicaciones" ([03](03-detalle-perdida.png), [04](04-detalle-sin-datos.png)). Se lee `sales.lastCommunicationAt`, que mantiene el registro de comunicaciones de Gabriel (HU-212); ver "Decisiones". |
| 4 | "Historial de etapas": cada cambio del más reciente al más antiguo con fecha, etapa anterior y nueva; si fue a "Venta perdida", el motivo o "Sin motivo registrado". | ✅ Cumple | [01](01-detalle-completo.png): 01/10, 24/09, 18/09 y 15/09, en ese orden; el primer registro muestra "—" como etapa anterior. [03](03-detalle-perdida.png): el cambio a "Venta perdida" muestra "El cliente eligió otro proveedor.". "Sin motivo registrado" (motivo vacío, nulo o solo espacios) se comprueba en las pruebas; el seed no tiene una pérdida sin motivo. |
| Caso sin datos | Venta que no existe. | ✅ | "No se encontró la posible venta." con el enlace de volver ([05](05-no-existe.png)). Si falla la carga: "No se pudo cargar la posible venta. Intente de nuevo.". |

## Decisiones

- **Última comunicación.** Se usa `sales.lastCommunicationAt`, que ya está en el contrato. HU-212 (Gabriel) lo actualiza al registrar una comunicación: la de esa venta, o todas las abiertas si es "Todas sus posibles ventas". Así el detalle respeta que las ganadas y perdidas no reciben comunicaciones nuevas. Hasta que HU-212 exista, el dato viene del seed.
- **Productos** con nombre y presentación desde el catálogo (`saleProducts` solo guarda el id). Si un producto ya no está en el catálogo se muestra "Producto no disponible".
- **Contacto que ya no existe:** se muestra "—" sin enlace.
- **Textos sin literal en el PDF:** "Sin productos", "Sin notas", "No se encontró la posible venta." y "No se pudo cargar la posible venta. Intente de nuevo.".
- **Un solo detalle de carga:** la venta, sus productos, el contacto y el historial se piden juntos. El historial usa el índice `saleId` + `changedAt` que ya estaba en `firestore.indexes.json`.
- Los botones "Editar" y "Cambiar etapa" llegan con HU-309 y HU-310.

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores.
- `npm test`: 287/287 (269 anteriores + 18 nuevas).
- `npm run test:emulators`: 52/52 (47 anteriores + 5 nuevas).
