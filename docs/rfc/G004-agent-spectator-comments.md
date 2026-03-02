# RFC G004 — Comentarios del Agente para Espectadores

| Campo | Valor |
|---|---|
| **ID** | G004 |
| **Título** | Comentarios del agente dirigidos a espectadores: razonamiento público por turno |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-03-02 |
| **Refs. spec** | [30-ui-spec §UI-005](../../clue-arena-spec/docs/spec/30-ui-spec.md) · [10-requisitos-funcionales](../../clue-arena-spec/docs/spec/10-requisitos-funcionales.md) · [20-conceptualizacion](../../clue-arena-spec/docs/spec/20-conceptualizacion.md) |
| **Deps.** | RFC F006 · RFC F007 · RFC F009 · RFC F011 · RFC F016 · RFC G003 |

---

## 1. Resumen

Este RFC introduce el campo opcional `spectatorComment` en el contrato del agente (`AgentResponse`), proporcionando un **comentario breve en lenguaje natural** que el agente puede añadir a su decisión de turno (o de refutación) con el único propósito de que los espectadores humanos comprendan el razonamiento que hay detrás de la jugada.

El comentario se diferencia del campo `reasoning` existente (verboso, para logs internos) en que está **pensado para ser leído en pantalla**: es corto (≤ 160 caracteres), está escrito en primera persona del agente y puede ser visto por todos los presentes en la sala durante el evento.

El comentario aparece en dos lugares de la Arena (`/partidas/[id]`):

1. **Banner temporal en la cabecera de la partida** (`ArenaHeader`): se muestra como una cita animada durante ~8 s tras recibir la respuesta del agente, luego desaparece con una transición de fundido.
2. **Feed de acciones** (`ArenaActionFeed`): se añade como línea de cita secundaria debajo de la entrada de turno o refutación, persistente en el historial.

El diseño prolonga el pipeline existente sin romper contratos: agentes que no implementen el campo simplemente no generarán comentarios, y la UI degrada elegantemente mostrando solo la información de acción ya existente.

---

## 2. Motivación

### 2.1 Contexto del evento

Clue Arena está concebida como una **competición presencial** en la que los espectadores siguen la partida en tiempo real en una pantalla compartida. El interés del evento depende en gran medida de que el público pueda entender no solo *qué* hace cada agente, sino *por qué* lo hace.

La `AgentResponse` ya transporta un campo `reasoning: string` generado por el LLM, pero:

| Limitación | Detalle |
|---|---|
| Verbosidad | El razonamiento interno del LLM puede tener varios párrafos de cadena de pensamiento, token por token; no es apto para pantalla |
| Orientación técnica | Habla de "probabilidades", "descarte de hipótesis", "herramientas MCP"… en términos de debug |
| Sin formato visual | Se usa solo en logs (F012) y en la vista de Admin; nunca se emite por WebSocket |
| No es narración | No está pensado para ser leído como frase coherente por un no-técnico |

El campo `spectatorComment` resuelve estos problemas: es un texto **corto, narrativo, en primera persona**, generado deliberadamente por el agente para el público.

### 2.2 Impacto en la experiencia del evento

Con `spectatorComment`:

- El espectador lee _"Sospecho que el arma está en la Cocina; mis deducciones previas descartan el Comedor y la Biblioteca."_ directamente en la cabecera de la pantalla, en el momento en que el agente actúa.
- El feed de acciones se convierte en una **narración del razonamiento colectivo** de todos los agentes a lo largo de la partida, consultable en cualquier momento.
- Los equipos cuyo agente explica bien sus decisiones reciben reconocimiento público, lo que añade una dimensión de comunicación al criterio de calidad del agente.

### 2.3 Separación diseñada de `reasoning` vs `spectatorComment`

| Campo | Propósito | Destino | Límite | Visibilidad |
|---|---|---|---|---|
| `reasoning` | Trazabilidad interna del LLM | Log pino (F012), Admin | Sin límite | Solo Admin |
| `spectatorComment` | Narración para el público | WS broadcast → Arena | 160 caracteres | Todos los espectadores |

---

## 3. Extensión del contrato del agente

### 3.1 `AgentResponse` — campo nuevo

