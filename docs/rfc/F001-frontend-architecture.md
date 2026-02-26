# RFC F001 — Arquitectura Frontend: Clue Arena

| Campo | Valor |
|---|---|
| **ID** | F001 |
| **Título** | Arquitectura Frontend de la aplicación Clue Arena |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-02-26 |
| **Refs. spec** | [00-context](../../clue-arena-spec/docs/spec/00-context.md) · [40-arquitectura](../../clue-arena-spec/docs/spec/40-arquitectura.md) · [70-frontend](../../clue-arena-spec/docs/spec/70-frontend.md) · [30-ui-spec](../../clue-arena-spec/docs/spec/30-ui-spec.md) |

---

## 1. Resumen

Este documento describes la arquitectura de implementación del frontend de **Clue Arena — "El Algoritmo Asesinado"**: una plataforma de competición gamificada donde equipos de empleados desarrollan agentes IA que juegan al Cluedo. La aplicación es un monolito Next.js 15 que integra la interfaz de usuario, la capa de API REST interna, el servidor MCP del motor de juego y la autenticación OIDC con Azure EntraID.

El stack está determinado por la especificación: **Next.js 15 + React 19 + TypeScript + Tailwind CSS**. Este RFC define las decisiones de estructura de proyecto, gestión de estado, routing, acceso a datos, autenticación, estrategia de componentes y testing para que el desarrollo sea coherente y predecible desde el inicio.

---

## 2. Motivación y contexto

- La app tiene un plazo fijo (~mayo 2026) y un equipo unipersonal.
- Es un evento puntual, por lo que la complejidad de infraestructura debe ser mínima.
- El MVP incluye 8 pantallas, 3 roles, autenticación corporativa OIDC, polling en tiempo real, un motor de juego expuesto como servidor MCP y un cliente SSE hacia MattinAI.
- No hay backend Python independiente en MVP: toda la lógica reside en Next.js (Server Components, API Routes, Route Handlers).
- El diseño tiene que soportar la extracción futura del MCP Server a un proceso Python independiente sin reescribir la UI.

---

## 3. Stack técnico

### 3.1 Dependencias principales

| Capa | Librería / herramienta | Versión objetivo | Motivo |
|---|---|---|---|
| Framework | Next.js | 15.x (App Router) | Obligatorio por spec; SSR + API Routes en un proceso |
| UI Library | React | 19.x | Peer dep de Next.js |
| Lenguaje | TypeScript | 5.x (`strict: true`) | NFR-007 |
| Estilos | Tailwind CSS | 4.x | Obligatorio por spec |
| Componentes base | shadcn/ui | latest | Componentes accesibles sobre Radix UI + Tailwind; sin bloqueo de vendor |
| Autenticación | Auth.js (NextAuth v5) | 5.x beta | Integración OIDC lista para EntraID; gestión de sesión con cookie httpOnly; elimina código de handshake OIDC manual. |
| ORM / acceso BD | Drizzle ORM | latest | Type-safe, ligero, compatible con SQLite/LibSQL; sin necesidad de cliente Python |
| Base de datos (MVP) | SQLite (via `better-sqlite3`) | — | ADR-0006; sin servidor extra |
| Validación esquema | Zod | 3.x | Validación compartida cliente/servidor; integra con formularios |
| Formularios | React Hook Form | 7.x | Resolvers Zod; mínimo boilerplate |
| Fetching SSE cliente | `EventSource` nativo | — | Para consumo SSE de MattinAI en server-side |
| Testing unitario | Vitest | latest | Rápido, compatible con ESM, config en `vite.config.ts` |
| Testing componentes | @testing-library/react | latest | Estándar React |
| Testing E2E | Playwright | latest | Smoke tests de rutas críticas; NFR tests |
| Linting | ESLint + eslint-config-next | — | Next.js built-in |
| Formateo | Prettier | latest | Consistencia de estilo |

### 3.2 Dependencias del servidor MCP (embebido en MVP)

| Capa | Librería | Motivo |
|---|---|---|
| MCP Server SDK | `@modelcontextprotocol/sdk` | SDK oficial para implementar el MCP Server como Route Handler HTTP |
| Validación MCP tools | Zod | Esquemas de entrada/salida de herramientas MCP tipados |

