# RFC F015 — Área de Entrenamiento del Agente

| Campo | Valor |
|---|---|
| **ID** | F015 |
| **Título** | Área de entrenamiento: partidas de práctica para afinar el comportamiento del agente |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-03-02 |
| **Refs. spec** | [10-requisitos-funcionales](../../clue-arena-spec/docs/spec/10-requisitos-funcionales.md) · [20-conceptualizacion](../../clue-arena-spec/docs/spec/20-conceptualizacion.md) · [30-ui-spec](../../clue-arena-spec/docs/spec/30-ui-spec.md) · [60-backend](../../clue-arena-spec/docs/spec/60-backend.md) · [50-modelo-datos](../../clue-arena-spec/docs/spec/50-modelo-datos.md) |
| **Deps.** | RFC F001 · RFC F005 · RFC F006 · RFC F007 · RFC G001 · RFC G003 |

---

## 1. Resumen

Este RFC define el **Área de Entrenamiento** (`/equipo/entrenamiento`): una sección del panel de equipo que permite a los participantes lanzar **partidas de práctica** con su agente IA para observar su comportamiento, depurar errores y afinar su estrategia antes del evento oficial.

Las partidas de entrenamiento son **partidas Cluedo reales** ejecutadas por el mismo motor de juego (`engine.ts`) que las partidas oficiales, pero con cuatro diferencias fundamentales:

1. **No cuentan en el ranking oficial** — los puntos no se acumulan en la tabla de clasificación.
2. **El equipo controla el ciclo** — puede lanzar, pausar y reiniciar partidas sin necesidad del Admin.
3. **Visibilidad completa del juego** — el equipo ve todos los detalles de cada turno (incluyendo `cartaMostrada` y el sobre secreto al finalizar) para facilitar la depuración.
4. **Trazabilidad completa de la interacción con el agente** — cada turno registra el prompt exacto enviado al LLM, la respuesta cruda del modelo, cada llamada a herramienta MCP (`get_game_state`, `get_agent_memory`, `save_agent_memory`) con sus argumentos y respuestas, y el estado de la memoria del agente antes y después del turno.

Los oponentes de los agentes humanos en entrenamiento son instancias del **agente local Genkit** (F006), desplegadas con roles de equipo bot. No hay requisito de conectividad a MattinAI para el entrenamiento.

---

## 2. Motivación y contexto

### 2.1 Problema actual

Los equipos disponen de la página `/instrucciones` (F013) para entender el contrato MCP, pero no tienen ningún mecanismo dentro de la plataforma para **verificar que su agente funciona correctamente** antes del evento oficial. Esto genera:

| Problema | Impacto |
|---|---|
| El equipo no puede probar su agente contra el motor real hasta el día del evento | Errores de formato (`EVT_INVALID_FORMAT`), timeouts o acusaciones prematuras solo se descubren en competición |
| No hay feedback observable de qué información recibe el agente en cada turno | Los equipos depuran a ciegas, sin ver el `GameStateView` que su agente recibe |
| No se puede verificar el comportamiento de refutación hasta que ocurre una sugerencia rival en partida real | Estrategia de `show_card` no probada |
| El agente puede tener regresiones entre iteraciones que solo se detectan en producción | Sin cobertura de integración end-to-end en la plataforma |
| El equipo no puede ver qué prompt recibió el LLM ni cómo razonó antes de devolver la acción | Imposible distinguir si un error es de lógica del agente, de prompt engineering o de uso incorrecto de herramientas |
| Las llamadas a herramientas MCP (`get_game_state`, `get_agent_memory`, `save_agent_memory`) no son observables | El equipo no puede detectar lecturas incorrectas del estado o escrituras erróneas en memoria |
| El estado de la memoria gestionada por el agente no es inspeccionable turno a turno | No se puede auditar si el agente sobreescribe, corrompe o ignora su memoria entre turnos |

### 2.2 Objetivos de diseño

1. **Ciclo corto**: un equipo puede lanzar una partida de entrenamiento completa en menos de 5 minutos.
2. **Depuración detallada**: visibilidad completa del estado del juego, historial de turnos y sobre secreto al finalizar.
3. **Trazabilidad del agente**: registro completo de la interacción LLM por turno — prompt, respuesta, tool calls y evolución de la memoria — para que el equipo pueda identificar exactamente dónde falla su agente.
4. **Sin bloqueo externo**: no depende de MattinAI ni de la disponibilidad del Admin.
5. **Reutilizar el motor**: misma lógica que las partidas oficiales; sin bifurcaciones en `engine.ts`.
6. **Aislamiento de datos**: las partidas de entrenamiento no contaminan el ranking ni el historial oficial.

