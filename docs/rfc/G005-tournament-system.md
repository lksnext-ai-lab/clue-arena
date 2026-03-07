# RFC G005 — Sistema de Torneo

| Campo | Valor |
|---|---|
| **ID** | G005 |
| **Título** | Sistema de Torneo: fases, emparejamientos y progresión de equipos |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-03-05 |
| **Refs. spec** | [00-context](../../clue-arena-spec/docs/spec/00-context.md) · [10-requisitos-funcionales](../../clue-arena-spec/docs/spec/10-requisitos-funcionales.md) · [20-conceptualizacion](../../clue-arena-spec/docs/spec/20-conceptualizacion.md) · [50-modelo-datos](../../clue-arena-spec/docs/spec/50-modelo-datos.md) · [60-backend](../../clue-arena-spec/docs/spec/60-backend.md) |
| **Refs. FR** | FR-009 · FR-011 |
| **Deps.** | RFC G001 (sistema de puntuación) · RFC F007 (motor de juego/coordinator) · RFC F008 (gestión de partidas Admin) · RFC F005 (gestión de equipos) |

---

## 1. Resumen

Este documento propone un **sistema de torneo estructurado** para el evento Clue Arena. Define los formatos de torneo soportados (liga, eliminatoria, fase de grupos + playoffs), las reglas de emparejamiento automático, el modelo de datos necesario y la integración con el sistema de puntuación existente (RFC G001) y el panel de administración (RFC F008).

El sistema permite al Admin configurar un torneo antes del evento, generar automáticamente los emparejamientos de cada ronda, y controlar la progresión de los equipos a través de las fases. El resultado final es un ranking definitivo determinado por el rendimiento acumulado en todas las rondas del torneo.

---

## 2. Motivación y contexto

El modelo actual de partidas en Clue Arena es **ad hoc**: el Admin crea partidas manualmente seleccionando qué equipos participan en cada una. Este enfoque es suficiente para un evento pequeño, pero presenta las siguientes limitaciones cuando el número de equipos crece:

1. **Emparejamiento manual costoso**: con 8–16 equipos, decidir quién juega contra quién en cada ronda requiere trabajo manual y es propenso a errores (equipos que se repiten, equipos que no juegan).
2. **Sin progresión estructurada**: no hay noción de "fases" (clasificatoria → playoffs), lo que impide generar tensión narrativa durante el evento.
3. **Sin garantía de equidad**: un torneo estructurado asegura que todos los equipos jueguen el mismo número de partidas en la fase de clasificación.
4. **Ranking plano**: el ranking actual (`score_evento`) agrega todas las partidas por igual; en un torneo, las fases finales (playoff) deberían tener mayor peso o al menos diferenciarse visualmente.

Un sistema de torneo configurable resuelve estas limitaciones y hace el evento más escalable (desde 4 hasta 24 equipos).

---

## 3. Formatos de torneo soportados

### 3.1 Liga (*Round-Robin*)

- Todos los equipos participan en todas las rondas.
- En cada ronda se forman partidas de 2–6 jugadores siguiendo el algoritmo de emparejamiento (§4).
- El número de rondas se configura por el Admin (mínimo 3, máximo 10).
- El ranking final es la puntuación acumulada según RFC G001.
- **Indicado para**: eventos pequeños (4–12 equipos), una sola sesión de juego, máxima participación.

### 3.2 Eliminatoria (*Single Bracket*)

- El torneo parte de un bracket estándar (tamaño potencia de 2: 4, 8, 16 equipos).
- En cada ronda, los ganadores avanzan y los perdedores son eliminados.
- El criterio de avance es la posición en la partida de esa ronda (1.º avanza; en caso de empate, desempate por RFC G001 §5.2).
- Si el número de equipos no es potencia de 2, los equipos restantes reciben un *bye* (pase automático) para la primera ronda, priorizando los equipos con mayor puntuación en la fase previa o por sorteo si es la primera ronda.
- **Indicado para**: finales de alta tensión, evento de un día con fase previa de clasificación.

### 3.3 Fase de Grupos + Playoffs (*Group Stage + Knockout*)

Formato en dos fases secuenciales:

- **Fase 1 — Grupos (clasificatoria)**: los equipos se dividen en grupos de tamaño configurable (2–4 grupos). Dentro de cada grupo se juega una liga interna (Round-Robin reducido). Los `N` primeros de cada grupo avanzan a playoffs.
- **Fase 2 — Playoffs (eliminatoria)**: los clasificados de la fase de grupos se enfrentan en un bracket de eliminatoria simple.
- **Indicado para**: eventos con 8–24 equipos y suficiente tiempo para dos bloques de juego.

### 3.4 Personalizado (*Custom*)

El Admin puede crear rondas manualmente y asignar equipos a partidas sin lógica automática. Este modo preserva la compatibilidad con el flujo actual de RFC F008 y sirve de escape hatch para casos no cubiertos por los formatos anteriores.

---

## 4. Algoritmo de emparejamiento

### 4.1 Formato Liga

Se usa el algoritmo canónico de *round-robin scheduling* (rotación de berger):

```
Dado N equipos (rellenar con bye si N es impar):
  Fijar un equipo en posición 0.
  En cada ronda r (r = 1..N-1):
    Partida(k) = equipo[k] vs equipo[N-1-k]  para k = 0..⌊N/2⌋-1
    Rotar las posiciones 1..N-1 en sentido horario.
```

Si `N > 6` (capacidad máxima por partida de Cluedo), cada ronda produce múltiples partidas simultáneas con 2–6 jugadores en lugar de un único enfrentamiento 1v1. El reparto de grupos dentro de la ronda se hace maximizando el número de partidas completas de 6 jugadores.

### 4.2 Formato Eliminatoria

1. **Siembra inicial**: los equipos se ordenan por puntuación previa (o aleatoriamente si es la primera ronda).
2. **Construcción del bracket**: el 1.º contra el último, el 2.º contra el penúltimo, etc. —estrategia estándar para posponer el cruce de los dos mejores hasta la final.
3. **Criterio de avance por partida**: el equipo con mayor `score_partida` en esa ronda avanza. En caso de empate se aplican los tiebreakers de RFC G001 §5.2.
4. **Byes**: si el número de clasificados no es potencia de 2, se asignan byes a los equipos mejor clasificados.

### 4.3 Formato Fase de Grupos

- Fase 1: cada grupo se empareja mediante el algoritmo de liga (§4.1) restringido a los miembros del grupo.
- Asignación de equipos a grupos: opcionalmente por el Admin (manual) o automática (serpenteo por siembra: 1→G1, 2→G2, 3→G3, 4→G2, 5→G1… para distribuir la fuerza de forma equitativa).
- Fase 2: se construye el bracket de eliminatoria con los clasificados de cada grupo, cruzando grupos distintos en primera ronda (para evitar que los mismos equipos se enfrenten dos veces seguidas).

---

## 5. Modelo de datos

Se extiende el schema de Drizzle (`src/lib/db/schema.ts`) con las siguientes entidades:

### 5.1 `tournaments`

```typescript
export const tournaments = sqliteTable('tournaments', {
  id:          text('id').primaryKey().$defaultFn(() => createId()),
  name:        text('name').notNull(),
  format:      text('format', {
                 enum: ['round_robin', 'single_bracket', 'group_stage', 'custom']
               }).notNull(),
  status:      text('status', {
                 enum: ['draft', 'active', 'finished']
               }).notNull().default('draft'),
  config:      text('config').notNull(), // JSON blob — ver §5.5
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull()
                 .$defaultFn(() => new Date()),
  startedAt:   integer('started_at', { mode: 'timestamp' }),
  finishedAt:  integer('finished_at', { mode: 'timestamp' }),
});
```

### 5.2 `tournament_teams`

Tabla de inscripción: qué equipos participan en un torneo.

```typescript
export const tournamentTeams = sqliteTable('tournament_teams', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  tournamentId: text('tournament_id').notNull()
                  .references(() => tournaments.id, { onDelete: 'cascade' }),
  teamId:       text('team_id').notNull()
                  .references(() => teams.id, { onDelete: 'cascade' }),
  seed:         integer('seed'),           // siembra inicial (null = sin siembra)
  groupIndex:   integer('group_index'),    // solo para format = 'group_stage'
}, (t) => ({
  uniq: unique().on(t.tournamentId, t.teamId),
}));
```

### 5.3 `tournament_rounds`