---

## 4. Estructura de directorios

```
clue-arena-app/
├── docs/
│   └── rfc/
│       └── F001-frontend-architecture.md   ← este documento
├── src/
│   ├── app/                                ← Next.js App Router (rutas)
│   │   ├── layout.tsx                      ← Root layout (providers globales)
│   │   ├── page.tsx                        ← Redirección raíz (/ → /login o /equipo)
│   │   ├── login/
│   │   │   └── page.tsx                    ← UI-001 Login / Landing
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts                ← Auth.js route handler (OIDC callback)
│   │   ├── equipo/
│   │   │   ├── page.tsx                    ← UI-003 Panel de equipo
│   │   │   └── registro/
│   │   │       └── page.tsx                ← UI-002 Registro de equipo
│   │   ├── ranking/
│   │   │   └── page.tsx                    ← UI-004 Ranking del evento
│   │   ├── partidas/
│   │   │   └── [id]/
│   │   │       └── page.tsx                ← UI-005 Vista partida (espectador)
│   │   ├── admin/
│   │   │   ├── page.tsx                    ← UI-006 Panel Admin
│   │   │   └── partidas/
│   │   │       ├── nueva/
│   │   │       │   └── page.tsx            ← UI-007 Crear partida
│   │   │       └── [id]/
│   │   │           └── page.tsx            ← UI-008 Detalle partida (Admin)
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts            ← Auth.js handler (GET/POST)
│   │       ├── teams/
│   │       │   ├── route.ts                ← GET /api/teams, POST /api/teams
│   │       │   └── [id]/
│   │       │       └── route.ts            ← GET/PUT/DELETE /api/teams/:id
│   │       ├── games/
│   │       │   ├── route.ts                ← GET /api/games, POST /api/games
│   │       │   └── [id]/
│   │       │       ├── route.ts            ← GET /api/games/:id
│   │       │       ├── start/
│   │       │       │   └── route.ts        ← POST /api/games/:id/start
│   │       │       └── stop/
│   │       │           └── route.ts        ← POST /api/games/:id/stop
│   │       ├── ranking/
│   │       │   └── route.ts                ← GET /api/ranking
│   │       └── mcp/
│   │           └── route.ts                ← MCP Server endpoint (HTTP/SSE)
│   │                                       ← /api/mcp (accesible por MattinAI)
│   ├── components/
│   │   ├── ui/                             ← Componentes shadcn/ui generados
│   │   ├── game/                           ← Componentes de dominio del juego
│   │   │   ├── GameStatusBadge.tsx
│   │   │   ├── PlayerCard.tsx
│   │   │   ├── SuggestionRow.tsx
│   │   │   └── RankingTable.tsx
│   │   ├── forms/                          ← Formularios (React Hook Form + Zod)
│   │   │   ├── TeamRegistrationForm.tsx
│   │   │   └── CreateGameForm.tsx
│   │   └── layout/                         ← Shell, navegación, ErrorBanner
│   │       ├── AppShell.tsx
│   │       ├── ErrorBanner.tsx
│   │       └── LoadingOverlay.tsx
│   ├── contexts/                           ← React Contexts globales
│   │   ├── SessionContext.tsx              ← Usuario, rol, equipo activo
│   │   └── GameContext.tsx                 ← Estado partida activa + polling
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts                   ← apiFetch wrapper (fetch + auth headers)
│   │   │   └── mattin.ts                   ← Cliente SSE MattinAI (server-side)
│   │   ├── db/
│   │   │   ├── schema.ts                   ← Schema Drizzle (todas las entidades)
│   │   │   ├── index.ts                    ← Instancia DB (singleton)
│   │   │   └── migrations/                 ← Migraciones Drizzle generadas
│   │   ├── mcp/
│   │   │   ├── server.ts                   ← Instancia MCP Server (SDK)
│   │   │   └── tools/
│   │   │       ├── get-game-state.ts       ← Tool: get_game_state
│   │   │       ├── make-suggestion.ts      ← Tool: make_suggestion
│   │   │       ├── show-card.ts            ← Tool: show_card
│   │   │       └── make-accusation.ts      ← Tool: make_accusation
│   │   ├── game/
│   │   │   ├── engine.ts                   ← Lógica pura del motor Cluedo
│   │   │   │                               ← (sin I/O; testeable en aislamiento)
│   │   │   └── types.ts                    ← Tipos internos del motor
│   │   ├── auth/
│   │   │   └── config.ts                   ← Configuración Auth.js (provider EntraID)
│   │   └── utils/
│   │       ├── formatting.ts               ← Formateadores (puntos, fechas)
│   │       └── errors.ts                   ← Clases de error (ForbiddenError, etc.)
│   ├── middleware.ts                        ← Protección de rutas por rol
│   └── types/
│       ├── api.ts                          ← Tipos de request/response de la API
│       └── domain.ts                       ← Tipos de dominio exportados
├── drizzle.config.ts                       ← Configuración Drizzle Kit
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json                           ← strict: true
├── vitest.config.ts
├── playwright.config.ts
├── .env.example
└── package.json
```

