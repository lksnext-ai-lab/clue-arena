# RFC F014 — Navegación Pública: Acceso sin Autenticación

| Campo | Valor |
|---|---|
| **ID** | F014 |
| **Título** | Navegación pública — acceso sin autenticación a presentación, agentes y arena de espectador |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-02-28 |
| **Refs. spec** | [00-context](../../clue-arena-spec/docs/spec/00-context.md) · [30-ui-spec](../../clue-arena-spec/docs/spec/30-ui-spec.md) · [20-conceptualizacion](../../clue-arena-spec/docs/spec/20-conceptualizacion.md) · [80-seguridad](../../clue-arena-spec/docs/spec/80-seguridad.md) |
| **Deps.** | RFC F001 · RFC F003 · RFC F009 · RFC F013 |

---

## 1. Resumen

Este RFC define la arquitectura de **navegación pública** de Clue Arena: las rutas accesibles sin credenciales, el componente de cabecera compartido y el tratamiento del middleware de autenticación para cada segmento de ruta.

El modelo de acceso adopta un enfoque **público por defecto con autenticación opcional**: los visitantes sin sesión pueden explorar la presentación del evento, las instrucciones para construir agentes y la arena de espectador. La autenticación se ofrece —nunca se impone— para los roles de equipo y administrador.

### Mapa de acceso rápido

| Sección | Ruta | Auth requerida | Roles autorizados |
|---|---|---|---|
| Presentación del juego | `/` (landing) | No | Todos / público |
| Descripción del juego | `/acerca-del-juego` | No | Todos / público |
| Instrucciones de agente | `/instrucciones` | No | Todos / público |
| Arena espectador | `/partidas/[id]` | No | Todos / público |
| Ranking | `/ranking` | No | Todos / público |
| Login | `/login` | No | Todos / público |
| Dashboard equipo | `/dashboard` | Sí | `equipo`, `admin` |
| Panel equipo | `/equipo` | Sí | `equipo`, `admin` |
| Arena (`/arena`) | `/arena` | Sí | `equipo`, `admin` |
| Admin | `/admin/**` | Sí | `admin` |

---

## 2. Motivación

### 2.1 Problema actual

El middleware actual utiliza una lista de rutas permitidas (`PUBLIC_PATHS`) para determinar qué rutas pueden verse sin sesión. Esta lista nació de forma incremental y no refleja una política coherente:

| Situación | Impacto |
|---|---|
| Un visitante que accede a `/` antes de logarse es redirigido a `/login` sin ver nada del evento | Barrera de entrada para espectadores y posibles participantes |
| No existe un layout de navegación pública coherente | Un usuario sin sesión que está en `/partidas/[id]` o `/instrucciones` no tiene forma de entender dónde está ni de navegar al resto de contenido público |
| El botón de login no está visible en las páginas públicas | Los usuarios con rol de equipo o admin que llegan por URL directa no tienen un CTA claro para autenticarse |
| El componente `AppShell` (sidebar + header) requiere sesión | No se puede reutilizar para páginas públicas; cada página pública tiene su propio layout ad-hoc |

### 2.2 Objetivos de este RFC

1. Definir formalmente el contrato de rutas públicas vs. protegidas.
2. Diseñar un componente de navegación pública (`PublicNav`) reutilizable en todas las páginas sin sesión.
3. Actualizar el middleware para que la política sea explícita, exhaustiva y documentada.
4. Describir la transición suave de "visitante → autenticado" sin interrupciones de navegación.
5. Mantener la seguridad: las rutas protegidas siguen siendo inaccesibles.

---

## 3. Diseño de rutas

### 3.1 Segmentos de ruta públicos

Las siguientes rutas y sus sub-rutas son enteramente públicas. El middleware las deja pasar sin verificar sesión.

```
/                          ← Landing del evento (nueva, ver §5)
/acerca-del-juego          ← Descripción del juego (F003)
/instrucciones             ← Instrucciones para construir agentes (F013)
/instrucciones/**          ← Sub-rutas de instrucciones si aplica
/ranking                   ← Ranking global del evento
/partidas/[id]             ← Arena de espectador (F009)
/login                     ← Formulario / CTA de autenticación
/auth/**                   ← Callbacks OIDC (Auth.js)
/api/ranking               ← Endpoint público de ranking
/api/games/[id]/public     ← Sub-endpoint público de estado de partida (ver §6)
```

