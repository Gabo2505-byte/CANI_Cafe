# Evidencia HU-302: Elegir el contacto de una posible venta

**Responsable:** Dylan · **Revisa:** Gabriel · **Fecha:** 2026-10-14

> Como administrador quiero encontrar fácilmente el contacto al crear una posible venta
> para que quede a nombre de la persona correcta.

## Alcance de esta evidencia

HU-302 es un componente del formulario "Nueva posible venta" (HU-301), que todavía no existe. Los criterios se comprobaron con pruebas de componente y contra el emulador. El **recorrido en navegador** se hace en el formulario real al cerrar HU-301, y esta evidencia se completa entonces con capturas.

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | Al escribir al menos 2 letras del nombre o del correo, aparece una lista con hasta 10 contactos activos que coinciden. | ✅ Cumple (pruebas) | Con 1 letra no aparece lista. Con 2 sí. Busca por nombre (también por apellido) y por correo, sin distinguir mayúsculas ni tildes. Con 12 coincidencias muestra 10, ordenadas por nombre. Los inactivos nunca aparecen (prueba unitaria y prueba contra emulador). |
| 2 | Si ningún contacto coincide: "No se encontraron contactos.". | ✅ Cumple (prueba) | Prueba *"sin coincidencias: No se encontraron contactos."*. |
| 3 | Desde la ficha de un contacto, ese contacto ya viene elegido y no se puede cambiar. | ✅ Cumple (prueba) | Con `fixedContact` el campo muestra el nombre, es de solo lectura, no ofrece lista y ni siquiera lee los contactos. |
| Recorrido en navegador | | ✅ Hecho | Los tres criterios se comprobaron también en el formulario real; ver [HU-301](../HU-301/README.md). |

## Cómo funciona

- `src/sales/contactSearch.ts`: `searchContacts` (lógica pura) y los mensajes.
- `src/sales/contactSearchRepository.ts`: lectura de solo lectura de los contactos con `status == 'activo'`. No modifica nada de `contacts` y no necesita índice.
- `src/sales/ContactPicker.tsx`: campo con lista; se maneja con ratón y con teclado (flechas, Enter, Escape). Escribir de nuevo deshace la elección.
- **Decisión:** la búsqueda se hace en el cliente porque Firestore solo busca por prefijo y el criterio pide encontrar por nombre o correo. Si algún día hay miles de contactos activos, se reemplaza `listActiveContactsIn` sin tocar el componente.
- Si no se pueden cargar los contactos: "No se pudieron cargar los contactos. Intente de nuevo.".
- El mensaje de contacto obligatorio al guardar lo muestra el formulario (HU-301) por el parámetro `error`.

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores.
- `npm test`: 193/193 (178 anteriores + 15 nuevas).
- `npm run test:emulators`: 35/35 (33 anteriores + 2 nuevas).
