# Evidencia: tabla de movimientos

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-11-14 · **Rama:** `dylan-tabla-movimientos`

## Decisión

El profesor pidió una **tabla de movimientos**. Hasta ahora, el historial de cambios de etapa solo se veía en el detalle de cada oportunidad ("Historial de etapas", HU-308). La tabla nueva junta en una sola pantalla los cambios de etapa de **todas** las oportunidades. Es de solo lectura.

- **Ruta:** `/posibles-ventas/movimientos`, dentro del área de ventas y protegida como las demás pantallas internas. Es una ruta fija, así que se elige antes que `/posibles-ventas/:saleId`, igual que `/posibles-ventas/nueva`.
- **Acceso:** botón "Movimientos" en el encabezado de la pantalla **Gestión de ventas**, a la izquierda de "+ Nueva oportunidad". El menú principal no cambia.
- **Columnas:** Fecha, Oportunidad, Etapa anterior, Etapa nueva y Motivo. En Oportunidad, el nombre del contacto es un enlace al detalle de la venta, y debajo va el título de la oportunidad (un contacto puede tener varias). Las columnas usan las mismas etiquetas de etapa (`SALE_STAGE_LABELS`), el mismo formato de fecha (`formatDateNumericCR`, dd/mm/aaaa en hora de Costa Rica) y el mismo motivo de pérdida (`lossReasonText`) que el historial del detalle. La entrada inicial muestra "—" como etapa anterior. El motivo solo aparece en los cambios a "Venta perdida".
- **Orden y paginación:** del cambio más reciente al más antiguo, de 25 en 25, con un botón "Cargar más".
- **Pantallas angostas:** en 600 px o menos, cada movimiento se muestra como una tarjeta de pares "columna: valor". La pantalla nunca se desplaza hacia los lados.

## Qué cambió

| Archivo | Cambio |
|---|---|
| `src/sales/movements.ts` | Nuevo. Funciones puras: `buildMovementRows()` arma las filas (orden, guion de la entrada inicial, motivo solo en pérdidas, "—" si la venta o el contacto ya no existen), `MOVEMENTS_MESSAGES` y `MOVEMENTS_PAGE_SIZE = 25`. |
| `src/sales/movementsRepository.ts` | Nuevo. `listStageHistoryPageIn()` consulta `stageHistory` con `orderBy('changedAt', 'desc')`, `startAfter(último documento)` y `limit(25 + 1)`. `getSaleSummariesIn()` trae las ventas en lotes con `documentId() in` (hasta 30 por consulta). `createMovementsLoaderIn()` es el cargador, que guarda en memoria las ventas y los contactos ya leídos. |
| `src/sales/movementsApi.ts` | Nuevo. Conecta el cargador con la instancia de Firestore de la aplicación; en las pruebas de pantalla se reemplaza por uno simulado. |
| `src/sales/MovementsPage.tsx` | Nueva pantalla con sus estados de carga, vacío, error, tabla y "Cargar más" (que también tiene su propio error y se puede reintentar). |
| `src/sales/SalesBoardPage.tsx` | El encabezado agrupa los botones en `.page-header-actions` y agrega "Movimientos" (`button-secondary`). El tablero no cambia en nada más. |
| `src/shared/constants/labels.ts` | `SALES_LABELS.movements = 'Movimientos'`. |
| `src/app/routes.ts`, `src/app/AppRoutes.tsx` | Ruta `ROUTES.movements` dentro de `ProtectedRoute`. |
| `src/styles.css` | Estilos de `.movements-page` y `.movements-table`, con la vista de tarjetas a 600 px o menos. |

**No cambian:** el cambio de etapa, el mapa de transiciones, el tablero (columnas, tarjetas, avisos), la creación de oportunidades, `contacts`, `communications`, `formRequests`, `firestore.rules` y `firestore.indexes.json`.

### Consulta e índices

La consulta ordena por un solo campo (`changedAt`) y no tiene `where`, así que le basta el índice simple que Firestore crea solo. No hace falta un índice compuesto. Las ventas y los contactos se buscan por id con `documentId() in`, que tampoco necesita índice. Las reglas ya permitían leer `stageHistory`, `sales` y `contacts` con una sesión activa.

