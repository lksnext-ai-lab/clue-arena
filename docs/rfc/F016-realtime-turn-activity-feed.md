# RFC F016 — Feed de Actividad de Turno en Tiempo Real

| Campo | Valor |
|---|---|
| **ID** | F016 |
| **Título** | Feed de actividad de turno en tiempo real: micro-eventos del coordinador en la Arena |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-03-02 |
| **Refs. spec** | [40-arquitectura](../../clue-arena-spec/docs/spec/40-arquitectura.md) · [30-ui-spec §UI-005](../../clue-arena-spec/docs/spec/30-ui-spec.md) · [60-backend](../../clue-arena-spec/docs/spec/60-backend.md) · [10-requisitos-funcionales](../../clue-arena-spec/docs/spec/10-requisitos-funcionales.md) |
| **Deps.** | RFC F007 · RFC F009 · RFC F011 · RFC F012 · RFC G001 |

---

## 1. Resumen

Este RFC extiende la Arena (`/partidas/[id]`) con un **feed de actividad en tiempo real** que refleja los micro-eventos del coordinador dentro de cada turno: cuándo se solicita una acción a un equipo, cuándo responde, cuándo se pide refutación a otro equipo y cuándo se produce. Cada evento incluye un **timestamp de alta precisión** que permite calcular y mostrar tiempos de respuesta de los agentes.

El objetivo es doble:

1. **Dinamismo para el espectador**: la pantalla muestra actividad visual continua durante la ejecución de un turno —que puede durar varios segundos— en lugar de parecer bloqueada hasta que llega el `game:turn_completed` de F011.
2. **Trazabilidad de latencias**: registrar `durationMs` por micro-evento como base de datos para futuros criterios de puntuación (ver §7).

El diseño amplía el **protocolo WebSocket de F011** con cuatro nuevos tipos de mensaje `turn:*`, extiende el **`GameEventEmitter`** para emitir estos eventos desde el coordinador (F007), y añade un componente `<TurnActivityFeed>` en la Arena (F009).

---

## 2. Motivación

### 2.1 Problema actual

El mecanismo WebSocket de F011 emite un único evento por turno completo (`game:turn_completed`). Durante la ejecución real de un turno el coordinador realiza hasta cuatro operaciones secuenciales con latencias individuales:

```
Coordinador                     Agente activo              Agente(s) refutador(es)
    │                               │                               │
    │── invokeAgent(AgentRequest) ──▶│  ← tiempo de respuesta A     │
    │                               │                               │
    │◀── AgentResponse (sugerencia) ─│                               │
    │                                                               │
    │── invokeAgent(RefutaciónReq) ─────────────────────────────────▶│
    │                                                               │
    │◀── AgentResponse (refutación / no_refutación) ────────────────│
    │                                                               │
  persiste turno + emite game:turn_completed
```

Hasta que no llega el `game:turn_completed` la UI no muestra ninguna señal de actividad. Con agentes que pueden tardar 2–10 s en responder (LLM inference + MCP round-trip) la pantalla parece congelada, lo que reduce el interés del espectador.

### 2.2 Oportunidad

Los tiempos de respuesta son **dato natural** del proceso de coordinación. Capturarlos con timestamps de `Date.now()` no requiere instrumentación adicional costosa y permite:

- Mostrar en la UI un indicador animado "esperando respuesta de AgentName…" con cronómetro.
- Calcular `durationMs` por micro-evento y exponerlo en el feed como dato de interés para el espectador.
- Acumular estos datos como base para un futuro criterio de eficiencia temporal en G001 (ver §7).

---

## 3. Modelo de micro-eventos de turno

### 3.1 Los cuatro micro-eventos

| ID Evento | Descripción | Emitido por | Incluye `durationMs` |
|---|---|---|---|
| `turn:agent_invoked` | El coordinador envía la solicitud de turno al agente activo | Coordinador, antes de `invokeAgent` | No (inicio del intervalo) |
| `turn:agent_responded` | El agente activo devuelve su `AgentResponse` al coordinador | Coordinador, tras recibir respuesta | Sí (tiempo de `invokeAgent`) |
| `turn:refutation_requested` | El coordinador solicita refutación a uno o más agentes | Coordinador, antes de invocar refutadores | No (inicio del intervalo) |
| `turn:refutation_received` | Un agente refutador devuelve su decisión al coordinador | Coordinador, tras recibir cada respuesta de refutación | Sí (tiempo por refutador) |