---

## 3. Modelo de datos

### 3.1 Tabla `partidas_entrenamiento`

Las partidas de entrenamiento se almacenan en una tabla separada para garantizar el aislamiento del ranking oficial. Comparten la misma estructura lógica que `partidas`, pero añaden columnas de control propias del equipo.

```typescript
// src/lib/db/schema.ts (adición)
export const partidasEntrenamiento = sqliteTable('partidas_entrenamiento', {
  id:            text('id').primaryKey(),                     // UUID v4
  equipoId:      text('equipo_id')
                   .notNull()
                   .references(() => equipos.id),             // Dueño de la sesión
  estado:        text('estado', {
                   enum: ['en_curso', 'finalizada', 'abortada'],
                 }).notNull().default('en_curso'),
  numBots:       integer('num_bots').notNull().default(2),    // 1–5 bots oponentes
  seed:          text('seed'),                                // Semilla reproducible (opcional)
  sobresJson:    text('sobres_json'),                        // JSON del sobre (visible al finalizar)
  createdAt:     integer('created_at', { mode: 'timestamp' }).notNull(),
  finishedAt:    integer('finished_at', { mode: 'timestamp' }),
});
```

### 3.2 Tabla `turnos_entrenamiento`

```typescript
export const turnosEntrenamiento = sqliteTable('turnos_entrenamiento', {
  id:            text('id').primaryKey(),
  partidaId:     text('partida_id')
                   .notNull()
                   .references(() => partidasEntrenamiento.id, { onDelete: 'cascade' }),
  equipoId:      text('equipo_id').notNull(),                 // Puede ser el equipo real o un bot
  esBot:         integer('es_bot', { mode: 'boolean' }).notNull().default(false),
  numero:        integer('numero').notNull(),
  accion:        text('accion_json'),                        // AgentResponse completo (JSON)
  gameStateView: text('game_state_view_json'),               // GameStateView recibida por el agente
  agentTrace:    text('agent_trace_json'),                   // AgentInteractionTrace (ver §3.4)
  memoriaInicial: text('memoria_inicial_json'),              // Estado de memoria antes del turno
  memoriaFinal:   text('memoria_final_json'),                // Estado de memoria tras el turno
  durationMs:    integer('duration_ms'),                     // Latencia total de invocación del agente
  createdAt:     integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

> **Decisión de diseño**: `gameStateView`, `agentTrace`, `memoriaInicial` y `memoriaFinal` se persisten íntegramente en cada turno del equipo real, pero **no** en los turnos de bots. Los turnos de bot no generan traza de interacción porque no tienen valor diagnóstico para el equipo y reducen el almacenamiento necesario a la mitad.

### 3.4 Tipo `AgentInteractionTrace`

Estructura JSON almacenada en `agent_trace_json` para cada turno del equipo real:

```typescript
// src/types/api.ts (adición)
export interface AgentToolCall {
  tool:        'get_game_state' | 'get_agent_memory' | 'save_agent_memory';
  args:        Record<string, unknown>;      // Argumentos enviados a la herramienta
  result:      Record<string, unknown>;      // Respuesta de la herramienta
  durationMs:  number;                       // Latencia de la llamada MCP
}

export interface AgentLlmExchange {
  /** Índice 0-based dentro del mismo turno (un turno puede tener varias iteraciones LLM si usa ReAct) */
  index:       number;
  systemPrompt: string;                     // System prompt enviado al LLM
  userPrompt:  string;                      // Mensaje de usuario / contexto del turno
  rawResponse: string;                      // Texto crudo devuelto por el LLM
  toolCalls:   AgentToolCall[];             // Herramientas invocadas DURANTE esta iteración
  durationMs:  number;                      // Latencia de la llamada LLM
}

