# RFC F009 — Arena: Vista de Espectador de Partida

| Campo | Valor |
|---|---|
| **ID** | F009 |
| **Título** | Arena — Vista de espectador de una partida en curso |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-02-26 |
| **Refs. spec** | [30-ui-spec §UI-005](../../clue-arena-spec/docs/spec/30-ui-spec.md) · [10-requisitos-funcionales §FR-012, FR-009, FR-006, FR-007](../../clue-arena-spec/docs/spec/10-requisitos-funcionales.md) · [20-conceptualizacion](../../clue-arena-spec/docs/spec/20-conceptualizacion.md) · [60-backend](../../clue-arena-spec/docs/spec/60-backend.md) · [50-modelo-datos](../../clue-arena-spec/docs/spec/50-modelo-datos.md) |
| **Deps.** | RFC F001 · RFC F002 · RFC F007 |

---

## 1. Resumen

Este RFC define el diseño e implementación de la **Arena** (`/partidas/[id]`): la pantalla desde la que cualquier usuario autenticado —sea Equipo, Espectador o Admin— puede seguir una partida de Cluedo en tiempo real.

La Arena tiene cuatro zonas informativas complementarias:

1. **Cabecera de partida** — estado, nombre, turno actual y equipo activo, con controles de auto-run para el Admin.
2. **Panel de equipos** — tarjeta por equipo con posición, puntos, número de cartas, estado activo/eliminado e indicador de turno.
3. **Tablero de deducción** — cuadrícula estilo "libreta de Cluedo" que cruza las 21 cartas posibles (sospechosos, armas, habitaciones) con los equipos participantes, marcando visualmente qué cartas han aparecido en sugerencias públicas y su resultado.
4. **Feed de acciones** — historial cronológico de todos los turnos con expansión por turno: tipo de acción, combo propuesto, resultado (refutado/no-refutado/acusación correcta o incorrecta) y delta de puntos.

Al finalizar la partida se presenta un **panel de resultado final** sobreimpreso con el sobre revelado, el ganador y la tabla de puntuación definitiva.

El ciclo de actualización es por **polling cada 5 segundos** mientras la partida está `en_curso`, gestionado por `GameContext`. No se usa WebSockets en MVP.

---

## 2. Motivación

La UI actual (`/partidas/[id]`) tiene una implementación mínima (UI-005 de la spec) que cubre el requisito básico de ver historial, pero no es suficiente para que un espectador comprenda el estado real de una partida. Los déficits concretos son:

| Problema | Impacto |
|---|---|
| No hay visibilidad del estado de cada equipo (puntos, cartas, eliminaciones) | El espectador no sabe quién va ganando ni quién queda activo |
| El historial de sugerencias es texto plano sin estructura visual | Difícil de leer cuando hay 20+ turnos en pantalla |
| No hay representación del espacio de deducción | No se puede intuir qué cartas van siendo descartadas |
| Sin indicador visual de turno activo | No se sabe cuándo hay actividad ni cuánto tarda cada turno |
| Sin resultado visualmente destacado al finalizar | El "desenlace" de la competición pasa desapercibido |

Este RFC resuelve todos esos problemas con un diseño de alta densidad informativa, coherente con el tema oscuro ya establecido en F002.

---

## 3. Diseño visual y estructura

### 3.1 Tema visual

El tema sigue las convenciones del dashboard (F002), con adiciones específicas de la Arena:

| Propiedad | Clase Tailwind |
|---|---|
| Fondo de pantalla | `bg-slate-900` |
| Fondo de secciones/tarjetas | `bg-slate-800` |
| Borde de secciones | `border border-slate-700` |
| Acento principal | `text-cyan-400` / `bg-cyan-500` |
| Equipo activo (turno) | `ring-2 ring-cyan-400` |
| Equipo eliminado | `opacity-40 grayscale` |
| Estado `en_curso` | `text-emerald-400` |
| Estado `finalizada` | `text-slate-400` |
| Estado `pendiente` | `text-amber-400` |
| Acusación correcta | `text-emerald-400 bg-emerald-400/10` |
| Acusación incorrecta / eliminación | `text-red-400 bg-red-400/10` |
| Sugerencia refutada | `text-amber-400` |
| Sugerencia no refutada | `text-cyan-400` |
| Carta en deducción (confirmada visible) | `bg-cyan-500/20 text-cyan-300` |
| Carta en deducción (no aparecida) | `bg-slate-700/50 text-slate-500` |

### 3.2 Layout general (1280 px+)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR (64 px)   │  CONTENIDO PRINCIPAL                                        │
│                   │                                                             │
│  🏠 Inicio        │  ┌─────────────────────────────────────────────────────┐   │
│  🏆 Ranking       │  │ CABECERA DE PARTIDA                                  │   │
│  ⚔️  Arena (actv) │  │  "Partida 1 — El Algoritmo Asesinado"  [● EN CURSO] │   │
│  👤 Perfil        │  │  Turno 7 / ~24 · Equipo activo: TeamName  [▶▶ Run]  │   │
│                   │  └─────────────────────────────────────────────────────┘   │
│                   │                                                             │
│                   │  ┌──────────────────────┐  ┌──────────────────────────┐   │
│                   │  │  PANEL DE EQUIPOS    │  │  TABLERO DE DEDUCCIÓN    │   │
│                   │  │                      │  │                          │   │
│                   │  │  ┌────────────────┐  │  │  Sospechosos  T1 T2 T3  │   │
│                   │  │  │ ① TEAM ALPHA   │  │  │  C. Mostaza   ✦  ·  ✦  │   │
│                   │  │  │ 🟢 ACTIVO    ▶ │  │  │  Sra. Pavo    ·  ✦  ·  │   │
│                   │  │  │ ♦ 320 pts      │  │  │  ...                    │   │
│                   │  │  │ 🃏 5 cartas    │  │  │                          │   │
│                   │  │  └────────────────┘  │  │  Armas        T1 T2 T3  │   │
│                   │  │  ┌────────────────┐  │  │  Candelabro   ·  ·  ✦  │   │
│                   │  │  │ ② TEAM BETA    │  │  │  Cuchillo     ✦  ·  ·  │   │
│                   │  │  │ 🔴 ELIMINADO   │  │  │  ...                    │   │
│                   │  │  │ ♦ 180 pts      │  │  │                          │   │
│                   │  │  │ 🃏 4 cartas    │  │  │  Habitaciones T1 T2 T3  │   │
│                   │  │  └────────────────┘  │  │  Cocina       ✦  ·  ✦  │   │
│                   │  │  ...                 │  │  Comedor      ·  ✦  ·  │   │
│                   │  └──────────────────────┘  └──────────────────────────┘   │
│                   │                                                             │
│                   │  ┌─────────────────────────────────────────────────────┐   │
│                   │  │ FEED DE ACCIONES                                     │   │
│                   │  │                                                       │   │
│                   │  │  T7  ▶ TEAM ALPHA  →  Sugerencia                    │   │
│                   │  │        Pavo Real · Cuerda · Comedor                  │   │
│                   │  │        Refutada por TEAM GAMMA  +10 pts              │   │
│                   │  │                                                       │   │
│                   │  │  T6  ▶ TEAM GAMMA  →  Sugerencia                    │   │
│                   │  │        Coronel Mostaza · Revólver · Cocina           │   │
│                   │  │        No refutada  +30 pts                          │   │
│                   │  │                                                       │   │
│                   │  │  T5  ▶ TEAM BETA   →  Acusación ✗ (ELIMINADO)       │   │
│                   │  │        Reverendo Verde · Cuchillo · Estudio          │   │
│                   │  │        Incorrecto. Equipo eliminado.  -50 pts        │   │
│                   │  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Layout tablet (768–1280 px)

