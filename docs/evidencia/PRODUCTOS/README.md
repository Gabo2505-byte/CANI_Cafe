# Evidencia: catálogo oficial de productos y selector de dos pasos

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-20 · **Rama:** `dylan-productos`

> Se carga el catálogo oficial del cliente (HT-002) y el producto de cada fila de una posible venta (HU-304, HU-309) pasa a
> elegirse en dos pasos: variedad y presentación.

## Decisiones del equipo

### Cambio de requisitos: HU-304, criterio 1

| | Texto del documento de requisitos | Ahora |
|---|---|---|
| HU-304, criterio 1 | "En cada fila se elige un producto del catálogo y se escribe la cantidad estimada, en unidades. Una 'X' al final de la fila permite quitarla." | En cada fila se elige primero la **variedad** y luego su **presentación**; el resultado sigue siendo **un solo producto del catálogo** (variedad + presentación). Cantidad, "unidades" y "X" no cambian |

Los criterios 2, 3 y 4 de HU-304 no cambian: los mensajes "Ingrese una cantidad entre 1 y 9999.", "Seleccione un producto o elimine la fila." (si falta la variedad o la presentación) y "Este producto ya fue agregado." (misma variedad con la misma presentación) siguen literales. La misma variedad con otra presentación sí es válida. Se aplica igual en "Nuevo registro" (HU-301) y en la edición de la venta (HU-309).

### Catálogo oficial

- **72 productos** = 9 variedades × 4 pesos (250 g, 340 g, 500 g y 1 kg) × 2 formatos (grano entero y molido), en la colección `products`, sin campos nuevos.
- En cada producto: `name` = la variedad, `presentation` = "Bolsa de 250 g, molido" o "Bolsa de 250 g, grano entero" (1 kg se escribe "Bolsa de 1 kg, …"), `description` = la descripción del PDF del cliente (la misma en los 8 productos de la variedad) y `active` = true.
- **No hay precios** y no se guardan en ningún lado (RN-06). Una prueba lo comprueba.
- **Las descripciones son las del cliente, sin reescribir.** Se extrajeron del PDF con un programa, sin retipearlas. Ninguna pasa de 300 caracteres (HU-402):

| Variedad | Caracteres |
|---|---|
| Villa Sarchí | 215 |
| Caturra | 245 |
| Catuaí | 227 |
| Kenia | 231 |
| San Roque | 224 |
| Milenio | 234 |
| Centroamericano | 241 |
| Casiopea | 235 |
| Geisha | 267 |

- **Excepción a la regla 5 de CLAUDE.md** ("datos siempre ficticios"): el catálogo oficial es real. Está anotado al final de CLAUDE.md.
- **Los datos viven en `scripts/seed/catalogData.ts`,** que no depende de Firebase, para reutilizarlos más adelante en la carga de producción (RT-02). El cargador de producción no se escribió.

### Ids y orden

El id de cada producto lleva el orden del catálogo: `prod-01-villa-sarchi-0250-grano`, `prod-01-villa-sarchi-0250-molido`, … `prod-09-geisha-1000-molido` (variedad, peso con ceros y formato). El componente ordena por id; `sortProducts` no cambia.

**Detalle del orden entre formatos:** al ordenar los ids como texto, dentro de cada peso "grano entero" (`…-grano`) queda antes que "molido" (`…-molido`), porque "g" va antes que "m". Por eso el primer producto es `prod-01-villa-sarchi-0250-grano` y el último `prod-09-geisha-1000-molido`. Si se prefiere "molido" primero, basta cambiar el nombre de los ids de formato; no cambia ningún otro archivo.

### Textos sin literal en el PDF

Los textos de las opciones vacías de los dos selectores no están en el documento de requisitos. Los aprobó el equipo:
- "Seleccione una variedad"
- "Seleccione una presentación"

Los nombres accesibles de los controles ("Variedad del producto 1", "Presentación del producto 1") tampoco son literales; siguen el patrón de "Cantidad del producto 1" y "Quitar producto 1".

## Ventas de ejemplo reasignadas

Los montos, las fechas de seguimiento, las comunicaciones, las etapas y los avisos **no cambian**. Solo se reasignan los productos de `saleProducts` al catálogo nuevo (siguen siendo 6 filas, con las mismas cantidades):

| Venta | Antes | Ahora |
|---|---|---|
| `sale-001` (en negociación, ₡ 450 000) | grano 340 g ×20 + grano 1 kg ×10 | Caturra, Bolsa de 340 g, grano entero ×20 + Caturra, Bolsa de 1 kg, grano entero ×10 |
| `sale-002` (cotización enviada, ₡ 1 200 000) | molido 340 g ×50 | Catuaí, Bolsa de 340 g, molido ×50 |
| `sale-003` (ganada, ₡ 300 000) | grano 1 kg ×5 + molido 1 kg ×5 | Villa Sarchí, Bolsa de 1 kg, grano entero ×5 + Villa Sarchí, Bolsa de 1 kg, molido ×5 |
| `sale-004` (perdida, ₡ 80 000) | espresso 2,5 kg ×3 | Geisha, Bolsa de 250 g, grano entero ×3 (no hay 2,5 kg) |

## Cómo funciona el selector

