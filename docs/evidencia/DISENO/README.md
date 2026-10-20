# Evidencia: rediseño visual del sistema interno

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-20 · **Rama:** `dylan-diseno`

> Rediseño visual de todo el sistema interno a partir de la única pantalla aprobada por el cliente (el tablero
> "Posibles ventas"), extrapolando su estilo al resto de pantallas. Tema oscuro espresso con acento dorado, títulos en
> serif y mayúsculas, y el logo oficial de CANI Café.

## Alcance y reglas

- **Solo cambios visuales:** estilos, fuentes, logo y el marcado mínimo para el diseño. No cambian la lógica, las rutas, los datos, el seed, las reglas ni los índices de Firestore, los tipos ni los textos literales de los criterios de aceptación.
- **Mayúsculas con CSS:** se ponen con `text-transform`, así que el texto real no cambia y los nombres accesibles siguen siendo los mismos.
- **Solo escritorio** (≥ 1366 × 768). Se respetan las reglas de formato del proyecto: errores en rojo bajo el campo, franja verde de 5 s, fechas dd/mm/aaaa y montos "₡ 150 000".
- **Fuera del MVP (no implementado):**
  - "Cambiar contraseña" (HU-109).
  - Buscador y filtros del tablero (HU-306 y HU-307).
  - Contador junto a "Contactos" (HU-504).
  - "Ganada al" y "Perdida al" en las tarjetas.

## Sistema de diseño

- **Tokens:** un solo bloque al inicio de `src/styles.css` (archivo único, ordenado por secciones comentadas). Fuera de ese bloque no queda ningún color fijo.

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | #1A110C | Fondo |
| `--color-surface` | #241911 | Columnas, paneles, diálogos |
| `--color-surface-raised` | #2E2118 | Tarjetas y campos |
| `--color-border` / `--color-border-strong` | #4A3829 / #856F57 | Borde decorativo / borde de campos (≥ 3:1) |
| `--color-text` / `-secondary` / `-muted` / `-disabled` | #F3E9DA / #B8A58F / #A08F7A / #8F7E6B | Textos |
| `--color-accent` (+ `-hover`) | #D4A762 (#E2B97A) | Acción principal, estado activo, montos |
| `--color-danger` (+ `-hover`) | #E8705F (#EF8A7B) | Errores, seguimiento vencido, peligro |
| `--color-warning` / `--color-attention` | #E9A23B / #F2D04D | Seguimiento para hoy / sin comunicación |
| `--color-success` / `--color-success-bg` / `--color-success-text` | #8DB58A / #1F3A24 / #CFE8CC | Ganada, cliente, franja verde |
| `--color-lost` | #9A8873 | Venta perdida (atenuada, sin opacity) |
| `--color-count` | #C62828 | Círculo de avisos (número blanco) |

- **Tipografía:** Cormorant Garamond 600/700 para títulos, solo desde unos 24 px, e Inter 400–700 para el cuerpo. Ambas se instalan con `@fontsource` (subconjuntos latin y latin-ext), así que funcionan sin internet. Se verificó que "₡" se dibuja con Inter.
- **Radios:** 4, 6 y 8 px, y forma de píldora en etiquetas.
- **Espacios:** escala de 4 px.
- **Foco:** anillo dorado de 2 px.
- **Controles nativos:** `color-scheme: dark`, para que selects, fechas y barras de desplazamiento sigan el tema.
- **Botones:**
  - Principal: dorado con texto oscuro.
  - Secundario: con borde claro; lo usan Cancelar, la paginación, Ver más y Quitar.
  - Peligro: rojo con texto oscuro.
  - Deshabilitado: atenuado.
- **Logo oficial:** `src/shared/ui/Logo.tsx`, con las piezas de `src/assets/` y el favicon de `public/`.
  - **Procesamiento:** a partir del archivo del cliente. Se quitaron el fondo blanco y el halo gris, y se colorearon las piezas: escudo dorado, nombre crema y frase dorada.
  - **Barra:** escudo y nombre.
  - **Ingreso:** escudo, nombre y frase.
  - **Accesibilidad:** las imágenes son decorativas (`alt=""`) y el nombre accesible sigue siendo exactamente "CANI Café".

## Contrastes

[contrastes.md](contrastes.md) se genera con `node docs/evidencia/DISENO/contrastes.mjs`, que lee los tokens de `src/styles.css`. Mide 52 pares y todos cumplen su mínimo (texto ≥ 4.5:1; texto grande y componentes ≥ 3:1). Solo hay dos pares exentos, por ser un control deshabilitado y un borde decorativo.

## Capturas (1366 × 768, Microsoft Edge)