> **Nota**: en un turno de tipo `acusacion` no se emite `turn:refutation_requested` ni `turn:refutation_received`. En un turno cuya sugerencia no tiene candidatos refutadores (ningún equipo tiene alguna de las tres cartas) tampoco se emiten los eventos de refutación.

### 3.2 Secuencia completa de eventos para un turno con sugerencia refutada

```
WS broadcast ──▶ clientes

turn:agent_invoked          {turnoId, equipoId="T1", accion="sugerencia"}
                                            ↓ (2 300 ms después)
turn:agent_responded        {turnoId, equipoId="T1", accion="sugerencia", durationMs=2300}
                                            ↓
turn:refutation_requested   {turnoId, refutadoresIds=["T3"]}
                                            ↓ (1 100 ms después)
turn:refutation_received    {turnoId, equipoId="T3", resultado="refutada", durationMs=1100}
                                            ↓
game:turn_completed         {turnoNumero, equipoId="T1", resultadoTipo="sugerencia", ...}
```

### 3.3 Secuencia para turno con acusación correcta (sin refutación)

```
turn:agent_invoked          {turnoId, equipoId="T2", accion="acusacion"}
                                            ↓ (3 700 ms después)
turn:agent_responded        {turnoId, equipoId="T2", accion="acusacion", durationMs=3700}
                                            ↓
game:turn_completed         {turnoNumero, equipoId="T2", resultadoTipo="acusacion_correcta", ...}
game:status_changed         {nuevoEstado="finalizada"}
```

---

## 4. Extensión del protocolo WebSocket (F011)

### 4.1 Nuevos schemas Zod en `src/lib/ws/protocol.ts`

```typescript
// Añadir al discriminatedUnion de ServerMessageSchema:

// El coordinador solicita turno al agente activo
z.object({
  type: z.literal('turn:agent_invoked'),
  gameId: z.string(),
  turnoId: z.string(),            // UUID del turno en curso (antes de persistir)
  turnoNumero: z.number(),
  equipoId: z.string(),
  equipoNombre: z.string(),
  ts: z.number(),
}),

// El agente activo ha respondido
z.object({
  type: z.literal('turn:agent_responded'),
  gameId: z.string(),
  turnoId: z.string(),
  turnoNumero: z.number(),
  equipoId: z.string(),
  equipoNombre: z.string(),
  accion: z.enum(['sugerencia', 'acusacion', 'pasar', 'timeout', 'formato_invalido']),
  // Presente cuando accion === 'sugerencia': expuesto al espectador para máximo dinamismo
  sugerencia: z.object({
    sospechoso: z.string(),
    arma: z.string(),
    habitacion: z.string(),
  }).optional(),
  durationMs: z.number(),
  ts: z.number(),
}),

// El coordinador solicita refutación a uno o más agentes
z.object({
  type: z.literal('turn:refutation_requested'),
  gameId: z.string(),
  turnoId: z.string(),
  turnoNumero: z.number(),
  equipoSugeridor: z.string(),    // equipoId del que propuso la sugerencia
  refutadoresIds: z.array(z.string()),  // equipoIds candidatos a refutar
  ts: z.number(),
}),

// Un agente refutador ha respondido
z.object({
  type: z.literal('turn:refutation_received'),
  gameId: z.string(),
  turnoId: z.string(),
  turnoNumero: z.number(),
  equipoId: z.string(),           // equipo refutador
  equipoNombre: z.string(),
  resultado: z.enum(['refutada', 'no_puede_refutar']),
  // Presente cuando resultado === 'refutada': carta mostrada al espectador
  cartaMostrada: z.string().optional(),
  durationMs: z.number(),
  ts: z.number(),
}),
```

> **Nota de privacidad**: la privacidad se mantiene **entre agentes** — ningún agente recibe en su `GameStateView` la carta que otro mostró. Sin embargo, el broadcast WebSocket destinado a los espectadores **sí incluye la carta concreta** (`cartaMostrada`) y el combo de sugerencia completo (`sugerencia`). El espectador humano debe poder seguir el razonamiento de la partida con toda la información disponible; esa es la experiencia que este RFC pretende construir.