```typescript
// src/types/api.ts

export interface AgentResponse {
  action: AgentAction;          // sin cambio
  reasoning: string;            // sin cambio (logs/debug internos)
  done: boolean;                // sin cambio
  /**
   * Comentario breve en lenguaje natural dirigido a los espectadores.
   * El agente puede omitirlo (undefined). Si se incluye:
   * - Máximo 160 caracteres (se trunca silenciosamente si el backend recibe más).
   * - Primera persona, tono narrativo, sin revelar información privada de cartas propias
   *   ni del sobre secreto (el motor valida esto; ver §8.1).
   */
  spectatorComment?: string;
}
```

**Retrocompatibilidad**: el campo es opcional. Los adaptadores existentes de MattinAI y Genkit (`invokeAgent`) continúan funcionando sin cambio; la ausencia de `spectatorComment` produce `undefined` y la UI omite el comentario sin error.

### 3.2 Contrato del adaptador de refutación

El flujo `refute` (F006 §3.5) también puede producir un comentario. La respuesta de refutación extiende igualmente:

```typescript
// El contrato de refutación usa AgentResponse con action.type ∈ { show_card, cannot_refute }
// spectatorComment es igual de opcional aquí.
// Ejemplos válidos:
//   "Tengo el Candelabro, así que puedo refutar sin revelar información clave."
//   "No tengo ninguna de las tres cartas; no puedo refutar."
```

### 3.3 Validación y sanitización en el coordinador

Antes de propagar `spectatorComment` al broadcast WebSocket, el coordinador aplica:

```typescript
// src/lib/game/coordinator.ts

function sanitizeSpectatorComment(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  // Truncar si supera el límite
  const truncated = trimmed.length > 160 ? trimmed.slice(0, 157) + '…' : trimmed;
  // Eliminar saltos de línea (el comentario debe ser una sola línea)
  return truncated.replace(/[\r\n]+/g, ' ');
}
```

> **Sin validación semántica de contenido en tiempo real**: el motor no puede verificar en el momento si el comentario revela información privada inapropiada (las cartas en mano del agente no deben mencionarse explícitamente). Esta responsabilidad recae en el **prompt del agente** (ver §4.2). Post-evento, el log de F012 permite auditar los comentarios si fuera necesario.

---

## 4. Cambios en el agente Genkit (F006)

### 4.1 Prompt `play_turn` — instrucciones de `spectatorComment`

El prompt de turno (`src/lib/ai/prompts/play-turn.ts`) debe incluir instrucciones explícitas para generar el campo. Se añade al final del prompt de sistema:

```
#### Campo spectatorComment (obligatorio en esta implementación)

Junto con tu decisión, genera una frase corta (máximo 160 caracteres) en primera persona
explicando tu razonamiento de forma narrativa para el público del evento. Esta frase
SERÁ VISIBLE EN PANTALLA para todos los espectadores.

Reglas:
- Primera persona del agente: "Sugiero…", "Descarto…", "Mi hipótesis actual es…"
- No menciones tus cartas específicas en mano ni el contenido del sobre.
- Haz referencia solo a información pública (historial de sugerencias, refutaciones vistas).
- Tono natural, como si explicaras tu jugada a un amigo que también está jugando.
- Si no tienes nada relevante que añadir, escribe una frase genérica antes que dejar el campo vacío.

Ejemplo (turno de sugerencia):
  "El Comedor no ha aparecido en refutaciones todavía; es la habitación más probable. Sugiero Coronel Mostaza."

Ejemplo (turno de acusación):
  "He descartado todas las combinaciones excepto una. Es el momento de acusar."
```

### 4.2 Prompt `refute` — instrucciones de `spectatorComment`

```
#### Campo spectatorComment (opcional pero recomendado)

Si tu equipo puede refutar, una frase breve (máx. 160 chars) confirmando que puedes hacerlo
sin revelar qué carta específica estás mostrando.
Si no puedes refutar, una frase confirmándolo.

Ejemplos:
  "Puedo refutar esta sugerencia." (cuando show_card)
  "No tengo ninguna de las cartas propuestas; paso sin poder refutar." (cannot_refute)
```

### 4.3 Construcción del `AgentResponse` desde Genkit

El esquema de salida del flujo Genkit se extiende:

```typescript
// src/lib/ai/flows/play-turn.ts y refute.ts

const AgentOutputSchema = z.object({
  action: AgentActionSchema,
  spectatorComment: z.string().max(200).optional(),  // 200 en schema (truncamos en coordinador)
});
```

El campo `spectatorComment` se mapea directamente a `AgentResponse.spectatorComment`.

---