| Carpeta | Contenido |
|---|---|
| [antes/](antes/) | Todas las pantallas antes del rediseño |
| [regresion-final/](regresion-final/) | Todas esas mismas pantallas con el estilo definitivo: ingreso, tablero (con zoom de "₡" en ganada y perdida), contactos, nuevo contacto con errores, foco con teclado, confirmación de descarte, ficha con pestañas, diálogo "Registrar comunicación", nueva venta, detalle, "Cambiar etapa", edición y avisos |
| [despues-fase3/](despues-fase3/) | Nueva posible venta (vacía, con errores, lista de contactos, productos con "Quitar", desde la ficha), detalle, edición con errores, "Cambiar etapa" (perdida, ganada, desde perdida), venta perdida y ganada, franja verde, no encontrado, avisos con los tres colores y vacío, y estados de carga |
| [logo/](logo/) | Logo oficial: barra e ingreso a 1× y 2×, zooms de las piezas procesadas sobre el fondo oscuro (sin halo), favicon y nombres accesibles (`verificacion.json`). No incluye el archivo original del cliente |
| [ajuste-botones-detalle/](ajuste-botones-detalle/) | Antes y después de alinear "Cambiar etapa" y "Editar" con el borde derecho del contenido (960 px) |

## Verificaciones hechas

- **Encabezado de columna:** su nombre accesible sigue siendo, por ejemplo, "En negociación · 3 · ₡ 1 450 000". El " · " va como texto suelto entre dos `<span>` y se oculta con `font-size: 0`; está comentado en el CSS como "NO BORRAR".
- **Columnas del tablero:** tienen la misma altura, las tarjetas empiezan en la misma fila (subgrid) y no hay desplazamiento vertical a 1366 × 768.
- **Fecha de seguimiento vencida en rojo:** reutiliza el aviso "Seguimiento vencido" de HU-314, sin tocar su lógica. Tiene una prueba nueva con dos casos en `tests/components/SalesBoard.test.tsx`.
- **"Ingrese el nombre completo." en Nuevo contacto:** no desaparece al escribir el nombre y salir del campo; solo al volver a pulsar "Guardar". El error sigue en el DOM con todas las hojas de estilo desactivadas, así que es comportamiento de la lógica existente (los errores se calculan al enviar), no del CSS. No se modificó.
- **Botones del detalle de la venta:** "Cambiar etapa" y "Editar" se alinean con el borde derecho del panel y del historial (960 px). Una comparación píxel a píxel de todas las pantallas antes y después del ajuste muestra que solo cambian las del detalle; en ellas, los títulos largos pasan a dos líneas porque ya no comparten fila con los botones a todo el ancho.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/styles.css` | Tokens al inicio y todas las secciones reescritas con ellos (archivo único) |
| `src/main.tsx` | Importa las fuentes de `@fontsource` |
| `package.json`, `package-lock.json` | `@fontsource/inter` y `@fontsource/cormorant-garamond` |
| `index.html` | Favicon |
| `src/shared/ui/Logo.tsx` (nuevo) | Componente del logo (barra e ingreso) |
| `src/assets/logo-cani-escudo.png`, `logo-cani-nombre.png`, `logo-cani-frase.png` (nuevos) | Piezas del logo oficial |
| `public/favicon.ico`, `public/favicon.png` (nuevos) | Favicon con el escudo dorado |
| `src/app/TopBar.tsx` (Gabriel) | Usa `Logo` en lugar del texto "CANI Café" |
| `src/auth/LoginPage.tsx` (Gabriel) | Usa `Logo` en lugar de `<h1>CANI Café</h1>` (el h1 sigue dentro de Logo) |
| `src/sales/SalesBoardPage.tsx` | Clase por etapa en cada columna, `<span>` en el encabezado, fecha vencida desde los avisos |
| `src/sales/SaleCard.tsx` | Campana en SVG (mismo nombre accesible) y clase `is-overdue` |
| `src/sales/AlertsPage.tsx` | Clase `empty-state` en "No hay avisos pendientes." |
| `tests/components/SalesBoard.test.tsx` | Dos casos nuevos (fecha vencida en rojo / ganada sin rojo); sin cambios en los existentes |
| `docs/evidencia/DISENO/` (nuevo) | Esta evidencia, capturas y el script de contrastes |

## Pruebas automatizadas

- `npm run typecheck`: sin errores.
- `npm test`: 526/526 (524 anteriores + 2 nuevas).
- `npm run test:emulators`: 126/126.

## Pendientes fuera del rediseño

- **Formato de fecha en Contactos y la ficha:** muestran fechas como "1 sept 2026" (`formatDateCR`), y los requisitos piden dd/mm/aaaa.
- **Campo de fecha:** el selector nativo de fecha muestra el formato del idioma del navegador (por ejemplo "20 oct 2026").
- **Logo del cliente:** falta el original en SVG o PNG transparente, para reemplazar las piezas procesadas.