El layout tablet apila verticalmente las secciones:

1. Cabecera de partida (ancho completo)
2. Panel de equipos (scroll horizontal, tarjetas en fila)
3. Tablero de deducción (ancho completo, scroll vertical si hay muchas filas)
4. Feed de acciones (ancho completo)

---

## 4. Secciones en detalle

### 4.1 Cabecera de partida

**Ruta componente**: `src/components/game/ArenaHeader.tsx` (`"use client"`)

**Información mostrada**:

| Campo | Fuente | Visibilidad |
|---|---|---|
| Nombre de la partida | `GET /api/games/:id` | Siempre |
| Badge de estado (`PENDIENTE` / `EN CURSO` / `FINALIZADA`) | `partida.estado` | Siempre |
| Turno actual (`Turno N / ~MAX`) | `gameState.turnoActual` | Siempre |
| Equipo activo (nombre resaltado en cian) | `equipos[turnoActual % equiposActivos].nombre` | Solo `en_curso` |
| Duración del turno en curso (contador regresivo) | `turno.startedAt` → `Date.now()` | Solo `en_curso` |
| Botones de control: `▶ AUTO` / `⏸ PAUSA` / `⏭ AVANZAR` | Rol Admin | Solo Admin |
| Indicador de sincronización (spinner giratorio) | Activo durante fetch de polling | Siempre durante polling |

**Controles de Admin** (exclusivo, rol `admin`):

```
[ ▶ Run auto ]  [ ⏸ Pausar ]  [ ⏭ Avanzar turno ]  [ ⏹ Finalizar ]
```

- `▶ Run auto` → `POST /api/games/:id/run` → deshabilita el botón durante la respuesta.
- `⏸ Pausar` → `POST /api/games/:id/pause`.
- `⏭ Avanzar turno` → `POST /api/games/:id/advance-turn` (visible solo en modo `manual` o `pausado`).
- `⏹ Finalizar` → `POST /api/games/:id/finish` con confirmación modal.

### 4.2 Panel de equipos

**Ruta componente**: `src/components/game/ArenaTeamPanel.tsx` (`"use client"`)

Cada equipo se renderiza como una tarjeta vertical. El equipo cuyo turno está activo lleva un borde `ring-2 ring-cyan-400` y un badge animado `● TURNO ACTIVO`.

**Datos mostrados por tarjeta de equipo**:

| Campo | Fuente | Nota |
|---|---|---|
| Nombre del equipo | `Team.nombre` | |
| Posición en ranking (nº de orden por puntos) | Calculada en cliente | Ordena por `puntos DESC` |
| Puntos acumulados | `EquipoStateView.puntos` | `+N pts` animado si cambia |
| Estado: `ACTIVO` / `ELIMINADO` | `EquipoStateView.eliminado` | Badge de color |
| Número de cartas | `EquipoStateView.cartas.length` | Solo el recuento; nunca los valores |
| Turno activo | Comparación `turnoActual % equiposActivos === equipo.orden` | |
| Nº de sugerencias correctas (no refutadas) | Calculado del historial público | |
| Nº de acusaciones realizadas | Calculado del historial público | |

**Regla importante**: las cartas de un equipo **nunca son visibles** para el espectador. Solo se muestra el recuento (`🃏 5 cartas`). Esto mantiene la confidencialidad del juego durante la partida.

Al estar `eliminado`, la tarjeta se renderiza con `opacity-40 grayscale` y el badge rojo `ELIMINADO`.

### 4.3 Tablero de deducción

**Ruta componente**: `src/components/game/ArenaDeductionBoard.tsx` (`"use client"`)

El tablero reproduce visualmente una "libreta de Cluedo" simplificada. Su propósito es ayudar al espectador a seguir qué cartas han aparecido en el juego sin revelar qué equipo las tiene en la mano.

**Estructura de la cuadrícula**:

- **Filas**: las 21 cartas posibles del juego, agrupadas por categoría:
  - Sospechosos (6): Coronel Mostaza, Señora Pavo Real, Reverendo Verde, Señora Escarlata, Profesor Ciruela, Señorita Amapola.
  - Armas (6): Candelabro, Cuchillo, Tubo de plomo, Revólver, Cuerda, Llave inglesa.
  - Habitaciones (9): Cocina, Salón de baile, Conservatorio, Comedor, Sala de billar, Biblioteca, Sala de estar, Estudio, más la habitación de inicio (si aplica).
- **Columnas**: un bloque por equipo participante (hasta 6 columnas).
- **Celda**: muestra un marcador `✦` (cian) si ese equipo ha mencionado esa carta en alguna de sus sugerencias; vacía en caso contrario.

> El tablero no revela si un equipo **tiene** la carta, sino que esa carta **apareció en una sugerencia de ese equipo**. Es información pública derivada únicamente del historial de sugerencias.

**Cabecera de columna**: nombre del equipo abreviado (máx. 8 chars) + badge si está eliminado.

**Cabecera de sección de filas**: `SOSPECHOSOS` / `ARMAS` / `HABITACIONES` con separador visual.

**Interactividad (hover)**:

Al pasar el cursor sobre una celda marcada, aparece un tooltip con el listado de turnos en que esa carta apareció en las sugerencias del equipo:

```
✦ T3, T7, T12
```

### 4.4 Feed de acciones

**Ruta componente**: `src/components/game/ArenaActionFeed.tsx` (`"use client"`)

Lista cronológica inversa (turno más reciente primero) de todas las acciones registradas. Cada ítem del feed es expandible.

**Estructura de un ítem de sugerencia**:

```
┌──────────────────────────────────────────────────────────────────┐
│  T7  [SUGERENCIA]  🟢 TEAM ALPHA                    hace 2 min  │
│       Sospechoso: Señora Pavo Real                               │
│       Arma:       Cuerda                                         │
│       Habitación: Comedor                                        │
│       Resultado:  Refutada por TEAM GAMMA  +10 pts              │
└──────────────────────────────────────────────────────────────────┘
```

**Estructura de un ítem de acusación** (correcta):

```
┌──────────────────────────────────────────────────────────────────┐
│  T18  [ACUSACIÓN ✓]  🟢 TEAM GAMMA                  hace 0 min  │
│        Sospechoso: Coronel Mostaza                               │
│        Arma:       Revólver                                      │
│        Habitación: Cocina                                        │
│        Resultado:  ¡CORRECTO! TEAM GAMMA GANA  +200 pts         │
└──────────────────────────────────────────────────────────────────┘
```

**Estructura de un ítem de acusación** (incorrecta / eliminación):

```
┌──────────────────────────────────────────────────────────────────┐
│  T5  [ACUSACIÓN ✗]  🔴 TEAM BETA                    hace 8 min  │
│       Sospechoso: Reverendo Verde                                │
│       Arma:       Cuchillo                                       │
│       Habitación: Estudio                                        │
│       Resultado:  Incorrecto. TEAM BETA eliminado.  -50 pts     │
└──────────────────────────────────────────────────────────────────┘
```

**Regla de visibilidad**: la carta mostrada en una refutación (`cartaMostrada`) **nunca se muestra** en el feed público del espectador. Solo se muestra el equipo refutador. Esto respeta la confidencialidad del juego establecida en `getGameStateView()`.

**Comportamiento de actualización**: al recibir nuevos datos del polling, los ítems nuevos del feed aparecen con una animación de entrada (`animate-slide-in-from-top`). Los ítems anteriores permanecen estables (sin re-render completo).

**Paginación / scroll infinito**: el feed muestra los últimos 50 turnos. Si hay más, aparece un botón `Ver más turnos anteriores` que expande la lista completa.

### 4.5 Panel de resultado final

