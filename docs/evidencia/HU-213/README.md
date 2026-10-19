# Evidencia HU-213: Consultar el historial de comunicaciones

**Responsable:** Gabriel · **Revisa:** Dylan · **Fecha:** 2026-10-19

> Como administrador quiero ver todas las comunicaciones que se han tenido con un contacto
> para que conozca su situación antes de volver a comunicarme con él.

## Estado: implementada, faltan capturas y pruebas de emuladores

- Código y pruebas sin emuladores ✅ (`npm test` 405/405).
- **Pendiente:** correr `npm run test:emulators` (3 pruebas nuevas en `tests/communications/history.emulator.test.ts`) y tomar las capturas con `npm run seed`.

## Datos de prueba

- Ambiente: Firebase Emulator Suite, proyecto `demo-cani-crm`, datos de `npm run seed`, usuario `admin`.
- **Ana Prueba Mora** (`contact-001`) tiene 2 comunicaciones: una registrada por `admin` y **`comm-006`, que llegó del formulario web** (nueva en el seed).
- **Bruno Ficticio Solís** (`contact-002`) tiene una comunicación sobre una venta en particular y otra para "Todas".
- **Diego Ejemplo Rojas** (`contact-004`) no tiene comunicaciones.
- Para "Ver más" hacen falta más de 10: registrar 11 o más con la ventana de HU-211, o con un script temporal como en HU-204.

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | Cada comunicación en un recuadro, de la más reciente a la más antigua. | ✅ Cumple | El orden es por día y, el mismo día, por la hora en que se registró. Se ordena **en Firestore** con el índice nuevo `contactId + date desc + createdAt desc`. |
| 2 | Cada recuadro muestra fecha, medio, posible venta (o "Todas sus posibles ventas"), nota completa y quién la registró. | ✅ Cumple | Ejemplo: "02/10/2026 · Correo electrónico", "Posible venta: Todas sus posibles ventas", la nota sin recortar (incluso de 1000 caracteres) y "Registrado por: admin". El nombre sale del documento `users` por su id, no se copia. |
| 3 | "Otro: Instagram"; las del formulario web dicen "Registrado por: Sistema (formulario web)". | ✅ Cumple | Para distinguirlas se agregó al contrato el campo `source` ("usuario" / "formulario_web"). La de Ana del seed (`comm-006`) muestra "Registrado por: Sistema (formulario web)". |
| 4 | Al abrir la pestaña se ven las 10 más recientes; "Ver más" agrega 10 debajo; el botón desaparece cuando ya se ven todas. | ✅ Cumple | **Consulta paginada:** cada página trae 10 documentos de Firestore (`limit` + cursor `startAfter`), no se descarga todo el historial. El conteo de la pestaña ("Comunicaciones (25)") se hace en el servidor. Prueba con 25: 10 → 20 → 25 y el botón desaparece. Al cambiar de pestaña y volver, se ven otra vez las 10 primeras. |
| 5 | Sin comunicaciones: "Este contacto no tiene comunicaciones registradas.". | ✅ Cumple | La pestaña dice "Comunicaciones (0)" y no hay botón "Ver más". |

## Decisiones

- **Contrato `communications` (responsable: Gabriel):**
  - Campo nuevo **`source`**: `"usuario"` o `"formulario_web"`.
  - **`userId` puede ser `null`**, solo cuando la comunicación viene del formulario web.
  - Las reglas solo permiten crear `source: "usuario"` con el uid de la sesión. El formulario web (otra HU) deberá escribir desde el servidor con el Admin SDK, con `source: "formulario_web"`, `userId: null` y "Todas sus posibles ventas" (HU-212).
- **Seed:** 6 comunicaciones. La nueva, `comm-006`, es de Ana y vino del formulario web. Las demás tienen `source: "usuario"`. Se actualizó la prueba de integridad del seed y el README.
- **Índice nuevo** en `firestore.indexes.json`: `communications` por `contactId` ASC, `date` DESC y `createdAt` DESC. Hay que desplegarlo al pasar a un proyecto real.
- **Después de registrar una comunicación** (HU-211) el historial se recarga y vuelve a mostrar las 10 más recientes, con la nueva arriba.
- **Si falla "Ver más"**, aparece "No se pudieron cargar más comunicaciones. Intente de nuevo." y las que ya se veían siguen ahí.
- **Usuario borrado:** si el usuario que registró la comunicación ya no existe, aparece "Registrado por: —".

## Archivos

- `src/communications/communicationsRepository.ts`: `listCommunicationsPageIn`, `countCommunicationsIn` y `getUserNamesIn`.
- `src/communications/communicationsApi.ts`: `listCommunicationsPage`.
- `src/contacts/ContactDetailPage.tsx`: `CommunicationsPanel` (recuadros y "Ver más").
- `src/contacts/contactDetail.ts` y `contactDetailRepository.ts`: primera página, total y `registeredByLabel`.
- `src/shared/types/communication.ts`, `firestore.rules`, `firestore.indexes.json`, `scripts/seed/seedData.ts`, `src/styles.css`.

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores. `npm run build`: OK.
- `npm test`: 405/405 (394 anteriores + 11 nuevas: 8 de pantalla y 3 unitarias).
- `npm run test:emulators`: **pendiente**, con 3 pruebas nuevas:
  - El conteo cuenta solo las del contacto.
  - Páginas 10/10/3 en orden, incluido el desempate del mismo día.
  - Desde la app no se puede crear como "formulario web".

## Capturas (pendientes)

| Archivo | Qué mostrar |
|---|---|
| `01-historial-ana.png` | Ficha de Ana: recuadros con fecha, medio, posible venta, nota y "Registrado por" (uno del formulario web) |
| `02-otro-instagram.png` | Un recuadro con "Otro: Instagram" |
| `03-ver-mas.png` | Contacto con más de 10: 10 recuadros y "Ver más" al final |
| `04-ver-mas-final.png` | Tras los clics, todas a la vista y sin botón |
| `05-sin-comunicaciones.png` | Ficha de Diego: "Este contacto no tiene comunicaciones registradas." |
