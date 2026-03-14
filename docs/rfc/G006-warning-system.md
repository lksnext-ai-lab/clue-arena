# RFC G006 — Sistema de Warnings por Infracciones de Agente

| Campo | Valor |
|---|---|
| **ID** | G006 |
| **Título** | Sistema de warnings por infracciones: acumulación, eliminación y redistribución de cartas |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-03-13 |
| **Refs. spec** | [10-requisitos-funcionales](../../clue-arena-spec/docs/spec/10-requisitos-funcionales.md) · [20-conceptualizacion](../../clue-arena-spec/docs/spec/20-conceptualizacion.md) · [60-backend](../../clue-arena-spec/docs/spec/60-backend.md) |
| **Refs. FR** | FR-009 · FR-011 |
| **Deps.** | RFC G001 (sistema de puntuación) · RFC F007 (motor de juego/coordinador) · RFC F011 (WebSocket arena) · RFC G002 (acción PASS) |

---

## 1. Resumen

Este RFC define el **sistema de warnings por infracciones** de Clue Arena. Cuando un agente recibe un evento de penalización (cualquier evento con puntos negativos derivado de no respetar el protocolo del juego), se le registra un warning. Al acumular **tres warnings** en la misma partida, el agente es **eliminado automáticamente por el coordinador** independientemente de su estado en el juego. Las cartas del agente eliminado se redistribuyen entre los agentes aún activos mediante un algoritmo round-robin para preservar la jugabilidad.

El sistema complementa el marco de penalizaciones de RFC G001 y el ciclo de coordinación de RFC F007, añadiendo un mecanismo de control de calidad que incentiva a los equipos a entregar agentes robustos y correctamente implementados.

---

## 2. Motivación y contexto

El sistema de penalizaciones de RFC G001 penaliza los comportamientos deficientes con puntos negativos. Sin embargo, este mecanismo es insuficiente cuando un agente está estructuralmente roto: puede seguir participando indefinidamente en la partida generando timeouts, formatos inválidos o cartas alucinadas en cada turno. Esto produce tres efectos negativos:

1. **Degrada la experiencia de juego**: los demás agentes esperan turnos que siempre terminan en error, distorsionando el ritmo del evento.
2. **Crea asimetría de información**: el agente roto conserva sus cartas en mano aunque no pueda razonar con ellas, impidiendo que otros deduzcan el sobre.
3. **Desincentivo insuficiente**: acumular puntos negativos no detiene al agente; el equipo puede llegar al final de la partida sin contribuir al juego.

El sistema de warnings establece un umbral máximo de infracciones tolerables dentro de una partida (3). Superado ese umbral, el motor elimina al agente y garantiza la continuidad del juego mediante la redistribución de sus cartas.

---

## 3. Diseño del sistema de warnings

### 3.1 Definición de infracción

Se considera **infracción** cualquier turno en el que el coordinador registra un evento de penalización derivado de no seguir el protocolo del juego. Los siguientes eventos de RFC G001 **generan un warning**:

| Evento de penalización | Puntos | ¿Genera warning? | Motivo |
|---|---|---|---|
| `EVT_TIMEOUT` | −20 | **Sí** | El agente no responde en el tiempo límite: error de infraestructura o bucle roto |
| `EVT_INVALID_FORMAT` | −25 | **Sí** | El agente responde con JSON inválido: incumplimiento del contrato de la API |
| `EVT_INVALID_CARD` | −30 | **Sí** | El agente usa cartas inexistentes: error de dominio o alucinación del modelo |
| `EVT_WRONG_REFUTATION` | −30 | **Sí** | El agente indica una carta para refutar que no posee o no corresponde a la combinación sugerida: error de dominio o de acceso al estado propio |
| `EVT_REDUNDANT_SUGGESTION` | −20 | **No** | Penalización de puntos suficiente; no implica fallo de protocolo estructural |
| `EVT_PASS` | −5 | **No** | Acción voluntaria y tácticamente válida introducida en RFC G002; no implica incumplimiento de normas |
| `EVT_WRONG_ACCUSATION` | −150 | No aplicable | Produce eliminación estándar por reglas del Cluedo antes de que el sistema de warnings intervenga; ver §3.5 |