## 5. Cambios en el coordinador (F007)

### 5.1 Propagación en `executeTurn`

```typescript
// src/lib/game/coordinator.ts — extracto modificado

// ② Emitir turn:agent_responded (F016) — añadir spectatorComment
gameEventEmitter.emitTurnMicroEvent({
  type: 'turn:agent_responded',
  ...existingFields,
  spectatorComment: sanitizeSpectatorComment(agentResponse.spectatorComment),
});

// ④ Emitir turn:refutation_received (F016) — añadir spectatorComment
gameEventEmitter.emitTurnMicroEvent({
  type: 'turn:refutation_received',
  ...existingFields,
  spectatorComment: sanitizeSpectatorComment(refutacion.spectatorComment),
});
```

### 5.2 Persistencia en BD

El comentario del agente se persiste en la tabla `turnos` para consulta post-evento y para el historial del feed:

```typescript
// src/lib/db/schema.ts — nuevas columnas en tabla `turnos`
agentSpectatorComment:     text('agent_spectator_comment'),       // comentario del agente activo
refutadorSpectatorComment: text('refutador_spectator_comment'),   // comentario del primer refutador que respondió
```

Ambas columnas son nullable (turnos sin comentario, acusaciones sin refutación…).

---

## 6. Extensión del protocolo WebSocket (F011)

### 6.1 Cambios en `src/lib/ws/protocol.ts`

Se añade el campo `spectatorComment` a los dos tipos de mensaje donde el agente ya ha respondido:

```typescript
// Modificar el tipo turn:agent_responded (F016):
z.object({
  type: z.literal('turn:agent_responded'),
  // ...campos existentes de F016...
  spectatorComment: z.string().max(160).optional(),   // ← NUEVO
}),

// Modificar el tipo turn:refutation_received (F016):
z.object({
  type: z.literal('turn:refutation_received'),
  // ...campos existentes de F016...
  spectatorComment: z.string().max(160).optional(),   // ← NUEVO
}),
```

> **Sin nuevos tipos de mensaje**: `spectatorComment` viaja en los mensajes `turn:agent_responded` y `turn:refutation_received` ya definidos en F016. No se introduce ningún tipo `turn:*` adicional.

---

## 7. UI: cambios en la Arena (F009)

### 7.1 Banner temporal en la cabecera (`ArenaHeader`)

Se añade una subzona de "comentario activo" debajo de la información de turno en la cabecera. Esta zona solo está visible cuando hay un `spectatorComment` pendiente de mostrar.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ CABECERA DE PARTIDA                                                      │
│  "Partida 1 — El Algoritmo Asesinado"         [● EN CURSO]              │
│  Turno 7 · Equipo activo: TeamAlpha            [▶ Auto] [⏭ Avanzar]   │
│ ─────────────────────────────────────────────────────────────────────── │
│  💬 TeamAlpha: "El Comedor es la habitación con menos apariciones.       │  ← NUEVO
│                 Sugiero Coronel Mostaza."                               │
└─────────────────────────────────────────────────────────────────────────┘
```

**Comportamiento del banner**:

| Activador | Acción |
|---|---|
| Recibir `turn:agent_responded` con `spectatorComment` | Mostrar banner con animación `fade-in` (200 ms) + efecto `slide-down` |
| Recibir `turn:refutation_received` con `spectatorComment` | Sustituir el banner anterior (si lo hubiera) con el nuevo comentario |
| Transcurrir 8 s sin nuevo comment | Ocultar con `fade-out` (500 ms) |
| Recibir `game:turn_completed` | Ocultar inmediatamente el banner |

**Ruta del componente**: el banner se implementa en `ArenaHeader` como estado local con `useEffect` y un `setTimeout` de 8 000 ms. No requiere cambios en `GameContext`.

```tsx
// src/components/game/ArenaHeader.tsx (sketch del banner)
'use client';

interface ActiveCommentBanner {
  equipoNombre: string;
  text: string;
  ts: number;
}

// Dentro del componente ArenaHeader:
const [activeComment, setActiveComment] = useState<ActiveCommentBanner | null>(null);

// Al recibir un micro-evento con spectatorComment desde GameContext:
useEffect(() => {
  if (!latestComment) return;
  setActiveComment(latestComment);

  const timer = setTimeout(() => setActiveComment(null), 8_000);
  return () => clearTimeout(timer);
}, [latestComment]);

