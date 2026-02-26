# RFC F007 — Motor de Juego como Coordinador de Agentes

| Campo | Valor |
|---|---|
| **ID** | F007 |
| **Título** | Motor de Juego Cluedo: diseño como coordinador de agentes de equipo |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-02-26 |
| **Refs. spec** | [40-arquitectura](../../clue-arena-spec/docs/spec/40-arquitectura.md) · [60-backend](../../clue-arena-spec/docs/spec/60-backend.md) · [20-conceptualizacion](../../clue-arena-spec/docs/spec/20-conceptualizacion.md) · [10-requisitos-funcionales](../../clue-arena-spec/docs/spec/10-requisitos-funcionales.md) |
| **Deps.** | RFC F001 · RFC F006 |

---

## 1. Resumen

Este RFC describe el diseño del **motor de juego de Clue Arena** (`src/lib/game/engine.ts`) en su rol de **coordinador de agentes de equipo**. El motor es el árbitro central que:

1. Gestiona el estado completo de cada partida (sobre secreto, cartas, turnos, puntuación).
2. Orquesta el ciclo de vida de cada turno: invoca al agente del equipo correspondiente, recibe su decisión estructurada (`AgentResponse`), la valida, la persiste y avanza el juego.
3. Expone la herramienta MCP `get_game_state` (`/api/mcp`) para que los agentes **lean** el estado durante su razonamiento. Las **acciones** (sugerencia, acusación, refutación) son la *salida* del agente, no efectos secundarios dentro del razonamiento.
4. Garantiza que cada agente solo ve la información que el reglamento del Cluedo le permite conocer.

El motor es **puro en su núcleo** (sin I/O, determinista dado un `seed`) y delega toda la persistencia a los Route Handlers que lo envuelven, siguiendo el principio establecido en F001.

---

## 2. Motivación y contexto

### 2.1 Problema a resolver

La competición requiere que múltiples agentes IA autónomos (uno por equipo) jueguen una partida de Cluedo coordinada sin intervención humana. Para ello se necesita un componente central que:

- Sea árbitro imparcial y determinista (resultado reproducible dado el `seed`).
- Garantice la confidencialidad de información (un agente nunca ve las cartas de otro ni el contenido del sobre).
- Aplique las reglas del juego de forma atómica: no pueden ocurrir acciones fuera de turno ni estados inconsistentes.
- Permita observabilidad completa para la organización y espectadores, sin exponerla a los agentes.

### 2.2 Diseño actual y su rol

El motor ya existe en `src/lib/game/engine.ts` como conjunto de funciones puras. Este RFC contextualiza cómo ese núcleo puro se integra con:

- La capa de persistencia (Drizzle + SQLite).
- El servidor MCP (herramientas expuestas a los agentes).
- El ciclo de invocación de agentes (`AgentRequest` / `AgentResponse` de F006).
- Los Route Handlers de administración de partidas.

---

## 3. Arquitectura de coordinación

### 3.1 Visión de componentes

