# Evidencia: cambio de etiquetas "Gestión de ventas" y "+ Nuevo registro"

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-20 · **Rama:** `dylan-etiquetas`

## Decisión

Por el feedback del mentor, el equipo decidió renombrar la pantalla y el botón de las posibles ventas. Es un **cambio de requisitos**: estas etiquetas prevalecen sobre las del documento de requisitos y se registrarán como cambio en la próxima entrega.

| Dónde | Antes (documento de requisitos) | Ahora |
|---|---|---|
| Opción de la barra superior | "Posibles ventas" | "Gestión de ventas" (en mayúsculas por CSS) |
| Título de la pantalla del tablero | "Posibles ventas" | "Gestión de ventas" |
| Botón del tablero y de la pestaña de la ficha del contacto | "Nueva posible venta" | "+ Nuevo registro" (el "+" es decorativo; el nombre accesible es exactamente "Nuevo registro") |
| Título de la pantalla del formulario | "Nueva posible venta" | "Nuevo registro" |
| Enlace de regreso del detalle y del formulario | "← Volver a posibles ventas" / "Volver a Posibles ventas" | "← Volver a gestión de ventas" |

**No cambian:**
- Los demás textos con "posible venta": mensajes como "Posible venta registrada correctamente." o "Sin posibles ventas.".
- La pestaña "Posibles ventas (n)" de la ficha.
- Las columnas "Posible venta" y el campo "Posible venta" de las comunicaciones.
- Las rutas y URL (`/posibles-ventas`, `/posibles-ventas/nueva`, …).

## Criterios afectados

| HU | Criterio | Texto del documento | Cómo queda |
|---|---|---|---|
| HU-103 | 2 | La barra muestra … "Posibles ventas" y "Avisos" … | La opción se llama "Gestión de ventas" |
| HU-301 | 1 | El botón "Nueva posible venta" está arriba a la derecha en la pantalla "Posibles ventas" y en la pestaña "Posibles ventas" de la ficha | El botón es "+ Nuevo registro", en la pantalla "Gestión de ventas" y en la pestaña "Posibles ventas" (que no cambia) |
| HU-305 | 1 | La pantalla "Posibles ventas" muestra seis columnas… | La pantalla se llama "Gestión de ventas"; "Sin posibles ventas." (criterio 5) no cambia |
| HU-308 | 1 | El detalle muestra arriba el enlace "← Volver a posibles ventas"… | El enlace es "← Volver a gestión de ventas" |

## Capturas (1366 × 768, Microsoft Edge, datos del seed)

| Captura | Qué se ve |
|---|---|
| [01-barra](01-barra.png) | Barra superior con "GESTIÓN DE VENTAS" activa |
| [02-tablero](02-tablero.png) | Título "GESTIÓN DE VENTAS" y botón "+ Nuevo registro" |
| [03-boton-nuevo-registro-zoom](03-boton-nuevo-registro-zoom.png) | El botón ampliado (3×) |
| [04-formulario-nuevo-registro](04-formulario-nuevo-registro.png) | Pantalla del formulario con el título "NUEVO REGISTRO" |
| [05-ficha-pestana-posibles-ventas](05-ficha-pestana-posibles-ventas.png) | Ficha del contacto: la pestaña sigue siendo "Posibles ventas (3)" y el botón es "+ Nuevo registro" |
| [06-detalle-enlace-volver](06-detalle-enlace-volver.png) | Detalle de una venta con el enlace "← Volver a gestión de ventas" |

**Nombres accesibles en el navegador real:** están en [verificacion.json](verificacion.json).
- El botón se llama exactamente "Nuevo registro", tanto en el tablero como en la ficha. Su "+" tiene `aria-hidden="true"`.
- Las opciones de la barra son "Contactos", "Gestión de ventas" y "Avisos".
- El enlace "← Volver a gestión de ventas" lleva a `/posibles-ventas`.

## Implementación

- **Etiquetas centralizadas:** están en `src/shared/constants/labels.ts` (`NAV_LABELS` y `SALES_LABELS`). Las pruebas mantienen los textos literales a propósito, para que un cambio accidental de una constante haga fallar las pruebas.
- **El "+" decorativo:** va en un `<span aria-hidden="true">` (componente `AddButtonLabel`), no en un `::before` de CSS, porque los navegadores incluyen el contenido de `::before` en el nombre accesible.
- **`SALE_MESSAGES.newSale` se eliminó.** Sus usos pasan a `SALES_LABELS`.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/shared/constants/labels.ts` (nuevo) | `NAV_LABELS` y `SALES_LABELS` |
| `src/shared/ui/AddButtonLabel.tsx` (nuevo) | "+" decorativo con `aria-hidden` |
| `src/app/TopBar.tsx` (Gabriel) | Las tres opciones de la barra salen de `NAV_LABELS` |
| `src/contacts/ContactDetailPage.tsx` (Gabriel) | Botón "+ Nuevo registro" en la pestaña de ventas |
| `src/sales/SalesBoardPage.tsx` | Título "Gestión de ventas" y botón "+ Nuevo registro" |
| `src/sales/NewSalePage.tsx` | Título "Nuevo registro" y enlace "← Volver a gestión de ventas" |
| `src/sales/saleDetail.ts` | Enlace de regreso del detalle desde `SALES_LABELS` |
| `src/sales/saleForm.ts` | Se elimina `SALE_MESSAGES.newSale` |
| `src/styles.css` | Espacio del "+" (`.button-plus`) |
| `tests/components/TopBar.test.tsx` (Gabriel), `Logout.test.tsx` (Gabriel), `Alerts.test.tsx`, `NewSale.test.tsx`, `SalesBoard.test.tsx`, `SaleDetail.test.tsx`, `ContactNewSaleButton.test.tsx` | Textos nuevos y dos casos nuevos del botón |
| `docs/evidencia/CAMBIO-ETIQUETAS/` (nuevo) | Esta evidencia |

La evidencia anterior (`docs/evidencia/HU-1xx` … `HU-3xx` y `DISENO`) no se reescribe: registra lo que se verificó en su momento con las etiquetas de entonces.

## Pruebas automatizadas

- `npm run typecheck`: sin errores.
- `npm test`: 528/528 (526 anteriores + 2 nuevas: nombre accesible exactamente "Nuevo registro" y "+" con `aria-hidden`).
- `npm run test:emulators`: 126/126 (no dependen de estos textos).
