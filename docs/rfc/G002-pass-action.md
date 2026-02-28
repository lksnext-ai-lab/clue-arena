# RFC G002 — Soporte de acción PASS voluntaria del agente

| Campo | Valor |
|---|---|
| **ID** | G002 |
| **Título** | Incorporación de la acción PASS voluntaria: flujo, puntuación y persistencia |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-02-28 |
| **Refs. spec** | [10-requisitos-funcionales](../../clue-arena-spec/docs/spec/10-requisitos-funcionales.md) · [60-backend](../../clue-arena-spec/docs/spec/60-backend.md) |
| **Refs. FR** | FR-009 · FR-011 |
| **Deps.** | RFC G001 (sistema de puntuación) · RFC F007 (motor de juego) |

---

## 1. Resumen

El motor de juego (`engine.ts`) dispone de `PassAction` y `applyPass()` desde el principio. Sin embargo, **un agente IA no puede actualmente emitir un pase voluntario**: el esquema Zod de validación de respuesta del agente lo rechaza, el coordinador lanza HTTP 422 al recibirlo y el prompt del turno no lo menciona.

Este RFC documenta el gap completo, diseña el flujo para incorporar el pase voluntario del agente y distingue con precisión entre:

- **Pase voluntario** (`EVT_PASS`, −5 pts): el agente decide explícitamente pasar.
- **Pase forzado por timeout** (`EVT_TIMEOUT`, −20 pts): el agente no responde en tiempo.
- **Pase forzado por formato inválido** (`EVT_INVALID_FORMAT`, −25 pts): el agente responde pero su JSON no supera la validación Zod.

El resultado es un flujo cohesivo donde el agente tiene control real sobre la acción de pasar, las penalizaciones son correctamente diferenciadas y la persistencia es auditable.

---

## 2. Análisis del estado actual

### 2.1 Motor de juego — ✅ Implementado

`src/lib/game/engine.ts` y `src/lib/game/types.ts` soportan `PassAction` completamente:

```typescript
// src/lib/game/types.ts (estado actual)
export interface PassAction {
  type: 'pass';
  equipoId: string;
}

export type GameAction = SuggestionAction | AccusationAction | PassAction;
```

`applyAction()` ya enruta `'pass'` a `applyPass()`:

```typescript
case 'pass':
  return applyPass(state, action.equipoId);
```

`applyPass()` avanza el turno y registra el `ActionRecord` correctamente.

### 2.2 Esquema Zod del agente — ❌ Pass NO permitido

`src/lib/api/local-agent.ts`, `PlayTurnResponseSchema`, sólo acepta `suggestion` y `accusation`:

```typescript
// Estado actual — pass ausente
const PlayTurnResponseSchema = z.union([
  z.object({ action: z.object({ type: z.literal('suggestion'), ... }) }),
  z.object({ action: z.object({ type: z.literal('accusation'), ... }) }),
]);
```

Si el agente emite `{ "action": { "type": "pass" } }`, Zod falla → se eleva `AgentResponseError` con `cause: 'parse_error'` → el coordinator aplica `EVT_INVALID_FORMAT` (−25 pts), no `EVT_PASS` (−5 pts). **El pase voluntario se penaliza con −20 pts de más.**

### 2.3 Prompt del agente — ❌ Pass NO documentado

`src/lib/ai/prompts/play-turn.ts` solo lista dos acciones posibles:

```
{ "action": { "type": "suggestion", ... } }
o
{ "action": { "type": "accusation", ... } }
```

Un agente que intente razonar que debería pasar no tiene contrato válido para comunicarlo.

### 2.4 Coordinador — ❌ Pass rechazado con HTTP 422

`src/lib/game/coordinator.ts`, función `advanceTurn()`:

```typescript
const isValidAction = action.type === 'suggestion' || action.type === 'accusation';
// ...
if (!isValidAction) {
  throw new CoordinatorError(422, `Tipo de acción inválido: "${action.type}"`);
}
```

Incluso si se extendiese el esquema Zod, el coordinador rechazaría el pase antes de llegar al motor.

### 2.5 Tipo `AgentAction` — ❌ Pass ausente

`src/types/api.ts` no incluye `pass` en el union type `AgentAction`:

```typescript
// Estado actual
export type AgentAction =
  | SuggestionAction
  | AccusationAction
  | ShowCardAction
  | CannotRefuteAction;
// PassAgentAction no existe
```

