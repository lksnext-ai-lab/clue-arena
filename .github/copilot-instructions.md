# Copilot Instructions — clue-arena-app

## Contexto del proyecto

**Clue Arena — "El Algoritmo Asesinado"** es una plataforma de competición gamificada donde equipos de empleados desarrollan agentes IA que juegan al Cluedo. Es un monolito **Next.js 15** que incluye UI, API REST interna, servidor MCP del motor de juego y autenticación OIDC con Azure EntraID.

Fecha objetivo del evento: mayo 2026. Equipo: unipersonal. No hay backend Python independiente en MVP; toda la lógica reside en Next.js.

---

## Stack técnico

| Capa | Librería | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 15.x |
| UI | React | 19.x |
| Lenguaje | TypeScript (`strict: true`) | 5.x |
| Estilos | Tailwind CSS | 4.x |
| Componentes base | shadcn/ui (Radix UI) | latest |
| Autenticación | Auth.js (NextAuth v5) | 5.x beta |
| ORM / BD | Drizzle ORM + SQLite (`better-sqlite3`) | latest |
| Validación | Zod | 3.x |
| Formularios | React Hook Form + resolvers Zod | 7.x |
| MCP Server | `@modelcontextprotocol/sdk` | 1.x |
| Tests unitarios | Vitest + @testing-library/react | latest |
| Tests E2E | Playwright | latest |
| Linting / formato | ESLint (`eslint-config-next`) + Prettier | — |

---

## Estructura del repositorio

```
src/
├── app/                    # Next.js App Router (rutas + route handlers)
│   ├── layout.tsx          # Root layout (providers globales)
│   ├── page.tsx            # Redirección condicional según sesión
│   ├── login/              # UI-001 Login / Landing
│   ├── equipo/             # UI-002 Registro equipo, UI-003 Panel equipo
│   ├── ranking/            # UI-004 Ranking del evento
│   ├── partidas/[id]/      # UI-005 Vista partida (espectador)
│   ├── admin/              # UI-006/007/008 Panel admin + partidas
│   └── api/                # Route Handlers (API REST + MCP endpoint)
│       ├── auth/           # Auth.js handlers
│       ├── teams/          # GET/POST/PUT/DELETE /api/teams
│       ├── games/          # GET/POST /api/games + acciones de partida
│       ├── ranking/        # GET /api/ranking
│       └── mcp/            # MCP Server endpoint (/api/mcp)
├── components/
│   ├── ui/                 # Componentes shadcn/ui generados (NO editar a mano)
│   ├── game/               # Componentes de dominio del juego
│   ├── forms/              # Formularios (React Hook Form + Zod)
│   └── layout/             # AppShell, ErrorBanner, LoadingOverlay
├── contexts/
│   ├── SessionContext.tsx  # Usuario, rol, equipo activo
│   └── GameContext.tsx     # Estado partida activa + polling
├── lib/
│   ├── api/
│   │   ├── client.ts       # apiFetch wrapper con manejo de errores
│   │   └── mattin.ts       # Cliente SSE MattinAI (server-side)
│   ├── db/
│   │   ├── schema.ts       # Schema Drizzle (fuente de verdad del modelo)
│   │   └── index.ts        # Singleton de BD
│   ├── mcp/
│   │   ├── server.ts       # Instancia MCP Server
│   │   └── tools/          # Implementaciones de herramientas MCP
│   ├── game/
│   │   ├── engine.ts       # Lógica pura del motor Cluedo (sin I/O)
│   │   └── types.ts        # Tipos internos del motor
│   ├── auth/
│   │   ├── config.ts       # Configuración Auth.js (Node.js runtime)
│   │   └── edge-config.ts  # Configuración Auth.js (Edge runtime, middleware)
│   └── utils/              # Formateadores, clases de error
├── middleware.ts            # Protección de rutas por rol (Edge runtime)
└── types/
    ├── api.ts              # Tipos request/response de la API
    └── domain.ts           # Tipos de dominio exportados
```

---

## Convenciones de código

### TypeScript
- `strict: true` en `tsconfig.json`. No usar `any` salvo casos excepcionales documentados con comentario.
- Importaciones con alias `@/` (mapeado a `src/`).
- Tipos de dominio compartidos en `src/types/domain.ts`; tipos de API en `src/types/api.ts`.
- Tipos del motor de juego en `src/lib/game/types.ts`.

### Componentes React
- **Server Components por defecto** para todo lo que no requiera interactividad de cliente.
- Añadir `"use client"` solo cuando se necesiten: hooks de estado/efecto, polling, formularios controlados, manejadores de eventos de navegador.
- Componentes de dominio del juego en `src/components/game/`.
- Componentes `shadcn/ui` en `src/components/ui/` — generados con el CLI de shadcn, **no editar manualmente**.

### Estilos
- Tailwind CSS 4. Usar `cn()` (helper `clsx` + `tailwind-merge`) para combinar clases condicionalmente.
- No escribir CSS en módulos separados salvo `globals.css` para variables o reset.

