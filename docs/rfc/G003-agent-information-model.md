# RFC G003 — Modelo de información pública/privada en la interacción con el agente

| Campo | Valor |
|---|---|
| **ID** | G003 |
| **Título** | Análisis y corrección del modelo de información pública/privada en la interacción agente-motor |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-02-28 |
| **Refs. spec** | [20-conceptualizacion](../../clue-arena-spec/docs/spec/20-conceptualizacion.md) · [60-backend](../../clue-arena-spec/docs/spec/60-backend.md) · [10-requisitos-funcionales](../../clue-arena-spec/docs/spec/10-requisitos-funcionales.md) |
| **Deps.** | RFC F007 (motor de juego) · RFC F006 (agente local Genkit) · RFC G001 (puntuación) · RFC G002 (pase voluntario) |
| **Archivos clave** | `src/lib/game/engine.ts` · `src/lib/game/types.ts` · `src/lib/mcp/tools/get-game-state.ts` · `src/lib/ai/prompts/play-turn.ts` · `src/lib/ai/prompts/refute.ts` |

---

## 1. Resumen

Este RFC analiza exhaustivamente qué información debe ser **pública** (visible para todos los agentes), **privada** (visible solo para el equipo propietario) o **secreta** (nunca expuesta a ningún agente) según las reglas del Cluedo real, contrasta ese modelo con la implementación actual de Clue Arena y determina las brechas existentes.

El análisis revela **un fallo crítico** y **tres gaps** en la información entregada al agente:

| Severidad | Hallazgo | Efecto |
|---|---|---|
| 🔴 CRÍTICO | `get-game-state.ts` pasa siempre `historial: []` | El agente recibe historial vacío → deducción imposible |
| 🟡 GAP | `GameStateView` no incluye `numCartas` del oponente | El agente no sabe cuántas cartas tiene cada rival |
| 🟡 GAP | `GameStateView` no incluye `turnosJugados` por equipo | El agente no puede inferir el progreso de cada rival |
| 🟢 INFO | Perspectiva del refutador en el historial | El agente que refutó no ve qué carta mostró en turnos previos |

Se proponen los cambios necesarios para que la información que el agente recibe sea **completa, correcta y fiel al reglamento del Cluedo real**.

---

## 2. Taxonomía de información en el Cluedo real

### 2.1 Fundamentos del modelo de información

El Cluedo es un juego de **información parcialmente oculta**. Cada jugador dispone de una libreta de detective donde anota sus deducciones. La partida progresa por reducción progresiva del espacio de soluciones. El reglamento establece tres niveles de visibilidad:

#### Información SECRETA (nunca visible a ningún jugador)
| Dato | Razón |
|---|---|
| Contenido del sobre secreto (sospechoso + arma + habitación) | Es la solución a descubrir; revelarlo antes terminaría el juego |

#### Información PRIVADA (solo el propietario la ve)
| Dato | Razón |
|---|---|
| Cartas en mano propias | Garantía de que solo tú sabes qué puedes refutar |
| Qué carta específica te mostró el refutador de tu sugerencia | Solo tú y el refutador saben qué carta se mostró |
| Qué carta específica mostraste tú al refutar una sugerencia | Solo tú y el sugeridor lo saben |

#### Información PÚBLICA (todos la ven en tiempo real)
| Dato | Razón |
|---|---|
| La tripla completa de cada sugerencia (sospechoso, arma, habitación) | Las sugerencias se realizan en voz alta |
| Quién realizó la sugerencia | Implícito (es el turno de ese jugador) |
| Quién refutó (primera persona en orden de rotación que pudo) | Todos ven a quién le pregunta el sugeridor |
| Si nadie pudo refutar | Todos ven que el sobre pasa sin refutación |
| Número de cartas en mano de cada jugador | Las cartas se reparten y cuentan visiblemente |
| Si un jugador pasó o fue eliminado | Acción o estado visible en la mesa |
| Acusaciones realizadas y si fueron correctas | Las acusaciones se verifican con el sobre en público |

#### Información DEDUCIBLE con lógica (no directa, pero legítima)
| Dato | Cómo se deduce |
|---|---|
| Los jugadores entre el sugeridor y el refutador (rotación) **no tienen** ninguna de las 3 cartas | La refutación es obligatoria; si pudieran, habrían refutado primero |
| Si nadie refuta: ningún jugador tiene ninguna de las 3 cartas (están en el sobre) | Combinando el hecho de que la refutación es obligatoria y nadie lo hizo |