```typescript
export const tournamentRounds = sqliteTable('tournament_rounds', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  tournamentId: text('tournament_id').notNull()
                  .references(() => tournaments.id, { onDelete: 'cascade' }),
  roundNumber:  integer('round_number').notNull(),
  phase:        text('phase', {
                  enum: ['group_stage', 'round_of_16', 'quarterfinal',
                         'semifinal', 'final', 'round']
                }).notNull().default('round'),
  status:       text('status', {
                  enum: ['pending', 'active', 'finished']
                }).notNull().default('pending'),
  generatedAt:  integer('generated_at', { mode: 'timestamp' }),
  finishedAt:   integer('finished_at', { mode: 'timestamp' }),
});
```

### 5.4 `tournament_round_games`

Relación N:M entre rondas y partidas (`games`). Una ronda puede contener varias partidas simultáneas.

```typescript
export const tournamentRoundGames = sqliteTable('tournament_round_games', {
  id:        text('id').primaryKey().$defaultFn(() => createId()),
  roundId:   text('round_id').notNull()
               .references(() => tournamentRounds.id, { onDelete: 'cascade' }),
  gameId:    text('game_id').notNull()
               .references(() => games.id, { onDelete: 'cascade' }),
  isBye:     integer('is_bye', { mode: 'boolean' }).notNull().default(false),
});
```

### 5.5 Schema de configuración (`config` JSON)

Cada formato tiene su propio subschema Zod almacenado en el campo `config` de `tournaments`:

```typescript
// src/lib/schemas/tournament-config.ts

export const RoundRobinConfigSchema = z.object({
  totalRounds:  z.number().int().min(3).max(10),
  playersPerGame: z.number().int().min(2).max(6).default(6),
});

export const SingleBracketConfigSchema = z.object({
  playersPerGame: z.number().int().min(2).max(6).default(2),
  // Los byes se calculan automáticamente
});

export const GroupStageConfigSchema = z.object({
  numGroups:       z.number().int().min(2).max(4),
  advancePerGroup: z.number().int().min(1).max(4), // cuántos clasifican de cada grupo
  groupRounds:     z.number().int().min(1).max(6), // rondas internas por grupo
  playersPerGame:  z.number().int().min(2).max(6).default(6),
});

export const TournamentConfigSchema = z.discriminatedUnion('format', [
  z.object({ format: z.literal('round_robin'),   ...RoundRobinConfigSchema.shape }),
  z.object({ format: z.literal('single_bracket'), ...SingleBracketConfigSchema.shape }),
  z.object({ format: z.literal('group_stage'),   ...GroupStageConfigSchema.shape }),
  z.object({ format: z.literal('custom'),         details: z.string().optional() }),
]);
```

---

## 6. API REST

### 6.1 Endpoints del torneo

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `GET` | `/api/tournaments` | Listar todos los torneos (con paginación) | `espectador` |
| `POST` | `/api/tournaments` | Crear un torneo nuevo (estado `draft`) | `admin` |
| `GET` | `/api/tournaments/:id` | Detalle de un torneo + rondas + clasificación actual | `espectador` |
| `PATCH` | `/api/tournaments/:id` | Actualizar nombre, config (solo en `draft`) | `admin` |
| `DELETE` | `/api/tournaments/:id` | Eliminar torneo (solo en `draft`) | `admin` |
| `POST` | `/api/tournaments/:id/start` | Iniciar torneo (draft → active); genera ronda 1 | `admin` |
| `POST` | `/api/tournaments/:id/finish` | Cerrar torneo manualmente (active → finished) | `admin` |

### 6.2 Endpoints de inscripción

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `GET` | `/api/tournaments/:id/teams` | Equipos inscritos (con seed y grupo) | `espectador` |
| `POST` | `/api/tournaments/:id/teams` | Inscribir equipo(s) al torneo | `admin` |
| `DELETE` | `/api/tournaments/:id/teams/:teamId` | Desinscribir equipo (solo en `draft`) | `admin` |

### 6.3 Endpoints de rondas

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `GET` | `/api/tournaments/:id/rounds` | Listar rondas con su estado | `espectador` |
| `GET` | `/api/tournaments/:id/rounds/:roundId` | Detalle de ronda: partidas y resultados | `espectador` |
| `POST` | `/api/tournaments/:id/rounds/:roundId/start` | Iniciar ronda (pendiente → activa) | `admin` |
| `POST` | `/api/tournaments/:id/rounds/:roundId/advance` | Finalizar ronda y generar la siguiente | `admin` |

