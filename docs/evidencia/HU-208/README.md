# Evidencia HU-208: Ver las posibles ventas de un contacto

**Responsable:** Gabriel · **Revisa:** Dylan · **Fecha:** 2026-10-19

> Como administrador quiero ver en la ficha todas las posibles ventas de un contacto
> para que sepa en qué etapa está cada una.

## Estado: implementada, faltan capturas y pruebas de emuladores

- Código y pruebas sin emuladores ✅ (`npm test` 357/357).
- **Pendiente:** correr `npm run test:emulators` y tomar las capturas con `npm run seed`.

## Datos de prueba

- Ambiente: Firebase Emulator Suite, proyecto `demo-cani-crm`, datos de `npm run seed`, usuario `admin`.
- **Bruno Ficticio Solís** (`contact-002`) tiene 3 posibles ventas: una "En negociación" (sale-001), una ganada reciente (sale-003) y una **ganada hace más de 30 días** (sale-005), que no se ve en el tablero pero sí aquí.
- **Ana Prueba Mora** (`contact-001`) tiene una venta perdida (sale-004).
- **Diego Ejemplo Rojas** (`contact-004`) no tiene posibles ventas.

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | La pestaña "Posibles ventas" muestra una tabla con título, etapa, monto estimado, próximo seguimiento y última comunicación. | ✅ Cumple | Mismos formatos que el tablero y el detalle (HU-305/308): "₡ 450 000" y fechas dd/mm/aaaa en hora de Costa Rica. Sin fecha: "Sin seguimiento programado" / "Sin comunicaciones" (mismos textos que HU-308). |
| 2 | Incluye todas las posibles ventas del contacto, también ganadas y perdidas, de la más reciente a la más antigua. | ✅ Cumple | Sin filtro por etapa ni por los 30 días del tablero. "Más reciente" se toma por **fecha de creación** (igual que el tablero), con desempate estable por id. Prueba de pantalla con una perdida y una ganada antigua, y prueba contra el emulador. |
| 3 | Al dar clic sobre una posible venta, se abre su detalle. | ✅ Cumple | Clic en cualquier celda de la fila (o Enter) → `/posibles-ventas/{id}` (pantalla de HU-308). El título además es un enlace, accesible con teclado. |
| 4 | Sin posibles ventas: "Este contacto no tiene posibles ventas.". | ✅ Cumple | Sin tabla; la pestaña dice "Posibles ventas (0)". |

## Decisiones

- **Orden por fecha de creación**, no por fecha del último cambio de etapa. Es el mismo criterio del tablero y no cambia cuando se mueve la venta de etapa. Si se prefiere `stageChangedAt`, se cambia solo en `sortSales`.
- **Datos de la propia venta:** `nextFollowUpAt` y `lastCommunicationAt` se leen del documento `sales`; no se consulta `communications`. HU-301 a 309 ya mantienen esos campos.
- **Una sola consulta** `where('contactId', '==')`, la misma de HU-207, así que el conteo de la pestaña y la tabla siempre coinciden. No hacen falta índices nuevos.
- Al volver desde el detalle de la venta, su enlace "← Volver a posibles ventas" lleva al tablero (HU-308, sin cambios). El botón Atrás del navegador regresa a la ficha.

## Archivos

- `src/contacts/ContactDetailPage.tsx`: `SalesPanel` (tabla y clic en la fila).
- `src/contacts/contactDetail.ts`: `CONTACT_SALES_COLUMNS`, `contactSaleCells`, `sortSales` con desempate y el mensaje vacío.
- `src/styles.css`: sección "HU-208".

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores.
- `npm test`: 357/357 (347 anteriores + 10 nuevas: 6 de pantalla y 4 unitarias).
- `npm run test:emulators`: **pendiente**. La prueba de HU-207 ahora incluye una ganada antigua y una perdida, y verifica el orden.

## Capturas (pendientes)

| Archivo | Qué mostrar |
|---|---|
| `01-tabla-bruno.png` | Ficha de Bruno, pestaña "Posibles ventas (3)" con las cinco columnas, incluida la ganada del 01/08 |
| `02-detalle-desde-ficha.png` | Detalle de la venta abierto tras dar clic en la fila |
| `03-perdida-ana.png` | Ficha de Ana con su venta perdida |
| `04-sin-ventas.png` | Ficha de Diego: "Este contacto no tiene posibles ventas." |