### 2.2 Asimetría del refutador

Un aspecto frecuentemente ignorado es la **asimetría interna a la refutación**:

- El **sugeridor** sabe QUÉ carta concreta le mostró el refutador (pista directa).
- El **refutador** sabe qué carta mostró (la eligió él), pero no necesita que se lo digan.
- El **resto de jugadores** NO saben qué carta se mostró, solo que alguien refutó.

Este modelo de tres perspectivas distintas dentro del mismo evento es el núcleo del razonamiento deductivo en Cluedo.

---

## 3. Análisis de la implementación actual

### 3.1 Flujo de información al agente

El flujo completo de entrega de información al agente sigue esta cadena:

```
coordinador.ts
  └─ invokeAgent(AgentRequest) [play_turn | refute]
       └─ local-agent.ts / mattin.ts
            │
            ├─ loggedGetGameState({ game_id, team_id })
            │    └─ get-game-state.ts::handler()
            │         ├─ builds partial GameState from DB (!! historial: [] siempre !!)
            │         └─ engine.ts::getGameStateView(state, team_id) → GameStateView
            │
            ├─ loggedGetAgentMemory({ game_id, team_id })
            │    └─ agent-memory.ts::getAgentMemory() → Record<string,unknown>
            │
            └─ prompt = SYSTEM_PROMPT + gameStateJson + memoryJson
                 └─ ai.generate() → AgentResponse (action + memory)
```

### 3.2 Estructura actual de `GameStateView` (lo que el agente recibe)

```typescript
// src/lib/game/types.ts
export interface GameStateView {
  gameId: string;
  estado: string;
  turnoActual: number;            // índice circular del turno actual
  equipos: EquipoStateView[];
  historial: ActionRecordView[];  // ← siempre [] por el bug en get-game-state.ts
  esElTurnoDeEquipo: boolean;
}

export interface EquipoStateView {
  equipoId: string;
  orden: number;
  cartas: Carta[];   // propias: relleno; ajenas: siempre [] (correcto)
  esPropio: boolean;
  eliminado: boolean;
  puntos: number;
  // turnosJugados: ausente ← gap
  // numCartas: ausente ← gap
}

export interface ActionRecordView {
  turno: number;
  equipoId: string;
  tipo: 'suggestion' | 'accusation' | 'pass';
  sospechoso?: string;       // público (todas las sugerencias)
  arma?: string;             // público
  habitacion?: string;       // público
  refutadaPor?: string | null;  // público
  cartaMostrada?: Carta | null; // privado: solo si es el sugeridor
  correcta?: boolean;        // para acusaciones
  timestamp: number;
}
```

### 3.3 Hallazgos detallados

---

#### 🔴 HALLAZGO-01 — `historial: []` permanente en `get-game-state.ts`

**Descripción:**

`src/lib/mcp/tools/get-game-state.ts` construye manualmente un `GameState` parcial para pasárselo a `getGameStateView()`. El campo `historial` se inicializa siempre como array vacío:

```typescript
// src/lib/mcp/tools/get-game-state.ts (actual — INCORRECTO)
const state: GameState = {
  gameId: game_id,
  estado: partida.estado as GameState['estado'],
  turnoActual: partida.turnoActual,
  sobre: { sospechoso: '' as any, arma: '' as any, habitacion: '' as any },
  equipos: equipoRows.map((e) => ({
    equipoId: e.equipoId,
    orden: e.orden,
    cartas: JSON.parse(e.cartas),
    eliminado: e.eliminado,
    puntos: e.puntos,
    turnosJugados: 0,       // ← siempre 0
  })),
  historial: [],            // ← SIEMPRE VACÍO — bug crítico
  ganadorId: null,
  seed: 0,
};
```

**Impacto:**

El agente recibe invariablemente `"historial": []` en su contexto de partida. Consecuencias:

1. **El agente no puede saber qué sugerencias ha hecho él mismo** → no puede detectar sugerencias redundantes (penalización `EVT_REDUNDANT_SUGGESTION`: −20 pts) → penalizaciones evitables.
2. **El agente no sabe qué cartas se han revelado en sus turno previos** → no puede actualizar su espacio de deducción salvo que lo haya guardado en `memory`. La `memory` se vuelve esencial para paliar el bug, pero es frágil (el agente puede descartar o corromper su propia memoria entre turnos).
3. **El agente no sabe qué triplas han sugerido los rivales** → no puede deducir qué tienen o no tienen (información pública en Cluedo real).
4. **El agente no sabe si hubo acusaciones anteriores incorrectas** → no puede excluir combinaciones ya descartadas públicamente.

Este bug hace que en cada turno la IA parta prácticamente de cero, confiando todo el razonamiento acumulado en su `memory` auto-generada en lugar de en los hechos objetivos del juego.

**Causa raíz:**

El `get-game-state.ts` sólo consulta `partidas` y `partida_equipos`. Las tablas `sugerencias`, `acusaciones` y `pases` (donde se persiste el historial real) no se consultan para reconstruir el historial.

**Nota sobre `getGameStateView`:**

La función `getGameStateView()` en `engine.ts` **está correctamente implementada**: filtra `cartaMostrada` para que solo la vea el sugeridor. El problema es enteramente upstream, en `get-game-state.ts`.

---

#### 🟡 HALLAZGO-02 — `numCartas` del oponente ausente en `GameStateView`

**Descripción:**

En Cluedo real, el número de cartas en mano de cada jugador es visible (los mazos se reparten visiblemente). La `GameStateView` retorna `cartas: []` para equipos ajenos, pero **no incluye ningún campo que indique cuántas cartas tiene cada oponente**.

El tipo `GameTeamResponse` en `src/types/api.ts` sí incluye `numCartas` para la API REST pública:

```typescript
// src/types/api.ts — expuesto en la API pero NO en GameStateView
export interface GameTeamResponse {
  numCartas: number;   // Recuento público de cartas
  cartas?: string[];   // Solo para el equipo propietario o admin
}
```

Sin `numCartas`, el agente no puede realizar una deducción importante: si un oponente tiene pocas cartas, es más probable que sea el primero en poder refutar ciertas combinaciones (tiene menos rango de posibilidades para cubrir).

**Impacto:** Leve. El razonamiento sigue siendo válido sin este dato, pero es información pública en Cluedo que debería estar disponible.

---

#### 🟡 HALLAZGO-03 — `turnosJugados` por equipo ausente en `GameStateView`

**Descripción:**

`EquipoState` (tipo interno del motor) incluye `turnosJugados`, pero `EquipoStateView` (tipo expuesto al agente) **no lo incluye**. Además, `get-game-state.ts` inicializa `turnosJugados: 0` para todos los equipos, ignorando el valor real (que podría recuperarse del conteo de turnos en BD).

```typescript
// src/lib/game/types.ts
export interface EquipoState {
  turnosJugados: number;   // ← existe internamente
}

export interface EquipoStateView {
  // turnosJugados: ausente ← gap
}
```

**Impacto:** Moderado. El agente no puede saber en qué punto del juego está cada equipo. Dado que `turnoActual` es un índice circular (no un contador absoluto), el agente no tiene forma de saber cuántos turnos totales han transcurrido. Combinado con HALLAZGO-01 (historial vacío), el agente trabaja sin contexto temporal.

---

#### 🟢 HALLAZGO-04 — Perspectiva del refutador en el historial (información correcta pero incompleta)

**Descripción:**

Según `getGameStateView()` en `engine.ts`:

```typescript
// Solo revela cartaMostrada al equipo que hizo la sugerencia
cartaMostrada:
  r.equipoId === requestingTeamId ? res?.cartaMostrada ?? null : undefined,
```

Esta lógica es correcta para el jugador que **hizo la sugerencia** y para los **espectadores externos**. Sin embargo, en Cluedo real:

- El **refutador** también sabe qué carta mostró (la eligió activamente). No necesita que el sistema se la diga porque ya la tiene en mano, pero si la mostró en múltiples de sus propias refutaciones, no puede ver en el historial qué carta reveló en cada caso.

**Impacto:** Bajo-moderado. El agente-refutador puede inferir qué mostró porque conoce sus propias cartas, pero no tiene confirmación de cuál eligió mostrar en cada refutación anterior si tuvo múltiples opciones. Esto afecta a estrategias sofisticadas de gestión de revelación.

**Propuesta:** Añadir campo opcional `cartaMostradaPorMi` en `ActionRecordView` visible solo cuando `r.equipoId !== requestingTeamId && r.result?.refutadaPor === requestingTeamId`.