### 6.4 Endpoint de clasificación

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `GET` | `/api/tournaments/:id/standings` | Clasificación actual del torneo (rankings por fase y global) | `espectador` |

### 6.5 Respuesta de clasificación (`GET /api/tournaments/:id/standings`)

```typescript
// src/types/api.ts (añadir)
export type TournamentStandingsResponse = {
  tournamentId: string;
  tournamentName: string;
  format: TournamentFormat;
  status: TournamentStatus;
  currentRound: number | null;
  standings: {
    rank: number;
    teamId: string;
    teamName: string;
    avatarUrl: string | null;
    groupIndex: number | null;
    totalScore: number;
    gamesPlayed: number;
    wins: number;
    eliminations: number;
    isEliminated: boolean; // solo en formatos de eliminatoria
    advancedToPlayoffs: boolean; // solo en group_stage
    roundScores: { roundNumber: number; score: number; gameId: string | null }[];
  }[];
};
```

---

## 7. Lógica del servidor

### 7.1 Servicio de torneo (`src/lib/tournament/`)

Se crea un módulo nuevo `src/lib/tournament/` con lógica pura (sin I/O), análogo a `src/lib/game/engine.ts`:

```
src/lib/tournament/
├── engine.ts          # Cálculo de clasificaciones, detección de ganador de ronda
├── matchmaker.ts      # Algoritmos de emparejamiento (round-robin, bracket, groups)
├── types.ts           # Tipos internos del torneo (sin deps de BD)
└── index.ts           # Re-exports públicos
```

**`matchmaker.ts`** exporta:

```typescript
export function generateRoundRobinPairings(
  teams: TeamId[],
  round: number,
  playersPerGame: number
): TeamId[][] // array de grupos (cada grupo = una partida)

export function generateBracketRound(
  standings: { teamId: TeamId; score: number }[],
  playersPerGame: number
): { matches: TeamId[][]; byes: TeamId[] }

export function generateGroupStagePairings(
  groups: TeamId[][],
  round: number,
  playersPerGame: number
): TeamId[][]
```

**`engine.ts`** exporta:

```typescript
export function computeTournamentStandings(
  teams: TournamentTeam[],
  rounds: TournamentRound[],
  gameResults: GameResult[] // resultados ya calculados por RFC G001
): TournamentStanding[]

export function isRoundComplete(round: TournamentRound, games: Game[]): boolean

export function getEliminatedTeams(
  standings: TournamentStanding[],
  round: TournamentRound
): TeamId[]
```

### 7.2 Flujo `POST /api/tournaments/:id/start`

1. Verificar que el torneo está en `draft` y tiene ≥ 2 equipos inscritos.
2. Validar que la configuración (`config`) es coherente (número de grupos ≤ equipos / 2, etc.).
3. Llamar a `matchmaker.generateXxxPairings()` para obtener los emparejamientos de la ronda 1.
4. Para cada grupo de emparejamiento: crear una entrada en `games` (RFC F008 flow) y vincularla en `tournament_round_games`.
5. Marcar el torneo como `active` y la ronda 1 como `pending`.
6. Retornar el torneo actualizado con la ronda 1 incluida.

### 7.3 Flujo `POST /api/tournaments/:id/rounds/:roundId/advance`

1. Verificar que todas las partidas de la ronda han finalizado (`isRoundComplete` = true).
2. Calcular los clasificados/eliminados con `engine.computeTournamentStandings()`.
3. Para formatos con eliminación: marcar equipos eliminados en `tournament_teams`.
4. Generar emparejamientos de la siguiente ronda con `matchmaker`.
5. Crear la nueva `tournament_round` + partidas asociadas.
6. Si no quedan más rondas posibles (eliminatoria con un ganador, o se alcanzó `totalRounds` en liga): marcar el torneo como `finished`.
7. Retornar la nueva ronda con sus partidas.

---

## 8. Integración con componentes existentes

### 8.1 RFC G001 — Sistema de puntuación

El sistema de torneo **no modifica** la fórmula de puntuación por partida definida en RFC G001. La puntuación por partida se calcula exactamente igual; el torneo añade una capa encima que:

- Agrega `score_partida` por equipo dentro de cada ronda.
- En formatos de eliminatoria, usa `score_partida` como criterio de avance (no acumulado).
- En el ranking global del torneo, acumula `score_partida` de todas las rondas en que el equipo participó.