### 4.2 Evento interno del `GameEventEmitter`

```typescript
// src/lib/ws/GameEventEmitter.ts — nuevo método

export type SugerenciaCombo = { sospechoso: string; arma: string; habitacion: string };

export type TurnMicroEvent =
  | { type: 'turn:agent_invoked';        gameId: string; turnoId: string; turnoNumero: number; equipoId: string; equipoNombre: string; ts: number }
  | { type: 'turn:agent_responded';      gameId: string; turnoId: string; turnoNumero: number; equipoId: string; equipoNombre: string; accion: string; sugerencia?: SugerenciaCombo; durationMs: number; ts: number }
  | { type: 'turn:refutation_requested'; gameId: string; turnoId: string; turnoNumero: number; equipoSugeridor: string; refutadoresIds: string[]; ts: number }
  | { type: 'turn:refutation_received';  gameId: string; turnoId: string; turnoNumero: number; equipoId: string; equipoNombre: string; resultado: 'refutada' | 'no_puede_refutar'; cartaMostrada?: string; durationMs: number; ts: number };

class GameEventEmitter extends EventEmitter {
  // ... métodos existentes ...

  emitTurnMicroEvent(event: TurnMicroEvent) {
    this.emit(`game:${event.gameId}:micro`, event);
  }

  onTurnMicroEvent(gameId: string, listener: (event: TurnMicroEvent) => void) {
    this.on(`game:${gameId}:micro`, listener);
    return () => this.off(`game:${gameId}:micro`, listener);
  }
}
```

---

## 5. Cambios en el coordinador (F007)

### 5.1 Puntos de emisión en `src/lib/game/coordinator.ts`

El coordinador sigue siendo lógica pura en su núcleo (`engine.ts`) pero el **orquestador** que lo envuelve (en el Route Handler o el servicio de ejecución de turnos) emite los micro-eventos **alrededor** de cada llamada a `invokeAgent`:

```typescript
// src/lib/game/coordinator.ts (pseudocódigo)

async function executeTurn(gameId: string, turno: TurnoState): Promise<TurnoResult> {
  const turnoId = crypto.randomUUID();
  const equipo = getEquipoActivo(turno);

  // ① Emitir solicitud de turno al agente activo
  gameEventEmitter.emitTurnMicroEvent({
    type: 'turn:agent_invoked',
    gameId, turnoId, turnoNumero: turno.numero,
    equipoId: equipo.id, equipoNombre: equipo.nombre,
    ts: Date.now(),
  });

  const tsInvoke = Date.now();
  let agentResponse: AgentResponse;

  try {
    agentResponse = await invokeAgent(buildAgentRequest(turno, equipo));
  } catch (err) {
    agentResponse = { accion: 'timeout' }; // normalizar timeout
  }

  const durationMs = Date.now() - tsInvoke;

  // ② Emitir respuesta del agente activo (incluye combo de sugerencia si aplica)
  gameEventEmitter.emitTurnMicroEvent({
    type: 'turn:agent_responded',
    gameId, turnoId, turnoNumero: turno.numero,
    equipoId: equipo.id, equipoNombre: equipo.nombre,
    accion: agentResponse.accion,
    // El combo se incluye aquí para que el espectador vea inmediatamente qué sugirió el agente
    sugerencia: agentResponse.accion === 'sugerencia' ? agentResponse.sugerencia : undefined,
    durationMs,
    ts: Date.now(),
  });

  // Solo si la acción es sugerencia y hay candidatos refutadores
  if (agentResponse.accion === 'sugerencia' && hayCandidatosRefutadores(turno)) {
    const refutadoresIds = getCandidatosRefutadores(turno, agentResponse.sugerencia!);

    // ③ Emitir solicitud de refutación
    gameEventEmitter.emitTurnMicroEvent({
      type: 'turn:refutation_requested',
      gameId, turnoId, turnoNumero: turno.numero,
      equipoSugeridor: equipo.id,
      refutadoresIds,
      ts: Date.now(),
    });

    // Invocar refutadores secuencialmente (reglas del Cluedo)
    for (const refutadorId of refutadoresIds) {
      const refutador = getEquipo(refutadorId);
      const tsRef = Date.now();
      const refutacion = await invokeRefutacion(refutador, turno, agentResponse.sugerencia!);
      const refDurationMs = Date.now() - tsRef;

      // ④ Emitir respuesta de cada refutador (carta visible para el espectador)
      gameEventEmitter.emitTurnMicroEvent({
        type: 'turn:refutation_received',
        gameId, turnoId, turnoNumero: turno.numero,
        equipoId: refutadorId,
        equipoNombre: refutador.nombre,
        resultado: refutacion.puedeRefutar ? 'refutada' : 'no_puede_refutar',
        // cartaMostrada se incluye en el broadcast WS para espectadores;
        // NO se incluye en el GameStateView que reciben otros agentes
        cartaMostrada: refutacion.puedeRefutar ? refutacion.cartaMostrada : undefined,
        durationMs: refDurationMs,
        ts: Date.now(),
      });

      // Si refutó con éxito, detener el ciclo (Cluedo: primera refutación es suficiente)
      if (refutacion.puedeRefutar) break;
    }
  }

  // Persist + emitir game:turn_completed (ya existente en F011)
  return buildTurnoResult(agentResponse, turno);
}
```