```
┌───────────────────────────────────────────────────────────────────┐
│                    Clue Arena (Next.js monolith)                  │
│                                                                   │
│  ┌─────────────────┐      ┌─────────────────────────────────┐     │
│  │  Admin UI       │      │  Route Handler: /api/games      │     │
│  └─────────────────┘      └──────────────┬──────────────────┘     │
│                                           │                       │
│                            ┌──────────────▼──────────────────┐    │
│                            │        GAME ENGINE               │   │
│                            │   src/lib/game/engine.ts         │   │
│                            │                                  │   │
│                            │  initGame() → GameState          │   │
│                            │  applyAction(state, action)      │   │
│                            │  getGameStateView(state, teamId) │   │
│                            │  isGameOver(state)               │   │
│                            │  getWinner(state)                │   │
│                            └──────┬────────────┬─────────────┘    │
│                                   │            │                  │
│              Invoke agent         │            │ Persist state    │
│                                   │            │                  │
│  ┌────────────────────────────────▼─┐  ┌───────▼───────────────┐  │
│  │  Agent Facade: src/lib/api/agent │  │  Drizzle ORM + SQLite │  │
│  │  invokeAgent(AgentRequest)       │  │  partidas, turnos,    │  │
│  │   └─ MattinAI  (producción)      │  │  sugerencias,         │  │
│  │   └─ Genkit    (local/CI)        │  │  acusaciones, sobres  │  │
│  └───────────────┬──────────────────┘  └───────────────────────┘  │
│                  │                                                │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  MCP Server: /api/mcp  (src/lib/mcp/)                        │ │
│  │                                                              │ │
│  │  Herramienta de CONSULTA (disponible al agente durante       │ │
│  │  su razonamiento — Genkit tool / MattinAI MCP):              │ │
│  │   • get_game_state  → GameStateView filtrada por equipo      │ │
│  │   • get_agent_memory → memoria persistida del agente         │ │
│  │   • save_agent_memory → persiste deducciones actualizadas    │ │ 
│  │                                                              │ │
│  │  Herramientas aplicadas por el COORDINADOR tras recibir      │ │
│  │  el AgentResponse (el agente no las llama directamente):     │ │
│  │   • make_suggestion → persiste sugerencia + refutación       │ │
│  │   • make_accusation → persiste acusación + cierre si gana    │ │
│  │   • show_card       → lectura de carta revelada (sugeridor)  │ │
│  └──────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

### 3.2 Separación de responsabilidades

| Capa | Archivo principal | Responsabilidad |
|---|---|---|
| Núcleo puro | `src/lib/game/engine.ts` | Reglas del juego, cálculos, transiciones de estado. Sin I/O. |
| Tipos de motor | `src/lib/game/types.ts` | `GameState`, `GameAction`, `ActionRecord`, vistas filtradas. |
| Herramientas MCP | `src/lib/mcp/tools/` | Adaptadores entre MCP y motor; leen/escriben en BD. |
| Servidor MCP | `src/lib/mcp/server.ts` | Singleton MCP Server; registra herramientas. |
| Endpoint MCP | `src/app/api/mcp/route.ts` | Transporte HTTP + autenticación por token Bearer. |
| Fachada de agente | `src/lib/api/agent.ts` | Selecciona backend (MattinAI / Genkit local) según `AGENT_BACKEND`; retorna `AgentResponse`. |
| Herramientas Genkit | `src/lib/ai/tools/cluedo-tools.ts` | Wrappers Genkit sobre handlers MCP; disponibles al agente local durante razonamiento. |
| Memoria de agente | `src/lib/ai/agent-memory.ts` | Persistencia de deducciones por `(gameId, teamId)` entre turnos. |
| API de partidas | `src/app/api/games/` | CRUD de partidas + orquestación del ciclo de turnos; aplica `AgentResponse`. |
| Orquestador auto-run | `src/lib/game/auto-run.ts` | Bucle de ejecución automática con soporte de pausa; fire-and-forget sobre el coordinador. |
| Persistencia | `src/lib/db/schema.ts` | Fuente de verdad del modelo de datos persistido. |

---

## 4. Estado del juego

### 4.1 `GameState` (estado interno — nunca expuesto a agentes)

```typescript
interface GameState {
  gameId: string;
  estado: 'pendiente' | 'en_curso' | 'finalizada';
  turnoActual: number;                              // índice relativo a equipos activos
  sobre: { sospechoso: Sospechoso; arma: Arma; habitacion: Habitacion }; // secreto
  equipos: EquipoState[];
  historial: ActionRecord[];
  ganadorId: string | null;
  seed: number;                                     // reproducibilidad
}
```

El campo `sobre` **nunca se serializa hacia los agentes**. Es el secreto del juego; solo el motor lo usa para validar acusaciones.

### 4.2 `GameStateView` (vista filtrada por equipo)

```typescript
interface GameStateView {
  gameId: string;
  estado: string;
  turnoActual: number;
  equipos: EquipoStateView[];   // cartas: solo las del propio equipo; vacío para otros
  historial: ActionRecordView[]; // cartaMostrada: solo en sugerencias propias
  esElTurnoDeEquipo: boolean;   // true si es el turno del equipo solicitante
}
```

La función `getGameStateView(state, requestingTeamId)` del motor aplica el filtrado. Garantiza:

- **Confidencialidad de cartas**: un agente recibe `cartas: []` para todos los equipos excepto el propio.
- **Confidencialidad de refutación**: `cartaMostrada` solo aparece en las entradas del historial donde `equipoId === requestingTeamId`.
- **Transparencia de eliminaciones y puntos**: visible para todos los agentes.

### 4.3 Persistencia del estado

El motor no persiste nada. El estado se reconstruye desde la BD en cada operación de herramienta MCP o Route Handler. El mapeo entre BD y `GameState` lo realizan los handlers:

| Tabla BD | Campo `GameState` |
|---|---|
| `partidas.estado` | `GameState.estado` |
| `partidas.turnoActual` | `GameState.turnoActual` |
| `sobres.*` | `GameState.sobre` (no expuesto a agentes) |
| `partidaEquipos[].cartas` | `EquipoState[].cartas` |
| `turnos`, `sugerencias`, `acusaciones` | `GameState.historial` |

---

## 5. Ciclo de vida de un turno

El ciclo de un turno completo desde la perspectiva del coordinador:

```
Admin inicia partida
        │
        ▼
POST /api/games/{id}/start
  ├── initGame(equipoIds, seed)    ← genera sobre + reparte cartas
  ├── Persiste: partidas, sobres, partidaEquipos
  └── Crea turno 0 (estado: 'en_curso') para equipo[0]
        │
        ▼
┌──────────────────────────────────────────────────────┐
│                  BUCLE DE TURNO                      │
│                                                      │
│  POST /api/games/{id}/advance-turn                   │
│   ├── Carga GameState desde BD                       │
│   ├── invokeAgent({ type: 'play_turn',               │
│   │                  gameId, teamId })               │
│   │    └── Agente razona internamente con:           │
│   │         • get_game_state  (consulta MCP/Genkit)  │
│   │         • get_agent_memory (deducciones previas) │
│   │         • save_agent_memory (persiste deducción) │
│   │    └── Devuelve AgentResponse:                   │
│   │         { action: { type: 'suggestion'|          │
│   │                      'accusation', ... } }       │
│   ├── Coordinador aplica AgentResponse:              │
│   │    • suggestion → makeSuggestionTool.handler()   │
│   │    • accusation → makeAccusationTool.handler()   │
│   ├── applyAction(state, action)  [validac. motor]   │
│   ├── Persiste resultado en BD                       │
│   ├── Si la sugerencia tiene refutador:              │
│   │    invokeAgent({ type: 'refute', ... })          │
│   │     └── Agente refutador razona con:             │
│   │          • get_game_state  (ve sus cartas)        │
│   │          • get_agent_memory (opcional)            │
│   │     └── Devuelve AgentResponse:                  │
│   │          { action: { type: 'show_card', card }   │
│   │                   | { type: 'cannot_refute' } }  │
│   │    Coordinador persiste cartaMostrada en BD      │
│   ├── Avanza turnoActual → siguiente equipo          │
│   └── Si isGameOver(state): cierra partida           │
│                                                      │
└──────────────────────────────────────────────────────┘
        │
        ▼
