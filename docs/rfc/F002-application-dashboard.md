# RFC F002 — Dashboard principal de la aplicación

| Campo | Valor |
|---|---|
| **ID** | F002 |
| **Título** | Dashboard principal post-login: clasificación de equipos, KPIs circulares, actividad reciente y barra de navegación lateral |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-02-26 |
| **Refs. spec** | [30-ui-spec](../../clue-arena-spec/docs/spec/30-ui-spec.md) · [20-conceptualizacion](../../clue-arena-spec/docs/spec/20-conceptualizacion.md) · [10-requisitos-funcionales](../../clue-arena-spec/docs/spec/10-requisitos-funcionales.md) · [40-arquitectura](../../clue-arena-spec/docs/spec/40-arquitectura.md) |
| **Deps.** | RFC F001 |
| **Referencia visual** | `docs/rfc/img/dashboard.png` |

---

## 1. Resumen

Este RFC define el diseño e implementación del **dashboard principal** de Clue Arena: la pantalla central que se muestra tras un inicio de sesión satisfactorio. El diseño está basado en la captura de referencia `docs/rfc/img/dashboard.png`.

La pantalla se divide en tres bloques principales:

1. **Ranking / Podio**: clasificación del evento con podio visual para el top 3 y listado plano para el resto. El equipo propio aparece resaltado con el tag `"(Tú)"`.
2. **Estadísticas del equipo**: métricas del equipo propio como gráficos de progreso circular (donut/ring charts) y gráfico de barras por etapa de investigación.
3. **Actividad reciente**: feed de eventos recientes del juego con timestamps relativos.

La navegación lateral es un **sidebar icon-only** (estrecho, ~64 px fijo) con iconos temáticos del juego y etiqueta corta bajo cada icono.

El **tema visual es oscuro** (dark mode forzado: fondo azul marino/pizarra, acentos en cian) como se observa en la captura de referencia.

---

## 2. Motivación y contexto

La arquitectura actual (F001) define un `AppShell` genérico y pantallas de rol independientes, sin un dashboard unificado post-login. Este RFC introduce:

- Una **ruta `/dashboard`** como destino unificado post-login para todos los roles.
- Un **layout con sidebar icon-only** persistente como shell de navegación.
- Contenido del dashboard diferenciado por rol (Admin vs. Equipo vs. Espectador), con la vista del rol Equipo como referencia principal de diseño (captura).

---

## 3. Diseño visual y estructura de layout

### 3.1 Referencia visual

![Dashboard reference](img/dashboard.png)

La captura muestra la perspectiva del rol **Equipo** (Equipo Omega, 5ª posición). El diseño observado:

- Fondo oscuro (azul marino/pizarra) en toda la pantalla y sidebar.
- Sidebar estrecho icon-only a la izquierda (~64 px).
- Barra de cabecera con el título del evento y acciones globales.
- Tres secciones verticales en el área principal: Ranking/Podio, Estadísticas del equipo, Actividad reciente.

### 3.2 Tema visual

| Propiedad | Clase Tailwind |
|---|---|
| Fondo de pantalla | `bg-slate-900` |
| Fondo sidebar | `bg-slate-950` |
| Fondo tarjetas/secciones | `bg-slate-800` |
| Borde de secciones | `border border-slate-700` |
| Acento principal | `text-cyan-400` / `bg-cyan-500` |
| Texto primario | `text-white` |
| Texto secundario | `text-slate-400` |
| Ítem activo sidebar | `bg-cyan-500/10 text-white` |

Dark mode forzado permanentemente en el layout del dashboard (no sigue la preferencia del sistema).