> **Sin cambios en `engine.ts`**: toda la emisión ocurre en el orquestador (`coordinator.ts`), que sí puede importar `gameEventEmitter`. El motor puro permanece sin I/O.

### 5.2 Registro de latencias en `durationMs` (F012 alignment)

Los micro-eventos `turn:agent_responded` y `turn:refutation_received` incluyen `durationMs`. El logger de F012 (`pino`) **también** debe registrar estos campos en las entradas `InteractionLogEntry` correspondientes. Se añade el campo `durationMs` a los tipos de log de F012:

```typescript
// Añadir a InvocacionEntry (F012) — ya tiene ts_invocada y ts_respuesta
durationMs: number;   // ts_respuesta - ts_invocada, calculado al loguear
```

---

## 6. UI: Componente `<TurnActivityFeed>`

### 6.1 Diseño y ubicación en la Arena (F009)

El feed se integra en la Arena como una **quinta zona** entre el feed de acciones (historial) existente y la cabecera de equipo activo. En pantallas ≥ 1280 px ocupa una franja horizontal en la parte inferior del panel izquierdo (debajo del panel de equipos); en móvil se muestra como una sección colapsable.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ CABECERA DE PARTIDA                                                      │
├──────────────────────┬──────────────────────────────────────────────────┤
│  PANEL DE EQUIPOS    │  TABLERO DE DEDUCCIÓN                            │
│  (F009 §3.2)         │  (F009 §3.2)                                     │
├──────────────────────┴──────────────────────────────────────────────────┤
│  ▶ ACTIVIDAD EN CURSO  [turno 7 · TeamAlpha]                 ← NUEVO   │
│  ─────────────────────────────────────────────────────────────────────  │
│  [T+0ms]   → Solicitando turno a TeamAlpha...                          │
│  [T+2 347ms] ✓ TeamAlpha respondió · Sugerencia  · 2 347 ms           │
│  [T+2 350ms] → Solicitando refutación a TeamBeta...                    │
│  [T+3 891ms] ✓ TeamBeta refutó  · 1 541 ms                            │
├──────────────────────────────────────────────────────────────────────── ┤
│  FEED DE ACCIONES (historial de turnos completados) — F009 §3.x        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Estados del feed

| Estado | Visual |
|---|---|
| **Esperando agente activo** | Fila animada con `animate-pulse` y texto "Solicitando turno a `<Nombre>`…" + cronómetro en curso |
| **Agente respondió (sugerencia)** | Fila con `✓` en `text-emerald-400` + combo completo: "sugiere: _Coronel Mostaza, Candelabro, Cocina_" + tiempo en ms |
| **Agente respondió (otros)** | Fila con `✓` en `text-emerald-400`, tipo de acción (`acusa`, `pasa`…), tiempo en ms |
| **Esperando refutador** | Fila animada "Solicitando refutación a `<Nombre>`…" + cronómetro |
| **Refutador respondió (refutó)** | Fila con `✓` en `text-amber-400` + "refutó con: _`<carta>`_" + tiempo |
| **Refutador respondió (no puede)** | Fila con `·` en `text-slate-500` + texto "no puede refutar" + tiempo |
| **Timeout** | Fila con `⏱` en `text-red-400` + "timeout · `<N>` ms" |
| **Turno completado** | El feed del turno activo se "sella" (fila de resumen) y desciende al historial |