- **Fila (dos líneas):** arriba, "Variedad" y "Presentación"; abajo, "Cantidad", "unidades" y la "X" a la derecha. El orden en el DOM sigue siendo Variedad, Presentación, Cantidad, unidades, X.
- **Variedad:** las 9 variedades en el orden del PDF (Villa Sarchí, Caturra, Catuaí, Kenia, San Roque, Milenio, Centroamericano, Casiopea, Geisha).
- **Presentación:** deshabilitada hasta elegir variedad; muestra solo las 8 presentaciones de esa variedad. **Al cambiar la variedad se borra la presentación.**
- **Edición de la venta:** la fila se precarga con la variedad y la presentación del producto guardado, sin esperar al catálogo. Un producto inactivo que la venta ya tenía sigue apareciendo.
- **Teclado:** son selectores nativos. Tab recorre Variedad → Presentación → Cantidad → X; mientras Presentación está deshabilitada, Tab la salta. Escribir letras elige por prefijo ("Ge" → Geisha). Elegir la variedad no mueve el foco solo.
- **Errores:** si falta la variedad se marca la variedad; si falta la presentación, o el producto está repetido, se marca la presentación. El mensaje va bajo la fila, en rojo.

## Verificación en el navegador (1366 × 768, Microsoft Edge)

Datos completos en [verificacion.json](verificacion.json). **Ninguna opción se corta:** se midió con la fuente real contra el ancho útil de cada selector.

| Selector | Ancho útil | Texto más largo | Resultado |
|---|---|---|---|
| Variedad | 189 px | "Seleccione una variedad", 186 px | cabe |
| Presentación | 229 px | "Bolsa de 340 g, grano entero", 220 px | cabe |

| Captura | Qué se ve |
|---|---|
| [30](30-fila-vacia-presentacion-deshabilitada.png) | Fila nueva: presentación deshabilitada, con "Seleccione una presentación" |
| [31](31-variedad-elegida.png) | Variedad elegida: la presentación se habilita |
| [32](32-fila-completa-opcion-mas-larga.png) | Fila completa con "Centroamericano" y "Bolsa de 250 g, grano entero" |
| [33](33-al-cambiar-la-variedad-se-borra-la-presentacion.png) | Al cambiar de variedad la presentación vuelve a "Seleccione una presentación" |
| [34](34-misma-variedad-otra-presentacion.png) | Misma variedad con otra presentación: válido |
| [35](35-errores-por-fila.png) | Errores: sin variedad, variedad sin presentación y producto repetido |
| [36](36-foco-con-teclado.png) | Foco con teclado en la fila |
| [37](37-edicion-precargada.png) | Edición de `sale-001` con sus dos productos precargados |
| [38](38-detalle-variedad-presentacion.png) | Detalle: "Caturra · Bolsa de 1 kg, grano entero — 10 unidades" |
| [39](39-ficha-productos-de-interes.png) | Ficha del contacto, pestaña "Productos de interés", con los nombres nuevos |

## Pruebas

- **Nuevas:** `tests/unit/catalog.test.ts` (11 pruebas):
  - 9 variedades en el orden del cliente.
  - 8 productos por variedad (72 en total).
  - Ids únicos y ordenados.
  - Formato de la presentación.
  - Todas las descripciones ≤ 300 caracteres.
  - Todos los productos activos.
  - Sin ningún precio.
  - Agrupación en dos pasos y orden por id.
- **Nuevas en `SaleProductsField.test.tsx` (6 más, de 12 a 18):** orden de las variedades, presentación deshabilitada, presentaciones solo de la variedad, borrado al cambiar de variedad, la misma variedad con otra presentación, y errores de la variedad y de la presentación.
- **Nuevas en `saleProductRows.test.ts` (2):** variedad sin presentación y misma variedad con otra presentación.
- **Ajustadas:** `SaleProductsField.test.tsx` (se reescribió para los dos pasos), `saleProductRows.test.ts` (forma de la fila), `NewSale.test.tsx` (1 prueba), `SaleEdit.test.tsx` (4 pruebas) y `tests/seed/seed.idempotent.test.ts` (72 productos, todos activos).

Resultado:
- `npm run typecheck`: sin errores.
- `npm test`: 547/547 (528 anteriores + 19 nuevas).
- `npm run test:emulators`: 126/126.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `scripts/seed/catalogData.ts` (nuevo) | Las 9 variedades con sus descripciones y la generación de los 72 productos |
| `scripts/seed/seedData.ts` | Usa el catálogo y reasigna los `saleProducts` de las ventas de ejemplo |
| `src/products/catalog.ts` (nuevo) y `src/products/index.ts` | Agrupa por variedad en el orden del catálogo (por id) |
| `src/sales/saleProductRows.ts` | La fila gana `variety` (solo de pantalla) |
| `src/sales/SaleProductsField.tsx` | Los dos selectores |
| `src/sales/SaleEditForm.tsx` | Precarga la variedad (una línea) |
| `src/styles.css` | Fila de producto en dos líneas |
| `README.md` (raíz) | "72 productos (catálogo oficial)" (único cambio en ese archivo) |
| `tests/…` | Las pruebas listadas arriba |
| `docs/evidencia/PRODUCTOS/` (nuevo) | Esta evidencia |

**No se tocó:** el sitio público, las reglas de Firestore, los tipos ni `sortProducts`.