---

### 3.4 Tabla resumen: estado actual vs. Cluedo real

| Información | Visibilidad real | Implementación actual | Estado |
|---|---|---|---|
| Sobre secreto | Secreta | Nunca expuesta (`sobre: {...}` vacío en view) | ✅ Correcto |
| Cartas propias | Privada | Solo el equipo propio las ve | ✅ Correcto |
| Cartas de oponent. | Privada | `cartas: []` para ajenos | ✅ Correcto |
| Cantidad de cartas por equipo | Pública | Ausente en `GameStateView` | ❌ Gap |
| Sugerencias pasadas (tripla completa) | Pública | Correctamente filtrada, **pero historial vacío** | 🔴 Bug |
| Quién refutó | Pública | Correctamente incluido, **pero historial vacío** | 🔴 Bug |
| Carta concreta mostrada (al sugeridor) | Privada (solo sugeridor) | `cartaMostrada` solo para sugeridor | ✅ Correcto |
| Carta concreta mostrada (al resto) | Oculta | `cartaMostrada: undefined` | ✅ Correcto |
| Qué carta mostré yo al refutar | Privada (refutador) | No expuesta | 🟡 Info |
| Acusaciones y resultado | Pública | Correctamente incluido, **pero historial vacío** | 🔴 Bug |
| Eliminación de equipos | Pública | `eliminado: boolean` en EquipoStateView | ✅ Correcto |
| Turno actual (índice) | Pública | `turnoActual` + `esElTurnoDeEquipo` | ✅ Correcto |
| Turnos jugados por equipo | Pública | Ausente en `EquipoStateView` | ❌ Gap |
| Puntos acumulados | Clue Arena (público) | `puntos` en `EquipoStateView` | ✅ Correcto |
| Memoria persistente | Privada (agente propio) | `getAgentMemory` solo para el equipo | ✅ Correcto |

---

## 4. Cambios propuestos

### 4.1 Corrección crítica: reconstruir `historial` desde BD (HALLAZGO-01)

**Archivo afectado:** `src/lib/mcp/tools/get-game-state.ts`

El handler debe consultar las tablas `sugerencias`, `acusaciones` y `pases` para reconstruir el historial real y pasárselo a `getGameStateView()`.