### 2.6 `AdvanceTurnResult` — ❌ Pass ausente en `actionType`

```typescript
// Estado actual
export interface AdvanceTurnResult {
  gameOver: boolean;
  reason: string;
  teamId: string;
  actionType: 'suggestion' | 'accusation'; // ← falta 'pass'
}
```

### 2.7 Puntuación `EVT_PASS` — ❌ Nunca se aplica

G001 define `EVT_PASS = −5` por pase voluntario, pero dado que el pase voluntario nunca llega al coordinador como acción válida, este evento nunca se emite. El único camino actual para que un turno avance sin acción útil es `EVT_TIMEOUT` o `EVT_INVALID_FORMAT`.

### 2.8 Resumen del gap

| Componente | Fichero | Estado |
|---|---|---|
| Motor: `PassAction` + `applyPass()` | `src/lib/game/engine.ts` | ✅ Implementado |
| Tipo `PassAction` | `src/lib/game/types.ts` | ✅ Implementado |
| Schema Zod agente: acepta `pass` | `src/lib/api/local-agent.ts` | ❌ Ausente |
| Tipo `AgentAction` includes `pass` | `src/types/api.ts` | ❌ Ausente |
| Prompt: documenta acción `pass` | `src/lib/ai/prompts/play-turn.ts` | ❌ Ausente |
| Coordinador: valida y enruta `pass` | `src/lib/game/coordinator.ts` | ❌ Rechaza con 422 |
| Coordinador: `AdvanceTurnResult.actionType` | `src/lib/game/coordinator.ts` | ❌ Falta `'pass'` |
| Scoring `EVT_PASS` en coordinador | `src/lib/game/coordinator.ts` | ❌ No emitido |
| Persistencia de pases | `src/lib/db/schema.ts` | ❌ Sin tabla `pases` |
| WebSocket al pasar | `src/lib/ws/GameEventEmitter.ts` | ❌ No emitido para pass |
| Tests: pase voluntario | `src/tests/` | ❌ Sin cobertura |

---

## 3. Motivación

### 3.1 El pase es una acción táctica legítima en Cluedo

En Cluedo, pasar el turno sin hacer sugerencia ni acusación es una estrategia válida cuando el agente decide que:

- No tiene combinaciones que aporten nueva información (todas las sugerencias útiles ya han sido refutadas).
- Prefiere no revelar qué combinaciones ha descartado mediante el flujo de refutación.
- Está esperando que otros equipos revelen información antes de acusar.

### 3.2 Consecuencias actuales del gap

- Un agente que intenta pasar voluntariamente recibe `EVT_INVALID_FORMAT` (−25 pts) en lugar de `EVT_PASS` (−5 pts): penalización incorrecta de −20 pts extra.
- Los logs de auditoría registran un fallo de formato cuando no lo hay: ruido en los datos de monitorización.
- Los participantes del evento no pueden diseñar agentes con estrategia de pase, aunque la especificación del evento la contempla (G001 §3.1 tabla `EVT_PASS`).

### 3.3 Diferenciación necesaria

| Origen | Tipo evento | Puntos | Intencionalidad |
|---|---|---|---|
| Agente devuelve `{ "action": { "type": "pass" } }` | `EVT_PASS` | −5 | Voluntaria: el agente decide pasar |
| Agente no responde dentro del timeout | `EVT_TIMEOUT` | −20 | Forzada: fallo técnico / infraestructura |
| Agente responde pero JSON no valida Zod | `EVT_INVALID_FORMAT` | −25 | Forzada: error de contrato del agente |

Estas tres rutas ya convergen en `PassAction` hacia el motor, pero deben registrar diferentes `ScoreEventType` (G001).

---

## 4. Diseño de la solución

### 4.1 Contrato del agente: nuevo tipo de acción `pass`

La acción de pase no tiene campos adicionales más allá del `type`. El agente la emite así:

```json
{ "action": { "type": "pass" } }
```

No requiere `equipoId` en el JSON del agente: el coordinador lo infiere del equipo en turno, igual que ya hace con `suggestion` y `accusation` (que tampoco incluyen `equipoId` en el JSON del agente; éste se añade en la capa de coordinación).

### 4.2 Casos de uso para la acción `pass`