> **Principio**: si la información no proporciona ventaja competitiva y no revela datos personales, la ruta puede ser pública.

### 3.2 Segmentos de ruta protegidos

Las siguientes rutas requieren sesión activa. El middleware redirige a `/login?callbackUrl=<ruta>` si no hay sesión.

```
/dashboard        ← Panel principal de equipo/admin (F002)
/equipo/**        ← Gestión del equipo (F005)
/arena            ← Arena con controles de equipo (F009 modo autenticado)
/admin/**         ← Panel de administración (F008) — además requiere rol `admin`
/api/teams/**     ← Endpoints de gestión de equipos
/api/games        ← Creación/gestión de partidas (POST, PATCH, DELETE)
/api/admin/**     ← Endpoints de administración
```

### 3.3 Siempre excluidos del matcher

Estos patrones nunca son procesados por el middleware (configuración `matcher`):

```
/_next/static/**
/_next/image/**
/favicon.ico
/api/mcp          ← MCP Server: autenticado con Bearer token propio, no con sesión de usuario
/public/**        ← Assets estáticos
```

---

## 4. Middleware: política actualizada

### 4.1 Constantes de configuración

```typescript
// src/middleware.ts

/** Rutas que son siempre públicas (sin verificación de sesión). */
const PUBLIC_PATHS = [
  '/',
  '/acerca-del-juego',
  '/instrucciones',
  '/ranking',
  '/partidas',       // cubre /partidas/[id] por startsWith
  '/login',
  '/auth',
  '/api/ranking',
  '/api/games',      // solo GET de listado; ver nota abajo sobre método HTTP
];

/** Prefijos que requieren rol admin (además de sesión). */
const ADMIN_PATHS = ['/admin'];
```

> **Nota sobre `/api/games`**: se incluye en `PUBLIC_PATHS` para el método `GET` del listado público. Los Route Handlers distinguen por método HTTP y aplican RBAC explícito. El middleware solo verifica sesión, no nivel de autorización sobre API routes específicas (salvo `/admin/**`).

### 4.2 Lógica de decisión

```
petición entrante
  │
  ├─ ¿matcher excluye la ruta? → pasar (estáticos, /api/mcp)
  │
  ├─ ¿ruta está en PUBLIC_PATHS? → pasar sin verificar sesión
  │
  ├─ DISABLE_AUTH=true (dev)
  │     ├─ ¿cookie de rol dev? → verificar RBAC dev → pasar / redirect
  │     └─ sin cookie → redirect /login
  │
  ├─ ¿sesión válida?
  │     ├─ No → redirect /login?callbackUrl=<ruta>
  │     └─ Sí →
  │           ├─ ¿ruta en ADMIN_PATHS? → ¿rol === 'admin'? → pasar / redirect /?error=forbidden
  │           └─ pasar
```

### 4.3 `callbackUrl` tras login

Cuando el middleware redirige a `/login`, incluye el parámetro `callbackUrl` con la ruta original. La página `/login` y el handler de Auth.js utilizan este parámetro para redirigir al usuario de vuelta una vez autenticado.

```typescript
// fragmento del middleware.ts
return NextResponse.redirect(
  new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, request.url)
);
```

---

## 5. Landing pública (`/`)

### 5.1 Motivación

La ruta raíz actualmente redirige condicionalmente según el estado de sesión. Con este RFC se convierte en una **landing pública del evento** que presenta el juego a cualquier visitante, con CTAs claros diferenciados por perfil.

### 5.2 Contenido y estructura

```
/
├── Hero — Título del evento, fecha, tagline
├── Sección "¿Qué es Clue Arena?" — descripción breve del juego y la competición
├── Sección "Cómo participar" — pasos: registrar equipo → construir agente → competir
├── CTA principal → /instrucciones    (para equipos que quieren construir su agente)
├── CTA secundario → /login           (para equipos/admin que ya tienen credenciales)
├── Sección "Sigue la competición" → /ranking + /partidas/:id (links a partidas activas)
└── Footer con información del evento
```