### 6.3 Animación del cronómetro en curso

Mientras el feed espera una respuesta del agente, se muestra un cronómetro en tiempo real (`useInterval` de 100 ms actualizando el estado local). Este enfoque es puramente local al cliente: el servidor no envía actualizaciones intermedias mientras el agente está procesando.

```tsx
// src/components/game/TurnActivityFeed.tsx (sketch)
'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface TurnMicroEventUI {
  type: string;
  equipoNombre: string;
  accion?: string;
  resultado?: string;
  durationMs?: number;
  ts: number;
}

interface TurnActivityFeedProps {
  turnoNumero: number;
  events: TurnMicroEventUI[];
  isCompleted: boolean;
}

export function TurnActivityFeed({ turnoNumero, events, isCompleted }: TurnActivityFeedProps) {
  const [elapsed, setElapsed] = useState(0);
  const lastEventTs = events.at(-1)?.ts ?? Date.now();

  useEffect(() => {
    if (isCompleted) return;
    const id = setInterval(() => setElapsed(Date.now() - lastEventTs), 100);
    return () => clearInterval(id);
  }, [lastEventTs, isCompleted]);

  return (
    <div className="rounded-md border border-slate-700 bg-slate-800/60 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
        <span className={cn('h-2 w-2 rounded-full', isCompleted ? 'bg-slate-500' : 'bg-cyan-400 animate-pulse')} />
        {isCompleted ? `Turno ${turnoNumero} completado` : `Turno ${turnoNumero} · en curso`}
      </div>
      <ol className="space-y-1">
        {events.map((ev, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <span className="w-20 shrink-0 text-right font-mono text-slate-500 text-xs">
              {ev.durationMs != null ? `${ev.durationMs} ms` : `+${elapsed} ms`}
            </span>
            <EventRow ev={ev} />
          </li>
        ))}
        {!isCompleted && <WaitingRow elapsed={elapsed} />}
      </ol>
    </div>
  );
}
```

### 6.4 Integración con `GameContext`

`GameContext` ya gestiona el ciclo de vida del WebSocket (F011). Se amplía para acumular los micro-eventos del turno activo en un estado local:

```typescript
// src/contexts/GameContext.tsx — adiciones

interface TurnActivityState {
  turnoId: string | null;
  turnoNumero: number | null;
  events: TurnMicroEventUI[];
  isCompleted: boolean;
}

// Dentro del handler de mensajes WS:
case 'turn:agent_invoked':
case 'turn:agent_responded':
case 'turn:refutation_requested':
case 'turn:refutation_received':
  dispatch({ type: 'TURN_MICRO_EVENT', payload: msg });
  break;

case 'game:turn_completed':
  dispatch({ type: 'TURN_COMPLETED', payload: msg });
  // Sellar el feed del turno activo → historial
  break;
```

El estado `TurnActivityState` se expone por `GameContext` como `currentTurnActivity` para que `<TurnActivityFeed>` pueda consumirlo sin propagar props desde la raíz.

### 6.5 Persistencia visual del historial de actividad

Al completarse un turno (`game:turn_completed`), el feed activo se transforma en una entrada sellada del historial. Se guardan los últimos **N = 5 turnos** completos en el estado de `GameContext` para que el espectador pueda revisar la actividad reciente. Los turnos más antiguos se descartan del estado cliente (no hay paginación en tiempo real; el historial completo sigue disponible en el `game:state` al reconectar).

---

## 7. Tiempos de respuesta y sistema de puntuación (G001)

### 7.1 Estado actual de G001

G001 nota explícitamente:

> "La latencia de respuesta del agente dentro del turno **no genera bonificación ni penalización propia**: el turno debe completarse dentro del timeout establecido (si no, se emite `EVT_TIMEOUT`)."

### 7.2 Propuesta para futura iteración

