# CLAUDE.md — CRM CANI Café

CRM interno de CANI Café. Trabajan dos personas en paralelo:
- **Gabriel:** plataforma, acceso (`auth`), `contacts` y `communications`.
- **Dylan:** `products`, `sales`, etapas (`stageHistory`) y avisos.

Escribí en español (voseo costarricense) cuando te dirijas al equipo.

## Plan de trabajo (Entrega 4)
**Historias de Gabriel**
- HT-001: entorno (hecho)
- HU-101 a HU-105: ingreso, errores, navegación, cierre de sesión y protección
- HU-201 a HU-204: modelo, validaciones, registro y lista de contactos
- HU-207 y HU-208: ficha del contacto y sus posibles ventas
- HU-211 a HU-213: registro, relación y consulta de comunicaciones

**Historias de Dylan**
- HT-002: products
- HU-301 a HU-304: ventas
- HU-305: tablero de 6 etapas
- HU-308 y HU-309: detalle y edición
- HU-310 a HU-313: etapas, pérdida, reapertura, ganada y conversión a cliente
- HU-314 a HU-316: avisos internos

**Dependencias**
- HU-208 y HU-212 usan `sales` simuladas hasta que Dylan publique el contrato real.
- Dylan usa fixtures de `contacts` y `communications`.

**Propiedad de las colecciones**
- Gabriel aprueba cambios en `users`, `contacts` y `communications`.
- Dylan aprueba cambios en `products`, `sales` y `stageHistory`.
- Un cambio de contrato se acuerda con el otro antes de integrarlo.

**Flujo de trabajo**
- Una rama por historia, con el nombre de la HU (ej. `HU-101`).
- Pull Request a `main`, que revisa la otra persona.
- PRs pequeños, de una historia o de una parte verificable.
- No hagas commit directo a `main`.

**Definición de terminado**
- Cumple todos los criterios de aceptación.
- Funciona con Firebase usando la configuración compartida.
- Tiene pruebas del flujo principal y de al menos un error relevante.
- No rompe las historias ya integradas: `npm test` y `npm run test:emulators` en verde.
- Tiene evidencia en `docs/evidencia/<HU>/`: README con la tabla de criterios, capturas, `pruebas.txt` y datos de prueba.

**Integraciones**
1. Firebase y datos de prueba de ambos (Gabriel prepara, Dylan verifica).
2. Una venta se crea desde un contacto, aparece en la ficha y recibe una comunicación.
3. Etapas, conversión, última comunicación y avisos.

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
- `src/app/`: rutas (`routes.ts` tiene `ROUTES`, `safeRedirect` y `loginPathFor`), `AppRoutes.tsx` y `ProtectedRoute.tsx`. Las pantallas nuevas que requieren sesión van envueltas en `ProtectedRoute`.
- `src/auth/`: `AuthContext` (`useAuth()`, sin Firebase, se puede mockear en pruebas), `AuthProvider`, `LoginPage` (HU-101).
- Ingreso por **usuario**: Auth usa un correo interno `${username}@usuarios.cani-crm.local` (`src/auth/username.ts`). `users.email` es el correo de contacto, no el de Auth.
- Pruebas de pantallas: `tests/components/*.test.tsx` con `// @vitest-environment jsdom`, Testing Library y `AuthContext.Provider` con un estado falso.
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
- Implementá **solo** los criterios de aceptación de la HU actual. Lo que no esté en la HU (mensajes de error, recuperación de contraseña, etc.) va en otra HU: no lo agregues.
- Commits: mensaje corto con el código de la HU (ej. `HU-101`). **Sin** línea `Co-Authored-By` de Claude ni atribución.
- Al terminar, decí qué pasos manuales le tocan al equipo.

## Gotchas
- En Windows, `firebase emulators:exec` puede dejar un proceso `java` vivo en el puerto 8080. Si aparece "port taken", cerralo.
- Las sesiones de Bash en esta máquina no tienen coreutils (`cat`, `mkdir`…). Usá PowerShell o las herramientas de archivos.