### 3.3 Layout general

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ┌───────┐  ┌─────────────────────────────────────────────────────────────────┐│
│ │  LOGO │  │ DESAFÍO CLUEDO CORPORATIVO: CLASIFICACIÓN DE EQUIPOS  [🔔] [→]  ││
│ ├───────┤  ├─────────────────────────────────────────────────────────────────┤│
│ │  🏠   │  │                                                                 ││
│ │Inicio │  │  PANEL DE CONTROL: CLASIFICACIÓN DE EQUIPOS                     ││
│ │       │  │  ┌──────────────────────────────────────────────────────────┐   ││
│ │  �   │  │  │ 🥇 1. EQUIPO ALPHA - 850 Pts   🥈 2. EQUIPO BETA - 820  │   ││
│ │Equipos│  │  │    (Investigación: 90%)           (Investigación: 85%)   │   ││
│ │       │  │  │ 🥉 3. EQUIPO GAMMA - 780 Pts (Investigación: 80%)        │   ││
│ │  ⚔️   │  │  │ 4.  EQUIPO DELTA   - 750                                 │   ││
│ │ Arena │  │  │ 5.  EQUIPO OMEGA   - 720  (Tú) ◄── resaltado cian        │   ││
│ │       │  │  └──────────────────────────────────────────────────────────┘   ││
│ │  🏆   │  │                                                                 ││
│ │Ranking│  │  ESTADÍSTICAS DEL EQUIPO (Omega)                                ││
│ │       │  │  ┌──────────────────────────────────────────────────────────┐   ││
│ │  👤   │  │  │ ⬤ 75%  Prog. Invest. │ ⬤ 82%  Precisión │ ⬤ 45min     │   ││
│ │Perfil │  │  │                       │                   │ [barras/etapa]│  ││
│ │       │  │  └──────────────────────────────────────────────────────────┘   ││
│ │       │  │                                                                 ││
│ │       │  │  ACTIVIDAD RECIENTE                                             ││
│ │       │  │  ┌──────────────────────────────────────────────────────────┐   ││
│ │       │  │  │ Hace  5 min: Equipo Delta descartó 'Cable de Red Cat 6'. │   ││
│ │       │  │  │ Hace 12 min: Equipo Sigma interrogó a 'Dra. Peacock'...  │   ││
│ │       │  │  │ Hace 20 min: Tú encontraste una pista en 'El Open Space' │   ││
│ └───────┘  │  └──────────────────────────────────────────────────────────┘   ││
│            └─────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Sidebar — descripción detallada

El sidebar tiene **ancho fijo ~64 px**, siempre icon-only (no colapsable). Cada ítem muestra el icono centrado y una etiqueta corta (`text-xs`) debajo.

| Ítem | Icono (lucide-react) | Etiqueta | Ruta | Roles |
|---|---|---|---|---|
| Inicio | `LayoutDashboard` | "Inicio" | `/dashboard` | Todos |
| Equipos | `Users` | "Equipos" | `/equipos` | Admin, Equipo |
| Arena | `Swords` | "Arena" | `/arena` | Admin, Equipo |
| Ranking | `Trophy` | "Ranking" | `/ranking` | Todos |
| — | — | — | — | — |
| Perfil | `User` | "Perfil" | `/perfil` | Todos |

- **Icono de la aplicación** (logo/lente) en la parte superior, antes de los ítems de nav.
- **Ítem activo**: `bg-cyan-500/10 text-white` (fondo sutil + texto blanco).
- **Hover**: `bg-slate-700/50`.
- **Sin botón de colapso** (fiel a la referencia visual).

#### TopBar (cabecera del área de contenido)

- **Izquierda**: título en mayúsculas `"DESAFÍO CLUEDO CORPORATIVO: CLASIFICACIÓN DE EQUIPOS"`.
- **Derecha**: icono de notificaciones (`Bell`) + icono de logout (`LogOut`).
- Estilo: `bg-slate-900 border-b border-slate-700`.

---

## 4. Secciones del dashboard

### 4.1 Ranking / Podio

Título de sección: **"PANEL DE CONTROL: CLASIFICACIÓN DE EQUIPOS"**

#### Top 3 — diseño podio (3 columnas)

