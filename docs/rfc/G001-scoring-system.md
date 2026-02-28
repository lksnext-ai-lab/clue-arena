# RFC G001 — Sistema de Puntuación de la Competición

| Campo | Valor |
|---|---|
| **ID** | G001 |
| **Título** | Sistema de puntuación: fórmula, eventos y ranking acumulado |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-02-28 |
| **Refs. spec** | [10-requisitos-funcionales](../../clue-arena-spec/docs/spec/10-requisitos-funcionales.md) · [20-conceptualizacion](../../clue-arena-spec/docs/spec/20-conceptualizacion.md) · [50-modelo-datos](../../clue-arena-spec/docs/spec/50-modelo-datos.md) · [60-backend](../../clue-arena-spec/docs/spec/60-backend.md) |
| **Refs. FR** | FR-009 · FR-011 |
| **Deps.** | RFC F007 (motor de juego) · RFC F008 (gestión de partidas Admin) |

---

## 1. Resumen

Este documento define el **sistema de puntuación completo** de la competición Clue Arena. Describe:

- Qué eventos generan puntos durante una partida y con qué valor.
- La fórmula de puntuación total por partida.
- Cómo se acumulan los puntos entre partidas para generar el ranking del evento.
- Las reglas de desempate.
- Los requisitos de implementación en el motor de juego y la capa de persistencia.

El sistema premia tres dimensiones de calidad en el agente IA: **efectividad** (ganar), **eficiencia** (ganar rápido) y **razonamiento deductivo** (usar bien las mecánicas del juego). Las penalizaciones desincentivan el juego pasivo, las acusaciones precipitadas, las sugerencias sin razonamiento y los fallos de formato en la respuesta del agente.

---

## 2. Motivación y contexto

La competición Clue Arena evalúa la calidad de los agentes IA de los equipos participantes a través de partidas de Cluedo. Un sistema de puntuación bien diseñado debe:

1. **Reflejar el objetivo real del juego**: resolver el sobre secreto correctamente.
2. **Distinguir a agentes de distinta calidad** incluso cuando varios ganan en la misma partida (imposible en Cluedo estándar, pero el sistema de puntos permite ordenar históricos).
3. **Incentivar el razonamiento deductivo correcto** (sugerencias informadas, no aleatorias).
4. **Desincentivar estrategias degeneradas**: acusaciones prematuras, pasar todos los turnos, o "spammear" sugerencias sin lógica.
5. **Ser transparente y comprensible** para los participantes antes del evento.

### 2.1 Formato de la competición

- El evento consta de **N partidas** (configurable por el Admin, mínimo 3).
- Cada partida enfrenta entre 2 y 6 equipos (según inscripción y configuración).
- El ranking final es la suma acumulada de puntos en todas las partidas.
- Todos los equipos participan en todas las partidas (no hay eliminación de equipos entre rondas).

---

## 3. Eventos puntuables durante una partida

Cada evento ocurre en un turno concreto y se asocia al equipo que lo realiza (o que recibe la acción, en el caso de refutaciones).

### 3.1 Tabla de eventos y valores base

| ID Evento | Descripción | Puntos | Notas |
|---|---|---|---|
| `EVT_WIN` | El equipo resuelve correctamente el sobre (acusación correcta) | **+1 000** | Evento principal |
| `EVT_WIN_EFFICIENCY` | Bonificación por eficiencia al ganar | `+max(0, 500 − (T − T_min) × 25)` | Ver §3.2 |
| `EVT_SURVIVE` | El equipo llega al final de la partida sin ser eliminado (no ganó) | **+200** | Solo si la partida termina con ganador |
| `EVT_SUGGESTION` | El equipo realiza una sugerencia lógicamente válida | **+10** | Máx. 5 eventos por partida (cap +50); ver §3.3 para condiciones |
| `EVT_REFUTATION` | El equipo refuta con éxito la sugerencia de otro equipo | **+15** | Sin cap |
| `EVT_WRONG_ACCUSATION` | El equipo realiza una acusación incorrecta (eliminación) | **−150** | Adicional a la eliminación del juego |
| `EVT_PASS` | El equipo pasa su turno sin hacer sugerencia ni acusación | **−5** | Se aplica por cada pase |
| `EVT_TIMEOUT` | El agente no responde en el tiempo límite (turno perdido por timeout) | **−20** | Por ocurrencia |
| `EVT_INVALID_CARD` | Sugerencia con carta inexistente en el juego | **−30** | No suma `EVT_SUGGESTION`; ver §3.3 |
| `EVT_REDUNDANT_SUGGESTION` | Sugerencia con combinación exacta ya intentada en la misma partida | **−20** | No suma `EVT_SUGGESTION`; ver §3.3 |
| `EVT_INVALID_FORMAT` | La respuesta del agente no cumple el esquema JSON esperado | **−25** | Turno consumido; el motor recibe un `PassAction`; ver §3.4 |

