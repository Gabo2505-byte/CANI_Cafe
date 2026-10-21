# Ajuste: "Presentación" deshabilitada del selector de dos pasos

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-20 · **Rama:** `dylan-oportunidades`

Ajuste visual y de texto sobre HU-304 (selector de producto en dos pasos, en Nueva oportunidad y en la edición). No cambia lógica ni los mensajes de error.

## Problema

Con la variedad sin elegir, el campo "Presentación" (deshabilitado) mostraba la flecha del desplegable repetida a lo ancho, en vez de una sola flecha a la derecha. Además el navegador lo atenuaba por su cuenta (`opacity: 0.7`) y el cursor era el de un campo activo.

## Causa

En `src/styles.css`, la regla `input:disabled, select:disabled, textarea:disabled` usaba el atajo `background: var(--color-surface)`. Ese atajo reescribe todas las propiedades de fondo y borra el `no-repeat`, la posición y el tamaño de la flecha propia de los `select` (medido en el navegador: `background-repeat: repeat`, posición `0% 0%`, tamaño `auto`). Afectaba a todo `select` deshabilitado de la app; solo el de presentación puede estarlo hoy en pantalla, así que no había otro afectado a la vista.

## Solución

- `background` pasa a `background-color` en esa regla (la flecha conserva su `no-repeat`, posición y tamaño).
- Estado deshabilitado natural: `opacity: 1` explícita (sin atenuar con opacity), borde suave (`--color-border`), fondo `--color-surface`, `cursor: not-allowed`; en el `select`, flecha atenuada (`#856f57`) y texto con `--color-text-muted` (5,5:1 sobre la superficie, ≥ 4,5:1). `--color-text-disabled` daba 4,4:1 y no alcanzaba. También sin cambio de borde al pasar el cursor.
- Texto de la opción vacía de la presentación: **"Primero elija una variedad"** mientras no haya variedad; al elegirla se habilita y dice **"Seleccione una presentación"**; si se borra la variedad, vuelve a la instrucción. **Sin literal en el PDF** (a confirmar con Gabriel, igual que los otros textos de las opciones vacías).
- El nombre accesible sigue siendo "Presentación del producto N" y el orden de Tab no cambia.

## Capturas (1366 × 768, Microsoft Edge, ampliadas 2×)

| Estado | Antes | Después |
|---|---|---|
| Deshabilitado | [antes-deshabilitado](antes-deshabilitado.png) | [despues-deshabilitado](despues-deshabilitado.png) |
| Habilitado (variedad "Villa Sarchí") | [antes-habilitado](antes-habilitado.png) | [despues-habilitado](despues-habilitado.png) |
| Pantalla completa, deshabilitado | [antes](antes-deshabilitado-pagina.png) | [después](despues-deshabilitado-pagina.png) |

Nota: en la captura "antes" de Edge la flecha no se ve repetida; falta por completo (con `repeat` y tamaño `auto` el SVG no se pinta como flecha). El defecto se confirma por las medidas del estilo calculado, en [antes-medidas.json](antes-medidas.json) y [despues-medidas.json](despues-medidas.json).

**Ancho:** el texto nuevo mide 196 px en un ancho útil de 229 px; "Seleccione una presentación" mide 219 px y la opción más larga del catálogo 220 px. No se corta nada.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/styles.css` | Regla de campos deshabilitados (`background-color`, `opacity`, borde, cursor) y flecha atenuada del `select` deshabilitado |
| `src/sales/SaleProductsField.tsx` | `PRODUCT_PLACEHOLDERS.presentationDisabled` y texto de la opción vacía según haya variedad |
| `tests/components/SaleProductsField.test.tsx` | Texto de la opción vacía deshabilitada y prueba nueva del ciclo de textos |

## Pruebas

- `npm run typecheck`: sin errores.
- `npm test`: 550/550 (una prueba nueva).
- `npm run test:emulators`: 126/126.
