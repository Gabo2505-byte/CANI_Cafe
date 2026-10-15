# Evidencia HU-301: Crear una posible venta

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-14

> Como administrador quiero crear una posible venta para un contacto
> para que pueda darle seguimiento.

## Estado: parcial

Solo falta una parte, que depende de Gabriel:

- **Criterio 1 (botón en la ficha):** la pestaña "Posibles ventas" de la ficha es de Gabriel (HU-208) y aún no existe. La ruta `/posibles-ventas/nueva?contactId=...` ya está lista para que su botón la use.

## Datos de prueba

- Ambiente: Firebase Emulator Suite, proyecto `demo-cani-crm`, datos del seed, usuario `admin`.
- Recorrido automático en Microsoft Edge (headless, 1366 × 768). Detalle en [recorrido.json](recorrido.json).
- El recorrido crea dos posibles ventas ficticias para "Bruno Ficticio Solís" (`contact-002`) y revisa en Firestore lo que quedó guardado.

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | Botón "Nueva posible venta" arriba a la derecha en "Posibles ventas" y en la pestaña "Posibles ventas" de la ficha. | ⚠️ Parcial | En "Posibles ventas": ✅ [01](01-posibles-ventas-boton.png), a 24 px del borde derecho y arriba. En la ficha: ⏳ pendiente (la pestaña es de Gabriel). La ruta ya acepta `?contactId=` para abrirlo con el contacto fijo ([09](09-contacto-fijo.png)). |
| 2 | El formulario tiene siete datos: contacto, título, etapa, monto estimado, productos, seguimiento y notas. | ✅ Cumple | [02](02-formulario.png). Etiquetas: Contacto, Título, Etapa, Monto estimado (₡), Fecha del próximo seguimiento, Notas, Productos. |
| 3 | Obligatorios: contacto, título, etapa y monto. Opcionales: productos, seguimiento y notas. | ✅ Cumple | Obligatorios marcados con asterisco. Guardar vacío: "Seleccione un contacto.", "Ingrese el título.", "Ingrese un monto válido." ([03](03-obligatorios.png)). La etapa siempre tiene valor. Una venta con solo lo obligatorio se guarda. |
| 4 | Al guardar, la posible venta aparece en el tablero, en la columna de su etapa, con el mensaje "Posible venta registrada correctamente.". | ✅ Cumple | Mensaje en franja verde que desaparece a los 5 s ([08](08-confirmacion.png)). La venta aparece en la columna de su etapa ([11](11-venta-en-su-columna.png), "Contactado · 1 · ₡ 350 000"; tablero: HU-305). En Firestore queda la venta (etapa, monto, seguimiento 00:00 de Costa Rica, notas), sus productos (`saleProducts`) y el primer registro de `stageHistory`; `createdAt` y `stageChangedAt` son iguales. |
| 5 | Un contacto puede tener varias posibles ventas a la vez; crear una nueva no cambia las que ya tiene. | ✅ Cumple | Se crearon dos para el mismo contacto con títulos distintos; la primera quedó idéntica (`primeraSinCambios: true`). Prueba contra emulador equivalente. |

## Lo que se comprobó de HU-302, HU-303 y HU-304 dentro del formulario real

- **HU-302:** con 1 letra no hay lista; con "an" aparece Ana Prueba Mora ([04](04-contacto-lista.png)); con "zzz": "No se encontraron contactos." ([05](05-contacto-sin-resultados.png)); desde la ficha el contacto viene fijo y de solo lectura ([09](09-contacto-fijo.png)).
- **HU-303:** monto `1000000000`: "Ingrese un monto válido."; seguimiento 01/01/2020: "La fecha de seguimiento no puede ser anterior a hoy."; título repetido escrito con otras mayúsculas: "Este contacto ya tiene una posible venta abierta con este título." ([06](06-errores-datos-y-productos.png), [10](10-titulo-repetido.png)). Los mensajes salen en rojo bajo el dato y desaparecen al corregirlo ([07](07-formulario-corregido.png)).
- **HU-304:** cantidad `0`: "Ingrese una cantidad entre 1 y 9999."; mismo producto en dos filas: "Este producto ya fue agregado."; la "X" quita la fila.

## Puntos por confirmar

- **Formato visible de la fecha.** El campo usa el selector de fecha del navegador. En el Edge del recorrido se ve "16 oct 2026", no "16/10/2026". El PDF pide dd/mm/aaaa. Depende del idioma del navegador; falta comprobarlo en el equipo real. Si no sale dd/mm/aaaa, se cambia por un campo de texto con ese formato.
- **Mensajes sin texto en el PDF:** "Ingrese el título.", "El título acepta como máximo 100 caracteres.", "Seleccione un contacto." y "No se pudo registrar la posible venta. Intente de nuevo.".
- **Botón "Cancelar".** Vuelve al tablero sin pedir confirmación, porque HU-301 no la menciona.
- **Guardado atómico.** Venta, productos e historial inicial se escriben en una sola operación: si falla, no queda nada a medias.

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores.
- Pruebas de HU-301: 13 de pantalla y 4 contra el emulador. Suite completa a la fecha: `npm test` 269/269 y `npm run test:emulators` 47/47.
- Se agregó la ruta `/posibles-ventas/nueva` (`routes.ts` y `AppRoutes.tsx`, dentro de `ProtectedRoute`).