POST /api/games/{id}/finish
  ├── Marca partida como 'finalizada'
  └── Calcula ranking final
```

### 5.1 Estados de un turno

| Estado | Descripción |
|---|---|
| `pendiente` | Turno asignado pero el agente aún no ha sido invocado |
| `en_curso` | Agente invocado; esperando `AgentResponse` (el agente está razonando) |
| `completado` | `AgentResponse` recibido, acción aplicada, persistida y turno cerrado |

### 5.2 Fase de refutación

Cuando un agente hace una sugerencia y existe un equipo que puede refutarla, el coordinador lanza una segunda invocación al agente del equipo refutador:

---

### 5.3 Modos de ejecución de la partida

El coordinador soporta dos modos de ejecución ortogonales al ciclo de turno:

| Modo | Valor en BD | Comportamiento |
|---|---|---|
| `manual` | `'manual'` | Cada turno avanza solo cuando el admin llama explícitamente a `POST /api/games/{id}/advance-turn`. |
| `auto` | `'auto'` | El orquestador ejecuta turnos en bucle con un retardo configurable (`turnoDelayMs`) entre cada uno. |
| `pausado` | `'pausado'` | El bucle automático se detiene antes del siguiente turno; la partida queda en espera sin finalizar. |

El campo `partidas.modoEjecucion` (default `'manual'`) y `partidas.turnoDelayMs` (default `3000` ms) se añaden al schema Drizzle.

#### Máquina de estados de `modoEjecucion`

```
          POST /run              POST /pause
 manual ──────────────▶ auto ──────────────▶ pausado
   ▲                    │  ▲                    │
   │                    │  └────────────────────┘
   │             estado │       POST /resume
   │          finalizada│
   └────────────────────┘  (loop termina solo)
```

- `manual → auto`: `POST /api/games/{id}/run`
- `auto → pausado`: `POST /api/games/{id}/pause`
- `pausado → auto`: `POST /api/games/{id}/resume`
- Cualquier modo → loop termina automáticamente cuando `estado === 'finalizada'`.

#### Endpoints de control de ejecución

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/games/{id}/run` | `POST` | Inicia ejecución automática. Establece `modoEjecucion = 'auto'`, lanza el bucle en background y retorna `202 Accepted`. Acepta body opcional `{ turnoDelayMs?: number }`. |
| `/api/games/{id}/pause` | `POST` | Pausa la ejecución automática. Establece `modoEjecucion = 'pausado'`. El turno en curso completa; el siguiente no se inicia. Retorna `200`. |
| `/api/games/{id}/resume` | `POST` | Reanuda desde el punto de pausa. Establece `modoEjecucion = 'auto'` y relanza el bucle. Acepta body opcional `{ turnoDelayMs?: number }`. Retorna `202`. |

#### Bucle auto-run (`src/lib/game/auto-run.ts`)

El módulo `auto-run.ts` exporta `startAutoRun(gameId, delayMs)`. La función es **fire-and-forget**: el Route Handler la invoca sin `await` y responde `202` inmediatamente.

```typescript
// src/lib/game/auto-run.ts  (pseudocódigo del bucle)
export async function startAutoRun(
  gameId: string,
  delayMs: number = 3000
): Promise<void> {
  while (true) {
    // 1. Leer estado actual desde BD
    const partida = await db.select().from(partidas).where(eq(partidas.id, gameId)).get();

    // 2. Condiciones de parada
    if (!partida) break;
    if (partida.modoEjecucion !== 'auto') break;    // pausa o cambio a manual
    if (partida.estado === 'finalizada') break;      // partida terminada

    // 3. Ejecutar un turno (reutiliza la misma lógica que advance-turn)
    await advanceTurn(gameId);

    // 4. Esperar entre turnos
    await sleep(delayMs);
  }
}
```

**Garantías y restricciones**:
- El bucle comprueba `modoEjecucion` **antes** de cada turno, no durante. Un turno en ejecución no se interrumpe.
- Si `pause` llega mientras el agente está razonando (`invokeAgent`), el turno actual completa normalmente y el bucle se detiene al llegar a la comprobación del siguiente ciclo.
- Solo puede haber **un bucle activo por partida** a la vez. `POST /run` y `POST /resume` deben verificar que no existe ya un bucle activo (campo `partidas.autoRunActivoDesde: timestamp | null`).
- En la arquitectura MVP (Node.js proceso único), el fire-and-forget es seguro. **RISK**: en un entorno serverless (Vercel Edge/Lambda), las funciones sin respuesta pueden ser terminadas antes de completar el bucle. Mitigación: registrar `autoRunActivoDesde`; un cron de recuperación puede relanzar bucles huérfanos.

#### Configuración del retardo entre turnos

| Escenario | `turnoDelayMs` recomendado |
|---|---|
| Evento en directo (espectadores) | 5 000 – 10 000 ms |
| Demo / presentación | 3 000 ms |
| CI / test de integración | 0 – 500 ms |
| Debug paso a paso | modo `manual` (sin retardo) |

