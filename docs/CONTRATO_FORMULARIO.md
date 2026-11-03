# Contrato del formulario (v3, 02/11/2026) - CONFIRMADO por Gabriel

Revisado contra la rama catalogo-variedades: se usan los tipos y códigos que ya existen en `src/shared/types`.

Reemplaza la v2. Si algo de este archivo contradice los criterios de aceptación de las HU, mandan las HU. Si contradice el documento "Tickets de la Entrega 5: Dylan y Gabriel" (Danny), manda ese documento.

## Quién hace qué
- Dylan (E5-010.1): HU-401 a HU-405. Sitio público en `sitio-publico/` (build aparte), catálogo, pantalla del formulario con la validación y los mensajes de HU-501, y envío de la solicitud. Lectura pública de productos activos en `firestore.rules`. Hosting de los dos sitios en `firebase.json`.
- Gabriel (E5-020.1): HU-501 a HU-504. Verifica HU-501, hace el bloque definitivo de `formRequests` y `communications` en `firestore.rules`, el procesador (HU-502 y HU-503) y HU-504.
- `firestore.rules` es uno solo: cada uno toca solo sus bloques.

## 1. Colección: `formRequests` (decidido)
Se queda el nombre que Dylan ya implementó.

Payload (`src/shared/types/formRequest.ts`):
- fullName: string, 1..100
- email: string, minúsculas, 1..100
- phoneCountry: string | null
- phoneNumber: string (solo dígitos) | null
- interests: [{ productId, quantity }], 1..72, en orden de catálogo
- message: string 1..1000 | null
- submittedAt: serverTimestamp
- processed: false

Id generado en el navegador y estable por envío; un reintento sin cambios no duplica.

El procesador agrega: processedAt, contactId, outcome ('created' | 'updated' | 'rejected'), error (solo si outcome es 'rejected'), y claimedAt / claimedBy mientras se procesa.

Las solicitudes procesadas se CONSERVAN como evidencia y respaldo; no se borran.

## 2. Origen (decidido)
- Se usa el campo existente `origin` del contacto (`ContactOrigin`, código más etiqueta en `CONTACT_ORIGIN_LABELS`).
- Se agregan dos códigos a `CONTACT_ORIGINS`:
  - `formulario_web` → etiqueta 'Formulario web'. Lo manda HU-502.2 por encima del ticket ("formulario").
  - `carga_inicial` → etiqueta 'Carga inicial' (E5-050.1).
- Los códigos que ya existen (referido, redes_sociales, sitio_web, feria, visita, otro) y el `null` de HU-201 no cambian.
- `formulario_web` y `carga_inicial` los pone solo el sistema; ningún formulario manual los ofrece.
- Se asigna al crear el contacto y NO cambia después. Un contacto de carga inicial que llena el formulario conserva su origen y se marca con la etiqueta de HU-504 (punto 10).

## 3. Interés con cantidad (decidido): arreglo dentro del contacto
- Campo `interests: [{ productId, quantity }]` en el documento del contacto.
- HU-503 lo REEMPLAZA completo en una sola escritura (atómico).
- La pestaña "Productos de interés" (HU-209) hoy se calcula SOLO desde las oportunidades (`interestProducts` en contactDetail.ts). Pasa a mostrar los productos del formulario con su cantidad, además de los de las oportunidades. El detalle se ajusta a los criterios de HU-209.
- Se descarta una colección aparte: reemplazarla obligaría a borrar documentos uno por uno, sin atomicidad y con más lecturas.
- En la ficha, el nombre del producto se resuelve contra `products` al mostrar; si un producto ya no existe, se muestra "Producto no disponible".

## 4. Comunicación del formulario (decidido): productos estructurados, no dentro del texto
Se usa el modelo `Communication` existente:
- `source: 'formulario_web'` y `userId: null`, que ya están previstos en HU-213; la ficha ya muestra "Registrado por: Sistema (formulario web)".
- `medium: 'formulario_web'`: código nuevo con etiqueta 'Formulario web'. NO se agrega a la lista de RegisterCommunicationDialog, que sigue siendo la de HU-211.
- `otherMedium: null`, `saleId: null` y `appliesToAllSales: true` ("Todas sus posibles ventas", como ya prevé `createCommunicationIn` para el formulario). Se actualiza `lastCommunicationAt` de las ventas abiertas del contacto, igual que HU-212, para que los avisos lo tomen en cuenta. No se crea oportunidad.
- `note`: el mensaje, o "Sin mensaje" si viene null, más la línea de diferencias al final si aplica (punto 6).
- `products: [{ productId, name, quantity }]`: campo aparte en la comunicación. Se guarda el nombre del momento del envío para que el historial no cambie si luego se edita el producto.
- La ficha muestra la lista de productos debajo de la nota.
- Las reglas permiten `note` hasta 1500 caracteres SOLO cuando `source == 'formulario_web'` y `medium == 'formulario_web'` (1000 de mensaje más las diferencias); el resto sigue en 1000.
- Así no se recorta nada y las comunicaciones normales mantienen su límite.