> **DECISION**: `EVT_PASS` y `EVT_REDUNDANT_SUGGESTION` se excluyen del sistema de warnings. `EVT_PASS` es una acción táctica legítima (RFC G002); `EVT_REDUNDANT_SUGGESTION` implica fallo de razonamiento pero no incumplimiento del protocolo de respuesta — la penalización de puntos es el mecanismo de corrección suficiente en ambos casos.

> **Nota sobre `EVT_WRONG_REFUTATION`**: ocurre durante la fase de refutación cuando el agente responde con `show_card` indicando una carta que (a) no está en su mano según el estado del juego, o (b) no pertenece a la combinación sugerida `(sospechoso, arma, habitacion)`. El coordinador detecta ambas condiciones antes de persistir; la carta errónea se descarta, se registra como `cannot_refute` forzado y se emite el evento de penalización. Es un fallo de protocolo asimilable a `EVT_INVALID_CARD` en la fase de sugerencia. Evento nuevo introducido en este RFC; no está en el catálogo de RFC G001.

### 3.2 Reglas de acumulación

- El contador de warnings es **por equipo y por partida**; se reinicia en cada nueva partida y también **al reanudar la partida desde estado `pausado`** (`POST /api/games/{id}/resume`). Esto permite recuperar sesiones interrumpidas sin arrastrar infracciones de una sesión de juego anterior.
- Un turno genera **como máximo un warning**, aunque se produzcan varios eventos de penalización elegibles en él.
- La prioridad de registro cuando coinciden varios eventos elegibles es: `EVT_INVALID_FORMAT` > `EVT_INVALID_CARD` > `EVT_WRONG_REFUTATION` > `EVT_TIMEOUT`. Los puntos de penalización de todos los eventos se aplican igualmente.
- El contador se almacena en `partidaEquipos.warnings` e incrementa de forma atómica en las transacciones del coordinador.
- Cada incremento emite un evento WebSocket `warning_issued` (§9) al canal de arena inmediatamente.

### 3.3 Umbral de eliminación

Cuando `warnings === 3` (tercera infracción del mismo equipo en la misma partida), el coordinador activa el procedimiento de **eliminación por warnings**:

```
1. Marcar al equipo como eliminado (eliminacionRazon: 'warnings')
2. Recoger las cartas del equipo eliminado
3. Ejecutar algoritmo de redistribución de cartas (§4)
4. Persiste la eliminación y redistribución en BD
5. Emitir evento WebSocket 'agent_warning_eliminated' (§9)
6. Aplicar ScoreEvent EVT_WARNING_ELIMINATION (§5)
7. Avanzar el turno al siguiente equipo activo
8. Evaluar isGameOver — si no quedan equipos activos, terminar partida
```

### 3.4 Información de warnings en `GameStateView`

El `GameStateView` expuesto a los agentes (RFC F007 §4.2) incluye el estado de warnings de todos los equipos sin restricción de visibilidad:

```typescript
interface EquipoStateView {
  // campos existentes…
  warnings: number;               // NUEVO: 0–3; visible para todos los agentes
  eliminadoPorWarnings: boolean;  // NUEVO: diferencia causa de eliminación
}
```

> **Justificación**: conocer el estado de warnings de los competidores es información estratégicamente relevante y completamente pública (equivalente a que el árbitro advierta en voz alta). Exponer `warnings` no compromete la confidencialidad de cartas ni del sobre secreto.

### 3.5 Interacción con la eliminación estándar de Cluedo

La eliminación estándar (`EVT_WRONG_ACCUSATION`) retira al equipo del juego sin redistribuir cartas. El sistema de warnings **no interfiere** con este mecanismo:

| Situación | Resultado |
|---|---|
| Equipo con 2 warnings hace acusación incorrecta | Eliminación estándar; warnings congelados en 2; sin redistribución de cartas |
| Equipo con 0 warnings acumula 3 infracciones | Eliminación por warnings; redistribución de cartas activa |
| Equipo ya eliminado (cualquier causa) recibe nuevo turno | No aplica; el coordinador ya salta al siguiente equipo activo |

Las dos rutas de eliminación son **mutuamente excluyentes**: una vez eliminado por cualquier causa, el contador de warnings queda congelado y no se aplica el procedimiento del otro tipo.

---

## 4. Redistribución de cartas tras eliminación por warnings

### 4.1 Objetivo

Cuando un agente es eliminado por warnings, sus cartas dejan de tener custodio activo. Para mantener la integridad del razonamiento deductivo, el coordinador redistribuye esas cartas entre los **equipos aún activos** (no eliminados en el momento de la redistribución).

### 4.2 Algoritmo de redistribución

```
Entrada:
  cartasEliminado  = cartas del equipo eliminado (ordenadas por ID de carta)
  equiposActivos   = equipos no eliminados, excluido el equipo que acaba de ser eliminado,
                     ordenados desde el equipo con el siguiente turno (índice circular
                     a partir de turnoActual + 1)

Algoritmo (round-robin cíclico):
  Para i = 0 hasta |cartasEliminado| - 1:
    equipoReceptor = equiposActivos[i mod |equiposActivos|]
    equipoReceptor.cartas.push(cartasEliminado[i])

Postcondición:
  Cada equipo activo recibe ⌊|cartasEliminado| / |equiposActivos|⌋ cartas base.
  Los primeros (|cartasEliminado| mod |equiposActivos|) equipos reciben una carta extra.
```

**Ejemplo**: 3 cartas eliminadas, 4 equipos activos (A, B, C, D con A como siguiente turno):

| Carta | Receptor |
|---|---|
| Carta 1 | Equipo A |
| Carta 2 | Equipo B |
| Carta 3 | Equipo C |
| — | Equipo D (no recibe carta extra) |

### 4.3 Semántica de las cartas redistribuidas

Las cartas redistribuidas pasan a formar parte **genuina de la mano del equipo receptor**:

- Aparecen en `EquipoState[receptor].cartas` dentro del `GameState`.
- El equipo receptor las ve en su `GameStateView` (`cartas` del propio equipo) en la siguiente llamada a `get_game_state`.
- Los demás equipos **no ven** qué cartas recibió el equipo receptor (las reglas de confidencialidad de cartas siguen aplicando).

> **Implicación estratégica**: las cartas redistribuidas son conocimiento privado del receptor. Los demás agentes solo observan en el `GameStateView` que el equipo fue eliminado por warnings y la lista de IDs de equipos que recibieron cartas, sin saber cuáles ni cuántas. Esto crea un incentivo para que los receptores usen esa información en su razonamiento deductivo.

### 4.4 Registro en el historial de la partida

El resultado de la redistribución se registra como un `ActionRecord` de tipo `'warning_elimination'` visible para todos en el historial:

```typescript
interface WarningEliminationRecord {
  type: 'warning_elimination';
  equipoId: string;          // equipo eliminado por warnings
  turno: number;
  cartasRepartidas: number;  // cantidad total de cartas redistribuidas
  equiposReceptores: string[]; // IDs de equipos que recibieron ≥1 carta (sin revelar cuáles)
}
```

> El historial **no revela qué cartas ni cuántas recibió cada equipo**. Solo informa de que se produjo la redistribución y qué equipos participaron. Cada receptor descubre sus cartas al invocar `get_game_state`.

---

## 5. Nuevos eventos de puntuación

El sistema de warnings añade dos nuevos tipos de `ScoreEvent` al catálogo de RFC G001:

| ID Evento | Descripción | Puntos | Notas |
|---|---|---|---|
| `EVT_WARNING` | El equipo acumula un nuevo warning | **0** | Evento informativo y de trazabilidad; los puntos negativos los aplica el evento de penalización asociado (EVT_TIMEOUT, etc.) |
| `EVT_WARNING_ELIMINATION` | El equipo es eliminado al alcanzar 3 warnings | **−50** | Penalización adicional a la propia eliminación; ver §5.1 para justificación |

### 5.1 Justificación de la penalización por eliminación

La penalización de −50 por `EVT_WARNING_ELIMINATION` es acumulativa a las tres penalizaciones previas que la originaron:

| Escenario (3 infracciones) | Penalización total acumulada | + `EVT_WARNING_ELIMINATION` | Total mínimo |
|---|---|---|---|
| 3× `EVT_TIMEOUT` | −60 | −50 | **−110** |
| 3× `EVT_INVALID_FORMAT` | −75 | −50 | **−125** |
| 3× `EVT_INVALID_CARD` | −90 | −50 | **−140** |
| Mezcla (máx penalización) | −90 | −50 | **−140** |

> La penalización de −50 es deliberadamente menor que `EVT_WRONG_ACCUSATION` (−150) porque la eliminación por warnings refleja fallo técnico recurrente del agente, no un error estratégico grave de razonamiento sobre el juego. Ambas situaciones son distintas y deben diferenciarse en el historial y ranking.

### 5.2 Suelo de puntuación

El suelo de 0 puntos por partida de RFC G001 §4 se aplica igualmente a los equipos eliminados por warnings. El resultado de `max(0, score_partida)` aplica después de todos los descuentos.

---

## 6. Cambios en el modelo de datos

### 6.1 Extensiones de tipos del motor

**Archivo**: `src/lib/game/types.ts`

```typescript
// Extensión de EquipoState — añadir campos
export interface EquipoState {
  equipoId: string;
  nombre: string;
  cartas: Carta[];
  eliminado: boolean;
  eliminacionRazon: 'acusacion_incorrecta' | 'warnings' | null;  // NUEVO: null si no eliminado
  warnings: number;                                               // NUEVO: 0..3
  puntos: number;
  turno: number;
}

// Extensión de ScoreEventType
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
  | 'EVT_INVALID_FORMAT'
  | 'EVT_WRONG_REFUTATION'       // NUEVO (introducido en este RFC)
  | 'EVT_WARNING'               // NUEVO
  | 'EVT_WARNING_ELIMINATION';  // NUEVO

// Extensión de GameAction
export type GameAction =
  | SuggestionAction
  | AccusationAction
  | PassAction
  | WarningEliminationAction;  // NUEVO

export interface WarningEliminationAction {
  type: 'warning_elimination';
  equipoId: string;                                               // equipo a eliminar
  redistribucion: { equipoId: string; cartas: Carta[] }[];       // cartas asignadas por receptor
}

// Extensión de ApplyActionResult
export interface ApplyActionResult {
  state: GameState;
  scoreEvents: ScoreEvent[];
  suggestionResult?: SuggestionResult;
  accusationResult?: AccusationResult;
  warningEliminationResult?: {                                    // NUEVO
    redistribucion: { equipoId: string; cartas: Carta[] }[];
  };
}
```

### 6.2 Schema Drizzle

**Archivo**: `src/lib/db/schema.ts`