```typescript
// src/lib/mcp/tools/get-game-state.ts — PROPUESTA

import { z } from 'zod';
import { db } from '@/lib/db';
import {
  partidas, partidaEquipos, turnos,
  sugerencias, acusaciones, pases,
} from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getGameStateView } from '@/lib/game/engine';
import type { GameState, ActionRecord } from '@/lib/game/types';
import type { Sospechoso, Arma, Habitacion } from '@/types/domain';

export const getGameStateTool = {
  schema: {
    game_id: z.string().describe('ID de la partida'),
    team_id: z.string().describe('ID del equipo solicitante'),
  },

  handler: async ({ game_id, team_id }: { game_id: string; team_id: string }) => {
    const partida = await db
      .select()
      .from(partidas)
      .where(eq(partidas.id, game_id))
      .get();
    if (!partida) throw new Error(`Partida ${game_id} no encontrada`);

    const equipoRows = await db
      .select()
      .from(partidaEquipos)
      .where(eq(partidaEquipos.partidaId, game_id))
      .all();

    const teamInGame = equipoRows.find((e) => e.equipoId === team_id);
    if (!teamInGame) throw new Error('El equipo no participa en esta partida');

    // ── Reconstruir historial desde BD ─────────────────────────────────────
    //
    // Cada turno tiene máximo UNA acción (suggestion | accusation | pass).
    // Consultamos los turnos en orden y cruzamos con sugerencias / acusaciones / pases.

    const turnoRows = await db
      .select()
      .from(turnos)
      .where(eq(turnos.partidaId, game_id))
      .orderBy(asc(turnos.numero))
      .all();

    const sugerenciaRows = await db
      .select()
      .from(sugerencias)
      .where(eq(sugerencias.partidaId, game_id))  // NOTA: requiere campo partidaId en sugerencias
      .all();
    // Índice por turnoId para O(1)
    const sugerenciaByTurno = new Map(sugerenciaRows.map((s) => [s.turnoId, s]));

    const acusacionRows = await db
      .select()
      .from(acusaciones)
      .where(eq(acusaciones.partidaId, game_id))
      .all();
    const acusacionByTurno = new Map(acusacionRows.map((a) => [a.turnoId, a]));

    const paseRows = await db
      .select()
      .from(pases)
      .where(eq(pases.partidaId, game_id))
      .all();
    const paseByTurno = new Map(paseRows.map((p) => [p.turnoId, p]));

    const historial: ActionRecord[] = [];
    const turnosJugadosByEquipo = new Map<string, number>();

    for (const turno of turnoRows) {
      if (turno.estado !== 'completado') continue; // skip turnos en curso o interrumpidos

      const equipoId = turno.equipoId;
      const turnoNum = turno.numero;
      const ts = turno.finishedAt?.getTime() ?? turno.startedAt?.getTime() ?? 0;

      // Incrementar contador de turnos jugados
      turnosJugadosByEquipo.set(equipoId, (turnosJugadosByEquipo.get(equipoId) ?? 0) + 1);

      const sug = sugerenciaByTurno.get(turno.id);
      if (sug) {
        historial.push({
          turno: turnoNum,
          equipoId,
          action: {
            type: 'suggestion',
            equipoId,
            sospechoso: sug.sospechoso as Sospechoso,
            arma: sug.arma as Arma,
            habitacion: sug.habitacion as Habitacion,
          },
          result: {
            refutadaPor: sug.refutadaPor ?? null,
            cartaMostrada: sug.cartaMostrada as any ?? null,
          },
          timestamp: ts,
        });
        continue;
      }

      const acu = acusacionByTurno.get(turno.id);
      if (acu) {
        historial.push({
          turno: turnoNum,
          equipoId,
          action: {
            type: 'accusation',
            equipoId,
            sospechoso: acu.sospechoso as Sospechoso,
            arma: acu.arma as Arma,
            habitacion: acu.habitacion as Habitacion,
          },
          result: { correcta: acu.correcta, ganador: acu.correcta ? equipoId : null },
          timestamp: ts,
        });
        continue;
      }

      const pase = paseByTurno.get(turno.id);
      if (pase) {
        historial.push({
          turno: turnoNum,
          equipoId,
          action: { type: 'pass', equipoId },
          result: null,
          timestamp: ts,
        });
      }
    }

    // ── Construir GameState completo ───────────────────────────────────────
    const state: GameState = {
      gameId: game_id,
      estado: partida.estado as GameState['estado'],
      turnoActual: partida.turnoActual,
      sobre: { sospechoso: '' as any, arma: '' as any, habitacion: '' as any }, // secreto
      equipos: equipoRows.map((e) => ({
        equipoId: e.equipoId,
        orden: e.orden,
        cartas: JSON.parse(e.cartas as string),
        eliminado: e.eliminado,
        puntos: e.puntos,
        turnosJugados: turnosJugadosByEquipo.get(e.equipoId) ?? 0, // reconstruido
      })),
      historial,  // ← reconstruido desde BD
      ganadorId: null,
      seed: 0,
    };

    const view = getGameStateView(state, team_id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(view) }] };
  },
};
```

**Precondición:** Las tablas `sugerencias`, `acusaciones` y `pases` tienen campo `partidaId` indexado. Revisar schema (ver §4.4).

---

### 4.2 Añadir `numCartas` y `turnosJugados` a `EquipoStateView` (HALLAZGO-02 y 03)

**Archivo afectado:** `src/lib/game/types.ts`

```typescript
// src/lib/game/types.ts — PROPUESTA (campos añadidos)
export interface EquipoStateView {
  equipoId: string;
  orden: number;
  cartas: Carta[];     // Propias rellenas; ajenas siempre []
  numCartas: number;   // NUEVO: número de cartas en mano (público en Cluedo real)
  esPropio: boolean;
  eliminado: boolean;
  puntos: number;
  turnosJugados: number; // NUEVO: cuántos turnos ha jugado este equipo
}
```

**Archivo afectado:** `src/lib/game/engine.ts` — `getGameStateView()`

```typescript
// src/lib/game/engine.ts — PROPUESTA (getGameStateView)
equipos: state.equipos.map((e) => ({
  equipoId: e.equipoId,
  orden: e.orden,
  cartas: e.equipoId === requestingTeamId ? e.cartas : [],
  numCartas: e.cartas.length,   // NUEVO: siempre expuesto
  esPropio: e.equipoId === requestingTeamId,
  eliminado: e.eliminado,
  puntos: e.puntos,
  turnosJugados: e.turnosJugados,  // NUEVO
})),
```

