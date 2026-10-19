# Evidencia HU-212: Relacionar una comunicación con una posible venta

**Responsable:** Gabriel · **Revisa:** Dylan · **Fecha:** 2026-10-19

> Como administrador quiero indicar a qué posible venta corresponde cada comunicación
> para que el seguimiento de cada posible venta de un mismo contacto se lleve por separado.

## Estado: parcial (criterio 5 preparado), faltan capturas y pruebas de emuladores

- Código y pruebas sin emuladores ✅ (`npm test` 394/394).
- **Criterio 5:** todavía no existe el formulario del sitio web. El registro ya trata como "Todas sus posibles ventas" cualquier comunicación que llegue sin venta, así que se cierra cuando exista esa HU.
- **Pendiente:** correr `npm run test:emulators` (6 pruebas nuevas en `tests/communications/communicationSale.emulator.test.ts`) y tomar las capturas con `npm run seed`.

## Datos de prueba

- Ambiente: Firebase Emulator Suite, proyecto `demo-cani-crm`, datos de `npm run seed`, usuario `admin`.
- **Bruno Ficticio Solís** (`contact-002`) tiene una venta abierta, "Café en grano para cafetería (mock)" (sale-001, última comunicación 02/10/2026), y dos ganadas que no deben aparecer como opción.
- Para ver varias abiertas, crear antes otra posible venta para Bruno desde el tablero (HU-301).

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | Al registrar una comunicación también se elige a qué posible venta corresponde; es obligatorio. | ✅ Cumple | Campo "Posible venta" en la ventana de HU-211. Si queda vacío o tiene una venta que ya no es elegible: "Seleccione la posible venta.". Las reglas de Firestore exigen una de las dos opciones: venta abierta del mismo contacto, o "Todas". |
| 2 | Opciones: el título de cada posible venta del contacto que no esté ganada ni perdida, y "Todas sus posibles ventas", elegida automáticamente. | ✅ Cumple | "Todas sus posibles ventas" va primero y viene elegida; después, las abiertas de la más reciente a la más antigua. Un texto de ayuda explica cuándo usarla. Sin ventas abiertas, solo aparece "Todas". |
| 3 | Si se elige una posible venta, se actualiza su fecha de última comunicación. | ✅ Cumple | Se guarda `saleId` y, **en la misma transacción**, `sales.lastCommunicationAt` de esa venta. Se ve en el detalle de la venta (HU-308, "Última comunicación") y en la tabla de la ficha (HU-208). |
| 4 | Con "Todas sus posibles ventas", todas las abiertas del contacto quedan con la fecha de la comunicación como última comunicación. | ✅ Cumple | `appliesToAllSales: true` y se actualizan todas las abiertas del contacto en la misma transacción. Las ganadas, las perdidas y las de otros contactos no cambian (prueba contra el emulador). |
| 5 | Las comunicaciones del formulario del sitio web se registran como "Todas sus posibles ventas". | ⚠️ Preparado | El formulario del sitio web aún no existe. `createCommunicationIn` registra como "Todas" cualquier comunicación sin `saleId`, y hay una prueba contra el emulador que lo verifica. Actualización por HU-213: lo que escriba el formulario debe tener además `source: "formulario_web"` y `userId: null`, escrito desde el servidor (Admin SDK), porque las reglas solo dejan crear `source: "usuario"` desde la app. Seed: `comm-006`. |

## Decisiones

- **La última comunicación no retrocede:** si se registra una comunicación con una fecha anterior a la última que ya tiene la venta, se conserva la más reciente. Así "Última comunicación" siempre es la más nueva (como pide el criterio 3 de HU-308). Si no tenía ninguna, se pone la nueva.
- **La fecha que se copia** es el día de la comunicación (00:00 en Costa Rica, HU-211), no la hora en que se registró.
- **Transacción:** la comunicación y las actualizaciones de las ventas se guardan juntas o no se guarda nada. Si la venta elegida se ganó o se perdió mientras la ventana estaba abierta, no se guarda y el campo avisa: *"La posible venta elegida ya no está abierta. Elija otra o "Todas sus posibles ventas"."*.
- **Historial:** cada comunicación muestra a qué venta corresponde ("· Café en grano para cafetería" o "· Todas sus posibles ventas").
- **Reglas de Firestore (`communications`):** o `appliesToAllSales == true` con `saleId == null`, o `saleId` de una venta **existente, del mismo contacto y abierta**.
- **Seed:** `comm-001` y `comm-005` (sin venta en particular) pasan a `appliesToAllSales: true`. No se recalculó `lastCommunicationAt` de `sale-004`, para no cambiar las capturas de HU-308; el seed no se genera con este flujo.

## Archivos

- `src/communications/RegisterCommunicationDialog.tsx`: campo "Posible venta".
- `src/communications/communicationForm.ts`: `ALL_SALES`, `saleOptions` y la validación.
- `src/communications/communicationsRepository.ts`: transacción y `SaleNotOpenError`.
- `src/contacts/ContactDetailPage.tsx` y `contactDetail.ts`: ventas abiertas para la ventana y la venta en el historial.
- `firestore.rules`, `scripts/seed/seedData.ts`, `src/styles.css`.

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores. `npm run build`: OK.
- `npm test`: 394/394 (380 anteriores + 14 nuevas: 8 de pantalla y 6 unitarias).
- `npm run test:emulators`: **pendiente**, con 6 pruebas nuevas:
  - Una venta: se actualiza solo esa.
  - "Todas": se actualizan las abiertas, no las ganadas, perdidas ni de otros contactos.
  - Sin indicar venta (sitio web) queda como "Todas".
  - No retrocede.
  - No se puede elegir una venta cerrada, de otro contacto o inexistente.
  - Reglas.

## Capturas (pendientes)

| Archivo | Qué mostrar |
|---|---|
| `01-campo-posible-venta.png` | Ventana con "Todas sus posibles ventas" elegida y la lista abierta (sin ganadas ni perdidas) |
| `02-una-venta.png` | Guardar eligiendo una venta |
| `03-detalle-ultima-comunicacion.png` | Detalle de esa venta con la nueva "Última comunicación" |
| `04-todas.png` | Guardar con "Todas" y la tabla de la ficha (HU-208) con la fecha en todas las abiertas |
| `05-historial.png` | Historial mostrando a qué venta corresponde cada comunicación |