```typescript
// Tabla partidaEquipos — añadir columnas nuevas
export const partidaEquipos = sqliteTable('partida_equipos', {
  // … columnas existentes …
  warnings: integer('warnings').default(0).notNull(),                    // NUEVO
  eliminacionRazon: text('eliminacion_razon',                            // NUEVO
    { enum: ['acusacion_incorrecta', 'warnings'] }
  ),  // null = no eliminado
});

// Nueva tabla: log de eliminaciones por warnings y redistribución
export const warningEliminaciones = sqliteTable('warning_eliminaciones', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => partidas.id),
  equipoEliminadoId: text('equipo_eliminado_id').notNull(),
  turno: integer('turno').notNull(),
  cartasCount: integer('cartas_count').notNull(),
  redistribucionJson: text('redistribucion_json').notNull(), // JSON: [{equipoId, cartas[]}]
  creadoEn: integer('creado_en', { mode: 'timestamp' }).notNull(),
});
```

> **Migración**: ejecutar `npm run db:generate` tras los cambios de schema y revisar la migración generada antes de aplicar.

---

## 7. Cambios en el motor de juego

### 7.1 Nueva función `applyWarningElimination`

**Archivo**: `src/lib/game/engine.ts`

```typescript
/**
 * Elimina un equipo por acumulación de 3 warnings y redistribuye sus cartas
 * entre los equipos activos restantes mediante round-robin.
 *
 * Función pura — sin I/O. Determinista dado el GameState de entrada.
 */
export function applyWarningElimination(
  state: GameState,
  equipoId: string,
): ApplyActionResult {
  const equipo = state.equipos.find(e => e.equipoId === equipoId);
  if (!equipo || equipo.eliminado) {
    throw new InvalidActionError(`Equipo ${equipoId} no encontrado o ya eliminado`);
  }

  const cartasEliminado = [...equipo.cartas];

  // Equipos activos ordenados desde el siguiente en el orden de turno
  const totalActivos = state.equipos.filter(e => !e.eliminado);
  const posActual = totalActivos.findIndex(e => e.equipoId === equipoId);
  const equiposActivos = [
    ...totalActivos.slice(posActual + 1),
    ...totalActivos.slice(0, posActual),
  ];

  // Round-robin
  const redistribucion: { equipoId: string; cartas: Carta[] }[] =
    equiposActivos.map(e => ({ equipoId: e.equipoId, cartas: [] }));

  cartasEliminado.forEach((carta, i) => {
    if (redistribucion.length > 0) {
      redistribucion[i % redistribucion.length].cartas.push(carta);
    }
  });

  const newEquipos = state.equipos.map(e => {
    if (e.equipoId === equipoId) {
      return { ...e, eliminado: true, eliminacionRazon: 'warnings' as const, cartas: [] };
    }
    const recv = redistribucion.find(r => r.equipoId === e.equipoId);
    return recv && recv.cartas.length > 0
      ? { ...e, cartas: [...e.cartas, ...recv.cartas] }
      : e;
  });

  const warningRecord: WarningEliminationRecord = {
    type: 'warning_elimination',
    equipoId,
    turno: state.turnoActual,
    cartasRepartidas: cartasEliminado.length,
    equiposReceptores: redistribucion
      .filter(r => r.cartas.length > 0)
      .map(r => r.equipoId),
  };

  return {
    state: {
      ...state,
      equipos: newEquipos,
      historial: [...state.historial, warningRecord],
    },
    scoreEvents: [
      {
        equipoId,
        type: 'EVT_WARNING_ELIMINATION',
        points: -50,
        turno: state.turnoActual,
        meta: { cartasRepartidas: cartasEliminado.length },
      },
    ],
    warningEliminationResult: { redistribucion },
  };
}
```

> **Cobertura de tests requerida** (en `src/tests/game-engine.test.ts`):
> - Distribución correcta con 3 cartas y 4 equipos activos.
> - Distribución con 0 cartas.
> - Eliminación del único equipo restante → `isGameOver` retorna true.
> - El equipo eliminado queda con `cartas: []` y `eliminacionRazon: 'warnings'`.
> - Idempotencia: llamar a `applyWarningElimination` sobre un equipo ya eliminado lanza `InvalidActionError`.

### 7.2 Modificación de `applyAction`

**Archivo**: `src/lib/game/engine.ts`