export interface AgentInteractionTrace {
  type:       'play_turn' | 'refute';       // Tipo de invocación
  exchanges:  AgentLlmExchange[];           // Todas las iteraciones LLM del turno (ReAct puede tener N)
  totalToolCalls: number;                   // Contador total de tool calls en el turno
  parsedAction: AgentResponse | null;       // Acción estructurada extraída (null si falló el parsing)
  parseError:   string | null;             // Mensaje de error si parsedAction es null
}
```

El tipo `AgentInteractionTrace` es **exclusivo del entrenamiento** y nunca se genera ni persiste en partidas oficiales.

### 3.3 Aislamiento del ranking

Las tablas `partidas_entrenamiento` y `turnos_entrenamiento` son totalmente independientes de `partidas`, `turnos`, `sugerencias` y `acusaciones` usadas por el motor oficial. La función `GET /api/ranking` **nunca lee** de las tablas de entrenamiento.

---

## 4. Diseño del backend

### 4.1 Route Handlers nuevos

| Método | Ruta | Descripción | Auth / RBAC |
|---|---|---|---|
| `POST` | `/api/training/games` | Crea y arranca una partida de entrenamiento | `equipo` (propio) |
| `GET` | `/api/training/games` | Lista las últimas N partidas de entrenamiento del equipo | `equipo` (propio) |
| `GET` | `/api/training/games/:id` | Detalle completo de una partida (incluye sobre al finalizar) | `equipo` (propio) o `admin` |
| `POST` | `/api/training/games/:id/abort` | Aborta una partida en curso | `equipo` (propio) |
| `GET` | `/api/training/games/:id/turns` | Historial de turnos con `gameStateView`, `accion`, `agentTrace` y memoria | `equipo` (propio) o `admin` |
| `GET` | `/api/training/games/:id/turns/:turnoId/trace` | Traza de interacción completa de un turno concreto | `equipo` (propio) |

### 4.2 `POST /api/training/games` — body y respuesta

```typescript
// src/lib/schemas/training.ts

export const CreateTrainingGameSchema = z.object({
  numBots: z.number().int().min(1).max(5).default(2),
  seed:    z.string().optional(),   // Si se omite, se genera aleatoriamente
});

export type CreateTrainingGameBody = z.infer<typeof CreateTrainingGameSchema>;
```

Respuesta exitosa `201`:

```json
{
  "id": "uuid-partida",
  "estado": "en_curso",
  "numBots": 2,
  "seed": "abc123",
  "turnoActual": 1,
  "equipoPropio": {
    "equipoId": "uuid-equipo",
    "cartas": ["Coronel Mostaza", "Cuchillo", "Biblioteca"]
  }
}
```

### 4.3 Ciclo de ejecución de un turno de entrenamiento

El ciclo de turno se ejecuta de forma **síncrona dentro del Route Handler** `POST /api/training/games` (y en el proceso de cada turno posterior). No se usa una cola de trabajo: el evento es de tamaño reducido y la duración de una partida de entrenamiento completa es corta.

```
POST /api/training/games
  │
  ├─ Validar body (Zod)
  ├─ Verificar sesión + RBAC (rol equipo, equipoId = session.equipo.id)
  ├─ initTrainingGame(equipoId, opciones) → TrainingGameState
  │    ├─ Generar sobre secreto (seed reproducible)
  │    ├─ Repartir cartas al equipo real + N bots
  │    └─ Persistir en partidas_entrenamiento
  │
  └─ runTrainingGameLoop(state) → TrainingGameResult
       ├─ Por cada turno (round-robin equipo + bots):
       │    ├─ buildGameStateView(state, currentTeamId)     ← lógica pura engine.ts
       │    ├─ Si turno del equipo real:
       │    │    ├─ memoriaInicial = await getAgentMemory(gameId, equipoId)
       │    │    ├─ invokeAgentWithTrace(AgentRequest)       ← wrapper instrumentado (§4.4)
       │    │    │    └─ retorna { agentResponse, trace: AgentInteractionTrace }
       │    │    └─ memoriaFinal = await getAgentMemory(gameId, equipoId)  ← re-lectura post-turno
       │    │
       │    ├─ Si turno de bot:
       │    │    └─ invokeAgent(AgentRequest)                ← fachada estándar, sin traza
       │    │
       │    ├─ applyAction(state, agentResponse)             ← lógica pura engine.ts
       │    ├─ Persistir turno en turnos_entrenamiento
       │    │    ├─ accion, gameStateView, durationMs (siempre)
       │    │    └─ agentTrace, memoriaInicial, memoriaFinal (solo si esBot = false)
       │    └─ Si isGameOver(state) → break
       └─ Persistir resultado final (sobre, ganador) en partidas_entrenamiento
