# Evidencia HU-305: Ver el tablero de posibles ventas

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-14

> Como administrador quiero ver las posibles ventas agrupadas por etapa
> para que identifique de un vistazo cómo avanza el proceso de ventas.

## Estado: parcial

Dos partes dependen de historias posteriores:

- **Campana roja de aviso (criterio 3):** la tarjeta ya sabe mostrarla (`hasAlert`), pero los avisos se calculan en HU-314 y HU-315. Se conecta al cerrarlas.
- **Detalle de la posible venta (criterio 5):** la tarjeta lleva a `/posibles-ventas/:saleId`, que hoy es una página provisional. El detalle real es HU-308.

## Datos de prueba

- Ambiente: Firebase Emulator Suite, proyecto `demo-cani-crm`, datos de `npm run seed`, usuario `admin`.
- El seed ahora tiene 6 ventas: una por etapa (ganada y perdida recientes), una **ganada hace más de 30 días** (20/08/2026, no debe verse) y una sin seguimiento ni productos.
- Recorrido automático en Microsoft Edge (headless, 1366 × 768). Detalle en [recorrido.json](recorrido.json).

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | Seis columnas: Nuevo interesado, Contactado, Precio o cotización enviada, En negociación, Venta ganada y Venta perdida. | ✅ Cumple | [01](01-tablero.png). Siempre aparecen las seis, en ese orden, aunque no haya ventas. A 1366 px miden 210 px cada una y no hay desplazamiento horizontal. |
| 2 | Cada columna indica cuántas posibles ventas tiene y la suma de sus montos: "En negociación · 4 · ₡ 820 000". | ✅ Cumple | Con el seed: "Precio o cotización enviada · 1 · ₡ 1 200 000", "En negociación · 1 · ₡ 450 000", etc. Prueba de pantalla con dos ventas: "En negociación · 2 · ₡ 820 000". Un monto de ₡ 0 cuenta como venta y suma cero. |
| 3 | Tarjeta con nombre del contacto, título, monto y fecha del próximo seguimiento (o "Sin seguimiento programado"); campana roja si hay aviso. | ⚠️ Parcial | Contacto, título, monto y seguimiento (dd/mm/aaaa, ej. "Seguimiento: 12/10/2026") ✅. El nombre sale del contacto por su id, no copiado. "Sin seguimiento programado" ✅. Campana: se muestra cuando `hasAlert` es verdadero (prueba de componente); se conecta en HU-314/315. |
| 4 | Ganada y perdida solo muestran las que llegaron a esa etapa en los últimos 30 días. | ✅ Cumple | En el navegador: la ganada del 20/08 no aparece y la de octubre sí. Pruebas: a 29 días se ve, a 31 no; las ventas ocultas tampoco cuentan en el encabezado. Se filtra con `stageChangedAt` en la consulta (índice nuevo `stage` + `stageChangedAt`). |
| 5 | Columna sin ventas: "Sin posibles ventas."; al dar clic en una tarjeta se abre su detalle. | ⚠️ Parcial | "Sin posibles ventas." ✅ ([01](01-tablero.png), columna Contactado). El clic abre `/posibles-ventas/sale-006` ✅ ([02](02-detalle-provisional.png)), pero la pantalla es provisional hasta HU-308. |

## Cierra HU-301 criterio 4

Una venta creada desde el formulario aparece en la columna de su etapa, con el mensaje "Posible venta registrada correctamente." ([03](03-venta-nueva-en-su-columna.png)): "Contactado · 1 · ₡ 350 000".

## Decisiones

- **Orden dentro de la columna:** la más nueva primero. Ordenar por seguimiento es HU-306 (fuera de alcance).
- **Dos consultas:** las abiertas (`stage in` las cuatro etapas) y las cerradas recientes. La segunda necesita el índice compuesto agregado a `firestore.indexes.json`.
- **Nombre del contacto** se consulta aparte, de a 30 ids por consulta (límite de Firestore). Si el contacto no existe, la tarjeta muestra "—".
- **Mensajes sin literal en el PDF:** "Cargando posibles ventas…" y "No se pudieron cargar las posibles ventas. Intente de nuevo." (patrón de la lista de contactos de Gabriel).
- **Monto del encabezado** en una sola línea (no se parte "₡ 450 / 000").
- **Fecha de "hoy"** fija al abrir la pantalla, para que el corte de 30 días no cambie mientras se mira.

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores.
- `npm test`: 269/269 (248 anteriores + 21 nuevas).
- `npm run test:emulators`: 47/47 (42 anteriores + 5 nuevas).