Con los `durationMs` ahora registrados de forma fiable por turno y micro-evento, se propone considerar en una revisión futura de G001 los siguientes criterios opcionales:

| Criterio | Métrica | Propuesta de impacto |
|---|---|---|
| **Velocidad media de respuesta** | Media de `durationMs` por `turn:agent_responded` en la partida | Bonificación de eficiencia temporal sobre `EVT_WIN_EFFICIENCY` |
| **Velocidad de refutación** | Media de `durationMs` por `turn:refutation_received` | Pequeña bonificación (±5 pts) por refutación rápida |
| **Consistencia de respuesta** | Desviación estándar baja de `durationMs` | Indicador de calidad de implementación del agente |

> **DECISION**: la incorporación de latencia al sistema de puntuación queda para la revisión de G001 en la siguiente iteración. Se registra aquí para que G001 pueda tomar la decisión con datos reales tras el piloto. Ver `OPENQ-016-01`.

### 7.3 Almacenamiento de `durationMs`

Para habilitar el análisis post-evento y la posible integración con G001, los `durationMs` de `turn:agent_responded` y `turn:refutation_received` se persisten en las tablas Drizzle correspondientes:

```typescript
// src/lib/db/schema.ts — columnas adicionales en tabla `turnos`
agentDurationMs:      integer('agent_duration_ms'),          // durationMs de turn:agent_responded
refutacionDurationMs: integer('refutacion_duration_ms'),     // durationMs de turn:refutation_received (primer refutador exitoso)
```

Estas columnas son **nullable** (turnos de acusación no tienen refutación; timeouts producen `durationMs` igual al valor del timeout configurado).

---

## 8. Árbol de ficheros nuevos / modificados

```
src/
├── lib/
│   ├── ws/
│   │   ├── GameEventEmitter.ts     ← MODIFICADO  nuevo método emitTurnMicroEvent + tipo TurnMicroEvent
│   │   └── protocol.ts             ← MODIFICADO  cuatro nuevos tipos de ServerMessage (turn:*)
│   ├── game/
│   │   └── coordinator.ts          ← MODIFICADO  emisión de micro-eventos en executeTurn
│   └── db/
│       └── schema.ts               ← MODIFICADO  columnas agentDurationMs, refutacionDurationMs en turnos
├── components/
│   └── game/
│       └── TurnActivityFeed.tsx    ← NUEVO       componente de feed animado
├── contexts/
│   └── GameContext.tsx             ← MODIFICADO  acumulación de currentTurnActivity
└── app/
    └── partidas/[id]/
        └── page.tsx                ← MODIFICADO  integración de <TurnActivityFeed> en el layout
```

---

## 9. Consideraciones de rendimiento y privacidad

### 9.1 Volumen de mensajes

| Escenario | Mensajes WS adicionales por turno |
|---|---|
| Turno de tipo `pasar` / `timeout` / `acusacion` | 2 (`turn:agent_invoked` + `turn:agent_responded`) |
| Turno con sugerencia sin candidatos refutadores | 2 |
| Turno con sugerencia y 1 refutador | 4 |
| Turno con sugerencia y N refutadores (hasta 5) | 2 + N (máx. 7) |

Con el número máximo de equipos (6) y partidas de 24 turnos el volumen sigue siendo bajo: ≤ 168 mensajes adicionales por partida. Con los ~100 espectadores esperados el throughput resultante es despreciable.

### 9.2 Privacidad: agentes vs. espectadores

La privacidad opera en **dos planos distintos** que este RFC no debe confundir:

| Plano | Criterio | Aplicación |
|---|---|---|
| **Entre agentes** | Un agente nunca ve las cartas de otro ni el contenido del sobre | Se garantiza en `getGameStateView()` dentro de `engine.ts` (F007). No afecta a los mensajes WS. |
| **Agentes vs. espectadores** | Los espectadores humanos pueden ver toda la información de la partida | Los mensajes `turn:*` incluyen `cartaMostrada` y el combo de `sugerencia` en el broadcast WS. |

En consecuencia:

- `turn:agent_responded` **incluye el combo completo** (`sospechoso`, `arma`, `habitación`) cuando la acción es `sugerencia`. El espectador ve de inmediato qué propone el agente activo.
- `turn:refutation_received` **incluye `cartaMostrada`** cuando `resultado === 'refutada'`. El espectador ve qué carta usó el refutador para responder.
- Ninguno de estos campos llega al `GameStateView` que reciben los agentes rivales: son canales completamente separados (WS broadcast vs. respuesta `invokeAgent`).

### 9.3 Compatibilidad con partidas de entrenamiento (F015)

El área de entrenamiento también se beneficia de este feed: el equipo puede ver en tiempo real los tiempos de respuesta de su propio agente durante la ejecución de cada turno de práctica. El `TurnActivityFeed` es reutilizable siempre que `GameContext` esté disponible; la vista de entrenamiento puede incluirlo sin cambios adicionales al componente.

---

## 10. Preguntas abiertas

| ID | Pregunta | Impacto | Bloquea |
|---|---|---|---|
| OPENQ-016-01 | ¿Se incorpora `durationMs` al sistema de puntuación G001? | Alto (requiere cambios en fórmula y UI de ranking) | Revisión de G001 |
| ~~OPENQ-016-02~~ | ~~¿`turn:agent_responded` incluye el combo de sugerencia completo?~~ | **Resuelta** (§9.2): sí se incluye; la privacidad aplica entre agentes, no hacia espectadores. | — |
| OPENQ-016-03 | ¿Los micro-eventos se emiten también en partidas de entrenamiento (F015)? | Bajo (reutilización sin coste adicional) | — |
| OPENQ-016-04 | ¿Se guarda el historial de micro-eventos en BD para análisis post-evento? | Medio (tabla adicional vs. JSON lines en log pino/F012) | Decisión de arquitectura de datos |

---

## 11. Criterios de aceptación (DoD)

- [ ] **Protocolo WS**: los cuatro tipos `turn:*` están definidos en `protocol.ts` con schema Zod y validados al serializar/deserializar.
- [ ] **Coordinador**: `coordinator.ts` emite los cuatro micro-eventos en el orden correcto para todos los tipos de turno (sugerencia con/sin refutación, acusación, pasar, timeout).
- [ ] **Sin cambios en `engine.ts`**: la lógica pura del motor no importa ni usa `gameEventEmitter`.
- [ ] **`TurnActivityFeed`**: el componente muestra las cuatro filas posibles con los estilos correctos y el cronómetro animado mientras hay un evento pendiente de respuesta.
- [ ] **Cronómetro**: se detiene exactamente al recibir `turn:agent_responded` o `turn:refutation_received`; no hay deriva visual.
- [ ] **Sellado al completar**: al recibir `game:turn_completed` el feed activo se sella y el estado `isCompleted` pasa a `true`; el cronómetro se detiene.
- [ ] **Historial**: se conservan los últimos 5 turnos completados en `GameContext` y son visibles en la Arena.
- [ ] **Privacidad entre agentes**: `cartaMostrada` y el combo de `sugerencia` no aparecen en el `GameStateView` que reciben los agentes rivales (garantizado en `engine.ts`); sí aparecen en el broadcast WS a espectadores.
- [ ] **`durationMs` persistido**: las columnas `agentDurationMs` y `refutacionDurationMs` se rellenan correctamente al persistir el turno en Drizzle.
- [ ] **Test unitario**: `coordinator.ts` tiene tests que verifican la secuencia y contenido de las emisiones de micro-eventos para cada tipo de turno.
- [ ] **Migración DB**: `npm run db:generate` produce una migración con las dos nuevas columnas nullable.

---

## 12. Fuentes

| URL | Fecha | Qué se extrajo |
|---|---|---|
| RFC F007 (interno) | 2026-03-02 | Arquitectura del coordinador, fachada `invokeAgent`, flujo de refutación |
| RFC F009 (interno) | 2026-03-02 | Layout y zonas visuales de la Arena, convenciones de estilos Tailwind |
| RFC F011 (interno) | 2026-03-02 | Protocolo WebSocket existente, `GameEventEmitter`, `ServerMessageSchema` |
| RFC F012 (interno) | 2026-03-02 | Modelo de log de interacción, campo `durationMs`, integración con `pino` |
| RFC G001 (interno) | 2026-03-02 | Nota explícita sobre latencia fuera del sistema de puntuación actual; base para OPENQ-016-01 |
