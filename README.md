# CANI Café — Sistema interno

Sistema interno de CANI Café. React + Vite + TypeScript sobre Firebase (Firestore + Auth).
El desarrollo y las pruebas corren 100 % sobre **Firebase Emulator Suite**, con proyectos `demo-*`.
No hace falta una cuenta de Firebase ni `firebase login` para trabajar en local.

| Responsable | Dominios |
|---|---|
| Gabriel | plataforma, `auth`, `contacts`, `communications` |
| Dylan | `products`, `sales` (ventas, etapas, avisos) |

## Requisitos

- Node.js 20 o superior (probado con Node 24)
- Java 11 o superior (lo necesita el emulador de Firestore)
- Git

`firebase-tools` viene como dependencia de desarrollo, así que no hace falta instalarlo globalmente.

## Primeros pasos

```bash
git clone <url-del-repo> cani-crm
cd cani-crm
npm install
```

Necesitás **dos terminales**:

```bash
# Terminal 1: emuladores (Auth :9099, Firestore :8080, UI http://127.0.0.1:4000)
npm run emulators
```

```bash
# Terminal 2: datos de prueba y app
npm run seed
npm run dev
```

Abrí http://localhost:5173 e ingresá con el admin de prueba:

- Usuario: `admin`
- Contraseña: el valor de `SEED_ADMIN_PASSWORD` en `.env.development`

Si ya habías corrido el seed antes de la HU-101, volvé a correrlo (`npm run seed`): el ingreso ahora es por usuario.

Los emuladores **no guardan datos** entre reinicios. Cada vez que los levantes, volvé a correr `npm run seed`.
El seed es idempotente: usa IDs fijos (`contact-001`, `sale-001`…), así que podés correrlo cuantas veces quieras sin duplicar datos.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Levanta Vite con `.env.development` |
| `npm run emulators` | Levanta los emuladores de Auth y Firestore (proyecto `demo-cani-crm`) |
| `npm run seed` | Carga 1 admin, 5 contactos, 5 comunicaciones y 3 ventas mock en los emuladores |
| `npm test` | Pruebas unitarias y de pantallas (Vitest + Testing Library, sin emuladores) |
| `npm run test:emulators` | Levanta los emuladores, corre las pruebas de reglas, del seed y de Auth real, y los apaga (proyecto `demo-cani-crm-test`) |
| `npm run typecheck` | Corre `tsc --noEmit` |
| `npm run build` | Typecheck y build de producción |

`test:emulators` usa otro projectId (no borra tus datos de desarrollo) pero los mismos puertos: **apagá `npm run emulators` antes de correrlo**.

## Estructura

```
firestore.rules            Reglas de seguridad (versionadas)
firestore.indexes.json     Índices compuestos
firebase.json / .firebaserc
.env.development           Config demo para desarrollo (versionado, sin secretos)
.env.test                  Config demo para pruebas (versionado, sin secretos)
.env.example               Plantilla para un proyecto real
scripts/
  seed.ts                  CLI del seed
  seed/seedData.ts         Datos ficticios (IDs y fechas fijos)
  seed/runSeed.ts          Lógica idempotente + protección "solo emuladores"
src/
  shared/types/            Contratos de Firestore (uno por colección)
  shared/constants/        Nombres de colecciones
  shared/firebase/         Inicialización de Firebase + conexión a emuladores
  shared/utils/dates.ts    Formato de fechas en America/Costa_Rica
  app/                     Rutas (routes.ts, AppRoutes.tsx) y ProtectedRoute
  auth/ contacts/ communications/   (Gabriel)
  sales/ products/                  (Dylan)
tests/
  unit/                    Vitest puro
  components/              Pantallas con Testing Library (jsdom)
  rules/                   Reglas contra el emulador (@firebase/rules-unit-testing)
  seed/                    Idempotencia e integridad referencial del seed
```

## Convenciones

- **Contratos:** los tipos de `src/shared/types/` son la fuente de verdad. No renombres campos ni colecciones sin avisar al otro.
- **Fechas:** se guardan como `Timestamp` de Firestore y se muestran con `src/shared/utils/dates.ts` (hora de Costa Rica).
- **Relaciones:** se guardan por ID (`contactId`, `saleId`, `userId`), nunca copiando texto.
- **Datos de prueba:** siempre ficticios (`@example.com`, `.test`, teléfonos `0000xxxx`).
- **Avisos:** son internos. El sistema no envía correos, SMS ni WhatsApp.
- **Índices:** el emulador **no** exige índices compuestos. Si agregás una consulta con `where` + `orderBy` sobre campos distintos, agregá el índice en `firestore.indexes.json`, porque en producción falla sin él.

## Usar un proyecto real (más adelante)

1. Copiá `.env.example` a `.env.production.local` y completalo con la config web del proyecto.
2. Corré `npx firebase login` y `npx firebase use --add` para elegir el proyecto real.
3. Desplegá con `npx firebase deploy --only firestore:rules,firestore:indexes`.
4. En *Authentication → Configuración → Acciones del usuario*, **desactivá la "Protección contra la enumeración de correos"**. Sin ese cambio, Auth no distingue "usuario inexistente" de "contraseña incorrecta" y no se cumple la HU-102.

El seed se niega a correr fuera de los emuladores o contra un proyecto que no sea `demo-*`.

## Problemas comunes

- **"Port 8080 is not open… port taken":** en Windows a veces queda vivo un proceso `java` del emulador después de cerrar. Buscalo con `Get-NetTCPConnection -LocalPort 8080` en PowerShell y cerralo, o reiniciá la terminal.
- **`ECONNREFUSED` en el seed:** los emuladores no están levantados.
- **`MetadataLookupWarning` en el seed o en las pruebas:** es inofensivo. El Admin SDK busca credenciales de Google Cloud que en local no existen.