```

> **Límite de seguridad**: `MAX_TRAINING_TURNS = 100`. Si la partida supera 100 turnos totales sin ganador, se marca como `abortada` con motivo `MAX_TURNS_EXCEEDED`.

### 4.4 `invokeAgentWithTrace` — wrapper de instrumentación

Para capturar la traza de interacción del agente del equipo real sin modificar el contrato de `invokeAgent`, se introduce un wrapper de instrumentación exclusivo del entrenamiento:

```typescript
// src/lib/api/training-agent.ts
import type { AgentRequest, AgentResponse, AgentInteractionTrace } from '@/types/api';

export interface InvokeAgentWithTraceResult {
  agentResponse:  AgentResponse;
  trace:          AgentInteractionTrace;
  memoriaInicial: Record<string, unknown> | null;
  memoriaFinal:   Record<string, unknown> | null;
  durationMs:     number;
}

export async function invokeAgentWithTrace(
  request: AgentRequest
): Promise<InvokeAgentWithTraceResult> { ... }
```

#### Estrategia de captura según backend

| Backend | Mecanismo de captura |
|---|---|
| **Genkit local** (`AGENT_BACKEND=local`) | Genkit expone un objeto `FlowState` con los intercambios LLM y tool calls al completar el flow. Se mapea directamente a `AgentInteractionTrace`. |
| **MattinAI** (`AGENT_BACKEND=mattin`) | MattinAI no expone trazas internas. Se captura: (a) el payload de la request enviada como `userPrompt` sintético, (b) el response body como `rawResponse`, y (c) las llamadas al MCP Server local que MattinAI realiza durante el turno (registradas por el middleware del Route Handler `/api/mcp`). |

> **OPENQ-F015-06**: ¿La API de MattinAI proporcionará un `trace_id` o endpoint de replay de trazas en el futuro? Si sí, la captura para `AGENT_BACKEND=mattin` puede enriquecerse sin cambios en `turnosEntrenamiento`.

#### Captura de tool calls del MCP Server local

Cuando el backend es MattinAI, las llamadas a herramientas del agente llegan como requests reales al Route Handler `/api/mcp`. Para registrarlas durante un turno de entrenamiento, se introduce un **interceptor de turno activo**:

```typescript
// src/lib/mcp/training-interceptor.ts

/** Activa la captura de tool calls para un turno de entrenamiento concreto. */
export function beginTurnCapture(trainingTurnId: string): void;

/** Registra una tool call interceptada. Llamado desde el Route Handler /api/mcp. */
export function recordToolCall(call: AgentToolCall): void;

/** Detiene la captura y retorna las tool calls acumuladas. */
export function endTurnCapture(): AgentToolCall[];
```

El interceptor es un singleton en memoria (válido en el contexto del proceso síncrono del entrenamiento). No se usa en partidas oficiales.

### 4.5 Restricciones de acceso y cuotas

| Restricción | Valor | Motivo |
|---|---|---|
| Partidas de entrenamiento activas simultáneas por equipo | 1 | Evitar sobrecarga del servidor en un evento con 10–20 equipos |
| Máximo de partidas de entrenamiento históricas por equipo | 20 | Límite de almacenamiento y visibilidad útil |
| Frecuencia mínima entre partidas de entrenamiento | 60 s | Rate limiting ligero: evitar abuso por accidente |

Si se intenta crear una partida cuando ya hay una `en_curso`, el servidor responde `409 TRAINING_GAME_IN_PROGRESS` con el `id` de la partida activa.

---

## 5. Diseño del frontend

### 5.1 Ruta y estructura de componentes

| Ruta | Componente raíz | Tipo |
|---|---|---|
| `/equipo/entrenamiento` | `src/app/equipo/entrenamiento/page.tsx` | Server Component (lista de partidas) |
| `/equipo/entrenamiento/nueva` | `src/app/equipo/entrenamiento/nueva/page.tsx` | Client Component (formulario de configuración) |
| `/equipo/entrenamiento/[id]` | `src/app/equipo/entrenamiento/[id]/page.tsx` | Client Component (vista de partida en progreso / resultado) |

```
src/app/equipo/entrenamiento/
├── page.tsx                    ← Lista de partidas de entrenamiento (Server Component)
├── nueva/
│   └── page.tsx                ← Formulario de creación (Client Component)
└── [id]/
    ├── page.tsx                ← Vista de partida (Client Component, polling 5 s)
    └── components/
        ├── TrainingGameHeader.tsx          ← Estado, seed, número de bots
        ├── TrainingTurnTimeline.tsx        ← Historial de turnos con acciones y estado del juego
        ├── TrainingDeductionBoard.tsx      ← Tablero de deducción (reutiliza buildDeductionBoard)
        ├── TrainingGameStateDebug.tsx      ← Acordeón con el GameStateView de cada turno (debug)
        ├── TrainingAgentInteractionLog.tsx ← Traza completa: prompts, LLM, tool calls, memoria
        └── TrainingEnvelopeReveal.tsx      ← Sobre secreto revelado al finalizar
