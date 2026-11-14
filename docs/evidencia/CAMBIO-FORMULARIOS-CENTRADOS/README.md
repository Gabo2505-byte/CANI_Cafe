# Evidencia: formularios de pantalla completa centrados

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-11-14 · **Rama:** `dylan-formularios-centrados` (commit `1ee7db7`)

## Decisión

Los formularios de pantalla completa del sistema interno quedaban pegados al borde izquierdo de la pantalla, con una columna vacía a la derecha. Ahora quedan **centrados en horizontal**, con el mismo ancho de siempre (600 px). Es un cambio solo de estilo: no cambia ningún texto, campo, regla ni comportamiento.

| Pantalla | Archivo | Antes | Ahora |
|---|---|---|---|
| Nueva oportunidad | `src/sales/NewSalePage.tsx` | Pegado a la izquierda | Centrado |
| Editar oportunidad | `src/sales/SaleEditForm.tsx` (dentro de `SaleDetailPage.tsx`) | Pegado a la izquierda | Centrado |
| Nuevo contacto (Gabriel) | `src/contacts/NewContactPage.tsx` | Pegado a la izquierda | Centrado |
| Editar contacto (Gabriel) | `src/contacts/EditContactPage.tsx` | Pegado a la izquierda | Centrado |

**No cambian:** las ventanas (`.dialog`), el ingreso y recuperación de contraseña (`.login`), el tablero, el detalle de la venta sin editar y la ficha del contacto. Ningún archivo `.tsx` se tocó.

## Qué cambió en `src/styles.css` (12 líneas añadidas)

1. `.page > .form` conserva `max-width: 600px` y suma `margin-inline: auto`.
2. Regla nueva `.page:has(> .form)`: lo que va encima del formulario se alinea a la misma columna de 600 px (el título `h1` en las cuatro pantallas y, en Editar oportunidad, también el enlace "← Volver a gestión de ventas", el encabezado y el nombre del contacto).
3. Como la regla usa `:has(> .form)`, solo se aplica a las pantallas que tienen un formulario directamente debajo. En el detalle de la venta sin editar no entra.
4. En pantallas angostas el `max-width` no limita: el formulario ocupa el ancho disponible, como antes.

## Capturas (datos del seed, usuario `admin`, Microsoft Edge)

Escritorio a 1280 × 800 y móvil a 390 × 844. Todas muestran el inicio de la pantalla.

| Captura | Qué se ve |
|---|---|
| [01](01-escritorio-nueva-oportunidad.png) | Escritorio: Nueva oportunidad, formulario centrado con su título |
| [02](02-escritorio-editar-oportunidad.png) | Escritorio: Editar oportunidad; el enlace de regreso, el título, el contacto y el formulario comparten la misma columna |
| [03](03-escritorio-nuevo-contacto.png) | Escritorio: Nuevo contacto |
| [04](04-escritorio-editar-contacto.png) | Escritorio: Editar contacto |
| [05](05-escritorio-detalle-venta-sin-editar.png) | Escritorio: detalle de una venta sin editar. **No cambió**: sigue alineado a la izquierda, con su panel de 960 px |
| [06](06-movil-nueva-oportunidad.png) | Móvil: Nueva oportunidad |
| [07](07-movil-editar-oportunidad.png) | Móvil: Editar oportunidad |
| [08](08-movil-nuevo-contacto.png) | Móvil: Nuevo contacto |
| [09](09-movil-editar-contacto.png) | Móvil: Editar contacto |
| [10](10-movil-detalle-venta-sin-editar.png) | Móvil: detalle de una venta sin editar (sin cambios) |

**Medidas tomadas en el navegador real:** están en [verificacion.json](verificacion.json).

- **Escritorio (1280 px):** en las cuatro pantallas con formulario, el formulario y el título miden 600 px y empiezan en el mismo punto: 333 px en Nueva y Editar oportunidad, 340 px en Nuevo y Editar contacto. La diferencia de 7 px es el ancho de la barra de desplazamiento, que solo aparece en las pantallas más largas. En Editar oportunidad, el enlace de regreso y el encabezado miden 600 px y empiezan también en 333 px.
- **Móvil (390 px):** el formulario y lo que va encima miden 295 px (el ancho disponible menos el relleno de 40 px de cada lado de la página, que no cambió). Ninguna pantalla se desborda en horizontal (`desbordaHorizontal: false` en las diez capturas).
- **Detalle sin editar:** en escritorio el título empieza en 40 px y el panel y el encabezado miden 960 px, igual que antes. No hay formulario, así que la regla nueva no aplica.

## Observaciones fuera de este cambio

Se vieron al preparar las capturas en móvil, pero no las causa este commit porque sus reglas no tocan esos elementos. No se corrigieron aquí. El sistema es solo de escritorio (≥ 1366 × 768).

- **Móvil, detalle de la venta (captura 10):** el título queda muy angosto (31 px) porque comparte la fila con los botones "Cambiar etapa" y "Editar". Viene de la regla `.detail-back + .page-header` (`flex-wrap: nowrap`).
- **Móvil, Editar oportunidad, más abajo del inicio (no sale en las capturas):** en la fila de producto, el selector de presentación sobresale del recuadro "Productos".

## Pruebas

- `npm run typecheck`: sin errores.
- `npm test`: 869/869 (en la tercera corrida; en la primera falló 1 de 869 y no se repitió).
- `npm run build`: el JS es idéntico byte a byte; solo cambia el CSS (`index-DdFCa-bS.css` → `index-0_39pxCc.css`) y, con él, el nombre del JS (`index-Bhw56y26.js` → `index-BsQtlET0.js`).
- No hay pruebas automáticas del centrado: las pruebas de componentes no cargan el CSS. Por eso esta evidencia se tomó en el navegador.