## 5. Búsqueda de la persona (decidido, según HU-502.1)
- Primero por correo, comparando email normalizado (trim y minúsculas).
- Si no hay coincidencia, por teléfono: `phoneCountry` y `phoneNumber` iguales. El contacto y la solicitud ya guardan ambos con el mismo formato (ISO y dígitos), así que la comparación es exacta, igual que en `findDuplicateContactsIn`.
- Se incluyen los contactos inactivos.
- NO se usa ID = correo, porque los contactos de la carga inicial pueden no tener correo.

## 6. HU-503 (decidido, según la HU; retiro mi propuesta anterior de no reactivar)
- No se crea otro contacto y se mantiene su clasificación.
- `interests` se reemplaza por el del nuevo formulario.
- Si estaba 'Inactivo', pasa a 'Activo'.
- Nombre, correo y teléfono guardados NO se cambian.
- Las diferencias se anotan al final de la nota, con etiquetas fijas:
  "Datos enviados distintos a los registrados: Nombre: X. Correo: Y. Teléfono: +506 8811-2233."
- Un dato guardado vacío y uno enviado con valor SÍ cuenta como distinto: se anota y no se rellena, porque la HU dice que no se cambian.
- Las comparaciones ignoran mayúsculas en el correo y el formato en el teléfono.

## 7. Fechas (decidido)
- Contacto nuevo: `createdAt = submittedAt`, que es la hora del envío, no la del procesamiento.
- Comunicación: `date` = fecha y hora EXACTAS de `submittedAt`, mostradas en hora de Costa Rica. Es una excepción a la convención de 00:00 de HU-211, porque HU-502 pide "fecha y hora del envío". `createdAt` = `request.time`, igual que hoy.

## 8. Dónde vive el procesador y cómo evita el doble procesamiento (decidido)
- Código en `src/formRequests/` (processor, hook `useFormRequestProcessor`), montado en AppLayout. Solo corre con sesión iniciada.
- Al cargar, se escuchan las solicitudes con `processed == false`, ordenadas por `submittedAt`, y se procesan una por una (secuencial).
- **Un solo procesador por navegador:** `navigator.locks.request('cani-formRequests', …)`. Si hay dos pestañas abiertas, solo una procesa; si esa se cierra, la otra toma el relevo.
- **Reclamo por transacción:** antes de procesar, una transacción lee la solicitud. Si ya está `processed` o tiene un `claimedAt` de menos de 2 minutos, la salta; si no, escribe `claimedAt` y `claimedBy`.
- **Escritura atómica:** se crea o actualiza el contacto, se crea la comunicación y se marca la solicitud como `processed: true` en un solo `writeBatch`. O queda todo, o no queda nada. Si falla a la mitad, el reclamo vence y se reintenta.
- **Riesgo residual aceptado:** dos administradores en dispositivos distintos procesando a la vez dos solicitudes DIFERENTES de la misma persona nueva podrían crear dos contactos. CANI Café tiene un solo administrador activo, así que se acepta y se documenta en riesgos.
- **Mejora posible si sobra tiempo:** documentos índice `contactKeys/email:<correo>` dentro de la transacción.

## 9. Solicitudes inválidas (decidido)
Las reglas solo validan que `interests` sea una lista de 1 a 72; el procesador valida cada elemento.
- `quantity` no entera o fuera de 1..9999 → la solicitud se rechaza completa: `outcome: 'rejected'`, `error` con el motivo y `processed: true`. No toca contactos.
- `productId` inexistente → se descarta ese producto.
  - Si quedan productos válidos, se procesa con ellos y la nota agrega "Productos no disponibles omitidos: N."
  - Si no queda ninguno, se rechaza.
- Producto existente pero inactivo → se acepta, porque la persona lo vio activo al enviar.

## 10. HU-504 (decidido)
- Campo del contacto: `formBadge: 'Nuevo' | 'Nuevo mensaje' | null`.
  - Contacto creado por el formulario → 'Nuevo'.
  - Contacto existente que reenvía → 'Nuevo mensaje'.
  - Contacto con 'Nuevo' sin abrir que reenvía → se queda en 'Nuevo', porque sigue sin revisarse.
- Se pone en `null` al abrir la ficha del contacto.
- Además, la lista y la ficha muestran de forma permanente el origen `formulario_web`, con su etiqueta 'Formulario web'.

## 11. Reglas (bloques de Gabriel)
- `formRequests`:
  - create público: se conserva `isValidFormRequest` de Dylan, solo si `processed == false`, los campos son exactamente los del payload, se cumplen los tipos y largos, `interests` es una lista de 1 a 72 y `submittedAt == request.time`.
  - read con auth.
  - update con auth, solo sobre los campos de procesamiento.
  - delete denegado.
- `communications`: se agrega una segunda validación, `isValidFormCommunication`, con estas condiciones:
  - `source == 'formulario_web'`, `medium == 'formulario_web'` y `userId == null`.
  - `note` de hasta 1500 y el campo `products`.
  - `date <= request.time`.
  - El contacto se comprueba con `existsAfter()`, no con `exists()`, porque cuando la persona es nueva el contacto se crea en el MISMO batch.
  
  La rama `source == 'usuario'` de HU-211 no cambia. Se corrige el comentario del Admin SDK: el procesamiento corre en el cliente con la sesión del administrador (CC-01, costo 0).
- `contacts`: sin cambios, todo con auth.
- Se prueban en el emulador con casos de acceso permitido y denegado (público lee contactos, público lee formRequests, público hace update, payload con campos de más).