**Ruta componente**: `src/components/game/ArenaFinalResult.tsx` (`"use client"`)

Se muestra cuando `partida.estado === 'finalizada'`. Ocupa la cabecera completa de la pantalla (desplaza hacia abajo las otras secciones) con una presentación dramática:

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   🏆  ¡ PARTIDA FINALIZADA !                                         │
│                                                                      │
│   Ganador:  TEAM GAMMA  — 850 puntos                                 │
│                                                                      │
│   ╔═══════════════════════════════════════╗                          │
│   ║  SOBRE REVELADO                       ║                          │
│   ║  Sospechoso:  Coronel Mostaza         ║                          │
│   ║  Arma:        Revólver                ║                          │
│   ║  Habitación:  Cocina                  ║                          │
│   ╚═══════════════════════════════════════╝                          │
│                                                                      │
│   Tabla final de puntuación:                                         │
│   1. TEAM GAMMA   850 pts  🥇                                        │
│   2. TEAM ALPHA   320 pts  🥈                                        │
│   3. TEAM DELTA   180 pts  🥉                                        │
│   4. TEAM BETA    -50 pts  ❌ eliminado                              │
│                                                                      │
│                           [ Ver Ranking Global → ]                   │
└──────────────────────────────────────────────────────────────────────┘
```

**Fuente de datos del sobre revelado**: el sobre secreto (`Envelope`) solo se expone por la API cuando `partida.estado === 'finalizada'`. El endpoint `GET /api/games/:id` incluye el campo `sobre` condicionalmente:

```typescript
// Solo se incluye si el estado es 'finalizada'
sobre: partida.estado === 'finalizada' ? {
  sospechoso: envelope.sospechoso,
  arma: envelope.arma,
  habitacion: envelope.habitacion,
} : undefined,
```

---

## 5. Modelo de datos y API

### 5.1 Endpoint principal

```
GET /api/games/:id
```

Respuesta base (incluye siempre):

```typescript
interface ArenaGameResponse {
  partida: {
    id: string;
    nombre: string;
    estado: GameStatus;           // 'pendiente' | 'en_curso' | 'finalizada'
    turnoActual: number;
    modoEjecucion: 'manual' | 'auto' | 'pausado';
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
  };
  equipos: ArenaTeamInfo[];
  historial: ArenaActionRecord[];
  sobre?: {                       // Solo si estado === 'finalizada'
    sospechoso: string;
    arma: string;
    habitacion: string;
  };
}

interface ArenaTeamInfo {
  equipoId: string;
  nombre: string;           // nombre del equipo (JOIN con tabla equipos)
  orden: number;
  eliminado: boolean;
  puntos: number;
  numCartas: number;        // Solo el recuento; nunca los valores
}

interface ArenaActionRecord {
  turno: number;
  equipoId: string;
  tipo: 'suggestion' | 'accusation' | 'pass';
  sospechoso?: string;
  arma?: string;
  habitacion?: string;
  refutadaPor?: string | null;  // equipoId del refutador (nunca la carta)
  correcta?: boolean;           // Para acusaciones
  deltaPoints?: number;         // Variación de puntos en ese turno
  timestamp: string;
}
```

### 5.2 Endpoints de control (solo Admin)

Todos definidos en RFC F007 §5.3, aquí se enumeran para referencia:

| Endpoint | Método | Acción |
|---|---|---|
| `/api/games/:id/run` | `POST` | Inicia ejecución automática |
| `/api/games/:id/pause` | `POST` | Pausa la ejecución |
| `/api/games/:id/resume` | `POST` | Reanuda la ejecución |
| `/api/games/:id/advance-turn` | `POST` | Avanza un turno (modo manual/pausado) |
| `/api/games/:id/finish` | `POST` | Fuerza el cierre de la partida |

### 5.3 Cálculo del tablero de deducción (cliente)

El tablero de deducción se calcula en el cliente a partir del `historial` ya recibido. No requiere endpoint adicional:

```typescript
// src/lib/utils/deduction-board.ts