### 8.2 RFC F008 — Panel Admin partidas

- La pantalla de creación de partidas en el Admin se extiende para mostrar si una partida está asociada a un torneo/ronda (campo `readonly` en ese caso: los participantes los determina el sistema de torneo).
- Se añade una sección **Torneo** en el Admin con:
  - Lista de torneos (estado, formato, progreso).
  - Wizard de creación de torneo (nombre, formato, config, inscripción de equipos).
  - Vista de bracket / tabla de grupos con botones "Iniciar ronda" y "Avanzar ronda".

### 8.3 RFC F005 — Gestión de equipos

- La inscripción al torneo referencia los equipos existentes. No se crea un nuevo concepto de "equipo de torneo": es la misma entidad `teams`.
- Si un equipo se elimina mientras hay un torneo activo, la API debe devolver `409 Conflict` y bloquear la operación.

### 8.4 Ranking público (`/ranking`)

- La ruta `/ranking` existente pasa a mostrar, por defecto, la clasificación del **último torneo activo o finalizado** (si existe) en lugar de la tabla plana de `score_evento`.
- Si no hay ningún torneo, el comportamiento es el actual (tabla de puntuación acumulada de todas las partidas).
- Se añade un selector de torneo para consultar clasificaciones de torneos anteriores.

---

## 9. Cambios en la interfaz (UI)

> Los wireframes detallados se documentarán en las RFC de frontend correspondientes. Este apartado describe las pantallas necesarias a nivel funcional.

### 9.1 Nuevas vistas de Admin

| ID provisional | Pantalla | Descripción |
|---|---|---|
| UI-ADMIN-T01 | Lista de torneos | Tabla con todos los torneos, estado, formato, nº equipos, acciones. |
| UI-ADMIN-T02 | Crear / editar torneo | Wizard en 3 pasos: (1) Nombre + formato, (2) Configuración (rondas/grupos), (3) Inscripción de equipos + seeds. |
| UI-ADMIN-T03 | Panel de torneo | Vista central: bracket o tabla de grupos, clasificación en tiempo real por ronda, botones de control de flujo (iniciar / avanzar). |
| UI-ADMIN-T04 | Detalle de ronda | Lista de partidas de la ronda con estado, enlace a espectador (`/partidas/[id]`), resultados. |

### 9.2 Vista pública

| ID provisional | Pantalla | Descripción |
|---|---|---|
| UI-PUBLIC-T01 | Ranking (extendido) | La pantalla `/ranking` existente muestra la clasificación del torneo activo con indicadores de fase (grupo/bracket). |
| UI-PUBLIC-T02 | Bracket público | Vista de solo lectura del bracket del torneo (accesible desde `/ranking` o `/torneo/[id]`). |

---

## 10. Eventos WebSocket (extensión de RFC F011)

Se añaden los siguientes tipos de evento al canal de arena:

| Tipo | Payload | Descripción |
|---|---|---|
| `tournament:round_started` | `{ tournamentId, roundId, roundNumber, phase }` | Una ronda ha comenzado. |
| `tournament:round_finished` | `{ tournamentId, roundId, standings: TournamentStanding[] }` | Una ronda ha terminado; standings actualizados. |
| `tournament:team_eliminated` | `{ tournamentId, teamId, roundId }` | Un equipo ha sido eliminado (solo en formatos de eliminatoria). |
| `tournament:finished` | `{ tournamentId, winnerId, finalStandings }` | El torneo ha finalizado. |

---

## 11. Testing

### 11.1 Tests unitarios (Vitest)

- `src/tests/tournament-matchmaker.test.ts`: cobertura completa de `generateRoundRobinPairings`, `generateBracketRound` y `generateGroupStagePairings` con:
  - 4, 6, 8, 12, 16 equipos.
  - Casos límite: número impar de equipos, un único equipo restante en bracket.
  - Verificar que ningún equipo aparece dos veces en la misma partida.
  - Verificar que todos los equipos aparecen en exactamente una partida por ronda (o un bye).
- `src/tests/tournament-engine.test.ts`: cobertura de `computeTournamentStandings` y `getEliminatedTeams`.

### 11.2 Tests de integración (Route Handlers)