---

## 5. Routing y protección por rol

### 5.1 App Router (Next.js 14)

Se usa el App Router con la siguiente convención:

- **Server Components por defecto** para todo aquello que no requiera interactividad de cliente (hooks, eventos, polling).
- **Client Components** (`"use client"`) cuando se necesiten: estado local, efectos, polling con `useInterval`, formularios controlados.
- Los **Route Handlers** (`route.ts`) implementan la API REST interna.

### 5.2 Middleware de autenticación y autorización

`src/middleware.ts` intercepta todas las peticiones entrantes:

```typescript
// Lógica de middleware (pseudocódigo)
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas públicas (bypass total)
  const PUBLIC_PATHS = ['/login', '/auth', '/ranking', '/partidas'];
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Verificar sesión (cookie httpOnly firmada por Auth.js)
  const session = await getSession(request);
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verificar rol para rutas de admin
  if (pathname.startsWith('/admin') && session.rol !== 'admin') {
    return NextResponse.redirect(new URL('/?error=forbidden', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/mcp).*)'],
};
```

> **Nota**: `/api/mcp` está excluido del matcher de sesión porque MattinAI accede a él con autenticación propia (token MCP — ver ADR-0008).

### 5.3 Tabla de rutas completa

| Ruta | Server/Client | Roles | Notas |
|---|---|---|---|
| `/` | Server | Todos | Redirección condicional según sesión |
| `/login` | Server | Público | Landing + botón OIDC |
| `/auth/[...nextauth]` | Route Handler | Público | Auth.js OIDC callback |
| `/equipo/registro` | Client | ROL-002 | Formulario RHF + Zod |
| `/equipo` | Client | ROL-002 | Polling 30s con `useInterval` |
| `/ranking` | Client | Público | Polling 30s |
| `/partidas/[id]` | Client | Público | Polling 5s mientras `en_curso` |
| `/admin` | Server + Client | ROL-001 | Tablas + acciones inline |
| `/admin/partidas/nueva` | Client | ROL-001 | Multi-select de equipos |
| `/admin/partidas/[id]` | Client | ROL-001 | Polling 3s + controles |
| `/api/*` | Route Handler | Varios | API REST interna |
| `/api/mcp` | Route Handler | MattinAI token | MCP Server endpoint |

---

## 6. Gestión de estado

### 6.1 Principio general

No se usa Redux ni Zustand en MVP. El estado se gestiona en tres niveles:

| Nivel | Mecanismo | Alcance |
|---|---|---|
| Estado de servidor | Server Components + fetch (cache de Next.js) | Datos leídos solo una vez por render |
| Estado global de sesión | `SessionContext` (React Context) | Toda la app |
| Estado de partida activa | `GameContext` (React Context + polling) | Rutas `/partidas/[id]` y `/admin/partidas/[id]` |
| Estado de formulario | React Hook Form + `useReducer` local | Componentes de formulario |

### 6.2 `SessionContext`

```typescript
// src/contexts/SessionContext.tsx
interface SessionContextValue {
  user: { id: string; name: string; email: string } | null;
  rol: 'admin' | 'equipo' | null;
  equipo: { id: string; nombre: string; agentId: string } | null;
  isLoading: boolean;
  logout: () => void;
}
```