// JSX:
{activeComment && (
  <div className={cn(
    'mt-2 flex items-start gap-2 rounded-md bg-slate-700/50 px-4 py-2 text-sm',
    'border-l-2 border-cyan-400 text-slate-200 animate-fade-in',
  )}>
    <span className="shrink-0 text-cyan-400">💬</span>
    <span>
      <span className="font-semibold text-cyan-300">{activeComment.equipoNombre}: </span>
      <span className="italic">"{activeComment.text}"</span>
    </span>
  </div>
)}
```

**Gestión del comentario desde `GameContext`**: `GameContext` expone un campo `latestSpectatorComment` que se actualiza al recibir `turn:agent_responded` o `turn:refutation_received` con `spectatorComment`. `ArenaHeader` lo consume y gestiona el ciclo de vida del banner de forma local.

```typescript
// src/contexts/GameContext.tsx — adiciones

interface LatestSpectatorComment {
  equipoId: string;
  equipoNombre: string;
  text: string;
  ts: number;
}

// En el estado global de GameContext:
latestSpectatorComment: LatestSpectatorComment | null;

// En el handler de mensajes WS:
case 'turn:agent_responded':
  if (msg.spectatorComment) {
    dispatch({
      type: 'SET_SPECTATOR_COMMENT',
      payload: {
        equipoId: msg.equipoId,
        equipoNombre: msg.equipoNombre,
        text: msg.spectatorComment,
        ts: msg.ts,
      },
    });
  }
  // + dispatch(TURN_MICRO_EVENT) ya existente de F016
  break;

case 'turn:refutation_received':
  if (msg.spectatorComment) {
    dispatch({
      type: 'SET_SPECTATOR_COMMENT',
      payload: {
        equipoId: msg.equipoId,
        equipoNombre: msg.equipoNombre,
        text: msg.spectatorComment,
        ts: msg.ts,
      },
    });
  }
  // + dispatch(TURN_MICRO_EVENT) ya existente de F016
  break;

case 'game:turn_completed':
  dispatch({ type: 'CLEAR_SPECTATOR_COMMENT' });
  // + dispatch(TURN_COMPLETED) ya existente de F016
  break;
```

### 7.2 Feed de acciones (`ArenaActionFeed`)

Cada entrada del feed de acciones puede mostrar una línea de cita adicional con el `spectatorComment` del agente. La línea es parte permanente del historial (no desaparece):

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FEED DE ACCIONES                                                         │
│                                                                          │
│  T7  ▶ TEAM ALPHA  →  Sugerencia                                        │
│        Coronel Mostaza · Candelabro · Comedor                           │
│        Refutada por TEAM GAMMA  +10 pts                                 │
│        💬 "El Comedor es la habitación con menos apariciones.            │  ← NUEVO
│            Sugiero Coronel Mostaza."                                    │
│                                                                          │
│  T7  ↩ TEAM GAMMA  →  Refutación                                        │
│        Resultado: refutada · carta: Comedor                             │
│        💬 "Puedo refutar; tengo una carta de esta sugerencia."          │  ← NUEVO
│                                                                          │
│  T6  ▶ TEAM GAMMA  →  Sugerencia                                        │
│        Coronel Mostaza · Revólver · Cocina                              │
│        No refutada  +30 pts                                             │
│                                                                          │  ← sin comentario → no hay línea
└─────────────────────────────────────────────────────────────────────────┘
```

**Representación visual de la cita**:

```tsx
// src/components/game/ArenaActionFeed.tsx (sketch)

{turno.agentSpectatorComment && (
  <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-400 italic">
    <span className="shrink-0 not-italic">💬</span>
    <span>"{turno.agentSpectatorComment}"</span>
  </p>
)}

{turno.refutadorSpectatorComment && (
  <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500 italic">
    <span className="shrink-0 not-italic">↩💬</span>
    <span>"{turno.refutadorSpectatorComment}"</span>
  </p>
)}
```

**Fuente de datos**: los comentarios persistidos (`agentSpectatorComment`, `refutadorSpectatorComment`) se devuelven como parte del historial de turnos en `GET /api/games/:id`. Se incluyen en el tipo `TurnoHistorial` (ya existente en `src/types/api.ts`).

### 7.3 Estados de degradación elegante