> **Nota**: `EVT_WIN_EFFICIENCY` solo se otorga junto con `EVT_WIN`. Un equipo que no gana no recibe bonificación de eficiencia. La latencia de respuesta del agente dentro del turno **no genera bonificación ni penalización propia**: el turno debe completarse dentro del timeout establecido (si no, se emite `EVT_TIMEOUT`).

### 3.2 Fórmula de bonificación por eficiencia

La eficiencia mide cuántos turnos propios (no turnos de la partida globales) necesitó el ganador para resolver el caso, respecto al mínimo teórico posible.

```
T        = número de turnos propios jugados por el ganador hasta la acusación correcta (inclusive)
T_min    = 2  (mínimo teórico: 1 sugerencia + 1 acusación correcta)
T_max    = 20 (umbral a partir del cual la bonificación es 0)

EVT_WIN_EFFICIENCY = max(0, 500 − (T − T_min) × 25)
```

Ejemplos:

| Turnos propios (T) | Bonificación |
|---|---|
| 2 (mínimo absoluto) | **+500** |
| 4 | **+450** |
| 10 | **+300** |
| 20 | **+0** |
| > 20 | **0** (no negativo) |

### 3.3 Penalizaciones por sugerencias incorrectas

Estos eventos se aplican sobre sugerencias que violan las reglas del juego o demuestran un razonamiento claramente deficiente. Son detectables de forma determinista por el motor, sin acceso al razonamiento interno del agente.

#### `EVT_INVALID_CARD` — Carta inexistente

Ocurre cuando la sugerencia incluye un valor de `sospechoso`, `arma` o `habitacion` que **no forma parte del conjunto de cartas válido** del juego (`SOSPECHOSOS`, `ARMAS`, `HABITACIONES` en `domain.ts`). Indica que el agente generó un valor alucinado o que su prompt/parsing está roto.

- **Penalización**: −30.
- El turno se consume pero **no se procesa la sugerencia** (no hay refutación, no hay `EVT_SUGGESTION`).
- Si múltiples cartas son inválidas, la penalización se aplica **una sola vez** por turno.

#### `EVT_REDUNDANT_SUGGESTION` — Combinación ya intentada

Ocurre cuando la sugerencia `(sospechoso, arma, habitacion)` es exactamente igual a una sugerencia previa **del mismo equipo** en la misma partida. El agente tiene acceso completo al historial mediante `get_game_state`, por lo que repetir una combinación es un error de razonamiento claro.

- **Penalización**: −20.
- La sugerencia se procesa normalmente (hay refutación si aplica), pero **no suma `EVT_SUGGESTION`** (+10).
- Solo se penaliza si la combinación es exactamente idéntica en los tres campos.


#### Combinación de penalizaciones en una misma sugerencia

Varios eventos pueden coincidir en la misma sugerencia (excepto `EVT_INVALID_CARD`, que excluye `EVT_REDUNDANT_SUGGESTION` porque el turno no se procesa). 

| Sugerencia | Eventos aplicados | Puntos netos |
|---|---|---|
| Carta alucinada (`Profesora Rubio` no existe) | `EVT_INVALID_CARD` | **−30** |
| Combo ya usada antes, sin cartas propias | `EVT_REDUNDANT_SUGGESTION` | **−20** |
| Sugerencia correcta y nueva | `EVT_SUGGESTION` | **+10** |

---

### 3.4 Penalización por respuesta en formato incorrecto (`EVT_INVALID_FORMAT`)

Ocurre cuando el agente devuelve una respuesta dentro del límite de tiempo pero cuyo contenido **no supera la validación Zod** del esquema de respuesta esperado (`PlayTurnResponseSchema` o `RefuteResponseSchema`). Casos típicos:

- JSON malformado o campo `action` ausente.
- `type` de acción no reconocido (p.ej. `"move"` en lugar de `"suggestion"`).
- Campos obligatorios con tipos incorrectos (p.ej. `sospechoso: 42`).
- Estructura de acusación incompleta (falta `sospechoso`, `arma` o `habitacion`).

#### Comportamiento en el motor y el coordinator

| Aspecto | Detalle |
|---|---|
| **Quién lo detecta** | El Route Handler de turno, al capturar `AgentResponseError` lanzado por `invokeAgent()` |
| **Quién lo emite** | El Route Handler (no `applyAction()`): el motor nunca ve el fallo de formato |
| **Efecto en el juego** | El motor recibe un `PassAction` para el equipo: el turno avanza normalmente |
| **Diferencia con `EVT_TIMEOUT`** | `EVT_TIMEOUT` = no responde en tiempo. `EVT_INVALID_FORMAT` = responde en tiempo pero el contenido no es válido |
| **Reintento** | No. El coordinator **no reintenta** la invocación; la penalización se aplica directamente |
| **Notificación** | Sí. Se emite un evento WebSocket al canal de arena y se registra en la persistencia de la partida |
| **Acumulables en el mismo turno** | No. Un turno emite exactamente uno entre `{respuesta válida, EVT_TIMEOUT, EVT_INVALID_FORMAT}` |

> **Nota de diseño**: la penalización (−25) es deliberadamente mayor que `EVT_TIMEOUT` (−20) porque un fallo de formato implica que el agente está activo y responde, pero no respeta el contrato de la API del juego — un error de diseño del agente más que un problema de infraestructura. No se realizan reintentos para no enmascarar bugs del agente.

---

### 3.5 Resumen de puntuación máxima teórica por partida

| Escenario | Puntos |
|---|---|
| Ganar en mínimo turno (T=2), sin pasar, sin timeout | 1 000 + 500 + 10 (1 sugerencia) = **1 510** |
| Ganar en T=10, sin pasar, con 5 sugerencias, sin timeout | 1 000 + 300 + 50 = **1 350** |
| Sobrevivir sin ganar, 5 sugerencias, 3 refutaciones | 200 + 50 + 45 = **295** |
| Eliminado en T=1 (acusación incorrecta en primer turno) | −150 |

---

## 4. Puntuación total por partida

La puntuación de un equipo en una partida es la suma algebraica de todos los eventos que le aplican:

```
score_partida(equipo, partida) =
    (EVT_WIN si ganó)
  + (EVT_WIN_EFFICIENCY si ganó)
  + (EVT_SURVIVE si sobrevivió sin ganar)
  + Σ EVT_SUGGESTION (máx. 5; solo sugerencias lógicamente válidas)
  + Σ EVT_REFUTATION
  + Σ EVT_WRONG_ACCUSATION       (normalmente 0 ó −150)
  + Σ EVT_PASS × (−5)
  + Σ EVT_TIMEOUT × (−20)
  + Σ EVT_INVALID_CARD × (−30)
  + Σ EVT_REDUNDANT_SUGGESTION × (−20)
  + Σ EVT_INVALID_FORMAT × (−25)
```

> **Nota sobre `EVT_SUGGESTION` y penalizaciones por sugerencia**: una sugerencia penalizada con `EVT_INVALID_CARD` o `EVT_REDUNDANT_SUGGESTION` **no genera `EVT_SUGGESTION`** (+10). Los eventos son mutuamente excluyentes en el lado positivo: o una sugerencia suma puntos o los resta, nunca ambas cosas.

**La puntuación mínima por partida no puede ser negativa**: `score_partida = max(0, score_partida)`.

> **Motivación del suelo en 0**: evitar que un equipo con graves fallos técnicos acumule deuda de puntos que imposibilite su recuperación en el ranking general. Los puntos negativos pueden producirse durante el cálculo intermedio, pero el valor final aportado al ranking es 0 como mínimo.

---

## 5. Ranking acumulado del evento

### 5.1 Puntuación del evento

```
score_evento(equipo) = Σ score_partida(equipo, partida_i)  para toda partida_i en el evento
```

El ranking muestra los equipos ordenados de mayor a menor `score_evento`.

### 5.2 Reglas de desempate (tiebreaker)

Cuando dos o más equipos tienen el mismo `score_evento`, se aplican los siguientes criterios en orden de precedencia:

| Nivel | Criterio | Desempate a favor de |
|---|---|---|
| 1 | Número de victorias (`EVT_WIN`) | Más victorias |
| 2 | Suma de bonificaciones de eficiencia | Mayor suma |
| 3 | Número de partidas con puntuación > 0 | Más partidas con puntos |
| 4 | Número de refutaciones exitosas | Más refutaciones |
| 5 | Orden de inscripción del equipo (fecha de registro) | Inscripción más temprana |

### 5.3 Actualización del ranking

- El ranking se recalcula **al finalizar cada partida** (trigger: estado de partida → `finalizada`).
- El ranking es visible en tiempo real en `/ranking` (FR-011).
- Antes de que empiece la primera partida, todos los equipos aparecen con 0 puntos.

---

## 6. Reglas especiales

### 6.1 Partida sin ganador

Si todos los jugadores son eliminados antes de que alguien resuelva el caso (todos han hecho acusaciones incorrectas), la partida termina como `finalizada_sin_ganador`. En este caso:

- Ningún equipo recibe `EVT_WIN` ni `EVT_WIN_EFFICIENCY`.
- Ningún equipo recibe `EVT_SURVIVE` (no hay supervivientes válidos porque todos fallaron su acusación).
- Solo se contabilizan los eventos negativos (`EVT_WRONG_ACCUSATION`, `EVT_PASS`, `EVT_TIMEOUT`) y los positivos previos a la eliminación (`EVT_SUGGESTION`, `EVT_REFUTATION`).

### 6.2 Partida abortada por el Admin

Si el Admin aborta o cancela una partida antes de que finalice:

- La partida se marca como `cancelada` y **no computa en el ranking**.
- Los puntos parciales acumulados hasta ese momento se descartan.
- El Admin debe crear una nueva partida para reemplazarla si es necesario.

### 6.3 Equipos no activos en una partida

Si una partida tiene menos equipos que el total inscrito (p.ej. el Admin selecciona solo 4 de 6 equipos para una partida):

- Los equipos que no participan en esa partida reciben **0 puntos** (no se penalizan).
- El Admin debe garantizar a lo largo del evento una distribución equitativa de participaciones.

### 6.4 Refutación con sin cartas válidas (pass forzado)

Un equipo puede no tener cartas que refutar. En ese caso el motor registra `refutadaPor: null`, lo que no genera ningún evento de puntuación ni positivo ni negativo para ningún equipo.

---

## 7. Implementación

### 7.1 Capa del motor de juego (`src/lib/game/engine.ts`)

El motor calcula los eventos de puntuación como efecto de `applyAction()`. La función debe retornar los eventos generados junto con el nuevo estado:

```typescript
// src/lib/game/types.ts — ampliación propuesta

export type ScoreEventType =
  | 'EVT_WIN'
  | 'EVT_WIN_EFFICIENCY'
  | 'EVT_SURVIVE'
  | 'EVT_SUGGESTION'
  | 'EVT_REFUTATION'
  | 'EVT_WRONG_ACCUSATION'
  | 'EVT_PASS'
  | 'EVT_TIMEOUT'
  | 'EVT_INVALID_CARD'
  | 'EVT_REDUNDANT_SUGGESTION'
  | 'EVT_INVALID_FORMAT';

export interface ScoreEvent {
  equipoId: string;
  type: ScoreEventType;
  points: number;        // valor real aplicado (puede ser negativo)
  turno: number;
  meta?: Record<string, unknown>;  // datos contextuales opcionales (p.ej. T para eficiencia)
}

export interface ApplyActionResult {
  state: GameState;
  scoreEvents: ScoreEvent[];
  suggestionResult?: SuggestionResult;
  accusationResult?: AccusationResult;
}
```

La función `applyAction` devuelve `ApplyActionResult` en lugar del `GameState` directamente (cambio de firma):

```typescript
// Firma actual:
// applyAction(state: GameState, action: GameAction): GameState

// Firma propuesta:
export function applyAction(
  state: GameState,
  action: GameAction,
): ApplyActionResult
```

> **OPENQ-G001-001 → Resuelto**: `EquipoState.puntos` se acumula **dentro del motor** en cada `applyAction` (suma algebraica sin suelo) y también se persiste en la tabla `score_events`. El suelo en 0 se aplica únicamente al calcular el ranking, no en el estado interno. Esto permite auditoría completa de puntos negativos intermedios.

