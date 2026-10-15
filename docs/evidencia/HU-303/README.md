# Evidencia HU-303: Completar los datos de una posible venta

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-14

> Como administrador quiero indicar el título, la etapa, el monto, el próximo seguimiento y las notas de una posible venta
> para que su información sea clara y correcta.

## Alcance de esta evidencia

HU-303 son los campos y las reglas del formulario "Nueva posible venta" (HU-301), que todavía no existe. Los criterios se comprobaron con pruebas de componente, unitarias y contra el emulador. El **recorrido en navegador** se hace en el formulario real al cerrar HU-301, y esta evidencia se completa entonces con capturas.

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | El título acepta como máximo 100 caracteres. | ✅ Cumple (pruebas) | El campo no deja escribir más de 100 y muestra el contador "100/100" con el aviso de máximo. 100 caracteres sí valida; 101 no. |
| 2 | Un contacto no puede tener dos posibles ventas abiertas con el mismo título: "Este contacto ya tiene una posible venta abierta con este título.". | ✅ Cumple (pruebas y emulador) | Se compara sin mayúsculas, tildes ni espacios de más. Solo cuentan las abiertas de ese contacto (las ganadas, las perdidas y las de otros contactos no). Al editar (HU-309) se excluye la propia venta. |
| 3 | La etapa viene en "Nuevo interesado"; al crear solo se pueden elegir Nuevo interesado, Contactado, Precio o cotización enviada y En negociación. | ✅ Cumple (prueba) | El selector ofrece exactamente esas cuatro opciones, con "Nuevo interesado" elegida. |
| 4 | Monto entero de ₡ 0 a ₡ 999 999 999; ₡ 0 = sin estimar; vacío o fuera de rango: "Ingrese un monto válido.". | ✅ Cumple (pruebas) | Válidos: `0`, `150000`, `150 000`, `999999999`. Rechazados: vacío, `1000000000`, `-5`, `12.5`, `1,5`, texto. |
| 5 | Seguimiento no anterior a hoy: "La fecha de seguimiento no puede ser anterior a hoy."; notas hasta 1000 caracteres. | ✅ Cumple (pruebas) | Hoy y fechas futuras valen; ayer no; sin fecha vale. "Hoy" se compara con el día de Costa Rica y se puede inyectar en las pruebas. Las notas no pasan de 1000 caracteres (contador "1000/1000"). |
| Recorrido en navegador | | ✅ Hecho | Los criterios se comprobaron también en el formulario real; ver [HU-301](../HU-301/README.md). Queda por confirmar el formato visible del campo de fecha (dd/mm/aaaa). |

## Decisiones y puntos por confirmar

- **Mensajes sin texto en el PDF.** El PDF no da texto para título vacío, título demasiado largo ni contacto sin elegir. Se usó el patrón de los formularios de Gabriel: "Ingrese el título.", "El título acepta como máximo 100 caracteres." y "Seleccione un contacto.". Si el cliente o Gabriel prefieren otros textos, es un cambio en `SALE_MESSAGES` (`src/sales/saleForm.ts`).
- **Botón "Guardar".** El PDF dice que "Guardar" solo se puede usar con los datos obligatorios llenos, pero el formulario de contactos de Gabriel lo deja activo y muestra los mensajes al guardar. Se siguió el mismo patrón que Gabriel para ser consistentes y poder mostrar "Ingrese un monto válido." con el monto vacío. Por confirmar.
- **Campo de fecha.** Es el selector nativo del navegador; su formato visible depende del idioma del navegador. Hay que comprobar en el recorrido que se vea como dd/mm/aaaa.
- **Fecha guardada.** El seguimiento se guarda a las 00:00 de Costa Rica del día elegido (así el aviso de HU-314 empieza a las 00:00).
- **Edición (HU-309).** La regla "no anterior a hoy" se aplicaría también al editar una venta con un seguimiento ya vencido; se decide en HU-309.

## Archivos

- `src/sales/saleForm.ts`: reglas y mensajes (puras).
- `src/sales/SaleDataFields.tsx`: título, etapa, monto, seguimiento y notas.
- `src/sales/salesRepository.ts` y `salesApi.ts`: títulos de las abiertas de un contacto.
- `src/shared/utils/money.ts`: `formatColones` ("₡ 150 000"), para tablero y detalle.

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores.
- `npm test`: 235/235 (193 anteriores + 42 nuevas).
- `npm run test:emulators`: 38/38 (35 anteriores + 3 nuevas).