Cada columna contiene:
- Badge circular con número de posición (dorado #1, plateado #2, bronce #3).
- Nombre del equipo (cian en #1, blanco en #2 y #3).
- Puntos (`NNN Puntos`).
- Porcentaje de investigación (`Investigación: XX%`) en `text-slate-400`.

#### Posiciones 4 en adelante

Filas planas sin tarjeta: `[N].  [Nombre equipo]  -  [NNN]`

- Si es el equipo propio: texto en cian + sufijo `"(Tú)"`.
- Contenedor: `bg-slate-800 rounded-lg p-4`.

#### Tipo de dato

```typescript
interface RankingRow {
  posicion: number;
  equipoId: string;
  nombre: string;
  puntos: number;
  porcentajeInvestigacion: number; // 0–100
}
```

Fuente: `GET /api/ranking`. Polling 30 s.

---

### 4.2 Estadísticas del equipo

Título de sección: **"ESTADÍSTICAS DEL EQUIPO ({nombre})"**

Solo visible para rol **Equipo** (y Admin con OPENQ-F002-05).

#### Gráficos circulares — 3 métricas (side by side)

| Métrica | Valor de referencia | Campo |
|---|---|---|
| Progreso de la Investigación | `75%` | `progressoPct` |
| Precisión de Hipótesis | `82%` | `precisionPct` |
| Tiempo Promedio de Resolución | `45 min` (valor absoluto centrado) | `avgResolutionMin` |

- Diámetro: ~120–140 px.
- Arco de progreso: `stroke-cyan-400`; arco de fondo: `stroke-slate-700`.
- Valor numérico grande en el centro del anillo.
- Etiqueta descriptiva debajo del gráfico en `text-slate-400 text-sm`.
- Implementar con `recharts` `RadialBarChart` o SVG puro con `stroke-dashoffset`.

#### Gráfico de barras — Puntos por etapa

- Posición: a la derecha de los 3 rings en la misma fila.
- Título: `"Puntos por Etapa"`.
- Eje X: `["Pistas", "Interrogatorios", "Descarte"]`.
- Eje Y: puntos (0–100).
- Color barras: `fill-sky-600` o `fill-cyan-500`.
- Implementar con `recharts` `BarChart`.

#### Tipo de dato

```typescript
interface TeamStats {
  equipoId: string;
  nombre: string;
  progressoPct: number;
  precisionPct: number;
  avgResolutionMin: number;
  puntosPorEtapa: Array<{
    etapa: 'Pistas' | 'Interrogatorios' | 'Descarte';
    puntos: number;
  }>;
}
```

Fuente: `GET /api/teams/{id}/stats` (endpoint nuevo — sección 6).

---

### 4.3 Actividad reciente

Título de sección: **"ACTIVIDAD RECIENTE"**

Feed cronológico inverso de los últimos 10 eventos. Visible para todos los roles.

Formato de cada entrada (fila): `"Hace N min: [descripción del evento]"`

- Si el actor es el equipo propio (rol Equipo): `"Tú (Equipo X)"` en negrita cian.
- Fondo de cada fila: `bg-slate-800 rounded-md px-3 py-2`.
- Tipografía: `text-sm text-slate-300`.

Ejemplos exactos de la referencia:
- *Hace 5 min: Equipo Delta descartó 'Cable de Red Cat 6'.*
- *Hace 12 min: Equipo Sigma interrogó a 'Dra. Peacock' en 'Recursos Humanos'.*
- *Hace 20 min: **Tú (Equipo Omega)** encontraste una pista en 'El Open Space'.*

#### Tipo de dato

```typescript
interface ActivityEvent {
  id: string;
  timestampMs: number;
  tipo: 'descarte' | 'interrogatorio' | 'pista' | 'acusacion' | 'sugerencia';
  actorNombre: string;
  actorEquipoId: string;
  descripcion: string; // texto pre-formateado listo para mostrar
}
```

Fuente: `GET /api/games/activity?limit=10` (endpoint nuevo — sección 6). Polling 10 s.

---

## 5. Rutas y componentes

### 5.1 Nueva ruta `/dashboard`

```
src/app/
└── dashboard/
    ├── layout.tsx    ← DashboardLayout (dark mode + DashboardShell)
    └── page.tsx      ← DashboardPage (pre-carga + secciones)
```

Post-login, `src/app/page.tsx` redirige a `/dashboard` para todos los roles:

```typescript
// src/app/page.tsx
export default async function RootPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  redirect('/dashboard');
}
```

### 5.2 Árbol de componentes

```
DashboardLayout  [src/app/dashboard/layout.tsx]  — Server Component
  └── DashboardShell  [src/components/layout/DashboardShell.tsx]  — Client
        ├── Sidebar  [src/components/layout/Sidebar.tsx]  — Client
        │     ├── SidebarLogo
        │     ├── SidebarNav  (filtrado por rol, ítem activo con usePathname)
        │     └── SidebarProfile  (icono Perfil al fondo)
        └── main
              ├── TopBar  [src/components/layout/TopBar.tsx]  — Client
              │     ├── EventTitle
              │     ├── NotificationButton
              │     └── LogoutButton  (signOut de Auth.js)
              └── <children>

DashboardPage  [src/app/dashboard/page.tsx]  — Server Component
  ├── RankingPodium  [src/components/dashboard/RankingPodium.tsx]  — Client
  │     ├── PodiumTop3  (3 PodiumCard)
  │     └── RankingList  (filas planas posición 4+)
  ├── TeamStatsSection  [src/components/dashboard/TeamStatsSection.tsx]  — Client
  │     ├── RingChart × 3  [src/components/dashboard/RingChart.tsx]
  │     └── StageBarChart  [src/components/dashboard/StageBarChart.tsx]
  └── ActivityFeed  [src/components/dashboard/ActivityFeed.tsx]  — Client
        └── ActivityItem × N
```

### 5.3 Nuevos ficheros

| Fichero | Tipo | Descripción |
|---|---|---|
| `src/app/dashboard/layout.tsx` | Server | Layout con dark mode + `DashboardShell`. Verifica sesión. |
| `src/app/dashboard/page.tsx` | Server | Pre-carga ranking + actividad; pasa props a Client Components. |
| `src/components/layout/DashboardShell.tsx` | Client | Wrapper sidebar + topbar + área de contenido. |
| `src/components/layout/Sidebar.tsx` | Client | Sidebar icon-only. `usePathname` + `useAppSession`. |
| `src/components/layout/TopBar.tsx` | Client | Cabecera con título del evento, notificaciones y logout. |
| `src/components/dashboard/RankingPodium.tsx` | Client | Podio top 3 + listado. Polling 30 s. |
| `src/components/dashboard/PodiumCard.tsx` | Client | Tarjeta de medalla (posición, nombre, puntos, %). |
| `src/components/dashboard/TeamStatsSection.tsx` | Client | Rings + barra. Solo visible para Equipo. |
| `src/components/dashboard/RingChart.tsx` | Client | Anillo de progreso SVG/Recharts. Props: `value`, `max`, `label`, `unit`. |
| `src/components/dashboard/StageBarChart.tsx` | Client | Barras por etapa Recharts `BarChart`. |
| `src/components/dashboard/ActivityFeed.tsx` | Client | Feed de actividad. Polling 10 s. |
| `src/components/dashboard/ActivityItem.tsx` | Client | Fila del feed con timestamp relativo y resaltado de equipo propio. |

### 5.4 Ficheros a modificar

| Fichero | Cambio |
|---|---|
| `src/app/page.tsx` | Redirigir a `/dashboard` para todos los roles autenticados. |
| `src/middleware.ts` | Añadir `/dashboard` al matcher de rutas protegidas. |
| `src/app/globals.css` | Variables CSS del tema oscuro del dashboard. |

---

## 6. API endpoints

### 6.1 Existentes (reutilizar sin cambios)

| Endpoint | Uso |
|---|---|
| `GET /api/ranking` | Datos del podio + posición del equipo propio |

### 6.2 Nuevos

#### `GET /api/teams/[id]/stats`

Estadísticas del equipo para la sección de rings y barras.

**Autorización**: Equipo solo puede ver el suyo; Admin puede ver cualquiera.

**Response `200`**:
```json
{
  "equipoId": "string",
  "nombre": "string",
  "progressoPct": 75,
  "precisionPct": 82,
  "avgResolutionMin": 45,
  "puntosPorEtapa": [
    { "etapa": "Pistas",          "puntos": 80 },
    { "etapa": "Interrogatorios", "puntos": 60 },
    { "etapa": "Descarte",        "puntos": 40 }
  ]
}
```

**Fichero**: `src/app/api/teams/[id]/stats/route.ts`

#### `GET /api/games/activity`

Eventos recientes del juego para el feed de actividad.

**Query params**: `limit` (default 10, max 50).

**Response `200`**:
```json
{
  "events": [
    {
      "id": "string",
      "timestampMs": 1709000000000,
      "tipo": "descarte",
      "actorNombre": "Equipo Delta",
      "actorEquipoId": "string",
      "descripcion": "Equipo Delta descartó 'Cable de Red Cat 6'."
    }
  ]
}
```

**Fichero**: `src/app/api/games/activity/route.ts`

---

## 7. Gestión de estado y fetching

### 7.1 Pre-carga server-side

```typescript
// src/app/dashboard/page.tsx
export default async function DashboardPage() {
  const session = await auth();
  const miEquipoId = session!.user.equipo?.id ?? null;

  const [ranking, activity] = await Promise.all([
    fetchRankingFromDb(),
    fetchRecentActivityFromDb({ limit: 10 }),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <RankingPodium
        initialRanking={ranking}
        miEquipoId={miEquipoId}
      />
      {miEquipoId && (
        <TeamStatsSection equipoId={miEquipoId} />
      )}
      <ActivityFeed
        initialEvents={activity}
        miEquipoId={miEquipoId}
      />
    </div>
  );
}
```

### 7.2 Polling en cliente

| Componente | Endpoint | Intervalo |
|---|---|---|
| `RankingPodium` | `GET /api/ranking` | 30 s |
| `TeamStatsSection` | `GET /api/teams/{id}/stats` | 30 s |
| `ActivityFeed` | `GET /api/games/activity` | 10 s |

Patrón estándar con `useInterval`:

```typescript
const [data, setData] = useState(initialData);
useInterval(async () => {
  const fresh = await apiFetch<T>(endpoint);
  setData(fresh);
}, intervalMs);
```

---

## 8. Comportamiento por rol

### 8.1 Equipo

- Ranking: tabla completa con fila propia resaltada + `"(Tú)"`.
- Team Stats: **visible** con datos del equipo propio.
- Actividad: visible; eventos propios con `"Tú (Equipo X)"` en cian.
- Sidebar: Inicio, Equipos, Arena, Ranking, Perfil.

### 8.2 Admin

- Ranking: tabla completa sin resaltado propio.
- Team Stats: **oculta** por defecto (ver OPENQ-F002-05).
- Actividad: visible, sin resaltado propio.
- Sidebar: Inicio, Equipos, Arena, Ranking, Perfil (+ posible ítem extra — OPENQ-F002-06).

### 8.3 Espectador

- Ranking: tabla completa sin resaltado propio.
- Team Stats: **oculta** (no tiene equipo).
- Actividad: visible, sin resaltado propio.
- Sidebar: Inicio, Ranking, Perfil. (Equipos y Arena ocultos para Espectador.)

---

## 9. Tema oscuro — implementación

```typescript
// src/app/dashboard/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Si el root layout ya tiene <html>, usar un div wrapper con clase 'dark'
  return (
    <div className="dark min-h-screen bg-slate-900 text-white">
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
```

```css
/* src/app/globals.css */
.dark {
  --background: theme('colors.slate.900');
  --card: theme('colors.slate.800');
  --border: theme('colors.slate.700');
  --primary: theme('colors.cyan.400');
  --muted-foreground: theme('colors.slate.400');
}
```

---

## 10. Dependencias de librería

Requiere instalar `recharts`:

```bash
npm install recharts
```

| Librería | Componentes usados |
|---|---|
| `recharts` | `RadialBarChart`, `RadialBar`, `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer` |
| `lucide-react` | Ya instalado; iconos del sidebar y topbar |
| `shadcn/ui` | `Card`, `Badge`, `Button`, `Separator`, `Tooltip` |

---

## 11. Responsive

| Breakpoint | Comportamiento |
|---|---|
| `>= lg` (1024px) | Sidebar icon-only (64 px) permanente. Sección stats: rings + barras en fila. |
| `md` (768–1023px) | Sidebar igual. Sección stats: rings apilados, barras debajo. |
| `< md` | Fuera de alcance MVP. |

---

## 12. Accesibilidad

- Sidebar: `<nav aria-label="Navegación principal">`.
- Ítem activo: `aria-current="page"`.
- Rings: `role="img"` + `aria-label="Progreso de la Investigación: 75%"`.
- Sección ranking: `<section aria-label="Clasificación del evento">`.
- Feed actividad: `<section aria-label="Actividad reciente">` + `<ul>` + `<li>`.
- Logout: `aria-label="Cerrar sesión"`.
- Notificaciones: `aria-label="Notificaciones"`.

---

## 13. Tests

| Test | Tipo | Fichero |
|---|---|---|
| `Sidebar` filtra ítems según rol | Unitario (Vitest + RTL) | `src/tests/Sidebar.test.tsx` |
| `RankingPodium` resalta equipo propio + `"(Tú)"` | Unitario | `src/tests/RankingPodium.test.tsx` |
| `RingChart` renderiza valor correcto en el centro | Unitario | `src/tests/RingChart.test.tsx` |
| `ActivityFeed` resalta eventos del equipo propio en cian | Unitario | `src/tests/ActivityFeed.test.tsx` |
| `TeamStatsSection` no renderiza para Espectador | Unitario | `src/tests/TeamStatsSection.test.tsx` |
| Post-login redirige a `/dashboard` | E2E (Playwright) | `e2e/smoke.spec.ts` (ampliar) |
| Dashboard carga ranking + actividad sin errores | E2E | `e2e/dashboard.spec.ts` |

---

## 14. Decisiones y alternativas

### D-001 — Sidebar icon-only permanente

**Decisión**: ancho fijo ~64 px, sin colapso ni expansión. Fiel a la referencia visual.

**Alternativa descartada**: sidebar expandible 240 px — añade complejidad y se aleja del diseño de referencia.

### D-002 — Recharts para gráficos

**Decisión**: `recharts` para `RadialBarChart` (rings) y `BarChart` (barras por etapa). Evita calcular `stroke-dashoffset` manualmente.

**Alternativa**: SVG puro — más control pero mayor coste de mantenimiento.

### D-003 — `descripcion` pre-formateada en el servidor

**Decisión**: el endpoint `GET /api/games/activity` devuelve el campo `descripcion` ya listo para mostrar, generado en el servidor. El cliente no contiene lógica de formateo de texto.

### D-004 — Dark mode forzado

**Decisión**: tema oscuro permanente en el layout del dashboard. El evento es interno y de duración fija; no se justifica soporte dual claro/oscuro.

### D-005 — `/dashboard` como destino unificado post-login

**Decisión**: todos los roles autenticados aterrizan en `/dashboard`. El contenido se adapta por rol. Simplifica `page.tsx` y el middleware.

---

## 15. Plan de implementación

| Paso | Tarea | Prioridad |
|---|---|---|
| 1 | `npm install recharts` | Alta |
| 2 | `Sidebar.tsx` + `TopBar.tsx` + `DashboardShell.tsx` | Alta |
| 3 | `src/app/dashboard/layout.tsx` (dark mode + shell) | Alta |
| 4 | `RankingPodium.tsx` + `PodiumCard.tsx` (polling 30 s) | Alta |
| 5 | `RingChart.tsx` + `StageBarChart.tsx` | Media |
| 6 | `TeamStatsSection.tsx` | Media |
| 7 | `GET /api/teams/[id]/stats` Route Handler | Media |
| 8 | `ActivityFeed.tsx` + `ActivityItem.tsx` (polling 10 s) | Media |
| 9 | `GET /api/games/activity` Route Handler | Media |
| 10 | `src/app/dashboard/page.tsx` (Server Component pre-carga) | Alta |
| 11 | `src/app/page.tsx` → redirect `/dashboard` | Alta |
| 12 | `middleware.ts` → proteger `/dashboard` | Alta |
| 13 | Tests unitarios + E2E `dashboard.spec.ts` | Media |

---

## 16. Preguntas abiertas

| ID | Pregunta | Impacto |
|---|---|---|
| OPENQ-F002-05 | ¿El Admin puede ver estadísticas de un equipo concreto en el dashboard? | Añade selector de equipo en `TeamStatsSection` para Admin |
| OPENQ-F002-06 | ¿Necesita el Admin ítems adicionales en el sidebar (ej. `/admin/partidas`)? | Ampliar `NAV_ITEMS` |
| OPENQ-F002-07 | ¿`porcentajeInvestigacion` es acumulado de todas las partidas o solo la activa? | Afecta a la query de `GET /api/teams/{id}/stats` |
| OPENQ-F002-08 | ¿El feed de actividad incluye eventos de todas las partidas o solo la activa? | Afecta al diseño de `GET /api/games/activity` |

---

## Historial de revisiones

| Versión | Fecha | Cambios |
|---|---|---|
| 0.1 | 2026-02-26 | Borrador inicial sin referencia visual |
| 0.2 | 2026-02-26 | Reescritura completa con base en `docs/rfc/img/dashboard.png`: tema oscuro forzado, sidebar icon-only con ítems temáticos del juego, podio visual top 3 + listado plano, gráficos donut/ring (recharts), gráfico de barras por etapa, feed de actividad reciente, 2 nuevos endpoints |
