# Evidencia: mejoras pequeñas de UX (foco, enlaces y datos a la vista)

**Responsable:** Dylan · **Revisa:** Gabriel (varios archivos son de `contacts`, `auth` y `communications`) · **Fecha:** 2026-11-15 · **Rama:** `dylan-ux-detalles`

## Decisión

Lote de nueve mejoras pequeñas, sin cambios de criterio y sin consultas nuevas. Son solo comportamiento y presentación. Salen de la auditoría de UX (puntos 2, 3, 4, 5, 7, 10, 11 y 15) más un punto nuevo, el 16.

## Qué cambió

| # | Cambio | Dónde |
|---|---|---|
| 2 | En el aviso de contacto repetido, "Ver contacto" se abre en otra pestaña (`target="_blank"`, `rel="noopener noreferrer"`). Lo escrito en el formulario no se pierde. | `src/contacts/ContactFormFields.tsx` (`FieldError`) |
| 3 | En Nueva oportunidad abierta desde la ficha de un contacto, "Cancelar" vuelve a esa ficha, con la lista de la que se venía ("Volver a contactos" conserva la búsqueda). Desde el tablero sigue yendo al tablero. **El destino después de guardar no cambia** (tablero). | `src/sales/NewSalePage.tsx` (`handleCancel`); `src/contacts/ContactDetailPage.tsx` pasa la lista de origen al abrir Nueva oportunidad |
| 4 | Al guardar con errores, el foco y la vista van al primer campo con error (el primero, en orden de pantalla, con `aria-invalid="true"`). Un helper común: `useFocusFirstError`. | `src/shared/hooks/useFocusFirstError.ts` (nuevo); lo usan `NewContactPage`, `EditContactPage`, `NewSalePage`, `SaleEditForm` y `RegisterCommunicationDialog` |
| 5 | En el selector de contacto de Nueva oportunidad, ya elegido el contacto, debajo del nombre se ve "teléfono · correo" (con un solo dato, solo ese). También cuando el contacto viene fijo desde la ficha. | `src/sales/ContactPicker.tsx` |
| 7 | En la ficha, el teléfono es un enlace `tel:` con el prefijo del país (`tel:+50688888888`). El texto visible y el orden de los datos no cambian. No hay WhatsApp. | `src/contacts/contactDetail.ts` (`contactPhoneHref`), `src/contacts/ContactDetailPage.tsx` (`ContactData`) |
| 10 | La ayuda del selector se muestra también visible debajo del campo, con el mismo texto de hoy, y no desaparece al escribir. | `src/sales/ContactPicker.tsx` |
| 11 | En la lista de contactos, si la búsqueda no encuentra a nadie, aparece el botón "Limpiar búsqueda": vacía el buscador, vuelve la lista y devuelve el foco al buscador. | `src/contacts/ContactsPage.tsx` |
| 15 | Inicio de sesión: si falla, el foco va al campo de usuario (usuario inexistente o vacío); el mensaje sigue siendo `role="alert"`. | `src/auth/LoginPage.tsx` |
| 16 | Pestaña "Bitácora" de Avisos: las filas de la lista de contactos y el contacto elegido muestran el teléfono primero y el correo después (con un solo dato, solo ese, sin separadores sobrantes). Reutiliza `contactSecondaryLine`. | `src/sales/ContactTimeline.tsx` |

Además: `src/styles.css` (dos reglas: `.contact-picker-selected` y la ayuda dentro del selector).

**Sin cambios:** el servicio de cambio de etapa, el mapa de transiciones, el tablero y su arrastre, `firestore.rules`, `firestore.indexes.json`, `formRequests`, `sitio-publico/`, la pestaña "Avisos pendientes", la lógica de la bitácora (solo se cambió cómo se escribe la línea de datos de cada fila), el orden de las columnas de la lista de contactos y el recuadro de datos de la ficha.

### Decisiones de detalle

