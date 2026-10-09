# CLAUDE.md — CRM CANI Café

CRM interno de CANI Café. Trabajan dos personas en paralelo:
- **Gabriel:** plataforma, acceso (`auth`), `contacts` y `communications`.
- **Dylan:** `products`, `sales`, etapas (`stageHistory`) y avisos.

Escribí en español (voseo costarricense) cuando te dirijas al equipo.

## Stack
- Frontend: React 19 + Vite 8 + TypeScript (strict, `verbatimModuleSyntax`)
- Backend: Firebase 13: Cloud Firestore + Firebase Auth (email/contraseña)
- Desarrollo local: Firebase Emulator Suite (Auth 9099, Firestore 8080, UI 4000)
- Pruebas: Vitest (`tests/unit`) y pruebas contra los emuladores (`tests/rules`, `tests/seed`) con `firebase emulators:exec`
- Gestor de paquetes: **npm**

## Entornos
- `demo-cani-crm`: desarrollo (`.env.development`, `npm run emulators`)
- `demo-cani-crm-test`: pruebas con emuladores (`.env.test`, `npm run test:emulators`)
- `demo-cani-crm-rules`: lo usa solo `tests/rules` para aislar `clearFirestore()`
- El proyecto real todavía no existe. Su config irá en `.env.production.local` (ignorado por git), basada en `.env.example`.
- Los proyectos `demo-*` solo funcionan con emuladores. El seed aborta fuera de ellos.

## Comandos
`npm run dev` · `npm run emulators` · `npm run seed` · `npm test` · `npm run test:emulators` · `npm run typecheck` · `npm run build`

Antes de dar una tarea por terminada, corré `npm run typecheck`, `npm test` y `npm run test:emulators` (con `npm run emulators` apagado).

## Estructura
- `src/shared/types/`: contratos de Firestore, un archivo por colección. **Fuente de verdad.**
- `src/shared/constants/collections.ts`: nombres de colecciones (usalos siempre; no escribas strings sueltos).
- `src/shared/firebase/config.ts`: `auth`, `db` y la conexión a los emuladores.
- `src/shared/utils/dates.ts`: `formatDateTimeCR`, `formatDateCR`, `toCostaRicaDateKey`.
- `src/<dominio>/`: código por dominio (`auth`, `contacts`, `communications`, `sales`, `products`), cada uno con su `index.ts` como API pública.
- `scripts/seed/`: seed idempotente (`seedData.ts` tiene los datos y `runSeed.ts` la lógica).
- `firestore.rules`, `firestore.indexes.json`: versionados en el repo.

## Contratos de Firestore (NO cambiar nombres sin avisar a Gabriel)
- `users`: id (= uid de Auth), username, email, active
- `contacts`: id, fullName, email, phoneCountry, phoneNumber, classification, status, origin, createdAt
- `communications`: id, contactId, saleId (opcional/null), appliesToAllSales, date, medium, note, userId
- `products` (Dylan): id, name, presentation, description, active
- `sales` (Dylan): id, contactId, title, stage, estimatedAmount, nextFollowUpAt, notes, createdAt, lastCommunicationAt
- `saleProducts` (Dylan): saleId, productId, quantity (id de doc sugerido: `${saleId}_${productId}`)
- `stageHistory` (Dylan): saleId, previousStage, newStage, changedAt, lossReason

Valores provisionales (en los tipos, pendientes de validar con el negocio):
- `classification`: prospecto | cliente | distribuidor | otro
- `status`: activo | inactivo
- `origin`: referido | redes_sociales | sitio_web | feria | visita | otro
- `medium`: llamada | correo | whatsapp | reunion | visita | otro
- `stage`: prospecto | contactado | propuesta | negociacion | ganada | perdida (los define Dylan)
- `phoneCountry`: código ISO alfa-2 ("CR"); `phoneNumber`: solo dígitos
- `estimatedAmount`: colones (CRC)

Invariante: si `appliesToAllSales` es true, entonces `saleId` es null.

## Reglas del proyecto
- Fechas como **Firestore Timestamp**; mostrarlas siempre en hora de Costa Rica (`America/Costa_Rica`) con `src/shared/utils/dates.ts`.
- Relaciones **por ID**, nunca por texto duplicado.
- **Nunca usar datos reales en pruebas** (`@example.com`, `.test`, teléfonos `0000xxxx`, nombres inventados).
- Los avisos son **internos**: no enviar correo, SMS ni WhatsApp.
- Seguridad: solo usuarios autenticados con `users/{uid}.active == true` leen y escriben. Las colecciones fuera del contrato quedan denegadas. Si agregás una colección, agregala a `firestore.rules`, a `COLLECTIONS` y a `tests/rules`.
- Índices: el emulador no los exige. Toda consulta nueva con `where` + `orderBy` en campos distintos necesita su entrada en `firestore.indexes.json`.
- El seed debe seguir siendo idempotente (IDs fijos + `set()`), y `tests/seed` lo verifica.

## Cómo trabajar
- Antes de escribir código, mostrá un plan breve (carpetas y archivos) y esperá confirmación.
- Al terminar, decí qué pasos manuales le tocan al equipo.

## Gotchas
- En Windows, `firebase emulators:exec` puede dejar un proceso `java` vivo en el puerto 8080. Si aparece "port taken", cerralo.
- Las sesiones de Bash en esta máquina no tienen coreutils (`cat`, `mkdir`…). Usá PowerShell o las herramientas de archivos.