### 5.3 Comportamiento según estado de sesión

| Estado de sesión | Comportamiento |
|---|---|
| Sin sesión | Muestra la landing completa con ambos CTAs |
| Sesión con rol `equipo` | Muestra la landing con enlace destacado "Ir a mi panel" → `/dashboard` |
| Sesión con rol `admin` | Muestra la landing con enlace destacado "Panel de administración" → `/admin` |

La detección de sesión en la landing se realiza en el **Server Component** con `auth()`, sin redireccionamiento automático. El usuario decide adónde ir.

### 5.4 Implementación

| Atributo | Valor |
|---|---|
| Ruta Next.js | `src/app/page.tsx` |
| Tipo | Server Component |
| Runtime | Node.js |
| Layout | Root layout con `PublicNav` (ver §7) |
| Auth | `auth()` invocado solo para personalizar CTAs; nunca redirige a `/login` |

---

## 6. API pública: `/api/games/[id]/public`

Para que la arena de espectador funcione sin sesión, el estado de la partida debe ser accesible sin token de sesión. Se introduce un sub-endpoint de solo lectura:

| Atributo | Valor |
|---|---|
| Ruta | `GET /api/games/[id]/public` |
| Auth | Ninguna |
| Respuesta | Estado público de la partida: `{ id, name, status, round, teams: [{name, score, eliminated}], actions: [...], solution: null \| {...} }` |
| Diferencia con `GET /api/games/[id]` | Omite información privada: cartas en mano de cada equipo, tokens MCP |

> **Regla**: `solution` solo se incluye en la respuesta cuando `status === 'finalizada'`. Durante la partida, `solution` es siempre `null` en el endpoint público.

El componente `GameContext` de la arena de espectador (`/partidas/[id]`) usa este endpoint cuando no hay sesión activa, y el endpoint privado cuando hay sesión con rol `admin`.

---

## 7. Componente `PublicNav`

### 7.1 Descripción

`PublicNav` es el header de navegación para todas las rutas públicas. Sustituye al `AppShell` (que requiere sesión) en el contexto de páginas sin autenticación.

- Es un **Server Component** con una zona de botón de sesión (Client Component aislado para leer el estado de la cookie de sesión en cliente).
- Sticky en la parte superior (`sticky top-0 z-50`).
- Responsive: menú hamburguesa en móvil (`sm:`), barra horizontal en escritorio.

### 7.2 Elementos de navegación

```
[ Logo Clue Arena ]   [ El Juego ]  [ Instrucciones ]  [ Ranking ]  [ Arena ]   [ Acceder → ]
```

| Elemento | Ruta destino | Visible sin sesión | Visible con sesión |
|---|---|---|---|
| Logo "Clue Arena" | `/` | Sí | Sí |
| El Juego | `/acerca-del-juego` | Sí | Sí |
| Instrucciones | `/instrucciones` | Sí | Sí |
| Ranking | `/ranking` | Sí | Sí |
| Arena (última partida activa) | `/partidas/[id]` | Sí | Sí |
| **Acceder** (CTA, sin sesión) | `/login` | Sí | No |
| **Mi panel** (con sesión equipo) | `/dashboard` | No | Sí (`equipo`) |
| **Admin** (con sesión admin) | `/admin` | No | Sí (`admin`) |

### 7.3 Estructura de componentes

```
PublicNav (Server Component)
├── PublicNavBrand           — logo + nombre del evento
├── PublicNavLinks           — links de navegación estáticos (Server Component)
└── PublicNavSessionSlot     — zona de sesión (Client Component)
      ├── sin sesión → <Button variant="outline">Acceder</Button> → /login
      ├── sesión equipo → <Button variant="ghost">Mi panel</Button> → /dashboard
      └── sesión admin  → <Button variant="ghost">Admin</Button> → /admin
```

`PublicNavSessionSlot` se implementa como Client Component con `useSession()` de Auth.js para evitar un fetch de servidor en el slot de sesión, que provocaría revalidaciones innecesarias.