| Situación | Comportamiento |
|---|---|
| `spectatorComment` ausente (undefined) | No se muestra ni el banner ni la línea de cita en el feed |
| `spectatorComment` presente pero `""` (vacío tras sanitización) | Tratado como ausente |
| Comentario en idioma distinto al de la plataforma | Sin restricción; se muestra tal cual (es decisión del equipo) |
| Comentario con caracteres Unicode/emoji | Permitido; el truncado opera en puntos de código Unicode, no en bytes |

---

## 8. Privacidad y seguridad

### 8.1 Información que el comentario NO puede revelar

Por las reglas del Cluedo el agente conoce sus propias cartas pero no debe revelarlas públicamente. Solo las cartas que el refutador muestra al sugeridor están permitidas (y solo para el sugeridor, según G003 §2.2). En el broadcast de espectadores ya se incluye `cartaMostrada` (F016 §9.2).

El motor **no puede** validar automáticamente si el texto de `spectatorComment` revela cartas privadas (sería necesario NLP). El control es:

1. **Contractual**: el prompt del agente prohíbe explícitamente mencionar cartas en mano (ver §4.1).
2. **Post-evento**: los logs de F012 permiten auditar los comentarios. La columna `agentSpectatorComment` en BD también queda para revisión.
3. **Reglamentario**: si un equipo hace trampa revelando cartas en sus comentarios, la organización puede descalificarlo manualmente.

> **OPENQ-G004-01**: ¿Debe la organización revisar los comentarios en tiempo real durante el evento y tener la capacidad de silenciar los comentarios de un equipo? Ver §10.

### 8.2 Límite de longitud como mitigación de abuso

El límite de 160 caracteres actúa también como mitigación básica contra el uso del campo para emitir mensajes largos, código o datos no relacionados. La sanitización en el coordinador garantiza que no se emiten strings superiores a `160` por WebSocket.

### 8.3 Canal separado del `GameStateView`

`spectatorComment` **no se incluye** en el `GameStateView` que el motor entrega a los agentes rivales. Un agente no puede leer los comentarios de sus oponentes como parte de su estado de juego. El comentario solo viaja por el canal WebSocket de espectadores.

---

## 9. `TurnActivityFeed` (F016) — integración

El componente `<TurnActivityFeed>` (F016 §6) puede opcionalmente mostrar el `spectatorComment` bajo la fila `turn:agent_responded` y `turn:refutation_received`:

```tsx
// Dentro de <EventRow ev={ev} /> en TurnActivityFeed.tsx

{ev.spectatorComment && (
  <span className="mt-0.5 block text-xs text-slate-400 italic">
    💬 "{ev.spectatorComment}"
  </span>
)}
```

Esto es **aditivo**: no modifica la lógica principal del feed de F016, solo añade una fila de cita condicional debajo de los eventos que ya existen.

---

## 10. Preguntas abiertas

| ID | Pregunta | Impacto | Bloquea |
|---|---|---|---|
| OPENQ-G004-01 | ¿Necesita el Admin poder silenciar los comentarios de un equipo específico durante el evento? | Medio (añadiría control en panel Admin + flag en BD) | Diseño panel Admin (F008) |
| OPENQ-G004-02 | ¿Se muestra el comentario de refutación en el banner de cabecera o solo en el feed? | Bajo (experiencia visual) | Implementación de `ArenaHeader` |
| OPENQ-G004-03 | ¿El agente MattinAI soporta el campo `spectatorComment` tal como se define, o requiere acuerdo con el proveedor? | Alto si el proveedor no puede ajustar el esquema de respuesta | Integración MattinAI |
| OPENQ-G004-04 | ¿Se muestra `spectatorComment` en la vista de entrenamiento (F015) o solo en partidas de competición? | Bajo (reutilización directa del componente) | — |

---

## 11. Árbol de ficheros nuevos / modificados