`applyAction` debe enrutar el nuevo tipo `'warning_elimination'` a `applyWarningElimination`:

```typescript
export function applyAction(
  state: GameState,
  action: GameAction,
): ApplyActionResult {
  switch (action.type) {
    case 'suggestion':  return applySuggestion(state, action);
    case 'accusation':  return applyAccusation(state, action);
    case 'pass':        return applyPass(state, action.equipoId);
    case 'warning_elimination':                                  // NUEVO
      return applyWarningElimination(state, action.equipoId);
    default:
      throw new InvalidActionError(`Tipo de acción desconocido`);
  }
}
```

---

## 8. Cambios en el coordinador

### 8.1 Detección y procesamiento de infracciones

**Archivo**: `src/app/api/games/[id]/advance-turn/route.ts` (y `src/lib/game/auto-run.ts`)

Tras cada llamada a `applyAction` o detección de `EVT_TIMEOUT`/`EVT_INVALID_FORMAT`, el coordinador ejecuta el siguiente flujo:

```typescript
// Constantes del sistema de warnings
const WARNING_EVENTS: ScoreEventType[] = [
  'EVT_TIMEOUT',
  'EVT_INVALID_FORMAT',
  'EVT_INVALID_CARD',
  'EVT_WRONG_REFUTATION',
];
const WARNING_THRESHOLD = 3;

// Tras aplicar la acción y obtener scoreEvents:
const infracionEvent = scoreEvents.find(e => WARNING_EVENTS.includes(e.type));

if (infracionEvent) {
  // Incremento atómico en BD (dentro de la misma transacción del turno)
  const nuevoWarnings = await db.transaction(async (tx) => {
    await tx.update(partidaEquipos)
      .set({ warnings: sql`warnings + 1` })
      .where(and(eq(partidaEquipos.gameId, gameId), eq(partidaEquipos.equipoId, equipoId)));
    const row = await tx.select({ warnings: partidaEquipos.warnings })
      .from(partidaEquipos)
      .where(and(eq(partidaEquipos.gameId, gameId), eq(partidaEquipos.equipoId, equipoId)))
      .get();
    return row?.warnings ?? 0;
  });

  // Emitir warning_issued
  await emitGameEvent(gameId, {
    type: 'warning_issued',
    equipoId,
    warnings: nuevoWarnings,
    reason: infracionEvent.type,
  });

  // Verificar umbral
  if (nuevoWarnings >= WARNING_THRESHOLD) {
    const currentState = await loadGameState(gameId);
    const elimResult = applyWarningElimination(currentState, equipoId);
    await persistWarningElimination(gameId, elimResult);  // persiste en BD + tabla warning_eliminaciones

    await emitGameEvent(gameId, {
      type: 'agent_warning_eliminated',
      equipoId,
      equiposConCartasNuevas: elimResult.warningEliminationResult!.redistribucion
        .filter(r => r.cartas.length > 0)
        .map(r => r.equipoId),  // IDs públicos, sin revelar qué cartas
    });
  }
}
```

> El incremento de `warnings` y la posterior verificación del umbral deben ocurrir en la **misma transacción de BD** que el resto del turno para mantener la consistencia del estado.

---

## 9. Eventos WebSocket

Se añaden dos nuevos tipos de evento al canal de arena (RFC F011 / RFC F018):

| Tipo | Campos | Receptor | Descripción |
|---|---|---|---|
| `warning_issued` | `equipoId: string`, `warnings: number` (1–3), `reason: ScoreEventType` | Todos los canales (arena, admin, equipo) | Notifica la emisión de un nuevo warning |
| `agent_warning_eliminated` | `equipoId: string`, `equiposConCartasNuevas: string[]` | Todos los canales | Notifica la eliminación y qué equipos recibieron cartas (sin revelar cuáles) |

> Los campos `equiposConCartasNuevas` son IDs públicos. La información de qué cartas recibió cada equipo solo es accesible a través de `get_game_state` (canal privado por equipo).