#### Lógica de validación de sugerencias en el motor

Antes de procesar cualquier `SuggestionAction`, el motor debe ejecutar las siguientes comprobaciones en orden:

```typescript
function validateSuggestion(
  action: SuggestionAction,
  equipo: EquipoState,
  historial: ActionRecord[],
): ScoreEvent[] {
  const penalties: ScoreEvent[] = [];

  // 1. Carta inexistente — invalida el procesamiento de la sugerencia
  const invalidCard =
    !SOSPECHOSOS.includes(action.sospechoso) ||
    !ARMAS.includes(action.arma) ||
    !HABITACIONES.includes(action.habitacion);
  if (invalidCard) {
    return [{ equipoId: action.equipoId, type: 'EVT_INVALID_CARD', points: -30, turno: ... }];
    // early return: no se procesa la sugerencia
  }

  // 2. Combinación redundante (misma combo del mismo equipo en historial)
  const isRedundant = historial.some(
    r =>
      r.equipoId === action.equipoId &&
      r.action.type === 'suggestion' &&
      r.action.sospechoso === action.sospechoso &&
      r.action.arma === action.arma &&
      r.action.habitacion === action.habitacion,
  );
  if (isRedundant) {
    penalties.push({ equipoId: action.equipoId, type: 'EVT_REDUNDANT_SUGGESTION', points: -20, turno: ... });
  }

  return penalties; // si vacío → sugerencia válida → emitir EVT_SUGGESTION
}
```

- Si `validateSuggestion` retorna `EVT_INVALID_CARD`, el motor **no procesa la sugerencia** (no hay refutación, el turno avanza sin `ActionRecord` de sugerencia).
- Si retorna una lista no vacía **sin** `EVT_INVALID_CARD`, la sugerencia se procesa normalmente (puede haber refutación) pero **no se emite `EVT_SUGGESTION`**.
- Si retorna lista vacía, la sugerencia es válida: se procesa y se emite `EVT_SUGGESTION` (+10).

### 7.2 Detección de `EVT_INVALID_FORMAT` en el Route Handler

`EVT_INVALID_FORMAT` **no lo genera `applyAction()`**: el motor solo ve acciones ya validadas. Lo emite el Route Handler cuando `invokeAgent()` lanza `AgentResponseError` con causa `parse_error`:

```typescript
// src/app/api/games/[id]/turn/route.ts (flujo simplificado)
let action: GameAction;
let formatScoreEvent: ScoreEvent | null = null;

try {
  const agentResponse = await invokeAgent(request, options);
  action = agentResponseToGameAction(agentResponse); // mapeo validado
} catch (err) {
  if (err instanceof AgentResponseError && err.cause === 'parse_error') {
    // Respuesta recibida pero esquema inválido
    formatScoreEvent = {
      equipoId: currentTeamId,
      type: 'EVT_INVALID_FORMAT',
      points: -25,
      turno: currentTurn,
      meta: { raw: err.reasoning.slice(0, 200) }, // primeros 200 chars para auditoría
    };
    action = { type: 'pass', equipoId: currentTeamId }; // el motor avanza con pass
  } else if (isTimeoutError(err)) {
    // Ya gestionado como EVT_TIMEOUT
    action = { type: 'pass', equipoId: currentTeamId };
  } else {
    throw err;
  }
}

const result = applyAction(currentState, action);

// Persistir score events del motor + el de formato (si aplica)
const allEvents = formatScoreEvent
  ? [...result.scoreEvents, formatScoreEvent]
  : result.scoreEvents;
```

### 7.3 Cálculo de `EVT_WIN_EFFICIENCY` en el motor

```typescript
function calcEfficiencyBonus(turnosJugados: number): number {
  const T_MIN = 2;
  const T_MAX = 20;
  const BONUS_BASE = 500;
  const DECAY = 25;
  return Math.max(0, BONUS_BASE - (turnosJugados - T_MIN) * DECAY);
}
```

`turnosJugados` es el contador de turnos propios del equipo ganador en esa partida (no el turno global de la partida). Se almacena en `EquipoState` como `turnosJugados: number`.

### 7.4 Persistencia de eventos de puntuación

Se propone una tabla `score_events` nueva en el schema Drizzle:

```typescript
// src/lib/db/schema.ts — tabla adicional propuesta
export const scoreEvents = sqliteTable('score_events', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  gameId:    text('game_id').notNull().references(() => games.id),
  equipoId:  text('equipo_id').notNull().references(() => teams.id),
  turno:     integer('turno').notNull(),
  type:      text('type').notNull(),        // ScoreEventType
  points:    integer('points').notNull(),
  meta:      text('meta'),                  // JSON serializado
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

Esta tabla permite:
- Auditar evento por evento cómo se formó la puntuación de cada equipo.
- Regenerar el ranking desde cero si se detecta un bug en la fórmula.
- Mostrar una vista de desglose de puntuación en el panel del equipo o Admin.

### 7.5 Cálculo del ranking (`src/app/api/ranking/route.ts`)

El API de ranking realiza el cálculo agregado mediante una query Drizzle:

```typescript
// Pseudocódigo de la query
const rawScores = await db
  .select({
    equipoId:    scoreEvents.equipoId,
    totalPoints: sql<number>`sum(${scoreEvents.points})`,
    wins:        sql<number>`count(case when ${scoreEvents.type} = 'EVT_WIN' then 1 end)`,
    effBonus:    sql<number>`sum(case when ${scoreEvents.type} = 'EVT_WIN_EFFICIENCY' then ${scoreEvents.points} else 0 end)`,
    refutations: sql<number>`count(case when ${scoreEvents.type} = 'EVT_REFUTATION' then 1 end)`,
  })
  .from(scoreEvents)
  .groupBy(scoreEvents.equipoId);

// Aplicar suelo en 0 por equipo, luego ordenar con tiebreakers
```

> El `max(0, ...)` por partida implica que hay que agrupar primero por `(equipoId, gameId)`, aplicar el suelo, y luego sumar entre partidas. No es un `max(0, sum_total)`.

### 7.6 Integración con `applyAction` en el Route Handler

```typescript
// src/app/api/games/[id]/turn/route.ts (flujo simplificado)

const result = applyAction(currentState, action);

// 1. Persistir nuevo estado
await db.update(games).set({ state: JSON.stringify(result.state) }).where(eq(games.id, gameId));

// 2. Persistir score events
if (result.scoreEvents.length > 0) {
  await db.insert(scoreEvents).values(
    result.scoreEvents.map(evt => ({
      gameId,
      equipoId: evt.equipoId,
      turno:    evt.turno,
      type:     evt.type,
      points:   evt.points,
      meta:     evt.meta ? JSON.stringify(evt.meta) : null,
      createdAt: new Date(),
    }))
  );
}