```

### 5.2 Pantalla: Lista de partidas de entrenamiento (`/equipo/entrenamiento`)

**Estados de la pantalla:**

| Estado | Descripción |
|---|---|
| Sin partidas | Mensaje vacío con CTA "Iniciar entrenamiento" |
| Cargando | Skeleton de la tabla |
| Con datos | Tabla con las últimas 20 partidas de entrenamiento |
| Partida activa | Banner en la parte superior con enlace directo a la partida en curso |

**Columnas de la tabla:**

| Columna | Valor |
|---|---|
| Fecha | `createdAt` formateado |
| Estado | Badge `en_curso` / `finalizada` / `abortada` |
| Bots | `numBots` |
| Turnos | Número de turnos totales disputados |
| Resultado | "Ganador: tu equipo" / "Ganador: Bot N" / "Abortada" |
| Semilla | `seed` (monospace, truncado) |
| Acciones | Enlace a detalle / botón "Abortar" si `en_curso` |

### 5.3 Pantalla: Configuración de nueva partida (`/equipo/entrenamiento/nueva`)

Formulario React Hook Form + Zod (`CreateTrainingGameSchema`):

```
┌─────────────────────────────────────────────────────────────┐
│  Nueva partida de entrenamiento                             │
│                                                             │
│  Nº de bots oponentes     [1] [2] [3] [4] [5]             │
│                                (2 seleccionado)            │
│                                                             │
│  Semilla (opcional) ______________________________         │
│  └─ Deja vacío para partida aleatoria reproducible         │
│                                                             │
│  ⚠ Esta partida no cuenta en el ranking oficial            │
│                                                             │
│              [Cancelar]  [Iniciar entrenamiento →]         │
└─────────────────────────────────────────────────────────────┘
```

Al enviar, el cliente hace `POST /api/training/games` y redirige a `/equipo/entrenamiento/{id}`.

### 5.4 Pantalla: Vista de partida de entrenamiento (`/equipo/entrenamiento/[id]`)

La pantalla se actualiza con polling cada **5 s** mientras el estado sea `en_curso`. Al finalizar, el polling se detiene y se muestra el sobre secreto revelado.

#### Layout de la pantalla

```
┌─────────────────────────────────────────────────────────────┐
│  Entrenamiento · Partida abc123  [en curso]  [Abortar]      │
│  Bots: 2 · Semilla: abc123                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌── Sobre secreto ─────────────────────────────────────┐  │
│  │  🔒 Se revelará al finalizar la partida              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌── Turno actual ──────────────────────────────────────┐  │
│  │  Turno 7 · Tu equipo (esperando respuesta del agente)│  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌── Tablero de deducción ──────────────────────────────┐  │
│  │  [TrainingDeductionBoard]                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌── Historial de turnos ───────────────────────────────┐  │
│  │  [TrainingTurnTimeline] ↓ más reciente primero       │  │
│  │  └─ Cada turno del equipo incluye:                   │  │
│  │       ▶ [Ver GameStateView]     (acordeón)           │  │
│  │       ▶ [Interacción del agente] (acordeón §5.7)     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Estados de pantalla obligatorios