- **#15, qué campo recibe el foco.** El pedido dice "si falla, el foco va al campo de usuario". Se aplicó así cuando el error es del usuario (no existe, o está vacío). Cuando la contraseña es incorrecta, **el foco se queda en la contraseña**, como ya era (HU-102.4: la contraseña se borra y el usuario se mantiene; el foco en el usuario obligaría a volver a pulsar la contraseña). Con los dos vacíos, el foco va al usuario. Si se prefiere el foco siempre en el usuario, es un cambio de una línea.
- **#3, cómo se vuelve a la ficha.** Se usa `replace`, así "Atrás" desde la ficha no regresa al formulario cancelado. Si la ficha se abrió sin lista de origen, "Volver a contactos" lleva a la lista desde el inicio.
- **#4, alcance.** Se aplicó a todos los formularios con validación que tienen campos con `aria-invalid`: contacto (nuevo y edición), oportunidad (nueva y edición) y comunicación. No se tocó el inicio de sesión con este helper (tiene su propio manejo, punto 15).

### Texto nuevo

| Lugar | Texto |
|---|---|
| Lista de contactos, sin resultados de búsqueda | **"Limpiar búsqueda"** (botón) |

Es el único texto nuevo. La ayuda del selector, "Ver contacto" y los demás mensajes conservan su texto. "Limpiar búsqueda" no existe en el PDF de requisitos; "Limpiar filtros" es de HU-206, que está fuera de alcance, y no se usó.

## Criterios revisados

| HU | Criterio | ¿Choca? |
|---|---|---|
| HU-308 y HU-301 (4) | Después de guardar, la oportunidad aparece en el tablero con su mensaje | No: el destino al guardar no cambió (hay prueba) |
| HU-207 | Orden de "Datos del contacto" y enlace "← Volver a contactos" | No: el orden y el texto no cambian; el teléfono solo pasa a ser un enlace |
| HU-204 (1) | Columnas de la lista de contactos | No: sin cambios (el recorrido lo comprueba) |
| HU-316 | Pantalla "Avisos" | No: la pestaña "Avisos pendientes" no se tocó |
| HU-203 (5) | "Ver contacto" abre la ficha del contacto que ya existe | No: la abre, ahora en otra pestaña |
| HU-102 (4) | Contraseña incorrecta: se borra y el usuario se mantiene | No: se conserva, incluido el foco en la contraseña |

Ningún punto chocó con un criterio literal, así que no hay cambios de criterio que registrar con Danny. El texto nuevo ("Limpiar búsqueda") sí conviene avisarlo.

## Capturas (usuario `admin`, Microsoft Edge headless)

Contra los emuladores con `npm run seed`. Escritorio a 1366 × 768 y móvil a 390 px. Las medidas del navegador (campo con el foco y si queda a la vista, enlaces, textos y desborde horizontal) están en [verificacion.json](verificacion.json). Los 26 pasos con su resultado están en [recorrido.json](recorrido.json). En ninguna pantalla hay desborde horizontal.