export interface DeductionCell {
  card: string;         // nombre de la carta
  category: 'sospechoso' | 'arma' | 'habitacion';
  teamId: string;
  turnos: number[];     // turnos en que apareció en sugerencia de este equipo
}

export function buildDeductionBoard(
  historial: ArenaActionRecord[],
  equipoIds: string[]
): Map<string, DeductionCell> {
  // Para cada acción de tipo 'suggestion' en el historial,
  // registrar las tres cartas (sospechoso, arma, habitacion) del equipo sugeridor.
  // Devuelve un Map indexado por `${equipoId}::${card}`.
}
```

---

## 6. Estructura de archivos y componentes

```
src/
├── app/
│   └── partidas/
│       ├── layout.tsx                        # Envuelve en GameContext (ya existe)
│       └── [id]/
│           └── page.tsx                      # Server Component (carga datos iniciales)
│               └── ArenaView                 # Client boundary principal
├── components/
│   └── game/
│       ├── ArenaView.tsx                     # "use client" — composición raíz de la Arena
│       ├── ArenaHeader.tsx                   # Cabecera de partida + controles admin
│       ├── ArenaTeamPanel.tsx                # Panel lateral de equipos
│       ├── ArenaTeamCard.tsx                 # Tarjeta individual de equipo
│       ├── ArenaDeductionBoard.tsx           # Tablero de deducción 21×N
│       ├── ArenaActionFeed.tsx               # Feed cronológico de acciones
│       ├── ArenaActionItem.tsx               # Ítem individual del feed (expandible)
│       └── ArenaFinalResult.tsx              # Panel de resultado final
├── lib/
│   └── utils/
│       └── deduction-board.ts               # Lógica pura de construcción del tablero
```

### 6.1 Jerarquía de componentes

```
page.tsx (Server Component)
  └─ <ArenaView gameId={id} initialData={data} />  ("use client")
       ├─ <ArenaHeader />       — cabecera + controles admin
       ├─ <div grid>
       │   ├─ <ArenaTeamPanel equipos={...} turnoActual={...} />
       │   │   └─ <ArenaTeamCard /> × N
       │   └─ <ArenaDeductionBoard historial={...} equipos={...} />
       ├─ <ArenaActionFeed historial={...} equipos={...} />
       │   └─ <ArenaActionItem /> × N
       └─ {finalizada && <ArenaFinalResult />}
```

### 6.2 Carga de datos inicial (Server Component)

```typescript
// src/app/partidas/[id]/page.tsx
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';

export default async function ArenaPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  // Carga datos iniciales en servidor para evitar flash de carga
  const initialData = await fetchArenaData(params.id);

  return <ArenaView gameId={params.id} initialData={initialData} />;
}
```

El Server Component proporciona los datos iniciales a `ArenaView` para evitar un flash de skeleton completo en la primera carga. El polling posterior lo gestiona `GameContext`.

---

## 7. Estado y polling

### 7.1 Integración con `GameContext`

`GameContext` (ya existente en `src/contexts/GameContext.tsx`) gestiona el polling de la partida activa. La Arena utiliza su hook `useGameContext()` para obtener los datos actualizados:

```typescript
// src/components/game/ArenaView.tsx
"use client";

import { useGameContext } from '@/contexts/GameContext';