// 3. Si la partida finalizó, recalcular ranking (invalidar caché)
if (result.state.estado === 'finalizada') {
  await recalculateRanking();
}
```

---

## 8. Ejemplo de partida completa

Partida de 3 equipos (A, B, C). Sobre secreto: Escarlata + Candelabro + Biblioteca.

| Turno global | Equipo | Acción | Resultado motor | Eventos puntuación |
|---|---|---|---|---|
| 1 | A | Sugerencia (Escarlata + Cuerda + Biblioteca) | Refutada por B | A: +10 (SUGGEST) · B: +15 (REFUTE) |
| 2 | B | Sugerencia (Plum + Candelabro + Salón) | Refutada por C | B: +10 · C: +15 |
| 3 | C | Sugerencia (Escarlata + Candelabro + Cocina) | No refutada | C: +10 |
| 4 | A | Sugerencia (Escarlata + Candelabro + Biblioteca) | No refutada | A: +10 |
| 5 | B | Sugerencia (Escarlata + Candelabro + Biblioteca) | No refutada (ya sabemos que nadie tiene esas cartas) | B: +10 |
| 6 | C | Acusación (Plum + Cuerda + Cocina) | **Incorrecta** | C: −150 (WRONG_ACC), eliminado |
| 7 | A | Acusación (Escarlata + Candelabro + Biblioteca) | **Correcta** | A: +1 000 (WIN) + EVT_WIN_EFFICIENCY(T=3) = +1 000 + 425 |
| — | B | Fin de partida (sobrevivió) | — | B: +200 (SURVIVE) |

**Resumen de puntos brutos por partida:**

| Equipo | Puntos brutos | Suelo | Aportación al ranking |
|---|---|---|---|
| A | 10 + 10 + 1 000 + 425 = **1 445** | — | **1 445** |
| B | 15 + 10 + 10 + 200 = **235** | — | **235** |
| C | 15 + 10 − 150 = **−125** | max(0, −125) = 0 | **0** |

---

## 9. Consideraciones de diseño y decisiones

### 9.1 Por qué 1 000 puntos por victoria

El valor base de victoria es 10× la bonificación de eficiencia máxima (500) y ordenes de magnitud superior a los eventos secundarios. Esto garantiza que **ganar siempre domina sobre el resto de la puntuación**: un equipo que gana varias partidas estará por encima de uno que no gana pero acumula bonificaciones menores, independientemente del número de sugerencias o refutaciones.

### 9.2 Cap de 5 en EVT_SUGGESTION

El cap desincentiva la estrategia de "hacer sugerencias sin lógica para acumular puntos". Un agente que hace 20 sugerencias antes de acusar no debería superar en el ranking a uno que resuelve el caso en 5 turnos. El cap se fija en 5 por ser el número de sugerencias razonables antes de tener información suficiente para acusar.

### 9.3 Suelo en 0 por partida (no global)

El suelo se aplica **per partida**, no sobre el total del evento. Un equipo que falla gravemente en una partida (acusación incorrecta + timeouts) recibe 0 para esa partida. Si en la siguiente partida lo hace bien, acumula puntos normalmente. Esto preserva el incentivo a seguir compitiendo y a mejorar el agente entre rondas.

### 9.4 Penalización por timeout vs. pass

El timeout (−20) penaliza más que el pase voluntario (−5) porque indica un fallo técnico del agente más grave que una decisión táctica de no actuar. El pase voluntario es una acción legítima en Cluedo (cuando el jugador no quiere revelar información con su sugerencia).

### 9.5 Fórmula pública para los participantes

La fórmula de puntuación completa (incluyendo todos los eventos, valores y penalizaciones) será **publicada a los equipos antes del evento**. Esto permite que los participantes diseñen sus agentes con conocimiento explícito de los incentivos y penalizaciones del sistema.

### 9.6 Alternativas descartadas

| Alternativa | Por qué se descartó |
|---|---|
| Puntuación basada solo en posición final (1.º, 2.º, 3.º) | No distingue calidad dentro del mismo puesto ni incentiva el juego deductivo |
| Puntuación por "información deducida" (entropía) | Requiere acceso al razonamiento interno del agente, no observable por el motor |
| Sistema Elo/rating por partidas | Overkill para un evento de un día; introduce complejidad sin valor pedagógico |
| Puntos negativos acumulables sin suelo | Desmotiva a equipos con problemas técnicos tempranos que ya no pueden remontar |

---

## 10. Cambios necesarios en código existente

| Fichero | Cambio |
|---|---|
| `src/lib/game/types.ts` | Añadir `ScoreEventType` (incluye los 3 nuevos), `ScoreEvent`, `ApplyActionResult`; añadir `turnosJugados` a `EquipoState` |
| `src/lib/game/engine.ts` | Cambiar firma de `applyAction` para devolver `ApplyActionResult`; implementar `validateSuggestion()` con las 3 comprobaciones; integrar resultados en `ScoreEvent[]` |
| `src/lib/db/schema.ts` | Añadir tabla `scoreEvents` |
| `src/app/api/games/[id]/turn/route.ts` | Consumir `ApplyActionResult`; capturar `AgentResponseError(parse_error)` y emitir `EVT_INVALID_FORMAT`; persistir todos los `scoreEvents` |
| `src/app/api/ranking/route.ts` | Implementar query agregada con suelo por partida y tiebreakers |
| `src/tests/game-engine.test.ts` | Tests unitarios de `applyAction` cubriendo todos los `ScoreEvent`; casos específicos para `EVT_INVALID_CARD` y `EVT_REDUNDANT_SUGGESTION`  |
| `src/tests/turn-route.test.ts` | Tests de integración del Route Handler: `EVT_INVALID_FORMAT` vs `EVT_TIMEOUT`; verificar que el motor recibe `PassAction` en ambos casos; verificar que se emite evento WebSocket |
| `src/lib/arena/` (nuevo o existente) | Emitir evento WebSocket al canal de arena cuando se genera cualquier `ScoreEvent` de penalización (`points < 0`) |

---

## 11. Preguntas abiertas (OPENQ)

| ID | Pregunta | Impacto | Bloquea | Estado |
|---|---|---|---|---|
| OPENQ-G001-001 | ¿Se acumula `EquipoState.puntos` dentro del motor o solo en la capa de persistencia? | Diseño de `applyAction` y auditoría | Implementación de `engine.ts` | ✅ **Resuelto**: se acumula en el motor Y en persistencia; suelo solo al calcular ranking |
| OPENQ-G001-002 | ¿Cuántas partidas tendrá el evento? (N) Afecta al balance de puntos totales y si hace falta normalización | Comunicación a participantes | Configuración del Admin | 🔲 **Pendiente** |
| OPENQ-G001-003 | ¿Se publicará la fórmula completa a los equipos antes del evento? | Estrategia de los agentes | Documentación pública | ✅ **Resuelto**: la fórmula será pública; ver §9.5 |
| OPENQ-G001-004 | ¿Hay bonus por velocidad de respuesta del turno (latencia del agente)? | Complejidad del sistema; puede discriminar infra vs. calidad del agente | Definición de eventos | ✅ **Resuelto**: no hay bonus de latencia; el turno debe completarse dentro del timeout |
| OPENQ-G001-005 | ¿El `T_min = 2` es correcto para el Cluedo con las reglas específicas del evento? | Valor de la bonificación de eficiencia máxima | Calibración de fórmula | ✅ **Resuelto**: confirmado `T_min = 2` |
| OPENQ-G001-006 | Para `EVT_INVALID_CARD`: ¿el turno debe seguir avanzando normalmente o el admin recibe una alerta especial? | UX Admin + gestión de turnos | Implementación de `engine.ts` | ✅ **Resuelto**: el turno pasa (motor recibe `PassAction`), sin alerta especial al Admin |
| OPENQ-G001-007 | ¿Se notifica al equipo en tiempo real cuando recibe una penalización por sugerencia incorrecta? | Transparencia hacia participantes | Diseño de WebSocket/persistencia | ✅ **Resuelto**: emitir evento WebSocket en canal arena + registrar en persistencia de la partida |
| OPENQ-G001-008 | ¿Debe el coordinator reintentar la invocación al agente antes de emitir `EVT_INVALID_FORMAT`? | Experiencia del participante vs complejidad | Implementación del Route Handler | ✅ **Resuelto**: no reintenta; penalización directa |

---

## 12. TODOs de implementación

| ID | Tarea | Prioridad |
|---|---|---|
| TODO-G001-001 | Ampliar `src/lib/game/types.ts` con `ScoreEvent`, `ScoreEventType` (11 tipos incluyendo `EVT_INVALID_FORMAT`), `ApplyActionResult` | MVP |
| TODO-G001-002 | Refactorizar `applyAction` en `engine.ts` para devolver `ApplyActionResult` | MVP |
| TODO-G001-003 | Implementar `calcEfficiencyBonus()` en `engine.ts` | MVP |
| TODO-G001-004 | Implementar `validateSuggestion()` en `engine.ts` con las 3 comprobaciones (carta inválida, redundante, carta propia) | MVP |
| TODO-G001-005 | Añadir tabla `score_events` al schema Drizzle y generar migración | MVP |
| TODO-G001-006 | Actualizar Route Handler de turno para persistir `scoreEvents` | MVP |
| TODO-G001-007 | Implementar cálculo de ranking con suelo por partida y tiebreakers en `/api/ranking` | MVP |
| TODO-G001-008 | Capturar `AgentResponseError(parse_error)` en el Route Handler de turno y emitir `EVT_INVALID_FORMAT` con `PassAction` al motor (sin reintento) | MVP |
| TODO-G001-009 | Emitir evento WebSocket al canal de arena para cualquier `ScoreEvent` con `points < 0`; registrar en persistencia de la partida | MVP |
| TODO-G001-009 | Tests unitarios de `validateSuggestion()`: carta inválida (1, 2, 3 cartas), redundante, carta propia, combinaciones | MVP |
| TODO-G001-010 | Tests unitarios de `applyAction` cubriendo todos los `ScoreEventType` | MVP |
| TODO-G001-011 | Tests de integración del Route Handler de turno: `EVT_INVALID_FORMAT` vs `EVT_TIMEOUT`, verificar `PassAction` al motor | MVP |
| TODO-G001-012 | Tests de integración del endpoint `/api/ranking` con datos de múltiples partidas | Should |
| TODO-G001-013 | UI de desglose de puntuación por equipo (panel equipo y Admin) | Should |