- Inicializado en `src/app/layout.tsx` con `GET /api/auth/session` (client-side en first mount).
- Auth.js provee `useSession()` para el componente raíz; el contexto lo transforma al shape del dominio.
- Toda la app puede consumirlo mediante `useSession()` de Auth.js o el hook `useAppSession()` de más alto nivel.

### 6.3 `GameContext`

```typescript
// src/contexts/GameContext.tsx
interface GameContextValue {
  partida: PartidaDetail | null;
  turnoActual: Turno | null;
  isPolling: boolean;
  lastUpdated: Date | null;
  refresh: () => void;
}
```

- Activo solo bajo los layouts de `/partidas/[id]` y `/admin/partidas/[id]`.
- Implementado con `useInterval` (hook utilitario) sobre `GET /api/games/{id}`.
- Intervalo configurable por ruta: 5s (espectador), 3s (admin detalle).
- Al desmontar el layout, el intervalo se limpia (`clearInterval`).

---

## 7. Autenticación (Auth.js v5 + Azure EntraID)

### 7.1 Flujo OIDC

```
/login
  └─► Clic "Iniciar sesión" → GET /api/auth/signin/azure-ad
        └─► Redirect a Microsoft EntraID (Authorization Code Flow)
              └─► Callback → GET /api/auth/callback/azure-ad
                    └─► Auth.js valida token → crea sesión
                          └─► Redirect según rol → /equipo o /admin
```

### 7.2 Configuración Auth.js

```typescript
// src/lib/auth/config.ts
import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.ENTRA_CLIENT_ID!,
      clientSecret: process.env.ENTRA_CLIENT_SECRET!,
      tenantId: process.env.ENTRA_TENANT_ID!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Upsert usuario en BD local (Drizzle) en primer login
      await upsertUsuario({ email: user.email!, nombre: user.name! });
      return true;
    },
    async session({ session, token }) {
      // Enriquecer sesión con rol y equipo desde BD
      const dbUser = await getUsuarioByEmail(token.email!);
      session.user.rol = dbUser?.rol ?? null;
      session.user.equipo = dbUser?.equipo ?? null;
      return session;
    },
  },
  session: { strategy: 'jwt' }, // JWT en cookie httpOnly
  pages: {
    signIn: '/login',
    error: '/login',
  },
});
```

### 7.3 Variables de entorno requeridas

```bash
# .env.example
AUTH_SECRET=                    # Secreto para firmar cookies de sesión Auth.js
ENTRA_TENANT_ID=                # Tenant de Azure EntraID
ENTRA_CLIENT_ID=                # App ID registrada en EntraID
ENTRA_CLIENT_SECRET=            # Client secret de la app EntraID
MATTIN_API_URL=                 # URL base de MattinAI (ej: https://mattin.example.com)
MATTIN_API_KEY=                 # API Key de MattinAI (secreto)
DATABASE_URL=./data/clue-arena.db  # Ruta SQLite
MCP_AUTH_TOKEN=                 # Token Bearer para autenticar llamadas entrantes al MCP endpoint
```

---

## 8. Acceso a datos (Drizzle ORM + SQLite)

### 8.1 Justificación

Drizzle ORM sobre SQLite (`better-sqlite3`) elimina la necesidad de un servidor de BD externo para MVP (alineado con ADR-0006). Es completamente type-safe, sus esquemas son TypeScript puro, y la migración a PostgreSQL en fases posteriores es mecánica (`drizzle.config.ts`).

### 8.2 Schema (alto nivel)

```typescript
// src/lib/db/schema.ts — entidades principales (mapping a 50-modelo-datos.md)

export const usuarios = sqliteTable('usuarios', {
  id: text('id').primaryKey(),        // UUID
  email: text('email').notNull().unique(),
  nombre: text('nombre').notNull(),
  rol: text('rol', { enum: ['admin', 'equipo', 'espectador'] }).notNull().default('equipo'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const equipos = sqliteTable('equipos', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull().unique(),
  agentId: text('agent_id').notNull(),
  usuarioId: text('usuario_id').references(() => usuarios.id).notNull(),
  estado: text('estado', { enum: ['registrado', 'activo', 'finalizado'] }).notNull().default('registrado'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const partidas = sqliteTable('partidas', { /* ... */ });
export const partidaEquipos = sqliteTable('partida_equipos', { /* ... */ });
export const sobres = sqliteTable('sobres', { /* ... */ });
export const turnos = sqliteTable('turnos', { /* ... */ });
export const sugerencias = sqliteTable('sugerencias', { /* ... */ });
export const acusaciones = sqliteTable('acusaciones', { /* ... */ });
export const ranking = sqliteTable('ranking', { /* ... */ });
```