export function ArenaView({ gameId, initialData }: ArenaViewProps) {
  const { gameState, isLoading, error } = useGameContext();

  // Usar initialData como fallback mientras gameState está null
  const data = gameState ?? initialData;

  // ...
}
```

### 7.2 Intervalos de polling

| Estado de partida | Intervalo | Razón |
|---|---|---|
| `pendiente` | 10 s | No hay actividad urgente; ahorra peticiones |
| `en_curso` | 5 s | Seguimiento en tiempo cuasi-real |
| `finalizada` | — | Detener polling; datos estáticos |

### 7.3 Transición sin flash (UX)

Al recibir nuevos datos del polling:

- **Panel de equipos**: los puntos se animan con `transition-all duration-500` si han cambiado.
- **Feed de acciones**: los ítems nuevos entran con `animate-in slide-in-from-top-2 duration-300`.
- **Cabecera**: el turno actual y equipo activo se actualizan sin re-render completo de la sección.
- **Tablero de deducción**: las celdas nuevas se marcan con un pulso de entrada (`animate-ping` de un frame).

---

## 8. Reglas de visibilidad y confidencialidad

| Información | Visible al espectador | Justificación |
|---|---|---|
| Nombre del equipo | ✅ Sí | Información pública |
| Estado del equipo (activo/eliminado) | ✅ Sí | Información pública |
| Puntos del equipo | ✅ Sí | Información pública |
| Número de cartas de cada equipo | ✅ Sí (solo recuento) | El recuento es deducible; las cartas no |
| Cartas en mano de cada equipo | ❌ No | Confidencial durante la partida |
| Combo de sugerencia (sospechoso + arma + habitación) | ✅ Sí | Acción pública del turno |
| Equipo refutador | ✅ Sí | Información pública |
| Carta mostrada en refutación | ❌ No | Confidencial siempre |
| Combo de acusación | ✅ Sí | Acción pública del turno |
| Resultado de acusación (correcto/incorrecto) | ✅ Sí | Información pública |
| Contenido del sobre | ✅ Solo si `finalizada` | Revelado al terminar la partida |
| Controles de gestión (run/pause/finish) | ✅ Solo rol Admin | RBAC por rol |

Estas reglas se aplican en **dos capas**:

1. **API**: `GET /api/games/:id` nunca incluye cartas en mano ni carta mostrada en el JSON de respuesta para espectadores. El `sobre` se incluye condicionalmente.
2. **Componentes**: aunque los datos llegaran, los componentes no renderizan campos de esas columnas.

---

## 9. Estados de pantalla

### 9.1 Estado: Cargando (inicial)

Skeleton de la pantalla completa:

- Cabecera: barra de `bg-slate-700 animate-pulse` de ancho completo (h-16).
- Panel de equipos: 3–4 tarjetas skeleton (h-32 cada una).
- Tablero: grilla de celdas skeleton (bg-slate-700/50, animate-pulse).
- Feed: 5 ítems skeleton (h-20 cada uno).

```tsx
// Si initialData es null (primera carga sin SSR) → mostrar skeleton completo
if (!data) return <ArenaSkeleton />;
```

### 9.2 Estado: Partida pendiente

```
┌──────────────────────────────────────────┐
│  ⚠ PARTIDA PENDIENTE DE INICIO           │
│  Esperando al administrador para iniciar  │
│  la partida. Actualización cada 10 s...  │
└──────────────────────────────────────────┘
```

Se muestra el panel de equipos registrados pero sin datos de turno. El tablero y el feed aparecen vacíos con el mensaje "La partida no ha comenzado todavía."

### 9.3 Estado: En curso

Layout completo como se describe en §3.2. El polling activo cada 5 s muestra un indicador de sincronización (spinner pequeño en la cabecera).

### 9.4 Estado: Finalizada

Se muestra el **panel de resultado final** (`ArenaFinalResult`) en la parte superior, seguido del tablero y el feed completo (histórico). El polling se detiene.

### 9.5 Estado: Error

```
┌──────────────────────────────────────────┐
│  ✖ Error al cargar la partida            │
│  No se pudo obtener el estado actual.    │
│  [ Reintentar ]                          │
└──────────────────────────────────────────┘
```

El error se muestra con `<ErrorBanner>` estándar. Si es un error 404, se redirige a `/ranking` con mensaje "Partida no encontrada."

### 9.6 Estado: Sin permisos

Redirigir a `/login` si no hay sesión activa (manejado por middleware y por `apiFetch`).

---

## 10. Trazabilidad

| Sección RFC | FR / UI relacionados | Descripción |
|---|---|---|
| §4.1 Cabecera + controles admin | FR-013, UI-008 | Gestión de estado de partida (iniciar, pausar, finalizar) |
| §4.2 Panel de equipos | FR-012, UI-005 | Visualización de estado de equipos en tiempo real |
| §4.3 Tablero de deducción | FR-012, UI-005 | Representación del espacio de deducción público |
| §4.4 Feed de acciones | FR-012, FR-009, FR-006, FR-007, UI-005 | Historial público de sugerencias y acusaciones |
| §4.5 Resultado final | FR-012, UI-005 | Revelado del sobre y resultado de la partida |
| §7 Polling | NFR-005 | Actualización en tiempo cuasi-real (5 s en curso) |
| §8 Confidencialidad | FR-009 | Cartas y refutaciones no visibles al espectador |

---

## 11. Decisiones de diseño

### 11.1 Polling vs. WebSockets

**Decisión**: polling `setInterval` de 5 s para `en_curso`.

**Razón**: la infraestructura de MVP es Next.js en Vercel/Railway con SQLite; WebSockets o SSE requieren configuración adicional o Vercel Edge Functions que aumentan la complejidad operativa innecesariamente para el evento de un día. El retraso de 5 s es aceptable para un espectador humano.

**Referencia ADR**: si se decide elevar a WebSockets en el futuro, crear `ADR-0004-arena-realtime.md`.

### 11.2 Tablero de deducción basado en historial público

**Decisión**: el tablero solo refleja cartas mencionadas en sugerencias (información 100% pública), no deducciones sobre qué equipo tiene qué carta.

**Razón**: mostrar deducciones reales requeriría conocer las cartas en mano (información confidencial durante la partida) o ejecutar el algoritmo de deducción del motor en el cliente. Ambas opciones violan la confidencialidad o aumentan innecesariamente la complejidad del frontend.

### 11.3 Datos iniciales por Server Component

**Decisión**: `page.tsx` carga los datos iniciales en el servidor y los pasa como props a `ArenaView`.

**Razón**: evita el flash de skeleton completo al navegar a la Arena por primera vez. El SSR proporciona content inmediato; el polling hidrata desde ese punto.

### 11.4 Revelado del sobre solo al finalizar

**Decisión**: `GET /api/games/:id` incluye el campo `sobre` solo si `estado === 'finalizada'`.

**Razón**: revelar el sobre durante la partida anula el juego para los espectadores que pudieran comunicarlo a los equipos. La restricción es de API, no solo de frontend.

---

## 12. Trabajo pendiente y preguntas abiertas

| ID | Descripción | Tipo |
|---|---|---|
| TODO-F009-01 | Implementar `ArenaView` y subcomponentes | Implementación |
| TODO-F009-02 | Actualizar `GET /api/games/:id` para incluir `numCartas`, `nombre` del equipo y `sobre` condicional | Backend |
| TODO-F009-03 | Implementar `buildDeductionBoard` en `src/lib/utils/deduction-board.ts` | Lógica |
| TODO-F009-04 | Añadir animaciones de entrada al feed (`animate-in`) con Tailwind CSS Animate | UI |
| TODO-F009-05 | Tests unitarios de `buildDeductionBoard` | Testing |
| TODO-F009-06 | Test E2E en smoke.spec.ts: navegar a Arena con datos de partida mock | Testing |
| OPENQ-F009-01 | ¿Se muestra el nombre de la habitación narrativo (temático del evento) o el nombre canónico del Cluedo? Explorar assets de F003. | Diseño |
| OPENQ-F009-02 | ¿Los controles de Admin en la Arena deben duplicarse con los del panel `/admin/partidas/[id]` o este RFC reemplaza a UI-008 para la gestión en tiempo real? | Arquitectura |