### Lecturas por página

Firestore cobra una lectura por cada documento que devuelve y una lectura mínima por cada consulta que no devuelve nada.

| Consulta | Lecturas |
|---|---|
| `stageHistory` | Hasta 26: los 25 de la página más 1 para saber si hay otra. |
| `sales` | Una por cada venta de la página que no esté ya en memoria: de 0 a 25. Va en consultas de hasta 30 ids. |
| `contacts` | Una por cada contacto de esas ventas que no esté ya en memoria: de 0 a 25. |

- **Peor caso:** 76 lecturas por página, cuando las 25 filas son de ventas y contactos distintos que todavía no se habían leído.
- **"Cargar más":** no vuelve a leer las ventas ni los contactos que ya se leyeron. La memoria dura mientras la pantalla está abierta; al volver a entrar, se lee de nuevo.
- **Con el seed** (20 registros, 6 ventas y 4 contactos): la pantalla se llena en una sola página con 20 + 6 + 4 = **30 lecturas**.

## Textos nuevos de la interfaz

| Texto | Dónde |
|---|---|
| Movimientos | Botón del encabezado de Gestión de ventas y título de la pantalla |
| Oportunidad | Encabezado de columna |
| No hay movimientos registrados. | Pantalla sin datos |
| No se pudieron cargar los movimientos. Intente de nuevo. | Error al cargar (en rojo) |
| Cargar más | Botón de la página siguiente |
| No se pudieron cargar más movimientos. Intente de nuevo. | Error al cargar la página siguiente (en rojo) |

**Se reutilizan:** "Fecha", "Etapa anterior", "Etapa nueva", "Motivo", "—", "Cargando…", "Sin motivo registrado" y "← Volver a gestión de ventas".

## Criterios afectados

Ninguno cambia. Es una pantalla nueva, de solo lectura, que no reemplaza al "Historial de etapas" del detalle (HU-308). Ese historial sigue igual.

## Pruebas

- `npm run typecheck`: sin errores.
- `npm test`: 937/937 (918 anteriores + 19 nuevas).
- `npm run test:emulators`: 267/267 (258 anteriores + 9 nuevas).
- Recorrido en Microsoft Edge headless, contra los emuladores con `npm run seed`, usuario `admin`:
  - el botón "Movimientos" aparece primero en el encabezado del tablero;
  - abre `/posibles-ventas/movimientos` con las 20 filas y sin "Cargar más";
  - la primera fila es la más reciente (10/10/2026) y la última es una entrada inicial con "—";
  - el enlace abre el detalle de la venta;
  - no hay desplazamiento horizontal ni a 1366 × 768 ni a 375, 390 y 600 px de ancho.

  Sin capturas por ahora.

| Archivo | Pruebas | Qué prueba |
|---|---|---|
| `tests/unit/movements.test.ts` | 8 | Orden del más reciente al más antiguo, mezclando ventas y sin modificar la lista original. Con la misma fecha se conserva el orden de la consulta. La entrada inicial muestra "—". Las etiquetas de etapa son las de la aplicación. El motivo solo aparece en pérdidas, y es "Sin motivo registrado" si está vacío. Si la venta o el contacto no existen, se muestra "—" y no hay enlace. Sin datos no hay filas. |
| `tests/components/Movements.test.tsx` | 11 | Carga, columnas y filas, enlace al detalle, fila sin enlace, vacío, error en rojo, "Cargar más" (usa el cursor, queda deshabilitado mientras carga, agrega las filas y desaparece al final), error de "Cargar más" con reintento, enlace de regreso, botón "Movimientos" en el encabezado del tablero, y que la ruta no se confunde con el detalle. |
| `tests/sales/movements.emulator.test.ts` | 9 | Con los datos del seed (20 registros): orden descendente y una sola página de 25, límite y paginación 8 + 8 + 4 sin repetir ni saltarse registros, sin página vacía cuando la última queda justa (10 + 10), campos del contrato, que no se puede leer sin sesión, filas con el contacto y el título correctos, memoria entre páginas (una venta borrada después de la primera página se sigue mostrando, y un cargador nuevo sí la vuelve a leer) y lotes con más de 30 ventas distintas en una sola página. |