| Captura | Punto | Qué se ve |
|---|---|---|
| [02](02-ver-contacto-repetido.png) | 2 | Teléfono repetido: el error con "Ver contacto" y el foco en el teléfono |
| [02b](02b-pestana-nueva-ficha.png) | 2 | La pestaña nueva con la ficha de Bruno; la del formulario conserva lo escrito |
| [03a](03a-nueva-oportunidad-desde-ficha.png) | 3 | Nueva oportunidad abierta desde la ficha de Bruno: contacto fijo |
| [03b](03b-cancelar-vuelve-a-la-ficha.png) | 3 | Tras "Cancelar": la ficha de Bruno, con "Volver a contactos" conservando la búsqueda |
| [04a](04a-movil-390-contacto-foco-telefono.png) | 4 | 390 px: Nuevo contacto sin correo ni teléfono, foco en el teléfono |
| [04b](04b-movil-390-oportunidad-foco-contacto.png) | 4 | 390 px: Nueva oportunidad guardada desde el final de la página; el foco sube al campo Contacto |
| [04c](04c-movil-390-oportunidad-foco-titulo.png) | 4 | 390 px: con contacto y sin título, foco en el Título |
| [04d](04d-comunicacion-foco-medio.png) | 4 | Registrar comunicación sin medio ni nota: foco en el Medio |
| [05](05-selector-contacto-elegido.png) | 5 y 10 | Bruno elegido: "+506 0000-0002 · bruno.ficticio@example.com" y la ayuda debajo |
| [05b](05b-selector-contacto-elegido-un-dato.png) | 5 | Elena (solo teléfono): "+506 0000-0005" |
| [07](07-ficha-telefono-enlace.png) | 7 | Ficha de Bruno; el teléfono es un enlace `tel:+50600000002`, con el mismo texto |
| [10](10-selector-ayuda-visible-al-escribir.png) | 10 | Escribiendo "bruno": la lista se abre sobre la ayuda; la ayuda sigue en el documento |
| [11a](11a-sin-resultados-limpiar-busqueda.png) | 11 | Búsqueda "zzz": "No se encontraron contactos." y el botón "Limpiar búsqueda" |
| [11b](11b-tras-limpiar-busqueda.png) | 11 | Tras el clic: buscador vacío con el foco y la lista completa |
| [15](15-login-foco-usuario.png) | 15 | Usuario inexistente: el mensaje y el foco en el usuario |
| [16a](16a-bitacora-lista-telefono-primero.png) | 16 | Bitácora: filas con el teléfono primero; Carla solo con correo y Elena solo con teléfono |
| [16b](16b-bitacora-contacto-elegido.png) | 16 | Bitácora de Bruno: el resumen del contacto con el teléfono primero |
| [16c](16c-movil-390-bitacora-lista.png) | 16 | 390 px: la lista cabe sin desborde |

## Recorrido en el navegador

| # | Paso | Resultado |
|---|---|---|
| 1–3 | Login con usuario inexistente: mensaje (`role="alert"`) y foco en el usuario ([15](15-login-foco-usuario.png)); usuario vacío: foco en el usuario | ✅ |
| 4 | Ingreso con `admin` | ✅ |
| 5–8 | Teléfono repetido ([02](02-ver-contacto-repetido.png)): "Ver contacto" con `target _blank` y `rel noopener noreferrer`; foco en el teléfono; se abre una pestaña nueva con la ficha ([02b](02b-pestana-nueva-ficha.png)); el formulario conserva lo escrito | ✅ |
| 9–12 | Foco en el primer error ([04a](04a-movil-390-contacto-foco-telefono.png), [04b](04b-movil-390-oportunidad-foco-contacto.png), [04c](04c-movil-390-oportunidad-foco-titulo.png), [04d](04d-comunicacion-foco-medio.png)): el campo con el foco queda a la vista, también a 390 px y con la página desplazada al final | ✅ |
| 13–14 | Selector: la ayuda se ve debajo y sigue al escribir ([10](10-selector-ayuda-visible-al-escribir.png)) | ✅ |
| 15–16 | Selector: contacto elegido con "teléfono · correo" ([05](05-selector-contacto-elegido.png)) y con un solo dato ([05b](05b-selector-contacto-elegido-un-dato.png)) | ✅ |
| 17–19 | Nueva oportunidad desde la ficha: contacto fijo ([03a](03a-nueva-oportunidad-desde-ficha.png)); "Cancelar" vuelve a la ficha con "Volver a contactos" a `/contactos?buscar=bruno` ([03b](03b-cancelar-vuelve-a-la-ficha.png)); desde el tablero, "Cancelar" vuelve al tablero | ✅ |
| 20 | Ficha: el teléfono es un enlace `tel:+50600000002` con el mismo texto y el mismo orden de datos ([07](07-ficha-telefono-enlace.png)) | ✅ |
| 21–23 | Lista de contactos: "zzz" → "No se encontraron contactos." y "Limpiar búsqueda" ([11a](11a-sin-resultados-limpiar-busqueda.png)); al pulsarlo, buscador vacío con el foco, lista completa y URL sin búsqueda ([11b](11b-tras-limpiar-busqueda.png)); columnas sin cambios | ✅ |
| 24–26 | Bitácora: filas con el teléfono primero ([16a](16a-bitacora-lista-telefono-primero.png)), contacto elegido ([16b](16b-bitacora-contacto-elegido.png)) y 390 px sin desborde ([16c](16c-movil-390-bitacora-lista.png)) | ✅ |