- `POST /api/tournaments`: validación de config, creación en BD.
- `POST /api/tournaments/:id/start`: generación correcta de ronda 1 + partidas.
- `POST /api/tournaments/:id/rounds/:roundId/advance`: avance correcto en liga y eliminatoria.

### 11.3 Tests E2E (Playwright)

- Flujo completo Admin: crear torneo Round-Robin → inscribir 4 equipos → iniciar → avanzar rondas hasta fin.
- Verificar que el ranking público refleja la clasificación correcta tras cada ronda.

---

## 12. Preguntas abiertas

| ID | Pregunta | Impacto |
|---|---|---|
| OPENQ-T01 | ¿El torneo del evento de mayo 2026 usará un formato fijo o debe ser configurable en tiempo real? Si es fijo, se puede simplificar el wizard de configuración. | Alcance del Admin UI |
| OPENQ-T02 | ¿Las partidas de distintas rondas pueden ejecutarse en paralelo, o siempre se completa una ronda antes de empezar la siguiente? | Diseño del coordinator y lógica de `advance` |
| OPENQ-T03 | ¿El ranking público debe mostrar el bracket visual (árbol) o es suficiente con una tabla de posiciones por ronda? | Esfuerzo UI (bracket visual es significativo) |
| OPENQ-T04 | ¿Se permite que un equipo compita en más de un torneo simultáneamente? (Hoy no hay restricción.) | Modelo de datos y validaciones |
| OPENQ-T05 | ¿Los puntos de las partidas de torneo se incluyen en el ranking global plano (`/ranking` sin torneo activo), o son puntuaciones independientes? | API de ranking y agregación |
| OPENQ-T06 | ¿Debe existir una fase de "entrenamiento" previa al torneo para la siembra inicial (seeding por rendimiento), o el seeding es manual o aleatorio? | Integración con RFC F015 (Training Arena) |

---

## 13. Trabajo pendiente (TODO)

| ID | Tarea | Deps. |
|---|---|---|
| TODO-T01 | Diseñar wireframes detallados UI-ADMIN-T01..T04 y UI-PUBLIC-T01..T02 | — |
| TODO-T02 | Implementar `src/lib/tournament/matchmaker.ts` con tests unitarios | — |
| TODO-T03 | Implementar `src/lib/tournament/engine.ts` con tests unitarios | TODO-T02 |
| TODO-T04 | Extender schema Drizzle (§5) y generar migración | — |
| TODO-T05 | Implementar Route Handlers de torneo (§6) | TODO-T03, TODO-T04 |
| TODO-T06 | Implementar Route Handlers de rondas + lógica `advance` | TODO-T05 |
| TODO-T07 | Extender panel Admin con sección Torneo (UI-ADMIN-T01..T04) | TODO-T05, TODO-T06 |
| TODO-T08 | Extender `/ranking` con soporte de torneo (UI-PUBLIC-T01) | TODO-T05 |
| TODO-T09 | Añadir tipos de evento WebSocket de torneo (§10) y emitirlos en `advance` | TODO-T06, RFC F011 |
| TODO-T10 | Tests E2E del flujo completo de torneo | TODO-T07 |

---

## 14. Alternativas consideradas

### 14.1 Double Elimination

Un formato de doble eliminatoria (winners bracket + losers bracket) fue considerado pero descartado para el MVP por la complejidad del bracket y la dificultad de visualizarlo de forma clara. Puede añadirse como un cuarto valor en el enum `format` en una iteración posterior.

### 14.2 Swiss System

El sistema suizo (equipos con puntuaciones similares se emparejan en cada ronda) es ideal para torneos largos con muchos equipos. Se descarta en MVP porque requiere un algoritmo de emparejamiento más complejo (basado en graph matchings) y el evento de mayo 2026 tiene un número de equipos y rondas relativamente pequeño. Considerado para futuras ediciones.

### 14.3 Torneo como entidad separada vs. agrupación de partidas

Se evaluó no introducir la entidad `tournament` y modelar el concepto como "grupos de partidas con etiquetas de ronda". Se descartó porque no permite capturar la configuración del formato, el estado del bracket, ni las reglas de progresión de forma coherente.

---

## 15. Fuentes

| URL | Fecha | Extracto |
|---|---|---|
| — | — | Diseño basado en reglas estándar de torneos (Round-Robin, Single Elimination, Swiss), sin fuentes externas específicas. Las referencias formales se añadirán si se implementa Double Elimination o Swiss. |