---

## 10. Impacto en la UI

### 10.1 Vista espectador — Arena (UI-005 / RFC F009)

- El panel de estado de cada equipo muestra un indicador visual de warnings:
  - 0 warnings: sin indicador
  - 1 warning: `⚠` (amarillo)
  - 2 warnings: `⚠⚠` (naranja)
  - 3 warnings: `✖ eliminado por warnings` (rojo)
- Al recibir `warning_issued`, el indicador del equipo afectado se actualiza en tiempo real.
- Al recibir `agent_warning_eliminated`, se muestra una notificación temporal en el feed de la arena indicando el equipo eliminado y los equipos que recibieron cartas.

### 10.2 Panel Admin (UI-006/007/008)

- La tabla de equipos de la partida en curso incluye columna **Warnings (0/3)** con indicador visual.
- El log de eventos de la partida registra las entradas `warning_issued` y `agent_warning_eliminated` con marca de tiempo.
- El detalle de la eliminación muestra los equipos receptores de cartas (sin revelar cuáles).

### 10.3 Panel de equipo (UI-003)

- El propio equipo ve su contador de warnings actual destacado en su panel de estado.
- Si el equipo recibe cartas redistribuidas, aparecen en su mano en el siguiente refresco del estado del juego.
- Una notificación toast indica al equipo que ha recibido cartas adicionales tras una eliminación por warnings.

---

## 11. Impacto en el prompt de los agentes

El system prompt del agente (RFC F007 §6 y `src/lib/ai/prompts/play-turn.ts`) debe actualizarse para informar del sistema de warnings:

```
SISTEMA DE WARNINGS:
Recibirás un warning por cada infracción cometida en tu turno o fase de refutación. Las infracciones son:
- No responder en el tiempo límite (EVT_TIMEOUT)
- Responder con formato JSON inválido (EVT_INVALID_FORMAT)
- Incluir cartas inexistentes en una sugerencia (EVT_INVALID_CARD)
- Indicar una carta para refutar que no posees o que no corresponde a la combinación sugerida (EVT_WRONG_REFUTATION)

Al acumular 3 warnings, tu agente será ELIMINADO automáticamente y tus cartas serán
redistribuidas entre los demás participantes. Consulta el campo `warnings` en el estado
del juego para conocer tu acumulado actual.
```

---

## 12. Casos extremos

| Escenario | Comportamiento esperado |
|---|---|
| Eliminación por warnings → 0 equipos activos restantes | La eliminación se ejecuta (sin redistribución); `isGameOver` detecta 0 equipos activos y cierra la partida como `finalizada_sin_ganador` |
| Eliminación por warnings → 1 equipo activo restante | Redistribución al único equipo activo; `isGameOver` devuelve true con ese equipo como ganador (recibe todas las cartas del eliminado) |
| El equipo en turno activo acumula su 3er warning | El coordinator elimina al equipo, redistribuye cartas y avanza el turno al siguiente equipo activo sin procesar nueva acción para el eliminado |
| Múltiples eventos de penalización elegibles en un mismo turno | Un único warning por turno (§3.2); se usa la prioridad de registro definida; los puntos negativos de todos los eventos se aplican igualmente |
| Equipo con 0 cartas en mano al ser eliminado por warnings | No hay cartas que redistribuir; `WarningEliminationRecord` registra `cartasRepartidas: 0` y `equiposReceptores: []`; el juego continúa normalmente |
| Dos equipos alcanzan el umbral de warnings en el mismo turno | Imposible: solo el equipo activo en ese turno puede generar una infracción. Los warnings son por turno; no hay turnos simultáneos |
| Equipo con 2 warnings hace una acusación incorrecta | Eliminación estándar (`EVT_WRONG_ACCUSATION`); los warnings se congelan en 2; no se aplica redistribución de cartas ni `EVT_WARNING_ELIMINATION` |

