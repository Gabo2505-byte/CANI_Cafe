# Evidencia HT-002: Colección de productos y acceso desde formularios de ventas

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-14

> Tarea técnica: crear la colección `products`, cargar datos de demostración y dejar un acceso de
> lectura para los formularios de ventas.
> Resultado verificable (Plan de trabajo paralelo): HU-304 puede ejecutarse sin una pantalla administrativa de productos.

## Datos de prueba

- Ambiente: Firebase Emulator Suite, proyecto `demo-cani-crm`, datos cargados con `npm run seed`.
- **Los 6 productos del seed son provisionales** (nombres genéricos de ejemplo). El cliente entregará el catálogo real; se reemplaza editando solo `seedProducts` en `scripts/seed/seedData.ts`.
- HT-002 no tiene pantalla propia, así que **no hay capturas**. El detalle de lo que ve un formulario está en [recorrido.json](recorrido.json), generado a partir de los datos del seed con el mismo código de acceso.

## Criterios

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | Existe la colección `products` con `id, name, presentation, description, active`. | ✅ Cumple | Tipo `Product` sin cambios; el seed escribe 6 documentos (`product-001` a `product-006`). Prueba de seed: 6 productos. |
| 2 | Datos de demostración reproducibles, sin duplicados al recargar. | ✅ Cumple | IDs fijos y escritura con `set()`. La prueba de idempotencia corre el seed dos veces y sigue contando 6 productos, 5 filas de `saleProducts` y 9 de `stageHistory`. Un producto es inactivo para probar el filtro. |
| 3 | Los formularios de ventas pueden leer el catálogo. | ✅ Cumple | `listActiveProducts()` (activos, ordenados por nombre y presentación sin importar tildes ni mayúsculas) y `listProducts()` (todos, para mostrar ventas antiguas). Prueba contra el emulador con las reglas reales. |
| 4 | HU-304 no necesita una pantalla administrativa de productos. | ✅ Cumple | No se creó ninguna pantalla (el Alcance la excluye). El catálogo sale del seed. |
| Error relevante | Sin sesión no se puede leer el catálogo. | ✅ Cumple | Prueba *"sin sesión no se puede leer el catálogo"*: las reglas rechazan la lectura. |

## Cambios de contrato incluidos (avisar a Gabriel)

- `stage` de `sales` pasa a `nuevo_interesado, contactado, cotizacion_enviada, en_negociacion, ganada, perdida`. Antes eran valores provisionales; ningún código de Gabriel los usaba.
- Campo nuevo en `sales`: **`stageChangedAt`** (Timestamp). Al crear la venta es igual a `createdAt`; cada cambio de etapa lo actualiza. Sirve para mostrar solo las ventas ganadas o perdidas de los últimos 30 días.
- `saleProducts` y `stageHistory` no llevan `id` en el contrato; sus documentos usan `${saleId}_${productId}` y `${saleId}_${nn}`.
- Se agregaron `SALE_STAGE_LABELS`, `OPEN_SALE_STAGES` y `isOpenSaleStage` en `src/shared/types/sale.ts`, y `formatDateNumericCR` (dd/mm/aaaa) en `src/shared/utils/dates.ts`. `formatDateCR` no cambió.
- El seed ahora incluye `saleProducts` y `stageHistory` coherentes: el último cambio de cada venta coincide con su `stage` y su `stageChangedAt`.

## Pruebas automatizadas

Salida completa en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores.
- `npm test`: 146/146 (141 anteriores + 5 nuevas: orden de productos, etapas y fecha numérica).
- `npm run test:emulators`: 33/33 (29 anteriores + 3 del catálogo + 1 de integridad del seed).
- HT-001, HU-101 a HU-105 y HU-201 a HU-204 siguen pasando.