### Formularios
- Siempre React Hook Form con resolver de Zod. El mismo esquema Zod se usa para validación en cliente y en el Route Handler.
- Los esquemas de validación van en `src/lib/schemas/`.

### Fetching en cliente
- Usar `apiFetch<T>()` de `src/lib/api/client.ts` para todas las llamadas a la API interna desde el cliente.
- `apiFetch` gestiona automáticamente 401 (redirect a `/login`) y 403 (`ForbiddenError`).

### Route Handlers (API)
- Estructura estándar por recurso:
  ```typescript
  // app/api/resource/route.ts
  import { NextRequest, NextResponse } from 'next/server';
  import { auth } from '@/lib/auth/edge-config';

  export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // ...
    return NextResponse.json(data);
  }
  ```
- Validar body con Zod antes de procesar. Retornar errores con el status HTTP correcto.
- Autorización explícita por endpoint (no delegar solo al middleware).

### Base de datos
- **No escribir SQL crudo**. Usar siempre la API query de Drizzle ORM.
- El schema en `src/lib/db/schema.ts` es la fuente de verdad. Generar migraciones con `pnpm db:generate`.
- Instancia singleton del DB en `src/lib/db/index.ts`.
- No importar el singleton `db` en archivos que corren en Edge runtime (middleware).

### Autenticación
- `src/lib/auth/config.ts` — para Node.js runtime (Route Handlers, Server Components).
- `src/lib/auth/edge-config.ts` — para Edge runtime (middleware). No importa Drizzle directamente.
- Variables de entorno requeridas: `AUTH_SECRET`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `DATABASE_URL`, `MATTIN_API_URL`, `MATTIN_API_KEY`, `MCP_AUTH_TOKEN`.
- Para desarrollo local sin OIDC: `DISABLE_AUTH=true` activa el modo dev con usuarios simulados.

### Gestión de estado
- Sin Redux ni Zustand. Tres niveles:
  1. **Server Components**: datos leídos en render (sin estado persistente).
  2. **`SessionContext`**: usuario, rol y equipo activo. Consumir via `useAppSession()`.
  3. **`GameContext`**: estado de partida activa con polling. Activo bajo rutas `/partidas/[id]` y `/admin/partidas/[id]`.
- Estado de formularios con React Hook Form + `useReducer` local cuando aplique.

### Polling
- Implementado con `useInterval` (hook utilitario) sobre `apiFetch`.
- Intervalos estándar: 30 s (equipo/ranking), 5 s (espectador partida), 3 s (admin detalle partida).
- Siempre limpiar el intervalo al desmontar el componente.

---

## Motor de juego (`src/lib/game/engine.ts`)

- **Lógica pura sin I/O**: no importar `db`, `fetch` ni ninguna dependencia de runtime.
- Todas las funciones deben ser testeables de forma aislada con Vitest.
- Los tipos del motor se definen en `src/lib/game/types.ts` y son independientes de los tipos de BD.

---

## MCP Server (`src/lib/mcp/`)

- Expuesto como Route Handler en `/api/mcp` (excluido del matcher de sesión del middleware).
- Autenticación mediante token Bearer (`MCP_AUTH_TOKEN`). **No usar sesión de usuario**.
- Herramientas MCP en `src/lib/mcp/tools/`. Cada herramienta en su propio fichero.
- Validar entradas y salidas de herramientas con Zod.
- El endpoint `/api/mcp` NO debe importar nada de `src/lib/auth/`.

---

## Roles y RBAC

| Rol | Valor en BD | Acceso |
|---|---|---|
| Administrador | `admin` | Todas las rutas, incluyendo `/admin/**` |
| Equipo | `equipo` | `/equipo/**`, `/ranking`, `/partidas/**` |
| Espectador | `espectador` | `/ranking`, `/partidas/**` |

- RBAC aplicado en middleware (`src/middleware.ts`) para rutas de página.
- RBAC **también aplicado explícitamente** en cada Route Handler que lo requiera.

---

## Testing

- **Unitarios** (Vitest + @testing-library/react): ficheros en `src/tests/` o colocados junto a la unidad con sufijo `.test.ts`.
- **E2E** (Playwright): ficheros en `e2e/` con sufijo `.spec.ts`.
- El motor de juego (`engine.ts`) debe tener cobertura unitaria completa.
- Para componentes: prefer `@testing-library/react` sobre snapshots.
- Mocks de `fetch` con MSW (`src/tests/setup.ts`).

---

## Scripts disponibles