```
invokeAgent({
  type: 'refute',
  gameId,
  teamId: refutadorId,
  suspect, weapon, room  // combinación a refutar
})
```

El agente refutador razona internamente con `get_game_state` (para ver sus cartas en mano) y devuelve un `AgentResponse` con `action.type` ∈ `{ show_card, cannot_refute }`. El **coordinador** valida que la carta indicada en `show_card` pertenezca al equipo refutador y coincida con la combinación sugerida antes de persistirla como `cartaMostrada` en la tabla `sugerencias`. El agente refutador no tiene disponible `save_agent_memory` en este flujo (operación de solo lectura).

---

## 6. Interacción agente ↔ coordinador: herramientas y contrato

El diseño sigue el principio de **segregación de responsabilidades** establecido en F006: el agente **decide** y el coordinador **actúa**. Los agentes nunca llaman a `make_suggestion`, `make_accusation` directamente; devuelven una respuesta estructurada y el coordinador aplica la acción.

### 6.1 Herramienta de consulta disponible al agente: `get_game_state`

El servidor MCP (`/api/mcp`) expone `get_game_state` como herramienta de **solo lectura** que el agente puede invocar durante su razonamiento. Requiere autenticación con `Bearer ${MCP_AUTH_TOKEN}`.

El agente local (Genkit) llama al handler directamente sin HTTP. MattinAI en producción accede via el endpoint MCP.

| Parámetro | Tipo | Descripción |
|---|---|---|
| `game_id` | `string` | ID de la partida |
| `team_id` | `string` | ID del equipo solicitante |

**Respuesta**: `GameStateView` serializado como JSON. El agente recibe únicamente:
- Sus propias cartas (`cartas` del propio equipo; `[]` para los demás).
- El historial de acciones con `cartaMostrada` visible solo en sus propias sugerencias.
- `esElTurnoDeEquipo: true/false`.
- Estado de todos los equipos (eliminado, puntos).

**Cuándo se usa**: al inicio del razonamiento de un turno (`play_turn`) y al inicio de una refutación (`refute`).

### 6.2 Herramientas de soporte internas al agente Genkit

Estas herramientas **no son herramientas MCP públicas**; son Genkit tools registradas en `src/lib/ai/tools/cluedo-tools.ts` exclusivamente para el agente local. MattinAI gestiona su propia memoria de forma independiente. La persistencia se realiza en la tabla `agent_memories` de SQLite via `src/lib/ai/agent-memory.ts`.

| Herramienta Genkit | Disponible en | Propósito |
|---|---|---|
| `get_agent_memory` | `play_turn` + `refute` | Leer deducciones persistidas de turnos anteriores |
| `save_agent_memory` | `play_turn` solo | Persistir deducciones actualizadas para el próximo turno |

#### `get_agent_memory`

| Parámetro | Tipo | Descripción |
|---|---|---|
| `game_id` | `string` | ID de la partida |
| `team_id` | `string` | ID del equipo solicitante |

**Respuesta**: `string` — JSON serializado con el objeto de memoria del agente para esa partida y equipo. Retorna `"{}"` si no existe registro previo (primer turno).

**Contenido típico de la memoria** (esquema libre; el agente lo define):
```json
{
  "cartasDescartadas": ["Coronel Mostaza", "Candelabro"],
  "cartasEnManoOtros": { "equipo-B": ["Revólver"] },
  "sospechososPosibles": ["Señorita Escarlata", "Profesor Ciruela"],
  "armasPosibles": ["Cuerda"],
  "habitacionesPosibles": ["Biblioteca", "Comedor"]
}
```

**Cuándo se usa**: al inicio del razonamiento, inmediatamente después de `get_game_state`, para recuperar el estado de deducción de turnos anteriores.

#### `save_agent_memory`

| Parámetro | Tipo | Descripción |
|---|---|---|
| `game_id` | `string` | ID de la partida |
| `team_id` | `string` | ID del equipo |
| `memory` | `Record<string, unknown>` | Objeto JSON con las deducciones actualizadas a persistir |

**Respuesta**: `"ok"` (literal).

**Comportamiento**: upsert sobre la clave `(game_id, team_id)` en la tabla `agent_memories`. Las llamadas sucesivas sobreescriben el registro anterior; no se mantiene historial de memorias intermedias.

**Cuándo se usa**: antes de emitir la respuesta final en el flujo `play_turn`, tras actualizar las deducciones con la información del turno actual. **No disponible en el flujo `refute`** para evitar mutaciones de estado durante una operación de solo lectura.

### 6.3 `AgentResponse` — decisión estructurada del agente

Tras razonar con las herramientas de consulta, el agente devuelve un `AgentResponse` con la acción a aplicar. El coordinador valida el tipo antes de ejecutarlo.

```typescript
interface AgentResponse {
  action: AgentAction;  // acción estructurada a aplicar
  reasoning: string;    // texto de razonamiento (logs/debug)
  done: boolean;        // siempre true en MVP
}

// Invariantes obligatorios:
// play_turn  → action.type ∈ { 'suggestion', 'accusation' }
// refute     → action.type ∈ { 'show_card', 'cannot_refute' }
```

| `action.type` | Flujo válido | Campos adicionales |
|---|---|---|
| `suggestion` | `play_turn` | `suspect`, `weapon`, `room` |
| `accusation` | `play_turn` | `suspect`, `weapon`, `room` |
| `show_card` | `refute` | `card` (nombre exacto de la carta) |
| `cannot_refute` | `refute` | — |