El agente **debería** elegir `pass` cuando:

1. **Todas las sugerencias útiles están agotadas**: todas las combinaciones de cartas desconocidas ya han sido sugeridas por alguien y refutadas (el agente conoce el resultado).
2. **Estrategia de información asimétrica**: el agente prefiere no hacer una sugerencia que revelaría a otros equipos qué combinaciones ha descartado.
3. **No tiene suficiente información para acusar con certeza**: y cree que una nueva sugerencia tampoco la aportaría.

El agente **no debería** pasar cuando:
- Tiene combinaciones nuevas y útiles para sugerir (penalización innecesaria).
- Tiene certeza para acusar (debería acusar).

> **Nota de diseño**: La penalización `EVT_PASS` (−5) es suave por diseño. En Cluedo un pase deliberado puede ser una buena decisión táctica. La penalización existe para desincentivar el juego completamente pasivo, no para prohibir la estrategia de espera.

### 4.3 Flujo completo del turno con pase voluntario

```
advanceTurn(gameId)
  │
  ├─ invokeAgent(play_turn)
  │   └─ PlayTurnResponseSchema valida { type: 'pass' } → OK
  │
  ├─ action.type === 'pass'            ← nuevo ramal en coordinator
  │   └─ handlePass({ gameId, teamId, turnoId, turnoActual, ... })
  │       ├─ Persistir pase en tabla `pases`
  │       ├─ Emitir EVT_PASS (−5 pts) → actualizar puntos en partidaEquipos
  │       ├─ Completar turno en tabla `turnos`
  │       ├─ Emitir WebSocket: type=turn_completed, resultadoTipo='pase'
  │       └─ Avanzar turnoActual → retornar false (gameOver)
  │
  └─ return { gameOver: false, reason: 'pass_applied', teamId, actionType: 'pass' }
```

### 4.4 Distinción pase voluntario vs. pases forzados

El coordinador debe diferenciar los tres orígenes **antes** de llamar a `applyAction()`:

```
invokeAgent()
  ├─ OK: agentResponse con action.type = 'suggestion' | 'accusation' | 'pass'
  │   └─ Enrutar a handleSuggestion / handleAccusation / handlePass
  │
  ├─ Timeout (AbortError / TimeoutError):
  │   ├─ Emitir EVT_TIMEOUT (−20 pts)
  │   ├─ Registrar en `pases` con origen='timeout'
  │   └─ applyAction(state, { type: 'pass', equipoId })
  │
  └─ Parse error (AgentResponseError, cause='parse_error'):
      ├─ Emitir EVT_INVALID_FORMAT (−25 pts)
      ├─ Registrar en `pases` con origen='invalid_format'
      └─ applyAction(state, { type: 'pass', equipoId })
```

El campo `origen` en la tabla `pases` permite auditar la causa de cada pase sin ambigüedad.

---

## 5. Cambios de implementación

### 5.1 `src/types/api.ts` — Añadir `PassAgentAction`

```typescript
// Añadir tipo
export interface PassAgentAction {
  type: 'pass';
}

// Extender AgentAction
export type AgentAction =
  | SuggestionAction
  | AccusationAction
  | ShowCardAction
  | CannotRefuteAction
  | PassAgentAction;   // ← nuevo
```

### 5.2 `src/lib/api/local-agent.ts` — Extender `PlayTurnResponseSchema`

```typescript
const PlayTurnResponseSchema = z.union([
  z.object({
    action: z.object({
      type: z.literal('suggestion'),
      suspect: z.string(),
      weapon: z.string(),
      room: z.string(),
    }),
  }),
  z.object({
    action: z.object({
      type: z.literal('accusation'),
      suspect: z.string(),
      weapon: z.string(),
      room: z.string(),
    }),
  }),
  z.object({
    action: z.object({ type: z.literal('pass') }),   // ← nuevo
  }),
]);
```

> **Nota**: `pass` no requiere campos adicionales. El agente solo emite `{ "action": { "type": "pass" } }`.

### 5.3 `src/lib/ai/prompts/play-turn.ts` — Documentar `pass` en el prompt

Añadir `pass` como tercera opción en el formato de respuesta y en la sección de estrategia:

```typescript
export const PLAY_TURN_SYSTEM_PROMPT = `
// ...
## Formato de respuesta final (OBLIGATORIO)
Después de llamar a las herramientas, responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional:
{ "action": { "type": "suggestion", "suspect": "...", "weapon": "...", "room": "..." } }
o
{ "action": { "type": "accusation", "suspect": "...", "weapon": "...", "room": "..." } }
o
{ "action": { "type": "pass" } }

## Estrategia
- Haz sugerencias con combinaciones donde al menos dos de las tres cartas sean desconocidas para ti.
- Acusa solo cuando hayas descartado con certeza todas las demás opciones.
- Pasa (pass) solo si no tienes sugerencias útiles nuevas Y no estás listo para acusar.
  Pasar tiene una penalización menor (−5 pts) que hacer una sugerencia redundante o con
  carta propia (EVT_REDUNDANT_SUGGESTION: −20 pts, EVT_OWN_CARD_SUGGESTION: −15 pts).
`;
```

> **Motivación**: informar al agente de la tabla de penalizaciones relativas le permite tomar decisiones correctas: a veces pasar es preferible a una sugerencia penalizable.

### 5.4 `src/lib/game/coordinator.ts` — Enrutar y manejar `pass`

#### 5.4.1 Actualizar `AdvanceTurnResult`

```typescript
export interface AdvanceTurnResult {
  gameOver: boolean;
  reason: string;
  teamId: string;
  actionType: 'suggestion' | 'accusation' | 'pass';   // ← añadir 'pass'
}
```

#### 5.4.2 Actualizar validación en `advanceTurn()`

```typescript
// Antes
const isValidAction = action.type === 'suggestion' || action.type === 'accusation';

// Después
const isValidAction =
  action.type === 'suggestion' ||
  action.type === 'accusation' ||
  action.type === 'pass';           // ← nuevo
```

#### 5.4.3 Añadir ramal `pass` en `advanceTurn()`

```typescript
if (action.type === 'suggestion') {
  // ... handleSuggestion (sin cambios)
} else if (action.type === 'accusation') {
  // ... handleAccusation (sin cambios)
} else {
  // action.type === 'pass' — pase voluntario del agente
  const maxTurnsReached = await handlePass({
    gameId,
    teamId: currentTeam.equipoId,
    turnoId: turno.id,
    turnoActual: partida.turnoActual,
    activeTeamCount: activeTeams.length,
    allTeams,
    maxTurnos: partida.maxTurnos,
    origen: 'voluntario',
  });

  gameEventEmitter.emitTurnCompleted(gameId, {
    type: 'turn_completed',
    gameId,
    payload: {
      turnoNumero: turno.numero,
      equipoId: currentTeam.equipoId,
      resultadoTipo: 'pase',
    },
  });

  if (maxTurnsReached) {
    gameEventEmitter.emitTurnCompleted(gameId, {
      type: 'status_changed',
      gameId,
      payload: { nuevoEstado: 'finalizada' },
    });
  }

  return {
    gameOver: maxTurnsReached,
    reason: maxTurnsReached ? 'max_turns_reached' : 'pass_applied',
    teamId: currentTeam.equipoId,
    actionType: 'pass',
  };
}
```

#### 5.4.4 Nueva función `handlePass()`

```typescript
interface PassParams {
  gameId: string;
  teamId: string;
  turnoId: string;
  turnoActual: number;
  activeTeamCount: number;
  allTeams: TeamRow[];
  maxTurnos: number | null;
  origen: 'voluntario' | 'timeout' | 'invalid_format';
}

async function handlePass(p: PassParams): Promise<boolean> {
  const { gameId, teamId, turnoId, turnoActual, activeTeamCount, allTeams, maxTurnos, origen } = p;

  // Persistir pase en tabla `pases`
  await db.insert(pases).values({
    id: uuidv4(),
    turnoId,
    partidaId: gameId,
    equipoId: teamId,
    origen,     // 'voluntario' | 'timeout' | 'invalid_format'
    createdAt: new Date(),
  });

  // Aplicar penalización EVT_PASS (−5) solo en pase voluntario
  // EVT_TIMEOUT y EVT_INVALID_FORMAT se gestionan en sus propios flujos (G001 §3.4)
  if (origen === 'voluntario') {
    await db
      .update(partidaEquipos)
      .set({ puntos: sql`${partidaEquipos.puntos} - 5` })
      .where(
        and(
          eq(partidaEquipos.partidaId, gameId),
          eq(partidaEquipos.equipoId, teamId),
        ),
      );
  }

  // Completar el turno
  await db
    .update(turnos)
    .set({ estado: 'completado', finishedAt: new Date() })
    .where(eq(turnos.id, turnoId));

  return _advanceTurnoIndex(gameId, turnoActual, activeTeamCount, allTeams, maxTurnos);
}
```

