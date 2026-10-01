# SaaS Subscription Management System

Dashboard B2B para la gestión de **licencias de software** y el **consumo de API** de las
empresas cliente. Los usuarios pueden visualizar su consumo y los administradores pueden
asignar licencias de forma optimista desde el panel.

- **Backend**: API REST con **NestJS + Prisma + PostgreSQL**, autenticación **JWT** con
  guard de roles (`ADMIN`/`USER`) y resiliencia centralizada.
- **Frontend**: SPA con **Vue 3 + TypeScript + TailwindCSS**, gráficos con **Chart.js**
  y tabla interactiva con render memoizado.

---

## Índice

- [Arquitectura de infraestructura](#arquitectura-de-infraestructura)
- [Arquitectura de software](#arquitectura-de-software)
- [Stack tecnológico](#stack-tecnológico)
- [Puesta en marcha (un solo comando)](#puesta-en-marcha-un-solo-comando)
- [Ejecución manual sin Docker](#ejecución-manual-sin-docker)
- [Variables de entorno](#variables-de-entorno)
- [Base de datos](#base-de-datos)
- [API REST](#api-rest)
- [Frontend](#frontend)
- [Usuarios de demostración](#usuarios-de-demostración)
- [Pruebas y cobertura](#pruebas-y-cobertura)
- [CI/CD](#cicd)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Supuestos](#supuestos)
- [Decisiones técnicas](#decisiones-técnicas)

---

## Arquitectura de infraestructura

```
                      ┌─────────────────────────────────────────────┐
                      │              Docker Compose                │
                      │                                             │
  Usuario ──▶ :5173 ──▶ Frontend (Vite dev server)                 │
              SPA     │   proxy /api ──────────────┐                │
                      │                            ▼                │
                      │                     Backend (NestJS) :3000  │
                      │                        │  /api/v1           │
                      │                        ▼                    │
                      │                 PostgreSQL :5432            │
                      │                                             │
                      │   pgAdmin :5050 (interfaz para la DB)       │
                      └─────────────────────────────────────────────┘
```

- El frontend se comunica con la API **a través del proxy de Vite** (`/api/v1` → backend),
  por lo que no hay problemas de CORS en desarrollo.
- Toda la API vive bajo el prefijo global **`/api/v1`**.
- El frontend también funciona detrás de `docker compose` y en build de producción
  (el proxy solo aplica al dev server).

## Arquitectura de software

El backend sigue una **arquitectura hexagonal ligera (puertos y adaptadores)** organizada
por **bounded contexts**, con las reglas de Clean Architecture y DDD aplicadas al mínimo
necesario para el tamaño del proyecto:

```
backend/src/
├── shared/            # Dominio y abstrucciones transversales
│   ├── domain/            # Role (tipos de rol compartidos)
│   ├── presentation/      # HealthController + decoradores (@Public, @Roles, @CurrentUser)
│   └── infrastructure/    # PrismaModule/Service, JwtAuthGuard, RolesGuard,
│                          # AllExceptionsFilter (puertos y adaptadores comunes)
├── identity/          # Contexto: identidad y acceso (login, usuarios, roles)
│   ├── domain/            # entidades User/Company + puertos UserRepository,
│   │                      # PasswordHasher, TokenProvider (interfaces + symbols DI)
│   ├── application/       # AuthService, UsersService (casos de uso; traducen
│   │                      # errores de dominio a excepciones HTTP)
│   ├── infrastructure/    # adaptadores: PrismaUserRepository, BcryptPasswordHasher,
│   │                      # JwtTokenProvider, JwtStrategy
│   └── presentation/      # AuthController, UsersController + DTOs validados
├── licensing/         # Contexto: ciclo de vida de licencias (asignar/límites)
│   ├── domain/            # LicenseStatus + LicenseRepository (puertos),
│   │                      # DuplicateLicenseError/SeatLimitReachedError/...
│   ├── application/       # LicensesService (casos de uso con transacciones)
│   ├── infrastructure/    # PrismaLicenseRepository (adaptador con tx serializable)
│   └── presentation/      # LicensesController + DTOs
└── consumption/       # Contexto: consumo de API y reportes
    ├── domain/            # UsageReport + UsageRepository (puertos)
    ├── application/       # UsageService
    ├── infrastructure/    # PrismaUsageRepository
    └── presentation/      # UsageController
```

**Reglas aplicadas:**

- El **dominio y la aplicación nunca importan Prisma ni Nest** (solo tipos puros e
  interfaces); el único punto que conoce la base de datos son los adaptadores bajo
  `*/infrastructure/*` — verificable con
  `grep -r "generated/prisma" src | grep -v infrastructure` (debe estar vacío).
- Los puertos se inyectan como **symbols** (`USER_REPOSITORY`, `LICENSE_REPOSITORY`,
  `USAGE_REPOSITORY`, `PASSWORD_HASHER`, `TOKEN_PROVIDER`) y los módulos los enlazan con
  `useClass` — cambiar de persistencia o de hasher no toca los casos de uso.
- Los **errores de dominio** (`DuplicateLicenseError`, `SeatLimitReachedError`,
  `CompanyNotFoundError`) se traducen a excepciones HTTP en la capa de aplicación, no en
  el controlador.
- Los **módulos por contexto** (`IdentityModule`, `LicensingModule`,
  `ConsumptionModule`) exponen solo lo necesario: `LicensingModule` importa
  `IdentityModule` para resolver `USER_REPOSITORY` (evita acoplamiento circular).
- **Why PostgreSQL**: relaciones reales con integridad referencial (FK + `@@unique`),
  transacciones `SERIALIZABLE` para el asiento de licencias y Prisma como capa tipada
  sobre ella; para este volumen, una DB relacional en Docker es lo simple y comprobable.

## Stack tecnológico

| Capa      | Tecnologías                                                            |
| --------- | ---------------------------------------------------------------------- |
| Backend   | NestJS 12, Prisma 7 (adapter-pg), PostgreSQL 15, Passport JWT, bcryptjs |
| Frontend  | Vue 3.5, TypeScript, Vite 8, TailwindCSS 4, Pinia 4, Vue Router 5       |
| Gráficos  | Chart.js 4 + vue-chartjs 5 (chunk lazy)                                |
| Calidad   | Vitest (unit + e2e), ESLint, oxlint, Prettier, vue-tsc, tsc            |
| Infra     | Docker Compose, GitHub Actions CI                                       |

## Puesta en marcha (un solo comando)

**Requisitos**: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (incluye
`docker compose` v2) con el daemon en ejecución.

```bash
docker compose up -d --build
```

Ese único comando levanta **PostgreSQL + backend + frontend + pgAdmin**: el backend
aplica migraciones (`db:deploy`) y siembra los datos de ejemplo (`db:seed`) automáticamente
al arrancar. Luego abre **http://localhost:5173** e inicia sesión con cualquier usuario de
[demostración](#usuarios-de-demostración).

| Servicio            | URL                          | Puerto    |
| ------------------- | ---------------------------- | --------- |
| Frontend (app)      | http://localhost:5173        | `5173`    |
| API (vía proxy)     | http://localhost:5173/api/v1 | `5173`    |
| API (directa)       | http://127.0.0.1:3000/api/v1 | `3000`    |
| PostgreSQL          | localhost:5432               | `5432`    |
| pgAdmin             | http://localhost:5050        | `5050`    |

> **Nota**: usa `localhost` (y no `127.0.0.1`) para el frontend, y `127.0.0.1` para
> llamar al backend directamente.

### Comandos útiles de Docker

```bash
docker compose ps                  # estado de los containers
docker compose logs -f backend     # logs en vivo del backend
docker compose restart backend     # reiniciar backend (Nest --watch no recarga bind-mounts en Windows)
docker compose down                # parar todo (conserva los datos de la DB)
```

## Ejecución manual sin Docker

**Requisitos**: Node.js ≥ 20, pnpm, PostgreSQL corriendo localmente.

```bash
# Base de datos
createdb saas_subscription            # o desde psql: CREATE DATABASE saas_subscription;

# Backend
cd backend
pnpm install
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/saas_subscription"
pnpm db:generate                      # genera el cliente Prisma
pnpm db:migrate                       # aplica migraciones
pnpm db:seed                          # datos de ejemplo
pnpm dev                              # http://localhost:3000

# Frontend (otra terminal)
cd frontend
pnpm install
pnpm dev                              # http://localhost:5173 (proxy a 127.0.0.1:3000)
```

## Variables de entorno

### Backend

| Variable           | Ejemplo                                          | Descripción                       |
| ------------------ | ------------------------------------------------ | --------------------------------- |
| `DATABASE_URL`     | `postgresql://postgres:postgres@db:5432/saas_subscription` | Conexión a PostgreSQL      |
| `PORT`             | `3000`                                           | Puerto del API                    |
| `JWT_SECRET`       | `dev-secret-change-me`                           | Secreto para firmar los JWT       |
| `JWT_EXPIRES_IN`   | `1h`                                             | Vigencia del token                |

En Docker todos tienen valores por defecto en `docker-compose.yml` (solo `JWT_SECRET`
puedes sobreescribirlo con un archivo `.env` en la raíz).

### Frontend

| Variable            | Ejemplo                     | Descripción                                  |
| ------------------- | --------------------------- | -------------------------------------------- |
| `VITE_API_URL`      | `/api/v1`                   | Prefijo base del API usado por el cliente    |
| `VITE_PROXY_TARGET` | `http://backend:3000`       | Destino del proxy de Vite en desarrollo      |

## Base de datos

- **Migraciones**: `pnpm db:generate` (cliente), `pnpm db:migrate` (dev),
  `pnpm db:deploy` (producción).
- **Seed**: `pnpm db:seed` — crea la empresa _Acme Corporation_ (25 licencias,
  límite de 100.000 llamadas/mes) y 10 usuarios con hashes bcrypt de `Password123!`.
  Es **idempotente**: actualiza usuarios existentes y no duplica.
- **Prisma Studio**: `pnpm db:studio` (UI en el puerto 5555).
- **pgAdmin**: http://localhost:5050 — `admin@example.com` / `admin`, conexión
  host `db`, usuario `postgres`, contraseña `postgres`, DB `saas_subscription`.

## API REST

Prefijo global: **`/api/v1`**. Autenticación: header `Authorization: Bearer <token>`.

| Método | Ruta                | Acceso    | Descripción                                                              |
| ------ | ------------------- | --------- | ------------------------------------------------------------------------ |
| `GET`  | `/health`           | público   | Health check → `{ status: "ok", timestamp }`                             |
| `POST` | `/auth/login`       | público   | `{ email, password }` → `{ accessToken, tokenType, user }`               |
| `GET`  | `/auth/me`          | JWT       | Perfil del usuario autenticado                                           |
| `GET`  | `/usage`            | JWT       | Reporte de consumo: empresa, KPIs de licencias, API y serie diaria       |
| `GET`  | `/usage/me`         | JWT       | Consumo personal: licencia, total/promedio de llamadas y serie de 30 días |
| `GET`  | `/users`            | JWT       | Usuarios de la empresa con su licencia activa (tenant-scoped por el JWT) |
| `PATCH` | `/users/:id/role`  | JWT+ADMIN | `{ role: ADMIN\|USER }` — 404 fuera de la empresa, 409 si es tu propio rol o el último admin |
| `POST` | `/licenses/assign`  | JWT+ADMIN | `{ userId }` → asigna licencia `ACTIVE` (404 si no es de la empresa)     |
| `POST` | `/licenses/revoke`  | JWT+ADMIN | `{ userId }` → revoca la licencia activa con `revokedAt` (404/409)       |

### Ejemplos con curl

```bash
# Login
TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa.com","password":"Password123!"}' | jq -r .accessToken)

# Consumo
curl -s http://127.0.0.1:3000/api/v1/usage -H "Authorization: Bearer $TOKEN" | jq

# Usuarios de la empresa
curl -s http://127.0.0.1:3000/api/v1/users -H "Authorization: Bearer $TOKEN" | jq

# Asignar licencia a un usuario (solo ADMIN)
curl -s -X POST http://127.0.0.1:3000/api/v1/licenses/assign \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"userId":"<uuid-del-usuario>"}' | jq

# Revocar la licencia activa de un usuario (solo ADMIN)
curl -s -X POST http://127.0.0.1:3000/api/v1/licenses/revoke \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"userId":"<uuid-del-usuario>"}' | jq

# Cambiar el rol de un usuario (solo ADMIN)
curl -s -X PATCH http://127.0.0.1:3000/api/v1/users/<uuid-del-usuario>/role \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"role":"ADMIN"}' | jq

# Consumo personal del usuario autenticado (cualquier rol)
curl -s http://127.0.0.1:3000/api/v1/usage/me -H "Authorization: Bearer $TOKEN" | jq
```

### Manejo de errores

Todas las respuestas de error usan un **envolvente uniforme** generado por
`AllExceptionsFilter`:

```json
{
  "statusCode": 409,
  "message": "User already has an active license",
  "error": "Conflict",
  "path": "/api/v1/licenses/assign",
  "timestamp": "2026-10-01T00:00:00.000Z"
}
```

Códigos habituales: `400` DTO inválido · `401` sin token/expirado · `403` sin rol ADMIN
o límite alcanzado · `404` recurso/tenant inexistente · `409` licencia duplicada ·
`503` base de datos no disponible.

Validación de entrada con `class-validator` en todos los DTOs y
`ValidationPipe({ whitelist: true })` global.

## Frontend

- **Rutas** (con guards): `/login` (solo invitados) y `/` (dashboard, requiere sesión);
  los intentos con redirect se sanitizan contra open-redirects y una sesión `401`
  cierra la sesión y redirige al login.
- **`DashboardView`**: banner de estado (`healthy`/`warning`/`exceeded`), tarjetas de
  KPI (consumo API, licencias usadas/disponibles) con progress bars, **gráfico de línea**
  del consumo diario (registrado bajo `defineAsyncComponent` → se sirve como **chunk
  separado** y solo se descarga al entrar al dashboard) y **tabla de usuarios** con
  búsqueda (debounce), orden por columnas, badges de licencia y **asignación optimista**
  (`POST /licenses/assign` + actualización local + refresco del reporte).
- **Rendimiento**: `shallowRef` para los datos, `v-memo` en las filas de la tabla y
  polling de `/usage` cada 30 s que se pausa cuando la pestaña está oculta y se detiene
  al desmontar.
- **TailwindCSS 4** vía plugin de Vite; sin component library.

### Scripts del frontend

```bash
pnpm dev               # servidor de desarrollo
pnpm build             # type-check + build de producción
pnpm test:run          # tests unitarios (Vitest)
pnpm test:coverage     # tests + cobertura con thresholds del 80%
pnpm check:lint        # oxlint + eslint
pnpm type-check        # vue-tsc
pnpm format:check      # prettier
```

## Usuarios de demostración

Contraseña de **todos** los usuarios: `Password123!`

| Email                     | Rol    | Licencia | Uso recomendado                                  |
| ------------------------- | ------ | -------- | ------------------------------------------------ |
| `admin@empresa.com`       | ADMIN  | ✅       | Ver todo y asignar licencias                     |
| `usuario@empresa.com`     | USER   | ✅       | Dashboard sin acciones de asignación             |
| `diego.ramos@empresa.com` | USER   | ❌       | Probar la asignación de licencias (como ADMIN)   |
| `pablo.mendoza@empresa.com` | USER | ❌       | Probar la asignación de licencias (como ADMIN)   |

Además existen 6 usuarios más con licencia activa (`maria.garcia@`, `carlos.lopez@`,
`sofia.martinez@`, `jorge.ruiz@`, `laura.torres@`, `elena.vargas@` — todos
`@empresa.com`).

## Pruebas y cobertura

Ambos proyectos exigen **≥ 80% de cobertura** (statements/branches/functions/lines)
como **threshold de Vitest**: el comando falla si baja del mínimo.

```bash
# Backend (unit + e2e sin BD: usa un fake de Prisma)
cd backend
pnpm test:coverage
# 76 tests · 98%+ stmts · 95%+ branches

# Frontend (jsdom + @vue/test-utils)
cd frontend
pnpm test:coverage
# 51 tests · 94%+ stmts · 87%+ branches
```

- Los e2e del backend (`backend/test/*.e2e-spec.ts`) montan la app real con
  `create-app.ts` y un `FakePrismaService` — corren sin PostgreSQL.
- La cobertura se reporta en `coverage/` (texto, HTML y `lcov.info`).

## CI/CD

`.github/workflows/ci.yml` se ejecuta en cada push/PR hacia `main` con dos jobs
paralelos (`pnpm` + caché):

1. **Backend**: `format:check` → `lint` → `typecheck` → `test:coverage` → `build`
2. **Frontend**: `format:check` → `check:lint` → `type-check` → `test:coverage` → `build`

## Estructura del proyecto

```
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # modelos Company, User, License
│   │   ├── migrations/            # migraciones versionadas
│   │   └── seed.ts                # datos de ejemplo
│   ├── src/
│   │   ├── shared/                # dominio transversal, Prisma, guards y filters
│   │   ├── identity/              # login JWT, usuarios, roles (hexagonal)
│   │   ├── licensing/             # POST /licenses/assign (ADMIN)
│   │   ├── consumption/           # GET /usage
│   │   ├── app.module.ts          # pipes, guards y filters globales
│   │   └── main.ts
│   └── test/                      # e2e + fakes (sin BD real)
├── frontend/
│   └── src/
│       ├── api/                   # cliente fetch tipado (ApiError, apiFetch)
│       ├── components/dashboard/  # UsageChart, UserTable, builders del chart
│       ├── router/                # guards, lazy routes, sanitizado de redirects
│       ├── stores/                # Pinia: auth (token + usuario + logout 401)
│       ├── views/                 # LoginView, DashboardView
│       └── App.vue                # shell con navbar y logout
├── .github/workflows/ci.yml
├── docker-compose.yml
└── README.md
```

## Supuestos

Decisiones tomados ante ambigüedades del enunciado (criterio de evaluación de "Supuestos"):

1. **"Asignar roles" = cambiar el `role` (ADMIN/USER) de un usuario existente**, no crear
   usuarios nuevos; con salvaguardas (no degradar el último ADMIN de la empresa).
2. **"Desasignar licencia" = estado `REVOKED` con historial**, no borrado físico: las
   licencias quedan trazables (`License.status` incluye `REVOKED`/`revokedAt`).
3. **"Consumo en tiempo real" por usuario**: el `UsageMetric` agregado (por empresa) se
   complementa con una métrica diaria por usuario, porque el enunciado distingue el punto
   de vista del usuario (su consumo) del del administrador (el de su empresa).
4. **No existe cuota/crédito individual de API**: los límites (`callsLimit`) son por
   empresa; las "alertas" se derivan de los KPIs/progress bars del dashboard (no se
   inventó una feature de notificaciones push).
5. **"Consumo de la empresa" = tenant del JWT** (`companyId` del token): `GET /usage` y
   `GET /users` devuelven siempre los datos de la empresa del usuario autenticado.
6. **Ventana de consumo**: 30 días (seed y dashboards), consistente con `callsLimit`
   mensual.
7. **Reintentos/timeouts de red**: marcados como opcionales en los criterios → fuera de
   alcance; la resiliencia se cubre con el filtro global de excepciones.

## Decisiones técnicas

- **NestJS + Prisma** por ser el stack pedido en los criterios; ESM con imports
  explícitos `.js` y cliente Prisma generado en `src/generated` (fuera de git).
- **Reintentos y timeouts quedaron fuera de alcance** (los criterios los marcan como
  opcionales); la resiliencia se cubre con el filtro global de excepciones
  (reintento de conexión de Prisma → `503`, mapeo de códigos Prisma P2002/P2003/P2025).
- **Tenant-scoping por JWT**: `companyId` viene del token, nunca del body — un usuario
  no puede leer ni asignar licencias fuera de su empresa.
- **Asignación optimista** en el frontend: la fila se actualiza al instante y se
  reconcilia con `GET /usage`; si el backend rechaza (403/409) se revierte.
- **Roles en backend**: aunque el frontend oculta los botones a `USER`, el endpoint
  `POST /licenses/assign` exige `ADMIN` (defensa en profundidad).
- **Cobertura ≥ 80%** forzada en CI en ambos proyectos (criterio 8).