| Script | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run type-check` | Verificación de tipos TypeScript |
| `npm run test` | Tests unitarios (Vitest) |
| `npm run test:e2e` | Tests E2E (Playwright) |
| `npm run db:generate` | Generar migraciones Drizzle |
| `npm run db:migrate` | Aplicar migraciones |
| `npm run db:studio` | Drizzle Studio (UI de BD) |

---

## Flujo de implementación

Seguir este orden al desarrollar cualquier funcionalidad nueva:

### 1. Planificar la jerarquía de componentes
- Identificar qué partes son Server Components (datos, sin interactividad) y cuáles Client Components (polling, formularios, estado).
- Definir dónde vive el estado: Server render → `SessionContext` → `GameContext` → `useReducer` local.
- Ubicar el Route Handler correspondiente en `src/app/api/`.

### 2. Definir tipos e interfaces
- Tipos de dominio en `src/types/domain.ts`.
- Tipos de request/response en `src/types/api.ts`.
- Si afecta al motor de juego, tipos en `src/lib/game/types.ts`.
- Esquemas Zod de validación en `src/lib/schemas/` (reutilizados en cliente y servidor).

### 3. Implementar la lógica del servidor
- Schema Drizzle en `src/lib/db/schema.ts` si se añaden entidades.
- Generar migración: `npm run db:generate` y aplicar: `npm run db:migrate`.
- Route Handler en `src/app/api/<recurso>/route.ts`:
  - Verificar sesión con `auth()`.
  - Validar body/params con Zod.
  - Aplicar RBAC explícito.
  - Llamar al motor de juego puro si aplica, persistir antes/después con Drizzle.
  - Retornar `NextResponse.json(data)` o error con status HTTP correcto.

### 4. Construir los componentes cliente
- Añadir `"use client"` solo si el componente necesita estado, efectos o eventos de navegador.
- Llamar a la API mediante `apiFetch<T>()` de `src/lib/api/client.ts`.
- Formularios con React Hook Form + resolver Zod del esquema ya definido.
- Componer con componentes `shadcn/ui` de `src/components/ui/` (no editar esos ficheros).
- Usar `cn()` para combinar clases Tailwind condicionalmente.

### 5. Gestionar errores
- Capturar `ForbiddenError` y `ServerError` lanzados por `apiFetch`.
- Mostrar `<ErrorBanner>` para errores recuperables; redirigir a `/login` en 401 (ya lo hace `apiFetch`).
- En Route Handlers: responder siempre con `{ error: string }` y el status HTTP adecuado (400, 401, 403, 404, 409, 500).
- En el motor de juego: lanzar errores tipados sin depender de I/O.

### 6. Aplicar estilos responsive
- Mobile-first con breakpoints de Tailwind (`sm:`, `md:`, `lg:`).
- Usar `cn()` para variantes condicionales.
- Ajustar `AppShell` si la pantalla requiere layout diferente.

### 7. Añadir estados de carga y vacío
- Todo componente con fetch asíncrono debe gestionar: **loading**, **error**, **vacío** y **datos**.
- Usar `<LoadingOverlay>` para bloqueos de pantalla completa o skeleton inline para secciones parciales.
- En polling (`GameContext`, `useInterval`): mantener los datos previos mientras se recarga (no flash de vacío).

### 8. Escribir tests
- **Motor de juego** (`engine.ts`): test unitario en `src/tests/game-engine.test.ts` — cobertura completa obligatoria.
- **Componentes**: `@testing-library/react` en `src/tests/`. Probar estados: cargando, error, vacío, con datos.
- **Route Handlers**: Vitest + MSW para mockear llamadas externas si aplican.
- **E2E críticos**: `e2e/*.spec.ts` con Playwright para flujos de login, registro de equipo y visualización de partida.

---

## Comprobaciones antes de hacer commit

```bash
# 1. Sin errores de tipos
npm run type-check

# 2. Sin errores de lint
npm run lint

# 3. Tests unitarios en verde
npm run test

# 4. Build de producción sin errores
npm run build
```

Comprobaciones adicionales según el cambio:

| Cambio | Comprobación extra |
|---|---|
| Nuevo schema Drizzle | `npm run db:generate` → revisar migración generada |
| Nuevo Route Handler | Verificar auth + RBAC + validación Zod + status HTTP |
| Nuevo componente con `"use client"` | Confirmar que no importa `db` ni `auth/config.ts` |
| Cambio en `engine.ts` | Test unitario actualizado; sin imports de `db`/`fetch` |
| Nueva herramienta MCP | Esquema Zod de entrada/salida; sin imports de `src/lib/auth/` |
| Cambio en middleware | Probar rutas protegidas con `DISABLE_AUTH=true` en dev |

---

## Restricciones importantes

- No importar `src/lib/db/index.ts` ni `src/lib/auth/config.ts` en ficheros que se ejecuten en **Edge runtime** (middleware u otras Edge Functions).
- No modificar ficheros en `src/components/ui/` manualmente — son gestionados por el CLI de shadcn/ui.
- `/api/mcp` debe permanecer excluido del matcher del middleware para que MattinAI pueda acceder con su token propio.
- El motor de juego (`engine.ts`) debe mantenerse sin dependencias de I/O. Toda persistencia se hace en los Route Handlers antes o después de llamar al motor.
- `strict: true` en TypeScript. No degradar esta configuración.