---

### 4.3 Añadir `cartaMostradaPorMi` para la perspectiva del refutador (HALLAZGO-04)

**Archivo afectado:** `src/lib/game/types.ts`

```typescript
// src/lib/game/types.ts — PROPUESTA (campo añadido a ActionRecordView)
export interface ActionRecordView {
  turno: number;
  equipoId: string;
  tipo: 'suggestion' | 'accusation' | 'pass';
  sospechoso?: string;
  arma?: string;
  habitacion?: string;
  refutadaPor?: string | null;
  cartaMostrada?: Carta | null;      // Privado: solo para el sugeridor
  cartaMostradaPorMi?: Carta | null; // NUEVO: privado: solo para el refutador
  correcta?: boolean;
  timestamp: number;
}
```

**Archivo afectado:** `src/lib/game/engine.ts` — `getGameStateView()`

```typescript
// En el bloque de 'suggestion' dentro de historial.map(...)
if (r.action.type === 'suggestion') {
  const res = r.result as SuggestionResult | null;
  return {
    ...base,
    sospechoso: r.action.sospechoso,
    arma: r.action.arma,
    habitacion: r.action.habitacion,
    refutadaPor: res?.refutadaPor ?? null,
    // Carta mostrada vista por el sugeridor (ya existente)
    cartaMostrada:
      r.equipoId === requestingTeamId ? res?.cartaMostrada ?? null : undefined,
    // NUEVO: carta que mostró el equipo solicitante cuando fue refutador
    cartaMostradaPorMi:
      res?.refutadaPor === requestingTeamId ? res?.cartaMostrada ?? null : undefined,
  };
}
```

---

### 4.4 Verificar presencia de `partidaId` en tablas de acciones (prerequisito)

Para que la consulta de historial sea eficiente, todas las tablas de acciones deben tener campo `partidaId` indexado. Verificar el schema actual:

- `sugerencias`: ver si tiene `partidaId` — si no, añadir.
- `acusaciones`: tiene `partidaId` (confirmado en `coordinator.ts` línea 647).
- `pases`: verificar.

Si `sugerencias` o `pases` no tienen `partidaId`, la alternativa es un JOIN con la tabla `turnos`:

```typescript
// Alternativa si falta partidaId en sugerencias:
const sugerenciaRows = await db
  .select({ ...sugerencias, turnoEquipoId: turnos.equipoId })
  .from(sugerencias)
  .innerJoin(turnos, eq(sugerencias.turnoId, turnos.id))
  .where(eq(turnos.partidaId, game_id))
  .all();
```

---

### 4.5 Actualizar type `AgentRequest` y prompts del agente (consecuencia)

Una vez que el historial esté disponible, el prompt del agente en `play-turn.ts` debe actualizarse para guiar al LLM sobre cómo interpretar los nuevos campos:

```typescript
// src/lib/ai/prompts/play-turn.ts — adiciones al SYSTEM_PROMPT

## Interpretación del historial de la partida
El campo "historial" en el estado contiene TODOS los turnos completados:
- tipo="suggestion": la tripla (sospechoso, arma, habitación) es pública.
  - "refutadaPor": equipo que refutó (tiene al menos una de las 3 cartas).
  - "cartaMostrada": solo presente en TUS sugerencias. Es la carta que te mostraron.
  - "cartaMostradaPorMi": solo presente cuando TÚ refutaste. Es la carta que mostraste.
  - Si "refutadaPor" es null: NADIE tiene esas 3 cartas → deben estar en el sobre.
- tipo="accusation": si "correcta" es false, esa tripla NO es la solución.
- tipo="pass": el equipo no hizo nada en ese turno.

Deducciones clave del historial (equipos entre sugeridor y refutador en orden):
- Si equipo A (orden=0) sugirió y equipo C (orden=2) refutó, el equipo B (orden=1)
  NO tiene ninguna de esas 3 cartas (la refutación es obligatoria y circula en orden).

## Información pública sobre rivals
Cada equipo en "equipos" incluye:
- "numCartas": número de cartas en mano (cuantas menos cartas, más concentradas sus posibilidades).
- "turnosJugados": cuántos turnos ha jugado (útil para inferir su progreso dedicativo).
```