### 8.3 Singleton de BD

```typescript
// src/lib/db/index.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const sqlite = new Database(process.env.DATABASE_URL ?? './data/clue-arena.db');
export const db = drizzle(sqlite, { schema });
```

> **Importante**: `db` solo se importa en código server-side (Server Components, Route Handlers). Nunca en Client Components.

---

## 9. Cliente API (frontend → API interna)

```typescript
// src/lib/api/client.ts
type ApiOptions = RequestInit & { skipAuth?: boolean };

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include', // envía cookie de sesión httpOnly
    ...options,
  });

  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (res.status === 403) throw new ForbiddenError();
  if (!res.ok) throw new ServerError(res.status, await res.text());

  return res.json() as T;
}
```

---

## 10. Motor de juego y MCP Server

### 10.1 Motor Cluedo (`lib/game/engine.ts`)

El motor es una función pura sin I/O. Recibe `EstadoJuego` y una acción; devuelve el nuevo `EstadoJuego`. Esto lo hace completamente testeable en aislamiento.

```typescript
// Interfaz del motor (simplificada)
export function applyAction(
  state: GameState,
  action: SuggestionAction | AccusationAction | PassAction
): GameState { ... }

export function initGame(equipos: string[], seed?: number): GameState { ... }
export function isGameOver(state: GameState): boolean { ... }
export function getWinner(state: GameState): string | null { ... }
```

### 10.2 MCP Server (`app/api/mcp/route.ts`)

Usando el SDK oficial `@modelcontextprotocol/sdk`, el Route Handler expone el MCP Server como un endpoint HTTP (streamable HTTP transport, compatible con MattinAI):

```typescript
// src/app/api/mcp/route.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { getGameStateTool } from '@/lib/mcp/tools/get-game-state';
import { makeSuggestionTool } from '@/lib/mcp/tools/make-suggestion';
import { showCardTool } from '@/lib/mcp/tools/show-card';
import { makeAccusationTool } from '@/lib/mcp/tools/make-accusation';

const server = new McpServer({ name: 'clue-arena-cluedo', version: '1.0.0' });
server.tool('get_game_state',  getGameStateTool.schema,  getGameStateTool.handler);
server.tool('make_suggestion', makeSuggestionTool.schema, makeSuggestionTool.handler);
server.tool('show_card',       showCardTool.schema,       showCardTool.handler);
server.tool('make_accusation', makeAccusationTool.schema, makeAccusationTool.handler);

export async function POST(request: Request) {
  // Verificar token MCP entrante (ADR-0008)
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.MCP_AUTH_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(request);
}
```

### 10.3 Herramientas MCP expuestas

| Tool | Input | Output | Descripción |
|---|---|---|---|
| `get_game_state` | `{ game_id, team_id }` | `GameStateView` | Estado de la partida desde la perspectiva del equipo solicitante (solo sus cartas) |
| `make_suggestion` | `{ game_id, team_id, suspect, weapon, room }` | `SuggestionResult` | Realiza una sugerencia; devuelve si fue refutada y por quién (sin carta) |
| `show_card` | `{ game_id, team_id, suggestion_id }` | `CardResult` | Obtiene la carta mostrada al equipo que hizo la sugerencia |
| `make_accusation` | `{ game_id, team_id, suspect, weapon, room }` | `AccusationResult` | Acusación final; devuelve si ganó o fue eliminado |

---

## 11. Cliente MattinAI (server-side SSE)

La llamada a MattinAI se realiza exclusivamente desde el servidor (Route Handler o Server Action). El frontend no conecta directamente al SSE de MattinAI.

