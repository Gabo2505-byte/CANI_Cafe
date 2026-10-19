# Evidencia HU-211: Registrar una comunicación

**Responsable:** Gabriel · **Revisa:** Dylan · **Fecha:** 2026-10-19

> Como administrador quiero anotar cada comunicación que tengo con un contacto
> para que quede registro de lo que se conversó.

## Estado: implementada, faltan capturas y pruebas de emuladores

- Código y pruebas sin emuladores ✅ (`npm test` 380/380).
- **Pendiente:** correr `npm run test:emulators` (15 pruebas nuevas en `tests/communications/createCommunication.emulator.test.ts`) y tomar las capturas con `npm run seed`.

## Datos de prueba

- Ambiente: Firebase Emulator Suite, proyecto `demo-cani-crm`, datos de `npm run seed`, usuario `admin`.
- Contacto sugerido: **Ana Prueba Mora** (`contact-001`), con 1 comunicación previa (28/09/2026, Llamada telefónica).

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | En la pestaña "Comunicaciones", arriba a la derecha, el botón "Registrar comunicación". Abre una ventana con fecha, medio y nota obligatorios. | ✅ Cumple | El botón solo aparece en esa pestaña, antes del historial y alineado a la derecha. La ventana es modal y se cierra con "Cancelar" o con Escape. Si los tres datos están vacíos: "Seleccione la fecha.", "Seleccione el medio." e "Ingrese la nota.". Una nota con solo espacios cuenta como vacía. |
| 2 | La fecha viene con el día de hoy y no puede ser futura: "La fecha no puede ser posterior a hoy.". | ✅ Cumple | "Hoy" es el día en Costa Rica. El calendario no ofrece días futuros (`max`) y, si se escribe uno, aparece el mensaje. Las reglas de Firestore también rechazan una fecha futura. |
| 3 | Medio de una lista: Llamada telefónica, WhatsApp, Correo electrónico, Visita presencial u Otro. Con "Otro" se escribe cuál (ej. "Instagram"). | ✅ Cumple | Con "Otro" aparece "¿Cuál fue el medio?" (ejemplo: "Instagram"), que es obligatorio y acepta hasta 50 caracteres. En el historial se ve "Otro: Instagram". |
| 4 | La nota acepta como máximo 1000 caracteres. | ✅ Cumple | El campo no deja escribir más y tiene el contador "0/1000" de HU-203; al llegar a 1000 avisa "Llegó al máximo de 1000 caracteres.". El texto de ayuda dice qué escribir: qué se conversó, qué pidió la persona y qué se le respondió. Las reglas rechazan 1001. |
| 5 | Al guardar: la ventana se cierra, la comunicación aparece en el historial y "Comunicación registrada correctamente.". No se puede editar ni eliminar. | ✅ Cumple | El historial se recarga, la nueva queda primera y el conteo sube a "Comunicaciones (2)". La confirmación es la franja verde de 5 s (`TimedNotice`) y sale **dentro de la pestaña, justo encima del historial**. Si la página estaba más abajo, se desplaza para que se vea, y no reaparece al cambiar de pestaña (corrección 19/10: antes salía arriba de la página y, con la página desplazada, no se veía). No hay botones de editar ni eliminar, y además **las reglas de Firestore niegan `update` y `delete`** en `communications`. |

## Decisiones

- **Contrato `communications` (responsable: Gabriel):**
  - `medium` ahora usa la lista de la HU: `llamada`, `whatsapp`, `correo`, `visita` y `otro`. Se quitó `reunion`, que era provisional de HT-001; en el seed, `comm-002` pasa de `reunion` a `visita`.
  - Campo nuevo **`otherMedium`**: el texto cuando el medio es "Otro", o `null` en los demás.
  - Campo nuevo **`createdAt`**: la hora del servidor al registrarla. Desempata comunicaciones del mismo día para que la recién registrada quede arriba.
  - `date` se guarda como las **00:00 del día elegido en Costa Rica**. Como solo se elige el día, el historial muestra solo el día (dd/mm/aaaa).
- **Quién la registró:** `userId` es el usuario con sesión, y las reglas exigen que coincida con `request.auth.uid`.
- **Venta asociada:** resuelta en [HU-212](../HU-212/README.md) (campo "Posible venta" y actualización de `lastCommunicationAt`).
- **Reglas de Firestore:** ahora `communications` valida al crear contacto existente, fecha no futura, medio de la lista, "Otro" con su texto, nota de 1 a 1000 caracteres, usuario y fecha del servidor, sin campos de más. Además prohíbe editar y eliminar. Por eso la prueba genérica "un usuario activo puede escribir en todas las colecciones" (`tests/rules`) ya no incluye `communications`, que tiene sus propias pruebas.
- **Si falla el guardado**, la ventana queda abierta con lo escrito y muestra "No se pudo registrar la comunicación. Intente de nuevo.".

## Archivos

- `src/communications/RegisterCommunicationDialog.tsx`: la ventana.
- `src/communications/communicationForm.ts`: reglas y mensajes (funciones puras).
- `src/communications/communicationsRepository.ts` y `communicationsApi.ts`: guardado.
- `src/contacts/ContactDetailPage.tsx`: botón, confirmación y recarga del historial.
- `src/contacts/contactDetail.ts`: orden del historial por día y hora de registro.
- `src/shared/types/communication.ts`, `scripts/seed/seedData.ts`, `firestore.rules`, `vitest.emulators.config.ts`.

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores. `npm run build`: OK.
- `npm test`: 380/380 (357 anteriores + 23 nuevas: 14 de pantalla y 9 unitarias).
- `npm run test:emulators`: **pendiente**, con 15 pruebas nuevas:
  - Se guarda con su usuario y queda primera.
  - No se puede editar ni eliminar.
  - Diez casos rechazados por las reglas.
  - Nota de 1000 aceptada.
  - Un usuario inactivo o sin sesión no puede registrar ni leer.

## Capturas (pendientes)

| Archivo | Qué mostrar |
|---|---|
| `01-boton.png` | Pestaña "Comunicaciones" con el botón arriba a la derecha |
| `02-ventana.png` | Ventana abierta con la fecha de hoy |
| `03-obligatorios.png` | Los tres mensajes de obligatorio |
| `04-fecha-futura.png` | "La fecha no puede ser posterior a hoy." |
| `05-medio-otro.png` | "Otro" con "¿Cuál fue el medio?" |
| `06-contador-1000.png` | Nota en 1000/1000 |
| `07-guardada.png` | Confirmación y la comunicación primera en el historial |