| Estado | Descripción |
|---|---|
| `en_curso` | Active polling; "Turno actual" con spinner si el agente del equipo está siendo invocado |
| `finalizada (victoria)` | Sobre secreto revelado en verde; banner "Tu agente ganó" con puntuación simulada |
| `finalizada (derrota)` | Sobre secreto revelado; banner "Ganó Bot N" con mensaje de depuración |
| `abortada` | Mensaje con motivo; botón "Nueva partida" |
| `error de red` | `<ErrorBanner>` no bloqueante; polling se reintenta |

### 5.5 Componente: `TrainingTurnTimeline`

Lista de tarjetas colapsables, una por turno, ordenadas de más reciente a más antiguo:

```
▼ Turno 6 — Tu equipo — Sugerencia
    Sospechoso: Coronel Mostaza
    Arma:       Cuchillo
    Habitación: Biblioteca
    Refutado por: Bot 2  →  carta mostrada: [Cuchillo] ← visible solo para equipo
    ─────────────────────────────────────────────────
    [Ver GameStateView recibida]   ▶ (acordeón debug)
    [Interacción del agente]       ▶ (acordeón — ver §5.7)

▶ Turno 5 — Bot 1 — Sugerencia (colapsado, sin acordeón de agente)
▶ Turno 4 — Tu equipo — Pase voluntario
```

El acordeón "Ver GameStateView recibida" muestra el JSON completo del `GameStateView` que recibió el agente en ese turno, formateado con resaltado de sintaxis.

El acordeón "Interacción del agente" muestra `TrainingAgentInteractionLog` (§5.7). Solo aparece en turnos del equipo real (`esBot = false`); los turnos de bot no tienen traza.

### 5.7 Componente: `TrainingAgentInteractionLog`

Muestra la traza completa de la interacción del agente en un turno concreto. Recibe el objeto `AgentInteractionTrace` del turno.

#### Estructura del componente

```
┌── Interacción del agente — Turno 6 (play_turn) ──────────────────────────────┐
│                                                                               │
│  Memoria al inicio del turno                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  { "descartados": ["Coronel Mostaza", "Cuchillo"], "candidatos": … } │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ── Iteración LLM 1 ─────────────────────────────────────────────────────   │
│                                                                               │
│  System prompt                              [Copiar] [Expandir ▼]           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Eres un agente Cluedo. Tu objetivo es resolver el sobre secreto…   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  Mensaje de usuario                         [Copiar] [Expandir ▼]           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Estado actual: turno 6, tus cartas son…                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  Tool calls en esta iteración                                                │
│  ┌─ 1. get_game_state ──────────────────────────────────────────────────┐   │
│  │   Args:   { "gameId": "abc", "teamId": "xyz" }                        │   │
│  │   Result: { "turno": 6, "historial": […] }    ⏱ 42 ms               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  ┌─ 2. get_agent_memory ────────────────────────────────────────────────┐   │
│  │   Args:   { "gameId": "abc", "teamId": "xyz" }                        │   │
│  │   Result: { "descartados": […] }               ⏱ 8 ms                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  Respuesta cruda del LLM                    [Copiar] [Expandir ▼]           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Voy a sugerir a Coronel Mostaza con el Cuchillo en la Biblioteca…  │    │
│  │  {"type":"suggestion","sospechoso":"Coronel Mostaza",…}             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ── Fin de iteraciones ──────────────────────────────────────────────────   │
│                                                                               │
│  Acción parseada: ✅ suggestion  (Coronel Mostaza · Cuchillo · Biblioteca)   │
│                                                                               │
│  Memoria al final del turno                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  { "descartados": ["Coronel Mostaza", "Cuchillo", …], … }           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  Diff de memoria  [solo campos modificados] ──────────────────────────────  │
│  + candidatos: eliminado "Cuchillo"                                          │
│                                                                               │
│                                             ⏱ Total: 1 243 ms               │
└───────────────────────────────────────────────────────────────────────────────┘
```

#### Reglas de presentación

| Elemento | Comportamiento |
|---|---|
| Prompts largos | Truncados a 300 chars por defecto; botón "Expandir" muestra el texto completo |
| JSONs de tool calls | Formateados con resaltado de sintaxis (`<pre>` + clase monospace) |
| `parseError` no nulo | Banner rojo con el mensaje de error antes del resultado; `parsedAction` se muestra como `null` |
| Múltiples iteraciones LLM | Cada iteración en su propio acordeón numerado (ReAct puede tener N rondas de razonamiento) |
| Botón "Copiar" | Copia al portapapeles el texto completo del prompt o respuesta |
| Diff de memoria | Calculado en cliente con comparación profunda de `memoriaInicial` vs `memoriaFinal`; si no hay cambios → "Sin cambios en memoria" |
| Turnos de bot | No renderizar este componente (los turnos de bot no tienen `agentTrace`) |

