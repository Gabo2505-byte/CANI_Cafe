# Evidencia HU-313: Marcar una posible venta como ganada

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-19

> Como administrador quiero marcar como ganada una posible venta que se concretó
> para que el contacto quede registrado como cliente.

## Datos de prueba

- Ambiente: Firebase Emulator Suite, proyecto `demo-cani-crm`, datos de `npm run seed`, usuario `admin`.
- Recorrido automático en Microsoft Edge (headless, 1366 × 768). Detalle en [recorrido.json](recorrido.json).
- Tres contactos con tres clasificaciones distintas: **Elena** (persona interesada, `sale-006`), **Bruno** (cliente, `sale-001`) y **Carla** (distribuidora, `sale-002`).

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | Al elegir "Venta ganada" en la ventana "Cambiar etapa", el sistema pregunta "¿Confirma que esta venta fue ganada? El contacto pasará a ser cliente y la venta ya no podrá cambiar de etapa.". | ✅ Cumple | [02](02-pregunta-venta-ganada.png): la pregunta aparece con el texto literal, dentro de la misma ventana, en un recuadro verde. El botón pasa de "Guardar" a "Aceptar". Con las demás etapas la pregunta no aparece. |
| 2 | Al aceptar, la posible venta pasa a "Venta ganada". Si el contacto era "Persona interesada", pasa a ser "Cliente" y aparece "Venta ganada. [Nombre] ahora es cliente.". | ✅ Cumple | Elena: la venta pasa a "Venta ganada" y aparece "Venta ganada. Elena Muestra Castro ahora es cliente." ([03](03-venta-ganada-y-cliente.png)). Su ficha cambia de "Persona interesada" ([01](01-ficha-antes-persona-interesada.png)) a "Cliente" ([04](04-ficha-despues-cliente.png)). En Firestore: `classification: cliente` y el registro nuevo en el historial. Todo se guarda en una sola operación atómica. |
| 3 | Si el contacto ya era cliente, sigue siendo cliente y aparece "Venta ganada correctamente.". | ✅ Cumple | Bruno ([05](05-venta-ganada-ya-era-cliente.png)): "Venta ganada correctamente.", sigue como cliente y su contacto no se modifica. |
| 4 | Una posible venta ganada ya no puede cambiar de etapa, por lo que el botón "Cambiar etapa" deja de aparecer. | ✅ Cumple | Tras ganar, el detalle solo muestra "Editar" (que en una ganada solo cambia las notas, HU-309). La base también lo impide: desde "Venta ganada" ningún cambio de etapa se acepta (prueba contra emulador). En el tablero pasa a la columna "Venta ganada" ([06](06-tablero-ventas-ganadas.png)). |
| 5 | Al dar clic en "Cancelar", no cambia nada. | ✅ Cumple | Cancelar cierra la ventana; la etapa sigue "Nuevo interesado", el contacto sigue "persona_interesada" y el historial conserva su único registro. |

## Escritura sobre `contacts` (archivo de Gabriel)

Es la única escritura acordada sobre su colección y se hace con su OK expreso:

- Solo se cambia el campo `classification`, y solo de "Persona interesada" a "Cliente". No se toca ningún otro campo del contacto (se comprueba en pruebas).
- Va en la misma transacción que el cambio de etapa y el historial: si algo falla, no se guarda nada (ni la venta ni el contacto). Si la etapa ya había cambiado en otra pestaña, no se escribe nada.
- Gabriel debe revisarlo: está en `changeSaleStageIn` (`src/sales/salesRepository.ts`). Las reglas de Firestore ya permiten escribir `contacts` a usuarios activos; no se cambiaron.

## Decisiones y puntos por confirmar

- **Distribuidor y "Otro" no cambian de clasificación.** El documento solo cubre "Persona interesada" y "Cliente". Carla (distribuidora) queda como distribuidora y ve "Venta ganada correctamente.". Por confirmar con Dylan o el cliente si quieren que también pasen a cliente.
- **[Nombre]** es el nombre completo del contacto, tomado del propio contacto (no copiado en la venta).
- **Si el contacto ya no existe**, la venta se gana igual, sin conversión y con "Venta ganada correctamente.".
- **Con esta historia "Venta ganada" y "Venta perdida" ya son elegibles** en la ventana; se quitó el texto provisional "Marcar una posible venta como ganada estará disponible pronto.".
- Una venta ganada sigue apareciendo en el tablero durante 30 días (HU-305).

## Nota sobre el recorrido en navegador

Cada carga completa de página deja abiertas conexiones largas del emulador (HTTP/1.1, máximo 6 por servidor en el navegador). Al recargar muchas veces seguidas, las siguientes peticiones esperaban hasta ~50 s. No ocurre al navegar dentro de la aplicación ni en producción (HTTP/2): se confirmó midiendo las peticiones pendientes y con un experimento sin navegador, donde ganar una venta tarda 126 ms. El recorrido abre una pestaña nueva por página para evitarlo.

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores.
- `npm test`: 456/456 (444 anteriores + 12 nuevas entre unitarias y de pantalla).
- `npm run test:emulators`: 108/108 (98 anteriores + 10 nuevas).
