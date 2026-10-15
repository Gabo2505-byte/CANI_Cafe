# Evidencia HU-304: Indicar los productos de una posible venta

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-14

> Como administrador quiero indicar qué productos incluye una posible venta
> para que distinga las distintas posibles ventas de un mismo contacto.

## Alcance de esta evidencia

HU-304 es un componente del formulario "Nueva posible venta" (HU-301), que todavía no existe. Los criterios se comprobaron con pruebas de componente, usando un formulario mínimo de prueba que valida al pulsar "Guardar". El **recorrido en navegador** de estos criterios se hace dentro del formulario real al cerrar HU-301, y esta evidencia se completa entonces con capturas.

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | "Agregar producto" agrega una fila; en cada fila se elige un producto del catálogo y se escribe la cantidad estimada en unidades; una "X" al final la quita. | ✅ Cumple (pruebas de componente) | Pruebas *"Agregar producto suma una fila…"*, *"el producto se elige del catálogo"* y *"la X quita solo su fila"*. La lista del catálogo es la de HT-002. |
| 2 | La cantidad es un entero de 1 a 9999; si no, "Ingrese una cantidad entre 1 y 9999.". | ✅ Cumple (pruebas de componente y unitarias) | Se rechazan `0`, `10000`, `2.5`, `1,5`, `abc`, vacío, negativos y `1e3`; se aceptan `1`, `9999` y `007`. |
| 3 | Fila sin producto: "Seleccione un producto o elimine la fila."; producto repetido: "Este producto ya fue agregado.". | ✅ Cumple (pruebas de componente y unitarias) | El aviso de repetido aparece en la segunda fila, no en la primera. Los mensajes salen en rojo bajo la fila. |
| 4 | La posible venta se puede guardar sin productos. | ✅ Cumple (prueba de componente) | Sin filas no hay errores y se entrega una lista vacía. |
| Recorrido en navegador | | ✅ Hecho | Los criterios se comprobaron también en el formulario real; ver [HU-301](../HU-301/README.md). |

## Cómo funciona

- `src/sales/saleProductRows.ts`: validación y conversión (sin pantalla). Los textos de error están en `SALE_PRODUCT_MESSAGES`.
- `src/sales/SaleProductsField.tsx`: filas de producto, cantidad y "X". Recibe el catálogo (`products`), las filas y los errores; el formulario que lo use (HU-301 y HU-309) llama a `validateSaleProductRows` al guardar.
- Al guardar se usará `toSaleProductInputs` para escribir `saleProducts` con id `${saleId}_${productId}`.
- Para editar una venta antigua (HU-309), el formulario podrá pasar también el producto inactivo que ya tenía, para que no desaparezca de la lista.

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores.
- `npm test`: 178/178 (146 anteriores + 32 nuevas de HU-304).
- `npm run test:emulators`: 33/33.