---

## 5. Impacto en el modelo de datos

Revisar las siguientes tablas del schema Drizzle (`src/lib/db/schema.ts`):

| Tabla | Campo requerido | Acción |
|---|---|---|
| `sugerencias` | `partidaId` | Verificar existencia; añadir y migrar si no está |
| `pases` | `partidaId` | Verificar existencia; añadir y migrar si no está |
| `acusaciones` | `partidaId` | Ya presente (confirmado) |

Si se añaden campos, generar migración con `npm run db:generate` y aplicarla con `npm run db:migrate`.

También revisar que `sugerencias` incluye el campo `refutadaPor` (equipoId que refutó), ya que `get-game-state.ts` lo necesita para reconstruir `SuggestionResult`:

```typescript
// Verificar que sugerencias tiene:
// - turnoId (FK)
// - partidaId (FK)
// - sospechoso, arma, habitacion
// - refutadaPor (equipoId, nullable)
// - cartaMostrada (nullable)
```

---

## 6. Plan de implementación

| Paso | Tarea | Archivo | Prioridad |
|---|---|---|---|
| 1 | Verificar schema: `sugerencias.refutadaPor`, `sugerencias.partidaId`, `pases.partidaId` | `src/lib/db/schema.ts` | 🔴 Bloqueante |
| 2 | Añadir `numCartas` y `turnosJugados` a `EquipoStateView` y `maxTurnos` al `GameStateView` | `src/lib/game/types.ts` | 🟡 |
| 3 | Actualizar `getGameStateView()` | `src/lib/game/engine.ts` | 🟡 |
| 4 | Añadir `cartaMostradaPorMi` a `ActionRecordView` | `src/lib/game/types.ts` | 🟢 |
| 5 | Actualizar lógica de `cartaMostradaPorMi` en `getGameStateView()` | `src/lib/game/engine.ts` | 🟢 |
| 6 | **Reescribir `get-game-state.ts`** para reconstruir historial desde BD | `src/lib/mcp/tools/get-game-state.ts` | 🔴 Crítico |
| 7 | Actualizar `PLAY_TURN_SYSTEM_PROMPT` con guía de interpretación del historial | `src/lib/ai/prompts/play-turn.ts` | 🟡 |
| 8 | Actualizar tests unitarios del motor | `src/tests/game-engine.test.ts` | 🟡 |
| 9 | Test de integración del `get-game-state.ts` con historial real | `src/tests/` | 🟡 |

---

## 7. Criterios de aceptación

- [ ] **CA-01**: El agente recibe en `historial` todos los turnos completados de la partida, incluyendo las triplas de sugerencias, quién refutó y si las acusaciones fueron correctas.
- [ ] **CA-02**: `cartaMostrada` en una sugerencia es visible únicamente en los registros donde `equipoId === requestingTeamId`.
- [ ] **CA-03**: Los equipos ajenos tienen `cartas: []` pero `numCartas` refleja su recuento real.
- [ ] **CA-03b**: El `GameStateView` incluye el campo `maxTurnos` copiado del estado para que los agentes conozcan el límite de rondas.
- [ ] **CA-04**: `turnosJugados` de cada equipo es correcto (verificable comparando con el número de registros en `turnos` completados por equipo).
- [ ] **CA-05**: El sobre secreto nunca aparece en la `GameStateView` (campo vacío o ausente).
- [ ] **CA-06**: Los tests unitarios de `game-engine.test.ts` cubren `getGameStateView()` con historial poblado.
- [ ] **CA-07**: El prompt incluye instrucciones de interpretación del historial y los nuevos campos.

---

## 8. Dependencias y riesgos

| ID | Descripción | Impacto | Mitigación |
|---|---|---|---|
| RISK-01 | `sugerencias` o `pases` no tienen `partidaId` → JOIN con `turnos` necesario | Moderado (consulta más lenta pero funcional) | Alternativa JOIN ya documentada en §4.4 |
| RISK-02 | Historial largo (partidas con `maxTurnos` alto) → payload `GameStateView` grande | Bajo-moderado | Limitar historial a últimas N entradas o comprimir |
| RISK-03 | El `turnosJugados` reconstruido difiere del calculado por el motor puro | Bajo | Ambas fuentes son la misma tabla `turnos`; son equivalentes |
| RISK-04 | `cartaMostradaPorMi` expone a los espectadores la lógica de selección del refutador | Bajo | El campo solo se emite si `refutadaPor === requestingTeamId`; espectadores no hacen `get_game_state` |