---

## 13. Orden de implementación

| Orden | Tarea | Archivo(s) | Dependencias |
|---|---|---|---|
| 1 | Extender tipos: `EquipoState`, `ScoreEventType`, `GameAction`, `ApplyActionResult` | `src/lib/game/types.ts` | — |
| 2 | Implementar `applyWarningElimination()` con tests unitarios completos | `src/lib/game/engine.ts`, `src/tests/game-engine.test.ts` | Paso 1 |
| 3 | Actualizar `applyAction()` para enrutar `'warning_elimination'` | `src/lib/game/engine.ts` | Paso 2 |
| 4 | Añadir columnas `warnings`, `eliminacionRazon` a `partidaEquipos` en schema Drizzle | `src/lib/db/schema.ts` | — |
| 5 | Crear tabla `warning_eliminaciones` en schema Drizzle | `src/lib/db/schema.ts` | Paso 4 |
| 6 | Generar y aplicar migración | `npm run db:generate && npm run db:migrate` | Pasos 4–5 |
| 7 | Actualizar el coordinador (`advance-turn`) para detectar infracciones e invocar `applyWarningElimination` | `src/app/api/games/[id]/advance-turn/route.ts` | Pasos 2–6 |
| 8 | Actualizar `auto-run.ts` si la lógica de warnings no está centralizada en el coordinador base | `src/lib/game/auto-run.ts` | Paso 7 |
| 9 | Añadir eventos WebSocket `warning_issued` / `agent_warning_eliminated` | `src/lib/game/` (emisión de eventos) | Paso 7 |
| 10 | Actualizar `getGameStateView` para incluir `warnings` y `eliminadoPorWarnings` en la vista | `src/lib/game/engine.ts` | Paso 1 |
| 11 | Actualizar prompts del agente para documentar el sistema de warnings | `src/lib/ai/prompts/play-turn.ts` | — |
| 12 | Actualizar UI: arena (espectador), admin y panel equipo | `src/components/game/`, `src/app/` | Paso 9 |

---

## 14. Preguntas abiertas

| ID | Pregunta | Impacto | Estado |
|---|---|---|---|
| OPENQ-G006-01 | ¿Debe `EVT_PASS` generar warning si se produce N veces consecutivas (pase abusivo sistemático) en lugar de nunca? | Diseño del sistema; requeuere umbral secundario | **Cerrada — No**: `EVT_PASS` nunca genera warning independientemente de la frecuencia; ver §3.1 |
| OPENQ-G006-02 | ¿El contador de warnings se resetea si la partida pasa por `pausado` y se reanuda? | Consistencia | **Cerrada — Sí**: el contador se resetea a 0 al ejecutar `POST /api/games/{id}/resume`; ver §3.2 |
| OPENQ-G006-03 | ¿Las cartas redistribuidas deberían también convertirse en conocimiento público (visibles en `GameStateView` para todos) además de ser asignadas al receptor privado? | Diseño del juego | **Cerrada — No**: las cartas redistribuidas son conocidas únicamente por el agente receptor; las reglas de confidencialidad de cartas aplican sin excepción; ver §4.3 |
| OPENQ-G006-04 | ¿Se debe incluir en el evento WebSocket `agent_warning_eliminated` las cartas específicas redistribuidas a cada equipo (para que el receptor las conozca sin esperar al siguiente `get_game_state`)? Requiere canal diferenciado por equipo o encriptación parcial del evento | UX del agente | Abierta |
| OPENQ-G006-05 | ¿El sistema de warnings aplica en partidas de entrenamiento (RFC F015) con la misma lógica, o se relaja el umbral (p.ej. 5 warnings) para facilitar el debug de agentes en desarrollo? | Experiencia de desarrollo | **Cerrada — Mismo criterio**: umbral de 3 warnings y misma lógica de eliminación en partidas de entrenamiento y competición |