```typescript
// src/lib/api/mattin.ts
export async function invokeTurn(
  agentId: string,
  context: string
): Promise<TurnResult> {
  const response = await fetch(
    `${process.env.MATTIN_API_URL}/public/v1/chat/${agentId}/call`,
    {
      method: 'POST',
      headers: { 'X-API-Key': process.env.MATTIN_API_KEY! },
      body: buildFormData(context),
    }
  );

  return parseSSEStream(response.body!); // procesa el stream SSE completo
}
```

El stream SSE de MattinAI emite:
- `{"type":"token","content":"..."}` — token generado por el LLM
- `{"type":"tool_call","tool":"...","args":{}}` — invocación de herramienta MCP
- `{"type":"tool_result","result":"..."}` — resultado de herramienta
- `{"type":"done"}` — fin de turno

El servidor escribe el resultado en BD al recibir `done`; el frontend detecta el cambio vía polling.

---

## 12. Estrategia de polling

El frontend usa **polling REST** (no WebSockets ni SSE cliente) en MVP (ver ADR-0007):

| Ruta | Endpoint | Intervalo | Condición de parada |
|---|---|---|---|
| `/partidas/[id]` (espectador) | `GET /api/games/{id}` | 5 s | `partida.estado === 'finalizada'` |
| `/admin/partidas/[id]` | `GET /api/games/{id}` | 3 s | `partida.estado === 'finalizada'` |
| `/equipo` | `GET /api/games?estado=en_curso` | 30 s | — |
| `/ranking` | `GET /api/ranking` | 30 s | — |

Hook utilitario:

```typescript
// src/lib/utils/useInterval.ts
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
```

---

## 13. Sistema de diseño y componentes UI

### 13.1 Capa base: shadcn/ui

Se usa **shadcn/ui** como sistema de componentes base (genera código en `src/components/ui/`). Beneficios:

- Componentes accesibles (Radix UI bajo el capó): diálogos, selects, tooltips, badges.
- Personalizables con Tailwind; sin dependencia de runtime.
- No añade bundle overhead en Server Components.

Componentes de shadcn/ui a instalar: `Button`, `Card`, `Badge`, `Table`, `Select`, `Input`, `Label`, `Dialog`, `Skeleton`, `Separator`, `Toast`.

### 13.2 Componentes de dominio

| Componente | Descripción | Tipo React |
|---|---|---|
| `GameStatusBadge` | Badge estado partida (`pendiente` / `en_curso` / `finalizada`) | Server |
| `PlayerCard` | Tarjeta equipo, estado activo/eliminado | Server |
| `SuggestionRow` | Fila historial sugerencia (oculta `carta_mostrada` según rol) | Server |
| `RankingTable` | Tabla clasificación con posición destacada | Server |
| `TeamSelector` | Multi-select equipos para crear partida | Client |
| `ErrorBanner` | Banner de error global (403, 500, red) | Client |
| `LoadingOverlay` | Overlay de carga full-page | Client |

### 13.3 Tema visual (referencia UI)

Basado en las imágenes de referencia (`docs/spec/ui/`), el tema sigue una estética **oscura y dramática** coherente con el universo de Cluedo:

- **Paleta**: fondo oscuro (`slate-900`/`zinc-950`), acentos en `amber-400` (oro/misterio), texto en `zinc-100`.
- **Tipografía**: serif para títulos del evento, sans-serif para UI funcional.
- **Personajes/armas**: iconografía en `src/assets/` basada en las imágenes de referencia.

Tailwind config extenderá el tema por defecto:

```typescript
// tailwind.config.ts (extensión)
theme: {
  extend: {
    colors: {
      arena: {
        bg:     '#0a0a0f',
        surface:'#1a1a2e',
        accent: '#f59e0b',  // amber-400
        danger: '#ef4444',
        muted:  '#64748b',
      }
    }
  }
}
```

---

## 14. Formularios y validación

Se usa **React Hook Form** con **Zod resolvers**. El esquema Zod es la fuente de verdad compartida entre cliente y servidor.

```typescript
// Ejemplo: registro de equipo
// src/lib/schemas/team.ts
export const TeamRegistrationSchema = z.object({
  nombre: z.string().min(3).max(50).regex(/^[\w\s]+$/, 'Solo alfanumérico y espacios'),
  agentId: z.string().min(1, 'El agent_id es requerido'),
});

// En Route Handler (server-side):
const result = TeamRegistrationSchema.safeParse(await req.json());
if (!result.success) return NextResponse.json({ errors: result.error.flatten() }, { status: 422 });
```