---

## 9. Decisiones de diseño

### DECISION-01: Reconstruir historial en `get-game-state.ts` vs. cachear `GameState` en memoria

**Opciones consideradas:**
- **A) Reconstruir desde BD en cada llamada** (propuesta en este RFC): simple, consistente, sin estado extra.
- **B) Mantener `GameState` en memoria y actualizarlo en cada turno**: más rápido, pero requiere serialización, manejo de reinicios y concurrencia.

**Decisión:** Opción A para MVP. El número de turnos por partida es acotado (máx. `maxTurnos` configurable, típicamente ≤ 100). La reconstrucción desde BD es O(n_turnos) y negligible frente al tiempo de llamada al LLM.

### DECISION-02: Incluir o no el `ganadorId` en `GameStateView`

Se añade `ganadorId: null | string` a `GameStateView` para partidas finalizadas. En el contexto del agente esto es irrelevante (si hay ganador, la partida terminó y no se le invoca más), pero puede ser útil para logs y trazabilidad de la memory.

### DECISION-03: Visibilidad de los puntos de los rivales como información pública

Los puntos (`puntos`) son una adición de Clue Arena, no parte del Cluedo real. Se mantienen públicos (ya lo estaban) porque son el equivalente al marcador de la competición y su visibilidad incentiva el razonamiento competitivo.

---

## Apéndice A — Ejemplo de `GameStateView` esperado tras la corrección

```json
{
  "gameId": "game-abc123",
  "estado": "en_curso",
  "turnoActual": 2,
  "maxTurnos": 50,
  "equipos": [
    {
      "equipoId": "equipo-X",
      "orden": 0,
      "cartas": ["Coronel Mostaza", "Llave inglesa", "Cocina"],
      "numCartas": 3,
      "esPropio": true,
      "eliminado": false,
      "puntos": 25,
      "turnosJugados": 1
    },
    {
      "equipoId": "equipo-Y",
      "orden": 1,
      "cartas": [],
      "numCartas": 4,
      "esPropio": false,
      "eliminado": false,
      "puntos": 40,
      "turnosJugados": 2
    }
  ],
  "historial": [
    {
      "turno": 1,
      "equipoId": "equipo-Y",
      "tipo": "suggestion",
      "sospechoso": "Señora Pavo Real",
      "arma": "Revólver",
      "habitacion": "Biblioteca",
      "refutadaPor": "equipo-X",
      "timestamp": 1740700000000
    },
    {
      "turno": 1,
      "equipoId": "equipo-X",
      "tipo": "suggestion",
      "sospechoso": "Profesor Bromo",
      "arma": "Cuchillo",
      "habitacion": "Biblioteca",
      "refutadaPor": null,
      "cartaMostrada": null,
      "timestamp": 1740700005000
    }
  ],
  "esElTurnoDeEquipo": true
}
```

**Notas sobre el ejemplo:**
- La primera sugerencia (equipo-Y): `cartaMostrada` ausente porque equipo-X (el solicitante) fue el **refutador**, no el **sugeridor**. Añadir `cartaMostradaPorMi` si se implementa HALLAZGO-04.
- La segunda sugerencia (equipo-X): `refutadaPor: null` permite deducir que nadie tiene Profesor Bromo, Cuchillo o Biblioteca → están en el sobre.
- `numCartas: 4` para equipo-Y: el agente sabe que tiene más cartas que él mismo.

---

## Apéndice B — Resumen de información bloqueada por el bug actual

Sin la corrección de HALLAZGO-01, el agente **no puede deducir**:

1. Qué cartas no están en ninguna mano (porque nadie refutó → están en el sobre).
2. Qué combinaciones ya descartó el sistema (acusaciones incorrectas de rivales).
3. Si ya realizó una sugerencia exacta antes (riesgo `EVT_REDUNDANT_SUGGESTION`).
4. Qué cartas se mostraron en sus propios turnos anteriores.
5. El patrón de refutaciones para deducir qué tienen los rivales.

Todo este razonamiento está siendo delegado, sin garantías, al campo `memory` del agente. El agente puede perder, corromper o no generar su propia `memory`, haciendo el juego completamente no deductivo.