Alternativamente, si se prefiere evitar el Client Component: pasar el estado de sesión como prop desde el Server Component padre (`auth()` en el layout).

### 7.4 Tema visual

| Elemento | Clase Tailwind |
|---|---|
| Fondo nav | `bg-slate-950/90 backdrop-blur-sm` |
| Borde inferior | `border-b border-slate-800` |
| Logo / marca | `text-cyan-400 font-bold` |
| Links activos | `text-slate-100` |
| Links inactivos | `text-slate-400 hover:text-slate-200` |
| CTA "Acceder" | `border-cyan-500 text-cyan-400 hover:bg-cyan-500/10` |
| CTA "Mi panel" / "Admin" | `text-emerald-400 hover:text-emerald-300` |

### 7.5 Ruta de fichero

```
src/components/layout/PublicNav/
├── index.tsx               ← PublicNav (Server Component, exportación principal)
├── PublicNavBrand.tsx      ← Client Component (link con imagen/logo)
├── PublicNavLinks.tsx      ← Server Component (links estáticos)
├── PublicNavSessionSlot.tsx ← Client Component ("use client", useSession)
└── PublicNavMobile.tsx     ← Client Component (menú hamburguesa)
```

---

## 8. Layouts por segmento

### 8.1 Layout público (`PublicLayout`)

Usado por: `/`, `/acerca-del-juego`, `/instrucciones`, `/ranking`, `/partidas/[id]`.

```tsx
// src/app/(public)/layout.tsx
import { PublicNav } from '@/components/layout/PublicNav';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      <PublicNav />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
```

Las rutas públicas se agrupan bajo el Route Group `(public)` de Next.js para compartir el layout sin afectar a la URL:

```
src/app/
├── (public)/
│   ├── layout.tsx               ← PublicLayout con PublicNav
│   ├── page.tsx                 ← Landing /
│   ├── acerca-del-juego/
│   │   └── page.tsx
│   ├── instrucciones/
│   │   ├── layout.tsx           ← sobreescribe el layout si necesita fondo diferente
│   │   └── page.tsx
│   ├── ranking/
│   │   └── page.tsx
│   └── partidas/
│       └── [id]/
│           └── page.tsx
├── (auth)/
│   ├── layout.tsx               ← Layout con AppShell (requiere sesión)
│   ├── dashboard/
│   ├── equipo/
│   └── arena/
├── admin/
│   └── ...                      ← Layout de admin (requiere rol admin)
├── login/
│   └── page.tsx                 ← Sin layout de nav
└── layout.tsx                   ← Root layout (providers globales solamente)
```

> **Migración**: los layouts actuales de `/instrucciones` y `/ranking` pasan a heredar de `(public)/layout.tsx`. Los metadatos específicos se mantienen en los `layout.tsx` de cada ruta.

### 8.2 Layout autenticado (`AuthLayout`)

Usado por: `/dashboard`, `/equipo`, `/arena`.

```tsx
// src/app/(auth)/layout.tsx
import { AppShell } from '@/components/layout/AppShell';
import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return <AppShell session={session}>{children}</AppShell>;
}
```

La verificación de sesión en el layout es una segunda capa de seguridad. El middleware ya bloquea las rutas del grupo `(auth)`, pero el layout garantiza que el servidor tampoco renderice contenido si la sesión es inválida.

---

## 9. Página `/login`: flujo de autenticación

### 9.1 Comportamiento

La página de login es **pública** (no requiere sesión previa) pero tiene lógica condicional:

- Si ya existe sesión activa → redirige a `callbackUrl` o al panel por defecto según el rol.
- Si no hay sesión → muestra el formulario/CTA de EntraID OIDC.

```typescript
// src/app/login/page.tsx (Server Component)
import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  const session = await auth();
  if (session?.user) {
    const target = searchParams.callbackUrl ?? defaultDashboardForRole((session.user as any).rol);
    redirect(target);
  }
  return <LoginView />;
}

function defaultDashboardForRole(rol: string): string {
  if (rol === 'admin') return '/admin';
  if (rol === 'equipo') return '/dashboard';
  return '/ranking';
}
```