**Corridas anteriores.** Dos corridas del recorrido no quedaron en verde, por el script y no por la aplicación:

- La primera se cortó en el paso del botón "+ Nueva oportunidad": su texto lo arma `AddButtonLabel` con el "+" aparte, así que la búsqueda por texto exacto no lo encontraba. Se cambió a buscar por texto contenido.
- La segunda terminó 25 de 26: el valor esperado del enlace estaba mal escrito en el script (`tel:+5060000002`, con un cero de menos). El enlace real es `tel:+50600000002` (506 + 00000002) y es correcto. Se corrigió la expectativa.
- Antes de cada corrida se borraron los datos del emulador y se volvió a correr `npm run seed`. Las capturas y los JSON son de la última corrida, con 26 de 26 pasos correctos.

**Datos usados:** los contactos del seed (ficticios). El recorrido no guarda nada (solo busca, cancela y muestra errores). Los emuladores se apagaron al terminar.

## Pruebas

- `npm run typecheck`: sin errores.
- `npm test`: 1157/1157 (1132 anteriores + 25 nuevas; además 2 pruebas existentes se ajustaron al comportamiento nuevo).
- `npm run test:emulators`: 313/313 (sin pruebas nuevas contra emulador: el cambio no toca reglas, consultas ni datos).
- `npm run build:todo`: correcto. Los 46 archivos de `dist-publico/` (incluidos el JS y el CSS) son idénticos byte a byte (sha256) a los de `main`.

| Archivo | Qué prueba |
|---|---|
| `tests/components/ContactValidation.test.tsx` | "Ver contacto" con `target _blank` y `rel`, y el formulario conserva lo escrito (prueba ajustada: antes navegaba en la misma pestaña). Foco en el primer error (nombre → teléfono → correo). Foco en el campo repetido. |
| `tests/components/NewSale.test.tsx` | "Cancelar" desde la ficha (con y sin lista de origen) vuelve a la ficha; desde el tablero, al tablero; al guardar desde la ficha sigue yendo al tablero; foco en el primer error (contacto → título → monto). |
| `tests/components/ContactPicker.test.tsx` | Ayuda visible y que no desaparece al escribir; contacto elegido con "teléfono · correo", con un solo dato y con el contacto fijo; deja de mostrarse al escribir de nuevo. |
| `tests/components/ContactDetail.test.tsx` | Enlace `tel:` en Costa Rica y en otro país, sin teléfono sin enlace, y el orden de los datos igual. |
| `tests/components/ContactsSearch.test.tsx` | "Limpiar búsqueda": aparece solo sin resultados, vacía el buscador, vuelve la lista, devuelve el foco y limpia la URL. |
| `tests/components/LoginPage.test.tsx` | Foco al usuario con usuario inexistente y vacío; a la contraseña si solo ella falta; mensaje con `role="alert"`. |
| `tests/components/AlertsTimeline.test.tsx` | Filas de la bitácora: teléfono primero, solo correo, solo teléfono y sin datos; el contacto elegido (prueba ajustada: antes esperaba el correo primero). |
| `tests/components/SaleEdit.test.tsx` y `RegisterCommunication.test.tsx` | Foco en el primer error al editar una oportunidad y al registrar una comunicación. |
| `tests/unit/contactDetail.test.ts` | `contactPhoneHref`: prefijo del país, otro país, sin teléfono y sin país. |

## Qué no se pudo probar

- Lectores de pantalla reales: el anuncio de los mensajes se comprueba por `role="alert"`, no con un lector.
- El clic en un enlace `tel:` (en el escritorio no hay aplicación de llamadas): se comprueba el `href`.
- El desplazamiento de la vista al campo con error en jsdom (no implementa `scrollIntoView`): se comprobó en Edge, con el campo "a la vista".