> Los pases forzados (`timeout` e `invalid_format`) siguen llamando a `handlePass()` pero con el origen correspondiente, así la tabla `pases` es la fuente de verdad única para todos los turnos sin acción.

#### 5.4.5 Integrar `handlePass` en los flujos de error existentes

En el bloque de manejo de timeout y formato inválido (que actualmente se describe en G001 y que aún no está completamente implementado en el coordinador), sustituir el `PassAction` directo al motor por una llamada a `handlePass()`:

```typescript
// Bloque de error en advanceTurn() (tras invokeAgent())
} catch (err) {
  if (isTimeoutError(err)) {
    // EVT_TIMEOUT: la puntuación (−20) se aplica aquí o en score_events (G001)
    await handlePass({
      gameId, teamId: currentTeam.equipoId, turnoId: turno.id,
      turnoActual: partida.turnoActual, activeTeamCount: activeTeams.length,
      allTeams, maxTurnos: partida.maxTurnos,
      origen: 'timeout',
    });
    // ... retornar resultado
  } else if (err instanceof AgentResponseError && err.cause === 'parse_error') {
    // EVT_INVALID_FORMAT: la puntuación (−25) se aplica aquí o en score_events (G001)
    await handlePass({
      gameId, teamId: currentTeam.equipoId, turnoId: turno.id,
      turnoActual: partida.turnoActual, activeTeamCount: activeTeams.length,
      allTeams, maxTurnos: partida.maxTurnos,
      origen: 'invalid_format',
    });
    // ... retornar resultado
  } else {
    throw err;
  }
}
```

### 5.5 `src/lib/db/schema.ts` — Tabla `pases`

```typescript
export const pases = sqliteTable('pases', {
  id:        text('id').primaryKey(),
  turnoId:   text('turno_id').notNull().references(() => turnos.id),
  partidaId: text('partida_id').notNull().references(() => partidas.id),
  equipoId:  text('equipo_id').notNull().references(() => equipos.id),
  origen:    text('origen').notNull(), // 'voluntario' | 'timeout' | 'invalid_format'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

Esta tabla permite:
- Consultar cuántos pases ha hecho cada equipo en una partida, y por qué motivo.
- Distinguir problemas técnicos (timeout/format) de estrategia (voluntario).
- Auditar el `EVT_PASS` scoring (G001) cuando se integre con `score_events`.

### 5.6 `src/app/api/games/[id]/turns/route.ts` — Exponer pases en la vista de turno

La respuesta `TurnResponse` ya incluye `sugerencias` y `acusacion`. Añadir `pase` opcional:

```typescript
// src/types/api.ts
export interface TurnResponse {
  id: string;
  equipoId: string;
  equipoNombre: string;
  numero: number;
  estado: string;
  sugerencias: SuggestionResponse[];
  acusacion?: AccusationResponse;
  pase?: PaseResponse;    // ← nuevo
}