Si el `action.type` no cumple el invariante del flujo, el coordinador responde con error 422 y puede reintentar la invocación.

### 6.4 Herramientas MCP aplicadas por el coordinador

Tras recibir el `AgentResponse`, el **coordinador** (Route Handler) llama al handler MCP correspondiente. El agente no interactúa con estas herramientas directamente.

#### `make_suggestion` — aplicada tras `action.type === 'suggestion'`

| Parámetro | Tipo | Descripción |
|---|---|---|
| `game_id` | `string` | ID de la partida |
| `team_id` | `string` | ID del equipo en turno |
| `suspect` | `string` | Valor de `action.suspect` |
| `weapon` | `string` | Valor de `action.weapon` |
| `room` | `string` | Valor de `action.room` |

**Resultado persistido**: registro en `sugerencias` con `refutadaPor` (si hay refutador) y `cartaMostrada` (tras invocar al agente refutador).

**Restricciones validadas por el coordinador antes de llamar**:
- `esElTurnoDeEquipo === true`.
- Equipo no eliminado.
- Valores de `suspect`, `weapon`, `room` pertenecen al dominio válido (§8).

#### `make_accusation` — aplicada tras `action.type === 'accusation'`

| Parámetro | Tipo | Descripción |
|---|---|---|
| `game_id` | `string` | ID de la partida |
| `team_id` | `string` | ID del equipo en turno |
| `suspect` | `string` | Valor de `action.suspect` |
| `weapon` | `string` | Valor de `action.weapon` |
| `room` | `string` | Valor de `action.room` |

**Resultado**: `{ correcta: boolean, ganador: string | null }`.

**Consecuencias**:
- `correcta === true`: partida finalizada; equipo declarado ganador.
- `correcta === false`: equipo **eliminado**. Si era el último activo, la partida finaliza sin ganador.

**RISK**: Una acusación incorrecta es irreversible. El agente debe acusar solo con certeza lógica completa.

### 6.5 `show_card` — consulta de carta revelada (lectura para el equipo sugeridor)

Esta herramienta **no es parte del flujo de decisión del agente**. Es una operación de lectura que el equipo sugeridor puede usar para verificar qué carta le mostró el refutador en una sugerencia anterior.

| Parámetro | Tipo | Descripción |
|---|---|---|
| `game_id` | `string` | ID de la partida |
| `team_id` | `string` | ID del equipo solicitante (debe ser el que hizo la sugerencia) |
| `suggestion_id` | `string` | ID de la sugerencia |

**Respuesta**: `{ suggestion_id, cartaMostrada, refutadaPor }`.

**Restricción de acceso**: solo el equipo que realizó la sugerencia puede ver `cartaMostrada`. Error 403 en cualquier otro caso.

---

## 7. Reglas de validación y guardianes

El coordinador y el motor aplican las siguientes validaciones antes de ejecutar cualquier acción:

| Regla | Validado en | Consecuencia si falla |
|---|---|---|
| Solo actúa el equipo en turno | Coordinador (previa a handler) + `applyAction` | Error 400; `AgentResponse` rechazado |
| El equipo no puede estar eliminado | Coordinador (previa a handler) | Error 400 |
| La partida debe estar en estado `en_curso` | Coordinador + MCP handlers | Error 400 |
| `action.type` válido para el flujo (`play_turn`/`refute`) | Coordinador tras recibir `AgentResponse` | Error 422; posible reintento |
| Los valores de carta deben ser del dominio válido | Zod schema en MCP tools (handler) | Error de validación Zod |
| En `show_card`: agente refutador posee la carta indicada | Coordinador antes de persistir | `cartaMostrada` rechazada; se trata como `cannot_refute` |
| `show_card` (lectura): solo accesible al equipo sugeridor | `showCardTool` handler | Error 403 |
| Partida finalizada no acepta más acciones | `applyAction` en engine | Return `state` sin cambios |

---

## 8. Dominio de valores válidos

Los agentes deben usar exactamente estos valores (case-sensitive) para `suspect`, `weapon` y `room`:

### Sospechosos (`SOSPECHOSOS`)

```
'Coronel Mostaza' | 'Señora Pavo Real' | 'Reverendo Verde' |
'Señorita Escarlata' | 'Profesor Ciruela' | 'Señora Blanca'
```

### Armas (`ARMAS`)

```
'Candelabro' | 'Cuchillo' | 'Tubería de plomo' |
'Revólver' | 'Cuerda' | 'Llave inglesa'
```

### Habitaciones (`HABITACIONES`)

```
'Cocina' | 'Sala de baile' | 'Conservatorio' |
'Billar' | 'Biblioteca' | 'Salón' |
'Estudio' | 'Vestíbulo' | 'Comedor'
```

Fuente: constantes en `src/types/domain.ts` (`SOSPECHOSOS`, `ARMAS`, `HABITACIONES`).

---

## 9. Garantías de determinismo y reproducibilidad

El motor usa el algoritmo **mulberry32** como PRNG seeded (ver `engine.ts`). Dado el mismo `seed`:

- El sobre secreto siempre es el mismo.
- El reparto de cartas es idéntico.
- Cualquier partida puede ser reproducida para auditoría dada la secuencia de acciones del historial.

El `seed` se genera en `initGame()` como `Date.now()` si no se especifica uno. El administrador puede inyectar un `seed` fijo para partidas de prueba o demos.

---

## 10. Observabilidad para la organización