### 9.2 Diseño de la página `/login`

La página de login no debe quedar desconectada visualmente del resto del sitio. Incluye:

- Header mínimo con logo y enlace "← Volver" a `/`.
- Tarjeta central con:
  - Título: "Accede a Clue Arena"
  - Descripción: "Inicia sesión con tu cuenta corporativa para gestionar tu equipo o acceder al panel de administración."
  - Botón: "Iniciar sesión con Microsoft" (EntraID).
  - Nota: "¿Eres espectador? No necesitas iniciar sesión. Puedes [ver el ranking](/ranking) y [seguir las partidas en directo](/partidas)."
- En modo dev (`DISABLE_AUTH=true`): selector de rol simulado (existente, sin cambios).

---

## 10. Arena de espectador sin sesión

La ruta `/partidas/[id]` es pública. El componente de la arena ajusta su comportamiento en función de si hay sesión:

| Funcionalidad | Sin sesión | Con sesión (equipo) | Con sesión (admin) |
|---|---|---|---|
| Ver estado de partida (polling) | Sí (`/api/games/[id]/public`) | Sí (`/api/games/[id]`) | Sí (`/api/games/[id]`) |
| Ver historial de acciones | Sí | Sí | Sí |
| Ver tablero de deducción | Sí | Sí | Sí |
| Ver cartas en mano (propio equipo) | No | Sí (solo propias) | Sí (todos) |
| Controles admin (auto-run, forzar turno) | No | No | Sí |
| Indicador "Mi equipo" en rankings | No | Sí | No aplica |

La detección de sesión se realiza en el Server Component de la página y se pasa como prop al `GameContext`.

---

## 11. Consideraciones de seguridad

| Aspecto | Control |
|---|---|
| Rutas públicas solo exponen datos de solo-lectura no sensibles | El endpoint `/api/games/[id]/public` omite cartas en mano y tokens MCP |
| `callbackUrl` en redirect de login | Validar que la URL de callback es relativa (no permite open redirect). Auth.js v5 valida esto por defecto; verificar configuración. |
| Los Route Handlers de rutas públicas aplican RBAC explícito | El middleware no es la única barrera; cada handler verifica `auth()` para operaciones de escritura |
| La landing pública no expone información de partidas en curso | Solo enlaza a `/ranking` y a `/partidas/[id]` si hay una partida activa (dato público) |
| `PublicNavSessionSlot` no expone datos de sesión sensibles en cliente | Solo lee `status` y `rol` del session objeto, no tokens |

---

## 12. Impacto en componentes existentes

| Componente / fichero | Cambio necesario |
|---|---|
| `src/middleware.ts` | Actualizar `PUBLIC_PATHS` y `matcher` según §4; añadir `callbackUrl` al redirect |
| `src/app/page.tsx` | Convertir en landing pública (§5); mover al grupo `(public)` |
| `src/app/instrucciones/layout.tsx` | Mover al grupo `(public)` y heredar `PublicLayout` |
| `src/app/ranking/` | Mover al grupo `(public)` |
| `src/app/partidas/[id]/` | Mover al grupo `(public)`; adaptar `GameContext` para endpoint público (§10) |
| `src/app/(auth)/layout.tsx` | Nuevo: agrupar rutas autenticadas; verificación de sesión en layout (§8.2) |
| `src/components/layout/AppShell` | Sin cambios estructurales; sigue siendo exclusivo del grupo `(auth)` |
| `src/components/layout/PublicNav/` | Nuevo: implementar según §7 |
| `src/app/api/games/[id]/public/route.ts` | Nuevo: endpoint GET público de estado de partida (§6) |
| `src/app/login/page.tsx` | Actualizar para soportar `callbackUrl` y redirección post-login (§9) |
| `src/contexts/GameContext.tsx` | Selección condicional de endpoint según presencia de sesión (§10) |

---

## 13. Plan de implementación

### Fase 1 — Middleware y política de rutas (baja complejidad)