### 5.6 Componente: `TrainingEnvelopeReveal`

```
┌──────────────────────────────────────────────────────┐
│  🔓 SOBRE SECRETO REVELADO                           │
│                                                      │
│  Sospechoso:  Coronel Mostaza                        │
│  Arma:        Llave inglesa                          │
│  Habitación:  Cocina                                 │
│                                                      │
│  Tu agente acusó: ✅ CORRECTO (en turno 8)           │
│  Puntos simulados: 1 350 pts (no cuentan en ranking) │
└──────────────────────────────────────────────────────┘
```

---

## 6. Integración con `buildDeductionBoard`

`TrainingDeductionBoard` reutiliza directamente `buildDeductionBoard` de `src/lib/utils/deduction-board.ts`. La adaptación es mínima: los datos de turno se mapean desde `TurnoEntrenamientoResponse` al tipo `TurnResponse` existente.

```typescript
// src/app/equipo/entrenamiento/[id]/components/TrainingDeductionBoard.tsx
import { buildDeductionBoard } from '@/lib/utils/deduction-board';

// Los turnos de entrenamiento conforman el mismo contrato TurnResponse
const board = buildDeductionBoard(turnos, equipoIds);
```

Solo se muestra la perspectiva del equipo real (sus sugerencias y las de los bots contra ellos). La vista es idéntica al tablero de deducción de las partidas oficiales.

---

## 7. Puntuación simulada

Al finalizar una partida de entrenamiento, se calcula y muestra una **puntuación simulada** para dar feedback accionable al equipo. La puntuación usa exactamente la misma fórmula de G001 pero se almacena únicamente en `partidas_entrenamiento.resultado_json` y **nunca** se agrega al ranking oficial.

```typescript
// src/lib/game/engine.ts (función reutilizada sin cambios)
const simulatedScore = computeScore(trainingGameState, equipoId);
```

El resultado se muestra en la interfaz con la etiqueta **"(simulado, no cuenta en el ranking)"** para evitar confusión.

---

## 8. Acceso, seguridad y RBAC

| Regla | Detalle |
|---|---|
| Solo el rol `equipo` puede crear y ver sus propias partidas de entrenamiento | Verificación en Route Handler: `session.user.rol === 'equipo'` y `session.equipo.id === params.equipoId` |
| El rol `admin` puede leer cualquier partida de entrenamiento | Para diagnóstico; no puede crearlas ni abortarlas |
| El rol `espectador` no tiene acceso a `/equipo/**` | Garantizado por middleware existente |
| `gameStateView` (datos debug) solo visible para el equipo propietario | Route Handler omite `gameStateView`, `agentTrace`, `memoriaInicial` y `memoriaFinal` si `session.user.rol === 'admin'`; el admin solo ve `accion` y `durationMs` |
| Los prompts del sistema pueden contener instrucciones propietarias del equipo | Nunca exponer `agentTrace` a otros equipos ni a espectadores; restricción RBAC estricta en `/api/training/games/:id/turns/:turnoId/trace` |
| Las partidas de entrenamiento no se exponen en `/api/games` ni en `/api/ranking` | Separación física de tablas; cero riesgo de fuga hacia el ranking oficial |

---

## 9. Cambios en ficheros existentes

| Fichero | Cambio |
|---|---|
| `src/lib/db/schema.ts` | Añadir `partidasEntrenamiento` y `turnosEntrenamiento` |
| `src/lib/game/engine.ts` | Sin cambios (lógica pura reutilizada directamente) |
| `src/middleware.ts` | Añadir `/equipo/entrenamiento/**` al matcher de rol `equipo` (ya protegido por `/equipo/**`) |
| `src/types/api.ts` | Añadir `TrainingGameResponse`, `TrainingTurnResponse`, `CreateTrainingGameBody`, `AgentInteractionTrace`, `AgentLlmExchange`, `AgentToolCall` |
| `src/lib/schemas/training.ts` | Nuevo fichero con `CreateTrainingGameSchema` |
| `src/app/api/training/` | Nuevos Route Handlers (§4.1) |
| `src/lib/api/training-agent.ts` | Nuevo: wrapper `invokeAgentWithTrace` (§4.4) |
| `src/lib/mcp/training-interceptor.ts` | Nuevo: interceptor de tool calls para trazas de entrenamiento (§4.4) |
| `src/app/equipo/entrenamiento/` | Nuevas páginas y componentes (§5.1) |