La organización (rol `admin`) tiene acceso al `GameState` completo (incluyendo el `sobre`) a través del panel de administración. Los agentes nunca ven el `GameState` crudo, solo la `GameStateView` filtrada.

| Audiencia | Vista disponible | Canal |
|---|---|---|
| Agentes (equipo) | `GameStateView` (filtrada) | MCP `get_game_state` |
| Espectadores | `GameStateView` (sin cartas de nadie) | `GET /api/games/{id}` + polling |
| Administradores | `GameState` completo (incluyendo sobre) | Panel admin + `GET /api/admin/games/{id}` |

---

## 11. Extensibilidad y evolución futura

### 11.1 Extracción del motor a proceso Python independiente

El diseño en capas permite sustituir el motor TypeScript por un proceso Python externo sin modificar la UI ni el contrato de los agentes. El punto de intercambio es `src/lib/api/agent.ts`: basta con añadir un tercer backend que llame a un servicio Python via HTTP.

### 11.2 Herramientas MCP adicionales

Nuevas herramientas MCP se añaden en `src/lib/mcp/tools/` y se registran en `server.ts`. Candidatos para futuras iteraciones:

| Herramienta | Descripción |
|---|---|
| `get_history` | Historial de acciones paginado (alternativa más eficiente a `get_game_state` completo) |
| `pass_turn` | Pasar turno explícitamente sin hacer sugerencia |
| `get_card_counts` | Número de cartas por equipo (información pública útil para deducción) |

### 11.3 Soporte multi-partida simultánea

La arquitectura actual soporta partidas paralelas porque cada `GameState` es independiente por `gameId`. Los MCP handlers seleccionan la partida por `game_id` en cada llamada. No hay estado global compartido entre partidas.

---

## 12. Flujo completo de turno — diagrama de secuencia

```
Admin      GameRoute        Engine       AgentFacade     MCPTools/Genkit      DB
  │             │               │               │                │              │
  │ POST        │               │               │                │              │
  │ /advance   │               │               │                │              │
  │────────────▶│               │               │                │              │
  │             │ loadState()   │               │                │              │
  │             │──────────────────────────────────────────────────────────────▶│
  │             │◀──────────────────────────────────────────────────────────────│
  │             │               │               │                │              │
  │             │ invokeAgent(play_turn)         │                │              │
  │             │──────────────────────────────▶│                │              │
  │             │               │               │ get_game_state │              │
  │             │               │               │───────────────▶│              │
  │             │               │               │◀───────────────│              │
  │             │               │               │ get_agent_memory              │
  │             │               │               │───────────────────────────────▶
  │             │               │               │◀───────────────────────────────
  │             │               │               │                │              │
  │             │               │               │  (LLM razona)  │              │
  │             │               │               │                │              │
  │             │               │               │ save_agent_memory             │
  │             │               │               │───────────────────────────────▶
  │             │               │               │◀───────────────────────────────
  │             │               │               │                │              │
  │             │◀─────────────────────────────│AgentResponse   │              │
  │             │  { action: { type:'suggestion'│ suspect, ... } }              │
  │             │               │               │                │              │
  │             │ make_suggestion_handler()     │                │              │
  │             │───────────────────────────────────────────────▶│              │
  │             │               │               │                │ persist      │
  │             │               │               │                │─────────────▶│
  │             │               │               │                │◀─────────────│
  │             │◀───────────────────────────────────────────────│              │
  │             │               │               │                │              │
  │             │ applyAction(state, action)    │                │              │
  │             │──────────────▶│               │                │              │
  │             │◀──────────────│ new state     │                │              │
  │             │ persistState()│               │                │              │
  │             │──────────────────────────────────────────────────────────────▶│
  │             │               │               │                │              │
  │ 200 OK      │               │               │                │              │
  │◀────────────│               │               │                │              │
```

**Nota sobre el flujo de refutación (dentro del mismo `advance-turn`):**

```
  │             │ Si hay refutador:              │                │              │
  │             │ invokeAgent(refute, refutadorId)│                │              │
  │             │──────────────────────────────▶│                │              │
  │             │               │               │ get_game_state  │              │
  │             │               │               │───────────────▶│              │
  │             │               │               │◀───────────────│              │
  │             │               │               │  (LLM decide)  │              │
  │             │◀─────────────────────────────│AgentResponse   │              │
  │             │  { action: { type:'show_card', card:'...' } }                 │
  │             │               │               │                │              │
  │             │ update sugerencias.cartaMostrada               │              │
  │             │──────────────────────────────────────────────────────────────▶│
```

---

## 13. Decisiones de diseño y alternativas consideradas

### DECISION-001: Motor puro sin I/O

**Decisión**: El núcleo del motor (`engine.ts`) es puro: toma `GameState` y devuelve `GameState` nuevo sin leer BD ni llamar a ninguna API.

**Alternativa rechazada**: Motor con acceso directo a BD (patrón Repository dentro del motor).

**Motivo**: El motor puro es testeable de forma aislada con Vitest sin mocks de BD. Los Route Handlers y MCP tools actúan como adaptadores. Esto permite reproducir cualquier partida pasando solo el `seed` y la secuencia de acciones, sin depender del estado de la BD.

→ ADR pendiente: `docs/adr/ADR-XXXX-motor-puro-sin-io.md`

### DECISION-002: Agentes devuelven `AgentResponse`; el coordinador aplica las acciones

