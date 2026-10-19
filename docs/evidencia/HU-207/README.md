# Evidencia HU-207: Consultar la ficha de un contacto

**Responsable:** Gabriel · **Revisa:** Dylan · **Fecha:** 2026-10-19

> Como administrador quiero abrir la ficha de un contacto desde la lista
> para que tenga toda su información a mano antes de comunicarme con él.

## Estado: implementada, faltan capturas y pruebas de emuladores

- Código y pruebas sin emuladores ✅ (`npm test` 347/347).
- **Pendiente:** correr `npm run test:emulators` (3 pruebas nuevas en `tests/contacts/contactRecords.emulator.test.ts`) y tomar las capturas del recorrido con `npm run seed`.

## Datos de prueba

- Ambiente: Firebase Emulator Suite, proyecto `demo-cani-crm`, datos de `npm run seed`, usuario `admin`.
- Contactos útiles del seed:
  - **Bruno Ficticio Solís** (`contact-002`): Cliente, 2 comunicaciones, 3 posibles ventas, 3 productos de interés.
  - **Ana Prueba Mora** (`contact-001`): Persona interesada.
  - **Elena Muestra Castro** (`contact-005`): sin correo, sin dirección y sin origen, así que muestra "No registrado".
- Para el criterio 2 hacen falta más de 20 contactos (página 2), igual que en HU-204.

## Criterios de aceptación

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | La ficha se abre al dar clic sobre el contacto en la lista. | ✅ Cumple | Igual que en HU-204: clic en cualquier celda de la fila o en el nombre (enlace). Prueba *"criterio 1"*. |
| 2 | Arriba a la izquierda, "← Volver a contactos". Regresa a la lista tal como estaba (búsqueda, filtros y página). | ✅ Cumple | La página de la lista ahora vive en la URL (`/contactos?pagina=2`). Al abrir la ficha se le pasa esa URL, y el enlace vuelve exactamente ahí. Prueba: página 2 → ficha → volver → "Página 2 de 3" con los mismos contactos. La búsqueda y los filtros (otras HU) se conservan solos si también se guardan en la URL, y hay una prueba que lo verifica con `?q=…&clasificacion=…`. Si se llega a la ficha por otro lado (detalle de una venta, contacto recién creado), vuelve a `/contactos`. |
| 3 | Nombre como título; a su lado la clasificación: "Persona interesada" en azul o "Cliente" en verde. | ✅ Cumple | Etiqueta junto al `h1`. Distribuidor y Otro salen en un tono neutro. |
| 4 | Recuadro "Datos del contacto" con correo, teléfono, dirección, fecha de registro y origen; "No registrado" si falta. | ✅ Cumple | Teléfono en el formato de HU-202 y fecha en hora de Costa Rica ("3 sept 2026"). Un dato vacío o con solo espacios también dice "No registrado", en gris e itálica. |
| 5 | Tres pestañas, "Comunicaciones", "Posibles ventas" y "Productos de interés", cada una con su conteo entre paréntesis. Al abrir se ve "Comunicaciones". | ✅ Cumple | "Comunicaciones (2) · Posibles ventas (3) · Productos de interés (3)" para Bruno. Sin registros: "(0)" y un mensaje. Se recorren con el teclado (flechas, Inicio y Fin), siguiendo el patrón de pestañas de WAI-ARIA. |

## Decisiones

- **Contenido de las pestañas (base):** el criterio pide las pestañas y sus conteos. Cada pestaña muestra una lista sencilla que HU-208 y HU-211 a HU-213 pueden ampliar:
  - Comunicaciones: completada en [HU-211](../HU-211/README.md) a [HU-213](../HU-213/README.md).
  - Posibles ventas: completada en [HU-208](../HU-208/README.md).
  - Productos de interés: nombre · presentación.
- **Productos de interés = productos distintos que aparecen en las posibles ventas del contacto** (de cualquier etapa, incluidos productos inactivos). Todavía no hay un modelo propio de "productos de interés". **Hay que validarlo con Dylan o con el cliente**; si se define otro modelo, solo cambia `loadContactRecordsIn`.
- **Consultas sin índices nuevos:** solo se usan `where('contactId', '==')` y `where('saleId', 'in')`, en grupos de 30 (límite de Firestore). El orden se hace en el cliente.
- **Si fallan los registros**, la ficha igual muestra el título y los datos, y las pestañas dicen *"No se pudieron cargar los registros del contacto. Intente de nuevo."*.
- **"?pagina=N" en la URL:** si se recarga o se abre directo, la lista recorre las páginas anteriores para llegar. Si esa página ya no existe, se queda en la última.
- **Contrato (Gabriel):** se agregan `CONTACT_ORIGIN_LABELS` y `COMMUNICATION_MEDIUM_LABELS`, solo textos de pantalla. No se renombra ningún campo.
- **Clasificación:** se quitó de la lista de datos porque ahora es la etiqueta junto al título.

## Archivos

- `src/contacts/ContactDetailPage.tsx`: la ficha.
- `src/contacts/contactDetail.ts`: lógica pura (filas, conteos, volver, productos de interés).
- `src/contacts/contactDetailRepository.ts` y `contactDetailApi.ts`: lectura de los registros.
- `src/contacts/ContactsPage.tsx`: página en la URL y paso del estado a la ficha.
- `src/styles.css`: sección "HU-207".

## Pruebas automatizadas

Salida en [pruebas.txt](pruebas.txt).

- `npm run typecheck`: sin errores.
- `npm test`: 347/347 (316 anteriores + 31 nuevas: 17 de pantalla y 14 unitarias).
- `npm run test:emulators`: **pendiente**, con 3 pruebas nuevas: solo los registros del contacto y en orden; contacto sin registros; sin sesión no se puede leer.

## Capturas (pendientes)

| Archivo | Qué mostrar |
|---|---|
| `01-lista-pagina-2.png` | Lista en "Página 2 de 2" antes de abrir un contacto |
| `02-ficha-cliente.png` | Ficha de Bruno: "Cliente" en verde, datos y "Comunicaciones (2)" abierta |
| `03-ficha-persona-interesada.png` | Ficha con "Persona interesada" en azul |
| `04-no-registrado.png` | Ficha de Elena con "No registrado" |
| `05-pestana-posibles-ventas.png` | Pestaña "Posibles ventas (3)" |
| `06-pestana-productos.png` | Pestaña "Productos de interés (3)" |
| `07-volver-pagina-2.png` | Tras "← Volver a contactos": de nuevo en "Página 2 de 2" |