---

## 15. Testing

### 15.1 Estrategia

| Nivel | Herramienta | Objetivo |
|---|---|---|
| Unitario | Vitest | Motor de juego (`lib/game/engine.ts`), utilidades, formatters |
| Componente | Vitest + Testing Library | Render de componentes clave con datos mock |
| Integración API | Vitest + `msw` (Mock Service Worker) | Route Handlers aislados |
| E2E (Smoke) | Playwright | Flujo crítico: login → panel equipo → ver partida |

### 15.2 Casos prioritarios

1. **Motor de juego**: inicializar partida, aplicar sugerencia, aplicar acusación correcta/incorrecta, fin de partida.
2. **Middleware**: rutas protegidas sin sesión → 302 a `/login`; ruta admin con rol equipo → redirect.
3. **MCP tools**: `get_game_state` devuelve cartas solo al equipo solicitante; `make_accusation` ejecuta eliminación.
4. **Ranking**: orden correcto por puntos.
5. **E2E smoke**: login OIDC (mock) → `/equipo` → `/partidas/:id` (polling visible).

### 15.3 Configuración

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
  },
});
```

---

## 16. CI / Calidad

Cada PR ejecuta (GitHub Actions o similar):

1. `tsc --noEmit` — TypeScript strict (NFR-007)
2. `eslint .` — Linting Next.js
3. `vitest run` — Tests unitarios y de componente
4. `next build` — Build de producción (detecta errores de SSR/RSC)

Playwright E2E se ejecuta en merge a `main` (smoke test).

---

## 17. Consideraciones de seguridad

| Control | Implementación |
|---|---|
| Sesión httpOnly | Auth.js JWT en cookie httpOnly; no accesible desde JS cliente |
| CSRF | Auth.js incluye protección CSRF por defecto |
| Middleware RBAC | `middleware.ts` verifica rol antes de cada ruta protegida |
| MCP auth entrante | Bearer token en `Authorization` header; validado en `/api/mcp/route.ts` (ADR-0008) |
| Secretos | Variables de entorno; nunca en código fuente ni en respuestas API |
| Sobre secreto | `ENT-005 Sobre` nunca en respuestas API hasta `partida.estado === 'finalizada'` (RI-003) |
| Cartas privadas | `PartidaEquipo.cartas` solo en respuesta API al equipo propietario (RI-004) |
| `carta_mostrada` | Solo devuelta al equipo que hizo la sugerencia (RI-005) |
| HTTPS | TLS en hosting; Next.js detrás de proxy/CDN (NFR-002) |
| Input validation | Zod en todos los endpoints de API antes de tocar BD |

---

## 18. Decisiones abiertas y preguntas

| ID | Pregunta | Impacto | Estado |
|---|---|---|---|
| D-001 | ¿Auth.js v5 (beta) vs implementación manual OIDC? | Riesgo de API inestable vs coste de implementar OIDC from scratch | **Propuesta**: usar Auth.js v5 con proveedor Microsoft EntraID; tiene soporte estable para este caso |
| D-002 | ¿`better-sqlite3` (sync) vs `@libsql/client` (async/Turso-compatible)? | SQLite sync es más simple en MVP; async abre la puerta a Turso/cloud en post-MVP | **Propuesta**: empezar con `better-sqlite3`; migrar a `@libsql/client` si se necesita Turso |
| D-003 | ¿MCP Server con `StreamableHTTPServerTransport` (stateless) vs SSE transport (stateful)? | MattinAI probablemente espera HTTP streamable; SSE requiere sesión stateful en el servidor | **Propuesta**: usar Streamable HTTP (stateless, más alineado con serverless/Vercel) |
| D-004 | Plataforma de hosting (Vercel vs Azure App Service vs VPS) | Afecta a SQLite (Vercel no tiene sistema de archivos persistente) | Ver ADR-0005; si Vercel → cambiar a Turso/Neon para BD |
| D-005 | ¿Soporte de turno concurrente (varias partidas simultáneas)? | SQLite sync puede ser cuello de botella con N partidas en paralelo | Evaluar WAL mode de SQLite; en MVP el evento puede serializar partidas |

---

## 19. Plan de implementación sugerido (fases)

### Fase 1 — Scaffold y autenticación (Semana 1–2)
- [ ] Inicializar proyecto Next.js 14 + TypeScript + Tailwind + ESLint + Prettier
- [ ] Configurar shadcn/ui base
- [ ] Integrar Auth.js v5 con Microsoft EntraID (flujo OIDC completo)
- [ ] Middleware de protección de rutas (sesión + rol)
- [ ] Schema Drizzle + migraciones iniciales (ENT-001 usuarios, ENT-002 equipos)
- [ ] UI-001 Login y redirección post-login según rol

### Fase 2 — Gestión de equipos y admin básico (Semana 3–4)
- [ ] UI-002 Registro de equipo (formulario + `POST /api/teams`)
- [ ] UI-003 Panel de equipo (datos mock → datos reales)
- [ ] UI-006 Panel Admin (listado equipos y partidas)
- [ ] UI-007 Crear partida (`POST /api/games`)
- [ ] Schema Drizzle partidas, partida_equipos, sobres, ranking

### Fase 3 — Motor de juego y MCP Server (Semana 5–6)
- [ ] Implementar `lib/game/engine.ts` (lógica Cluedo pura)
- [ ] Tests unitarios del motor (cobertura sugerencia, acusación, fin de partida)
- [ ] Implementar MCP Server en `/api/mcp` con las 4 herramientas
- [ ] Implementar cliente MattinAI SSE (`lib/api/mattin.ts`)
- [ ] Flujo completo de turno: Admin inicia → MattinAI → tool-calling → BD → polling UI

### Fase 4 — Vistas en tiempo real, ranking y pulido (Semana 7–8)
- [ ] UI-005 Vista partida espectador (polling 5s)
- [ ] UI-008 Detalle Admin con historial de turnos
- [ ] UI-004 Ranking (polling 30s + actualización automática post-partida)
- [ ] Estados vacío/error/carga en todos los componentes (NFR-005)
- [ ] Smoke test E2E Playwright
- [ ] Revisión accesibilidad (WCAG AA, navegación teclado)

### Fase 5 — Hardening y despliegue (Semana 9–10)
- [ ] Variables de entorno en hosting
- [ ] HTTPS + HSTS verificado (NFR-002)
- [ ] Monitorización uptime (NFR-003)
- [ ] Ensayo general con agentes reales de MattinAI
- [ ] Documentación operativa (runbook)

---

## Anexo A — Diagrama de componentes

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Process (SVC-001)                 │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │  App Router  │  │ Route Handler│  │   MCP Server      │ │
│  │  (UI / RSC)  │  │  /api/*      │  │   /api/mcp        │ │
│  │              │  │  (REST API)  │  │   (HTTP streamable)│ │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬─────────┘ │
│         │                 │                     │           │
│  ┌──────▼─────────────────▼─────────────────────▼─────────┐ │
│  │                  lib/ (shared)                          │ │
│  │  db/ (Drizzle+SQLite)  game/ (engine)  api/ (mattin)   │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │ HTTPS              │ REST               │ HTTP (MCP tools)
    Browser                EntraID              MattinAI
  (Admin/Equipo/         (OIDC auth)          (LLM + tool-calling)
   Espectador)
```

---

## Anexo B — Variables de entorno completas

```bash
# .env.example — Clue Arena App

# Auth.js
AUTH_SECRET=<random-32-bytes-hex>

# Azure EntraID OIDC
ENTRA_TENANT_ID=<tenant-id>
ENTRA_CLIENT_ID=<client-id>
ENTRA_CLIENT_SECRET=<client-secret>

# Base de datos
DATABASE_URL=./data/clue-arena.db

# MattinAI
MATTIN_API_URL=https://mattin.lksnext.com
MATTIN_API_KEY=mattin_<api-key>

# MCP Server (token para autenticar llamadas entrantes de MattinAI)
MCP_AUTH_TOKEN=<random-secure-token>

# App
NEXT_PUBLIC_APP_URL=https://clue-arena.example.com
NODE_ENV=production
```

---

*RFC F001 — Fin del documento*