**Decisión**: Los agentes no llaman directamente a herramientas de acción (`make_suggestion`, `make_accusation`). Devuelven un `AgentResponse` estructurado y el coordinador (Route Handler) aplica la acción llamando al handler MCP correspondiente.

**Alternativa rechazada**: El agente invoca `make_suggestion`/`make_accusation` como efectos secundarios dentro de su razonamiento (tool-calling directo de acción).

**Motivo**: La separación decisión/ejecución permite al coordinador validar la acción antes de persistirla, reintentar si el `AgentResponse` es inválido, y aplicar fallbacks sin depender de efectos secundarios del LLM. Alineado con el principio de F006: "el agente decide, el motor actúa". MCP (`get_game_state`) sigue siendo el protocolo de consulta de estado, tanto para MattinAI en producción como para el agente Genkit local (que llama al handler directamente, sin HTTP).

→ ADR pendiente: `docs/adr/ADR-XXXX-agent-response-coordinador.md`

### DECISION-005: Bucle auto-run como fire-and-forget en el mismo proceso Node.js

**Decisión**: El bucle de ejecución automática corre como una promesa disparada sin `await` dentro del Route Handler de `/run`. El handler retorna `202` inmediatamente sin esperar a que la partida termine.

**Alternativa rechazada A**: El handler ejecuta todos los turnos de forma síncrona y retorna `200` al finalizar la partida.

**Motivo de rechazo A**: Una partida puede tener decenas de turnos, cada uno con una invocación al LLM de varios segundos. Un request HTTP de varios minutos no es viable ni desde el cliente ni desde infraestructura (timeouts de proxies, CDNs).

**Alternativa rechazada B**: Sistema de colas externo (Bull, BullMQ, Redis Streams) para procesar turnos en workers.

**Motivo de rechazo B**: Añade dependencias de infraestructura (Redis) incompatibles con el objetivo de cero-servidor-extra del MVP. La complejidad operacional es desproporcionada para un evento puntual.

**Riesgo aceptado**: En entornos serverless (Vercel), las funciones fire-and-forget pueden ser terminadas. El campo `partidas.autoRunActivoDesde` permite detectar bucles huérfanos y relanzarlos. Para el MVP con deployment en VPS/contenedor (Node.js persistente), el riesgo es bajo.

→ ADR pendiente: `docs/adr/ADR-XXXX-auto-run-fire-and-forget.md`

### DECISION-003: Refutación como segunda invocación síncrona

**Decisión**: Cuando una sugerencia requiere refutación, el Route Handler lanza una segunda invocación al agente refutador de forma síncrona antes de devolver respuesta al solicitante.

**Alternativa rechazada**: Modelo asíncrono con cola de eventos (el agente refutador recibe un webhook).

**Motivo**: La complejidad operativa de una cola de eventos es desproporcionada para un evento puntual con equipo unipersonal. El tiempo de respuesta de los agentes es bajo (< 5 s en condiciones normales) y el bloqueo síncrono es aceptable en MVP.

### DECISION-004: Reconstrucción de `GameState` desde BD en cada operación

**Decisión**: No se mantiene un `GameState` en memoria entre turnos. Cada operación reconstruye el estado desde la BD.

**Alternativa rechazada**: Caché en memoria del `GameState` con invalidación explícita (singleton o Redis).

**Motivo**: Un proceso Next.js puede ser reiniciado o escalado (aunque en MVP es una sola instancia). La reconstrucción desde SQLite es O(n_turnos) y suficientemente rápida para el volumen esperado (< 100 partidas, < 50 turnos cada una). Simplifica enormemente el debugging y la auditoría post-evento.

---

## 14. Tests

### 14.1 Tests unitarios del motor (obligatorios)

Archivo: `src/tests/game-engine.test.ts`

| Caso | Qué verifica |
|---|---|
| `initGame` con seed fijo | Mismo sobre y reparto en cada ejecución |
| `initGame` reparte todas las cartas | N cartas previstas = N cartas repartidas + 3 del sobre |
| `applyAction` — sugerencia sin refutador | `refutadaPor === null` |
| `applyAction` — sugerencia con refutador | `refutadaPor === equipoId` correcto |
| `applyAction` — acusación correcta | Estado `finalizada`, `ganadorId` correcto |
| `applyAction` — acusación incorrecta | Equipo marcado como `eliminado` |
| `applyAction` — todos eliminados | Estado `finalizada` sin ganador |
| `applyAction` — turno incorrecto | Lanza error `'No es el turno de este equipo'` |
| `getGameStateView` | Cartas propias visibles; cartas ajenas vacías |
| `getGameStateView` | `cartaMostrada` visible solo para equipo sugeridor |
| `isGameOver` / `getWinner` | Coherentes con estado y `ganadorId` |

### 14.3 Tests del orquestador auto-run

Archivo: `src/tests/auto-run.test.ts` (pendiente)

| Caso | Qué verifica |
|---|---|
| `startAutoRun` — pausa externa entre turnos | El bucle se detiene después del turno en curso cuando `modoEjecucion = 'pausado'` |
| `startAutoRun` — partida finalizada | El bucle termina solo al detectar `estado = 'finalizada'` |
| `POST /run` con partida ya en auto | Idempotente; no lanza un segundo bucle si `autoRunActivoDesde` ya está activo |
| `POST /pause` durante turn en ejecución | El turno actual completa; el siguiente no se inicia |
| `POST /resume` tras pausa | Reanuda desde el turno siguiente al que se pausó |
| `turnoDelayMs = 0` | Los turnos ejecutan sin espera; partida completa en el menor tiempo posible |