- [ ] Actualizar `PUBLIC_PATHS` y matcher en `src/middleware.ts`
- [ ] Añadir `callbackUrl` al redirect a `/login`
- [ ] Validar que `/api/games/[id]/public` queda excluido de auth

### Fase 2 — Estructura de Route Groups

- [ ] Crear `src/app/(public)/layout.tsx` con `PublicNav` (stub inicial)
- [ ] Mover `instrucciones/`, `ranking/`, `partidas/` al grupo `(public)`
- [ ] Crear `src/app/(auth)/layout.tsx` con `AppShell`
- [ ] Mover `dashboard/`, `equipo/`, `arena/` al grupo `(auth)`
- [ ] Verificar que las URLs no cambian (los Route Groups no afectan a rutas)

### Fase 3 — Componente `PublicNav`

- [ ] Implementar `PublicNavBrand`, `PublicNavLinks`, `PublicNavSessionSlot`
- [ ] Implementar menú hamburguesa para móvil
- [ ] Integrar en `(public)/layout.tsx`
- [ ] Aplicar tema visual (§7.4)

### Fase 4 — Landing `/`

- [ ] Diseñar e implementar `src/app/(public)/page.tsx`
- [ ] CTAs diferenciados por estado de sesión
- [ ] Links a partidas activas (usando `/api/ranking` para obtener partidas en curso)

### Fase 5 — Endpoint público de partida y arena sin sesión

- [ ] Implementar `GET /api/games/[id]/public/route.ts`
- [ ] Actualizar `GameContext` para selección condicional de endpoint
- [ ] Ocultar controles de admin y cartas en mano cuando no hay sesión

### Fase 6 — Página `/login` actualizada

- [ ] Soporte de `callbackUrl` en redirect post-login
- [ ] Nota informativa para espectadores
- [ ] Header mínimo con enlace "← Volver"

---

## 14. Criterios de aceptación

| ID | Criterio |
|---|---|
| CA-01 | Un visitante sin sesión puede acceder a `/`, `/acerca-del-juego`, `/instrucciones`, `/ranking` y `/partidas/[id]` sin ser redirigido a `/login` |
| CA-02 | Un visitante sin sesión que intenta acceder a `/dashboard`, `/equipo` o `/admin` es redirigido a `/login?callbackUrl=<ruta>` |
| CA-03 | Tras autenticarse, el usuario es redirigido a la ruta original (`callbackUrl`) |
| CA-04 | `PublicNav` muestra el botón "Acceder" cuando no hay sesión y "Mi panel" / "Admin" cuando la hay |
| CA-05 | La arena `/partidas/[id]` funciona sin sesión y hace polling sobre `/api/games/[id]/public` |
| CA-06 | El endpoint `/api/games/[id]/public` nunca devuelve cartas en mano ni tokens MCP |
| CA-07 | La landing `/` muestra CTAs correctos según el estado de sesión (público / equipo / admin) |
| CA-08 | El middleware no redirige a `/login` desde ninguna ruta del grupo `(public)` |
| CA-09 | Las rutas privadas (`/dashboard`, `/equipo`, `/admin`) tienen doble verificación: middleware + layout server component |
| CA-10 | El `callbackUrl` de redirect es siempre una URL relativa (no se permite open redirect) |

---

## 15. Preguntas abiertas

| ID | Pregunta | Impacto |
|---|---|---|
| OPENQ-F014-01 | ¿La arena de espectador debe ser navegable desde la landing solo cuando hay una partida `en_curso`, o también se listan partidas `finalizadas`? | Diseño de landing y del link de "Arena" en `PublicNav` |
| OPENQ-F014-02 | ¿La ruta `/arena` (con controles de equipo) debe ser pública o protegida? Actualmente se asume protegida. | Tabla de acceso en §3 y grupo de route en §8 |
| OPENQ-F014-03 | ¿Es necesario un `PublicFooter`? ¿Qué contenido mínimo debe tener? | Alcance de implementación en Fase 3 |
| OPENQ-F014-04 | ¿Cómo se gestiona la internacionalización (i18n) en `PublicNav`? El proyecto usa `next-intl`; verificar si el `PublicNavSessionSlot` necesita adaptación. | Compatibilidad con F004 |