export interface PaseResponse {
  id: string;
  equipoId: string;
  origen: 'voluntario' | 'timeout' | 'invalid_format';
  createdAt: string;
}
```

### 5.7 `src/lib/ws/GameEventEmitter.ts` — Emitir evento para pase

El evento WebSocket de pase ya usa `resultadoTipo: 'pase'` en el diseño del §5.4.3. El payload del evento `turn_completed` es suficiente para que la arena actualice la vista; no se necesita un nuevo tipo de evento WebSocket.

---

## 6. Interacción con el sistema de puntuación (G001)

### 6.1 Relación EVT_PASS con pases forzados

G001 define tres eventos distintos que resultan en que el motor reciba `PassAction`:

| Evento G001 | Origen en `pases.origen` | Puntos | Emitido por |
|---|---|---|---|
| `EVT_PASS` | `voluntario` | −5 | `handlePass(origen='voluntario')` en coordinator |
| `EVT_TIMEOUT` | `timeout` | −20 | `handlePass(origen='timeout')` en coordinator |
| `EVT_INVALID_FORMAT` | `invalid_format` | −25 | `handlePass(origen='invalid_format')` en coordinator |

> **Nota de integración con G001**: cuando se implemente la tabla `score_events` (TODO-G001-005), las tres variantes deben insertar su `ScoreEvent` correspondiente. El coordinator actual aplica los puntos directamente sobre `partidaEquipos.puntos`. La migración hacia `score_events` es parte del trabajo de G001 y no se bloquea por este RFC; `handlePass()` debe emitir el `ScoreEvent` correcto según `origen`.

### 6.2 Cap de EVT_PASS

G001 no impone cap al número de pases penalizables. Un agente que pasa todos sus turnos acumula `n_turnos × (−5)` llegando potencialmente a puntuación muy negativa (mitigada por el suelo en 0 por partida de G001 §4). Este comportamiento es intencional: penalizar el juego completamente pasivo.

### 6.3 Precedencia de penalizaciones en el mismo "turno lógico"

Un turno produce exactamente uno de los tres eventos de pase: `EVT_PASS`, `EVT_TIMEOUT` o `EVT_INVALID_FORMAT`. Son mutuamente excluyentes por la estructura del flujo de control del coordinator.

---

## 7. Consideraciones de diseño

### 7.1 Por qué `pass` como acción del agente (no como herramienta MCP)

Alternativa descartada: exponer `pass_turn` como herramienta MCP que el agente llama con `tool_use`. Esto requeriría lidar con la arquitectura agentic loop de Genkit (el agente podría llamar la herramienta y seguir generando más tool calls). Con `pass` como acción final en el JSON de respuesta se mantiene el contrato limpio: el agente llama herramientas para razonar y devuelve una acción final estructurada.

### 7.2 Por qué una tabla `pases` separada (no solo `turnos`)

- `sugerencias` y `acusaciones` tienen su propia tabla para persistir el detalle de la acción (cartas, resultado de refutación, corrección de la acusación).
- `turnos` solo registra metadatos del turno (inicio, fin, estado).
- `pases` sigue el mismo patrón: registra el detalle de la acción de pase, en particular su `origen`, que es crítico para distinguir voluntario/forced en auditoría y en el cálculo de `ScoreEventType`.

### 7.3 El motor no necesita cambios

`applyPass()` en el motor ya funciona correctamente. La validación de si el pase está permitido (quién puede pasar, cuánda) es responsabilidad del coordinador, en línea con ADR-0009 (motor puro sin I/O) y ADR-0010.

### 7.4 Compatibilidad hacia atrás

- La extensión de `PlayTurnResponseSchema` en `local-agent.ts` es aditiva: los agentes que ya emiten `suggestion` o `accusation` no se ven afectados.
- La extensión del type union `AgentAction` es aditiva.
- La tabla `pases` es una tabla nueva; no modifica tablas existentes.
- `AdvanceTurnResult.actionType` expande el union: el código que consume este tipo debe actualizarse (inspección en `src/app/api/games/[id]/advance-turn/route.ts` y en el auto-run loop).

---

## 8. Ficheros afectados

| Fichero | Cambio | Tipo |
|---|---|---|
| `src/types/api.ts` | Añadir `PassAgentAction`; extender `AgentAction`; añadir `PaseResponse`; ampliar `TurnResponse` | Modificación aditiva |
| `src/lib/api/local-agent.ts` | Extender `PlayTurnResponseSchema` con `z.literal('pass')` | Modificación aditiva |
| `src/lib/ai/prompts/play-turn.ts` | Documentar `pass` en formato de respuesta y sección de estrategia | Modificación |
| `src/lib/game/coordinator.ts` | Aceptar `pass` en validación; añadir ramal `pass`; `handlePass()`; integrar en errores timeout/format | Modificación + adición |
| `src/lib/db/schema.ts` | Añadir tabla `pases` | Adición |
| `src/app/api/games/[id]/advance-turn/route.ts` | Manejar `actionType: 'pass'` en la respuesta si es necesario | Revisión |
| `src/app/api/games/[id]/turns/route.ts` | Incluir `pase` en la query y en `TurnResponse` | Modificación |
| `src/tests/game-engine.test.ts` | — (el motor ya tiene `applyPass`; añadir test de flujo completo voluntario) | Adición de test |
| `src/tests/coordinator.test.ts` | Tests: pase voluntario aplica EVT_PASS; timeout aplica EVT_TIMEOUT; invalid_format aplica EVT_INVALID_FORMAT; los tres avanzan el turno | Adición de tests |
| `src/tests/local-agent.test.ts` | Test: `PlayTurnResponseSchema` acepta `{ action: { type: 'pass' } }` | Adición de test |

---

## 9. Preguntas abiertas (OPENQ)

| ID | Pregunta | Impacto | Bloquea | Estado |
|---|---|---|---|---|
| OPENQ-G002-001 | ¿Debe mostrarse en la arena (UI-005) una indicación visual diferenciada para pase voluntario vs. timeout vs. invalid_format? | UX de la arena de espectadores | Vista de arena (`src/app/arena/`) | 🔲 Pendiente |
| OPENQ-G002-002 | ¿Debe el panel de Admin mostrar el `origen` del pase en el desglose de turnos? | UX Admin | `src/app/admin/partidas/[id]/` | 🔲 Pendiente |
| OPENQ-G002-003 | ¿La penalización `EVT_PASS` (−5) debe aplicarse también cuando el equipo está en la última ronda antes de `maxTurnos`? | Edge case en cálculo de puntos | `handlePass()` + G001 | 🔲 Pendiente |
| OPENQ-G002-004 | ¿Hay restricción en el número de pases consecutivos antes de que el motor o el coordinador fuerce una acción? | Diseño del juego y anti-abuso | Coordinador + reglas del evento | 🔲 Pendiente |

---

## 10. TODOs de implementación

| ID | Tarea | Prioridad | Fichero principal |
|---|---|---|---|
| TODO-G002-001 | Añadir `PassAgentAction` a `AgentAction` en `src/types/api.ts` | MVP | `src/types/api.ts` |
| TODO-G002-002 | Extender `PlayTurnResponseSchema` con `z.literal('pass')` en `local-agent.ts` | MVP | `src/lib/api/local-agent.ts` |
| TODO-G002-003 | Actualizar `PLAY_TURN_SYSTEM_PROMPT` para documentar `pass` como tercera acción | MVP | `src/lib/ai/prompts/play-turn.ts` |
| TODO-G002-004 | Ampliar validación en `advanceTurn()` para aceptar `pass` | MVP | `src/lib/game/coordinator.ts` |
| TODO-G002-005 | Implementar `handlePass()` en el coordinator con `origen` y persistencia en `pases` | MVP | `src/lib/game/coordinator.ts` |
| TODO-G002-006 | Actualizar `AdvanceTurnResult.actionType` para incluir `'pass'` | MVP | `src/lib/game/coordinator.ts` |
| TODO-G002-007 | Añadir tabla `pases` al schema Drizzle y generar migración | MVP | `src/lib/db/schema.ts` |
| TODO-G002-008 | Integrar `handlePass(origen='timeout')` en el bloque de manejo de timeout en `advanceTurn()` | MVP | `src/lib/game/coordinator.ts` |
| TODO-G002-009 | Integrar `handlePass(origen='invalid_format')` en el bloque de `AgentResponseError(parse_error)` | MVP | `src/lib/game/coordinator.ts` |
| TODO-G002-010 | Añadir `PaseResponse` a `TurnResponse` y actualizar el Route Handler de `turns` | Should | `src/types/api.ts`, `src/app/api/games/[id]/turns/` |
| TODO-G002-011 | Test: `PlayTurnResponseSchema` acepta `{ action: { type: 'pass' } }` | MVP | `src/tests/local-agent.test.ts` |
| TODO-G002-012 | Tests coordinator: pase voluntario → EVT_PASS −5 y avance de turno | MVP | `src/tests/coordinator.test.ts` |
| TODO-G002-013 | Tests coordinator: timeout → EVT_TIMEOUT, origen='timeout' en `pases` | MVP | `src/tests/coordinator.test.ts` |
| TODO-G002-014 | Tests coordinator: invalid_format → EVT_INVALID_FORMAT, origen='invalid_format' en `pases` | MVP | `src/tests/coordinator.test.ts` |
| TODO-G002-015 | Revisar `src/app/api/games/[id]/advance-turn/route.ts` para manejar `actionType: 'pass'` sin errores TypeScript | MVP | `src/app/api/games/[id]/advance-turn/route.ts` |