### 14.2 Tests de integración de herramientas MCP y ciclo de coordinación

Archivo: `src/tests/mcp-tools.test.ts` (pendiente)

| Caso | Qué verifica |
|---|---|
| `get_game_state` — equipo no participante | Error |
| `get_game_state` — equipo participante | `GameStateView` filtrada (cartas propias ✓, ajenas vacías ✓) |
| Coordinador aplica `suggestion` desde `AgentResponse` | `make_suggestion` handler persiste `refutadaPor` correcto |
| Coordinador aplica `suggestion` fuera de turno | Error 400 antes de llamar al handler |
| Coordinador aplica `accusation` correcta | Partida finalizada; `ganadorId` correcto |
| Coordinador aplica `accusation` incorrecta | Equipo eliminado; partida continúa |
| Coordinador recibe `AgentResponse` con `action.type` inválido para el flujo | Error 422; no se persiste nada |
| Flujo `refute` completo: `show_card` válido | `sugerencias.cartaMostrada` actualizado |
| Flujo `refute` completo: `cannot_refute` | `sugerencias.cartaMostrada` = `null` |
| `show_card` lectura — equipo ajeno | Error 403 |
| `show_card` lectura — equipo sugeridor | Devuelve `carta` y `refutadaPor` |

---

## 15. Checklist de implementación

- [x] `src/lib/game/engine.ts` — motor puro implementado
- [x] `src/lib/game/types.ts` — tipos `GameState`, `GameAction`, `GameStateView` definidos
- [x] `src/lib/mcp/server.ts` — MCP Server singleton con 4 herramientas registradas
- [x] `src/lib/mcp/tools/get-game-state.ts` — herramienta de consulta implementada
- [x] `src/lib/mcp/tools/make-suggestion.ts` — handler aplicado por coordinador
- [x] `src/lib/mcp/tools/make-accusation.ts` — handler aplicado por coordinador
- [x] `src/lib/mcp/tools/show-card.ts` — herramienta de lectura implementada
- [x] `src/tests/game-engine.test.ts` — tests unitarios del motor
- [ ] `src/types/api.ts` — tipos `AgentRequest`, `AgentResponse`, `AgentAction` (ver F006)
- [ ] `src/lib/api/agent.ts` — fachada de invocación de agente (ver F006)
- [ ] `src/lib/api/local-agent.ts` — backend Genkit con `invokeAgent` (ver F006)
- [ ] `src/lib/ai/genkit.ts` — instancia y configuración de Genkit (ver F006)
- [ ] `src/lib/ai/agent-memory.ts` — get/saveAgentMemory sobre tabla `agent_memories` (ver F006)
- [ ] `src/lib/ai/tools/cluedo-tools.ts` — Genkit tools: `get_game_state`, `get_agent_memory`, `save_agent_memory` (ver F006)
- [ ] `src/lib/db/schema.ts` — tabla `agent_memories` (ver F006)
- [x] `src/app/api/games/[id]/advance-turn/route.ts` — orquestador del ciclo de turno (paso a paso)
- [x] `src/app/api/games/[id]/run/route.ts` — inicia ejecución automática (202 fire-and-forget)
- [x] `src/app/api/games/[id]/pause/route.ts` — pausa el bucle automático
- [x] `src/app/api/games/[id]/resume/route.ts` — reanuda desde pausa
- [x] `src/lib/game/auto-run.ts` — bucle `startAutoRun(gameId, delayMs)`
- [x] `src/lib/game/coordinator.ts` — función `advanceTurn(gameId)` (orquestador puro)
- [x] `src/lib/db/schema.ts` — campos `modoEjecucion`, `turnoDelayMs`, `autoRunActivoDesde` en `partidas`
- [x] `src/tests/mcp-tools.test.ts` — tests de integración coordinador + herramientas
- [x] `src/tests/auto-run.test.ts` — tests del orquestador auto-run
- [x] ADR: motor puro sin I/O → [ADR-0009](../../clue-arena-spec/docs/spec/adr/ADR-0009-motor-puro-sin-io.md)
- [x] ADR: agentes devuelven `AgentResponse`; coordinador aplica acción → [ADR-0010](../../clue-arena-spec/docs/spec/adr/ADR-0010-agent-response-coordinador.md)
- [x] ADR: auto-run fire-and-forget → [ADR-0011](../../clue-arena-spec/docs/spec/adr/ADR-0011-auto-run-fire-and-forget.md)

---

## 16. Referencias

| Recurso | Descripción |
|---|---|
| [RFC F001](F001-frontend-architecture.md) | Arquitectura general del monolito Next.js |
| [RFC F006](F006-local-agent-genkit.md) | Agente local Genkit; define `AgentRequest`/`AgentResponse` y fachada `invokeAgent` |
| [`src/lib/game/engine.ts`](../../src/lib/game/engine.ts) | Implementación del motor puro |
| [`src/lib/game/types.ts`](../../src/lib/game/types.ts) | Tipos del motor |
| [`src/lib/mcp/server.ts`](../../src/lib/mcp/server.ts) | Servidor MCP |
| [`src/lib/mcp/tools/`](../../src/lib/mcp/tools/) | Herramientas MCP (4 archivos) |
| [`src/tests/game-engine.test.ts`](../../src/tests/game-engine.test.ts) | Tests unitarios del motor |
| [Model Context Protocol](https://modelcontextprotocol.io/) | Especificación MCP |