---

## 10. Plan de implementación

| Fase | Tareas | Estimación |
|---|---|---|
| **1 — Modelo** | Schema Drizzle + migración + tipos API | 0.5 días |
| **2 — Backend** | Route Handlers + lógica `runTrainingGameLoop` | 1.5 días |
| **3 — Frontend básico** | Lista de partidas + formulario de nueva partida + vista de resultado | 1 día |
| **4 — Debug UX** | `TrainingTurnTimeline` + acordeón `GameStateView` + `TrainingDeductionBoard` | 1 día |
| **5 — Traza de agente** | `invokeAgentWithTrace` + interceptor MCP + `TrainingAgentInteractionLog` (prompts, tool calls, memoria, diff) | 1.5 días |
| **6 — Tests** | Tests unitarios del loop de entrenamiento + `invokeAgentWithTrace` + interceptor + E2E smoke test `/equipo/entrenamiento` | 0.5 días |
| **Total** | — | **~6 días** |

---

## 11. Preguntas abiertas

| ID | Pregunta | Impacto |
|---|---|---|
| OPENQ-F015-01 | ¿El equipo puede descargar el historial completo de una partida de entrenamiento en JSON para depuración offline? | Si sí → añadir `GET /api/training/games/:id/export` |
| OPENQ-F015-02 | ¿Las partidas de entrenamiento deben expirar y eliminarse automáticamente tras N días? | Afecta al modelo de datos y a una tarea cron de limpieza |
| OPENQ-F015-03 | ¿Debe haber un límite de partidas de entrenamiento simultáneas a nivel global (todos los equipos), no solo por equipo? | Relevante si el servidor tiene recursos muy limitados el día del evento |
| OPENQ-F015-04 | ¿Se permite al Admin lanzar partidas de entrenamiento para un equipo concreto (modo diagnóstico)? | Si sí → añadir `equipoId` como parámetro en `POST /api/training/games` con RBAC admin |
| OPENQ-F015-06 | ¿La API de MattinAI proporcionará un `trace_id` o endpoint de replay de trazas en el futuro? | Si sí, la captura para `AGENT_BACKEND=mattin` puede enriquecerse sin cambios en el schema |
| OPENQ-F015-07 | ¿Debe el equipo poder exportar la traza completa de un turno como fichero JSON para análisis offline o envío al soporte? | Si sí → añadir descarga desde `TrainingAgentInteractionLog` |

---

## 12. Decisiones tomadas

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Tablas de entrenamiento separadas de las oficiales | Columna `esEntrenamiento: boolean` en `partidas` | Aislamiento más robusto; sin riesgo de queries que acumulen entrenamiento en el ranking por bug |
| Ciclo síncrono en el Route Handler (no cola) | Job queue (BullMQ, Inngest) | Complejidad innecesaria para MVP de evento; partida completa < 30 s |
| Bots siempre con agente local Genkit | Bots basados en heurísticas puras sin LLM | Reutilizar el stack de F006 y cubrir mejor el comportamiento que verán en producción |
| `gameStateView` persistida en cada turno | Solo disponible en runtime (no persistida) | Imprescindible para el caso de uso de depuración; el overhead de almacenamiento es asumible |
| `agentTrace` solo para turnos del equipo real, no de bots | Traza completa para todos los turnos | Los bots utilizan el agente local Genkit internamente; su traza no tiene valor diagnóstico para el equipo y duplicaría el almacenamiento |
| Interceptor singleton en memoria para captura de tool calls de MattinAI | Middleware persistente de trazas a BD | El ciclo es síncrono y uniproceso en el entrenamiento; el singleton es suficiente y evita complejidad innecesaria |
| Sin puntuación oficial en entrenamiento | Puntuación opcional que el usuario puede "activar" | Evita la fricción de explicar cuándo cuenta y cuándo no; la etiqueta "simulado" es suficiente |