```
src/
├── types/
│   └── api.ts                      ← MODIFICADO  campo spectatorComment en AgentResponse + TurnoHistorial
├── lib/
│   ├── game/
│   │   └── coordinator.ts          ← MODIFICADO  sanitizeSpectatorComment + propagación a emitTurnMicroEvent
│   ├── ws/
│   │   └── protocol.ts             ← MODIFICADO  spectatorComment en turn:agent_responded y turn:refutation_received
│   ├── db/
│   │   └── schema.ts               ← MODIFICADO  columnas agentSpectatorComment, refutadorSpectatorComment en turnos
│   └── ai/
│       ├── prompts/
│       │   ├── play-turn.ts        ← MODIFICADO  instrucciones spectatorComment en el prompt de sistema
│       │   └── refute.ts           ← MODIFICADO  instrucciones spectatorComment en el prompt
│       └── flows/
│           ├── play-turn.ts        ← MODIFICADO  AgentOutputSchema con spectatorComment
│           └── refute.ts           ← MODIFICADO  AgentOutputSchema con spectatorComment
├── contexts/
│   └── GameContext.tsx             ← MODIFICADO  latestSpectatorComment + SET/CLEAR_SPECTATOR_COMMENT
├── components/
│   └── game/
│       ├── ArenaHeader.tsx         ← MODIFICADO  banner temporal + useEffect con setTimeout
│       ├── ArenaActionFeed.tsx     ← MODIFICADO  línea de cita bajo cada entrada de turno
│       └── TurnActivityFeed.tsx    ← MODIFICADO  línea de cita bajo turn:agent_responded y turn:refutation_received
└── app/
    └── api/
        └── games/
            └── [id]/
                └── route.ts        ← MODIFICADO  incluir agentSpectatorComment en TurnoHistorial del GET
```

---

## 12. Criterios de aceptación (DoD)

- [ ] **Contrato**: `AgentResponse.spectatorComment` es un campo opcional `string` en `src/types/api.ts`; el campo no rompe los tests unitarios ni de integración existentes.
- [ ] **Sanitización**: `sanitizeSpectatorComment` trunca a 160 caracteres, elimina saltos de línea y convierte strings vacíos a `undefined`.
- [ ] **Protocolo WS**: `turn:agent_responded` y `turn:refutation_received` incluyen `spectatorComment?: string` (max 160) en sus schemas Zod.
- [ ] **Coordinador**: `spectatorComment` sanitizado se incluye en los micro-eventos WS correspondientes; ausente en el `GameStateView` enviado a agentes.
- [ ] **BD**: las columnas `agentSpectatorComment` y `refutadorSpectatorComment` existen en la tabla `turnos` como nullable; la migración generada con `npm run db:generate` es correcta.
- [ ] **Banner de cabecera**: el banner aparece con `fade-in` al recibir un micro-evento con `spectatorComment`, permanece 8 s y desaparece con `fade-out`; al recibir `game:turn_completed` desaparece inmediatamente.
- [ ] **Feed de acciones**: los turnos con `agentSpectatorComment` o `refutadorSpectatorComment` muestran la línea de cita en cursiva con el icono `💬`; los turnos sin comentario no muestran la línea.
- [ ] **TurnActivityFeed**: las filas de `turn:agent_responded` y `turn:refutation_received` muestran opcionalmente la cita del agente si está disponible.
- [ ] **Degradación sin comentario**: cuando `spectatorComment` es `undefined`, no se renderiza ningún elemento UI adicional ni se producen errores.
- [ ] **Privacidad entre agentes**: `spectatorComment` no aparece en `GameStateView`; verificado por test unitario del coordinador.
- [ ] **Prompts Genkit**: los prompts `play-turn` y `refute` incluyen las instrucciones de generación de `spectatorComment` y el esquema de salida Zod lo valida; el campo está marcado como `.optional()` para no romper la validación en agentes que no lo generen.
- [ ] **Migración DB**: `npm run db:generate` genera migración con las dos columnas nullable; `npm run db:migrate` la aplica sin errores.

---

## 13. Fuentes

| URL | Fecha | Qué se extrajo |
|---|---|---|
| RFC F006 (interno) | 2026-03-02 | Contrato `AgentResponse` con campo `reasoning`; arquitectura de flujos Genkit; prompts `play_turn` y `refute` |
| RFC F007 (interno) | 2026-03-02 | Rol del coordinador como orquestador; separación motor puro / coordinador con I/O |
| RFC F009 (interno) | 2026-03-02 | Layout y zonas de la Arena (`ArenaHeader`, `ArenaActionFeed`); convenciones Tailwind |
| RFC F011 (interno) | 2026-03-02 | Protocolo WebSocket; `GameEventEmitter`; `ServerMessageSchema` con discriminatedUnion |
| RFC F016 (interno) | 2026-03-02 | Tipos `turn:agent_responded` y `turn:refutation_received`; `TurnActivityFeed`; nota de privacidad agentes vs. espectadores (§9.2) |
| RFC G003 (interno) | 2026-03-02 | Modelo de información pública/privada; asimetría del refutador; garantías de `getGameStateView()` |
