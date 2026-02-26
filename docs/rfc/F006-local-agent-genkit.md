# RFC F006 — Soporte Inicial de Agente Local con Genkit

| Campo | Valor |
|---|---|
| **ID** | F006 |
| **Título** | Agente Cluedo local con Genkit: emulación de MattinAI para desarrollo y CI |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-02-26 |
| **Refs. spec** | [40-arquitectura](../../clue-arena-spec/docs/spec/40-arquitectura.md) · [60-backend](../../clue-arena-spec/docs/spec/60-backend.md) · [00-context](../../clue-arena-spec/docs/spec/00-context.md) |
| **Deps.** | RFC F001 |

---

## 1. Resumen

Este RFC define la integración de **[Genkit](https://firebase.google.com/docs/genkit)** como backend de agente local que emula el comportamiento de MattinAI. El objetivo es disponer de una implementación funcional del ciclo agente-turno sin depender del servicio externo MattinAI durante desarrollo, testing y CI.

La integración expone **exactamente el mismo contrato** que el cliente MattinAI refactorizado (`src/lib/api/mattin.ts`): la función `invokeAgent(request)` que recibe un `AgentRequest` tipado y retorna un `AgentResponse` con la acción estructurada decidida por el agente. El caller (el motor de turno del juego) no distingue entre backends; la selección se realiza mediante la variable de entorno `AGENT_BACKEND`.

El agente dispone de **tres herramientas de soporte** (consulta de estado de partida, lectura y escritura de memoria persistente) y **no** ejecuta acciones de juego directamente. El motor de juego aplica la acción devuelta (`suggestion`, `accusation`, `show_card` o `cannot_refute`). Hay dos modos de invocación:

- **`play_turn`**: el agente razona y decide qué sugerencia o acusación hacer.
- **`refute`**: el agente decide qué carta mostrar para refutar una combinación, o indica que no puede refutar.

---

## 2. Motivación y contexto

### 2.1 Problema actual

El motor de juego necesita invocar un agente IA por cada turno (`POST /api/mcp/turn` o equivalente). En el MVP, ese agente es MattinAI. Sin embargo:

| Problema | Impacto |
|---|---|
| MattinAI no disponible en entorno local/CI | Imposible ejecutar partidas de extremo a extremo sin conexión a producción |
| Los equipos no conectan su agente hasta semanas antes del evento | No se puede validar el flujo completo de partida durante el desarrollo |
| Los tests E2E que cubren el flujo de turno no pueden mockear la SSE de forma realista | Cobertura incompleta o tests frágiles con stubs fijos |
| No hay modo "demo" para presentar la plataforma sin dependencia externa | Demostración del producto bloqueada |

### 2.2 Solución propuesta

Integrar **Genkit** (framework open-source de Google para aplicaciones con IA generativa) para implementar localmente un agente Cluedo que:

1. Recibe una `AgentRequest` tipada (`play_turn` o `refute`) con los identificadores de partida y equipo.
2. Usa un LLM (configurable: Gemini Flash via `@genkit-ai/googleai`, o un modelo local Ollama via plugin `genkitx-ollama`) para razonar sobre el estado del juego.
3. Puede invocar hasta 3 herramientas de soporte: `get_game_state`, `get_agent_memory`, `save_agent_memory`.
4. Retorna un `AgentResponse` con la acción estructurada (`suggestion`, `accusation`, `show_card` o `cannot_refute`) que el motor de juego aplica.

---

## 3. Diseño de la integración

### 3.1 Principio de segregación del backend

```
src/lib/api/
├── mattin.ts          ← Backend MattinAI (existente, sin cambios)
├── local-agent.ts     ← Backend Genkit (nuevo)
└── agent.ts           ← Fachada: selecciona backend según AGENT_BACKEND
```

La fachada `agent.ts` exporta `invokeAgent` con la misma firma para ambos backends. Todo el código del servidor (route handlers de games, lógica de turno) importa **únicamente** desde `@/lib/api/agent`, nunca directamente de `mattin.ts` o `local-agent.ts`.

```typescript
// src/lib/api/agent.ts
import type { AgentRequest, AgentResponse } from '@/types/api';

export type { AgentRequest, AgentResponse };

export async function invokeAgent(request: AgentRequest): Promise<AgentResponse> {
  if (process.env.AGENT_BACKEND === 'local') {
    const { invokeAgent: invokeLocal } = await import('./local-agent');
    return invokeLocal(request);
  }
  const { invokeAgent: invokeMattin } = await import('./mattin');
  return invokeMattin(request);
}
```

`AGENT_BACKEND=local` en `.env.local` y en CI; `AGENT_BACKEND=mattin` (o sin variable) en producción.

### 3.2 Contrato del agente (`AgentRequest` / `AgentResponse`)

Los tipos se definen en `src/types/api.ts` y son compartidos por ambos backends (local y MattinAI).

```typescript
// src/types/api.ts (fragmento)

// --- Requests ---
export interface PlayTurnRequest {
  type: 'play_turn';
  gameId: string;
  teamId: string;
}

export interface RefuteRequest {
  type: 'refute';
  gameId: string;
  teamId: string;
  suspect: string;   // combinación a refutar
  weapon: string;
  room: string;
}

export type AgentRequest = PlayTurnRequest | RefuteRequest;

// --- Acciones estructuradas (respuesta del agente) ---
export interface SuggestionAction {
  type: 'suggestion';
  suspect: string;
  weapon: string;
  room: string;
}

export interface AccusationAction {
  type: 'accusation';
  suspect: string;
  weapon: string;
  room: string;
}

export interface ShowCardAction {
  type: 'show_card';
  card: string;
}

export interface CannotRefuteAction {
  type: 'cannot_refute';
}

export type AgentAction =
  | SuggestionAction
  | AccusationAction
  | ShowCardAction
  | CannotRefuteAction;

// --- Respuesta ---
export interface AgentResponse {
  action: AgentAction;   // Acción estructurada que el motor de juego aplica
  reasoning: string;     // Texto de razonamiento del LLM (para logs/debug)
  done: boolean;         // Siempre true; permite ampliar con streaming en el futuro
}
```

**Invariantes del contrato:**
- `play_turn` → `action.type` ∈ `{ suggestion, accusation }`
- `refute` → `action.type` ∈ `{ show_card, cannot_refute }`
- El motor de juego valida el tipo antes de aplicar la acción; responde con error 422 si no se cumple el invariante.

### 3.3 Herramientas del agente

El agente dispone de **3 herramientas de soporte**. No tiene acceso a herramientas de acción de juego: las acciones son la *salida* del agente, no efectos secundarios dentro del razonamiento.

| Tool Genkit | Propósito | Implementación |
|---|---|---|
| `get_game_state` | Obtiene el estado de la partida (cartas en mano, historial, turno activo…) desde la perspectiva del equipo | Reutiliza `getGameStateTool.handler` de `src/lib/mcp/tools/get-game-state.ts` |
| `get_agent_memory` | Recupera el JSON de memoria persistente del agente para esta partida (vacío en el primer turno) | `src/lib/ai/agent-memory.ts` → lectura en tabla `agent_memories` |
| `save_agent_memory` | Persiste un JSON de memoria para los siguientes turnos (deducciones acumuladas, cartas descartadas…) | `src/lib/ai/agent-memory.ts` → upsert en tabla `agent_memories` |

El handler de `get_game_state` **no se modifica**. Los handlers de `get_agent_memory` y `save_agent_memory` son nuevos y residen en `src/lib/ai/agent-memory.ts` (no en `src/lib/mcp/tools/`), ya que son internos al agente y no se exponen como herramientas MCP públicas.

### 3.4 Flujos Genkit

#### Flujo `play_turn`

```
invokeAgent({ type: 'play_turn', gameId, teamId })
  └─► generate(model, PLAY_TURN_PROMPT, tools=[get_game_state, get_agent_memory, save_agent_memory])
        ├─► LLM → tool_call: get_game_state({ game_id, team_id })
        │     └─► getGameStateTool.handler(...)  → JSON del estado
        ├─► LLM → tool_call: get_agent_memory({ game_id, team_id })
        │     └─► getAgentMemory(...)            → JSON de memoria previa
        ├─► LLM razona: descarta cartas, actualiza deducciones
        ├─► LLM → tool_call: save_agent_memory({ game_id, team_id, memory: {...} })
        │     └─► saveAgentMemory(...)           → ok
        └─► LLM emite respuesta final en JSON:
              { "action": { "type": "suggestion"|"accusation", "suspect", "weapon", "room" } }
```

El motor de juego parsea `action` y aplica `makeSuggestionTool.handler` o `makeAccusationTool.handler` según corresponda.

#### Flujo `refute`

```
invokeAgent({ type: 'refute', gameId, teamId, suspect, weapon, room })
  └─► generate(model, REFUTE_PROMPT, tools=[get_game_state, get_agent_memory])
        ├─► LLM → tool_call: get_game_state({ game_id, team_id })
        │     └─► getGameStateTool.handler(...)  → JSON del estado (cartas en mano)
        ├─► LLM → tool_call: get_agent_memory({ game_id, team_id })  [opcional]
        └─► LLM emite respuesta final en JSON:
              { "action": { "type": "show_card", "card": "..." } }
              o
              { "action": { "type": "cannot_refute" } }
```

En el flujo `refute` el agente no necesita guardar memoria; `save_agent_memory` no está disponible en este flujo, simplificando el razonamiento.

### 3.5 System prompts del agente Cluedo

Hay dos prompts, uno por tipo de solicitud, versionados en `src/lib/ai/prompts/`.

#### `play-turn.ts` — Prompt para jugar turno

| Sección | Contenido |
|---|---|
| **Rol** | Detective IA en partida de Cluedo competitiva |
| **Objetivo** | Identificar sospechoso + arma + habitación antes que los demás equipos |
| **Herramientas** | `get_game_state`, `get_agent_memory`, `save_agent_memory` |
| **Instrucción principal** | Razona usando las herramientas; actualiza la memoria con deducciones; devuelve **solo JSON** con `{ action: { type, suspect, weapon, room } }` |
| **Estrategia** | Priorizar sugerencias que descarten cartas desconocidas; acusar solo con certeza lógica |
| **Restricción de formato** | La respuesta final debe ser JSON parseable; sin texto libre |

#### `refute.ts` — Prompt para refutar

| Sección | Contenido |
|---|---|
| **Rol** | Mismo rol de detective |
| **Objetivo** | Decidir si puedes refutar la combinación `{suspect, weapon, room}` y qué carta mostrar |
| **Herramientas** | `get_game_state` (para ver tus cartas en mano), `get_agent_memory` (opcional) |
| **Instrucción principal** | Si tienes al menos una de las tres cartas en mano, elige la que menos información revele; devuelve `show_card` o `cannot_refute` |
| **Restricción de formato** | JSON parseable; sin texto libre extra |

### 3.6 Construcción del `AgentResponse` desde la respuesta Genkit

Genkit retorna un `GenerateResponse`. El texto final del modelo debe ser JSON; se parsea y valida con Zod antes de retornar:

```typescript
// 1. Extraer el texto final del último mensaje con role='model'
// 2. JSON.parse() del texto → validar con AgentActionSchema (Zod discriminado por request.type)
// 3. Construir AgentResponse { action, reasoning: textoAcumulado, done: true }
// 4. Si el JSON no es parseable o no satisface el esquema → lanzar AgentResponseError
//    (el motor de juego puede reintentar o aplicar fallback)
```

Los tool calls de soporte (`get_game_state`, `get_agent_memory`, `save_agent_memory`) son internos al razonamiento del agente y no se incluyen en la respuesta devuelta al motor de juego.

---

## 4. Estructura de ficheros

```
src/
├── types/
│   └── api.ts                      ← MODIFICADO: AgentRequest, AgentResponse, AgentAction
└── lib/
    ├── api/
    │   ├── mattin.ts               ← MODIFICADO: implementa invokeAgent (nuevo contrato)
    │   ├── local-agent.ts          ← NUEVO: invokeAgent con Genkit
    │   └── agent.ts                ← NUEVO: fachada de selección de backend
    └── ai/
        ├── genkit.ts               ← NUEVO: instancia y configuración de Genkit
        ├── agent-memory.ts         ← NUEVO: get/saveAgentMemory sobre tabla agent_memories
        ├── tools/
        │   └── cluedo-tools.ts     ← NUEVO: 3 tools Genkit (get_game_state, get/save_agent_memory)
        └── prompts/
            ├── play-turn.ts        ← NUEVO: system prompt para solicitudes play_turn
            └── refute.ts           ← NUEVO: system prompt para solicitudes refute
```

**Schema Drizzle**: añadir tabla `agent_memories` en `src/lib/db/schema.ts`:

```typescript
export const agentMemories = sqliteTable('agent_memories', {
  gameId:     text('game_id').notNull(),
  teamId:     text('team_id').notNull(),
  memoryJson: text('memory_json').notNull().default('{}'),
  updatedAt:  text('updated_at').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.gameId, t.teamId] }),
}));
```

---

## 5. Dependencias

### 5.1 Paquetes npm nuevos

| Paquete | Versión | Uso |
|---|---|---|
| `genkit` | `^1.x` | Core framework: `generate`, `defineTool`, `defineFlow` |
| `@genkit-ai/googleai` | `^1.x` | Plugin Gemini (Google AI Studio / Vertex AI) |
| `genkitx-ollama` | `^0.x` | Plugin Ollama (modelos locales, sin coste de API) |

Todas son dependencias de producción (`dependencies`), ya que el agente local también puede usarse en un entorno de staging sin MattinAI.

### 5.2 Variables de entorno nuevas

| Variable | Obligatoria | Descripción |
|---|---|---|
| `AGENT_BACKEND` | No (default: `mattin`) | `local` activa el backend Genkit |
| `GEMINI_API_KEY` | Solo si `GENKIT_MODEL=gemini-*` | Clave de Google AI Studio |
| `GENKIT_MODEL` | No (default: `gemini20FlashExp`) | Modelo LLM a usar. Valores: `gemini20FlashExp`, `ollama/llama3.2`, `ollama/qwen2.5-coder` |
| `OLLAMA_SERVER_URL` | Solo si modelo Ollama | URL del servidor Ollama (default: `http://localhost:11434`) |

En desarrollo sin clave de API, se puede usar `GENKIT_MODEL=ollama/llama3.2` con Ollama corriendo localmente, sin coste alguno.

---

## 6. Implementación detallada

### 6.1 `src/lib/ai/genkit.ts`

```typescript
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
// import { ollama } from 'genkitx-ollama'; // descomentar para Ollama

export const ai = genkit({
  plugins: [
    googleAI({ apiKey: process.env.GEMINI_API_KEY }),
    // ollama({ serverAddress: process.env.OLLAMA_SERVER_URL ?? 'http://localhost:11434' }),
  ],
});

export const DEFAULT_MODEL = process.env.GENKIT_MODEL ?? 'googleai/gemini-2.0-flash-exp';
```

### 6.2 `src/lib/ai/agent-memory.ts`

```typescript
/**
 * Agent memory persistence — SQLite via Drizzle.
 * Server-side only.
 */
import { db } from '@/lib/db';
import { agentMemories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function getAgentMemory(
  gameId: string,
  teamId: string
): Promise<Record<string, unknown>> {
  const row = await db
    .select()
    .from(agentMemories)
    .where(and(eq(agentMemories.gameId, gameId), eq(agentMemories.teamId, teamId)))
    .get();
  return row ? (JSON.parse(row.memoryJson) as Record<string, unknown>) : {};
}

export async function saveAgentMemory(
  gameId: string,
  teamId: string,
  memory: Record<string, unknown>
): Promise<void> {
  const memoryJson = JSON.stringify(memory);
  const updatedAt = new Date().toISOString();
  await db
    .insert(agentMemories)
    .values({ gameId, teamId, memoryJson, updatedAt })
    .onConflictDoUpdate({
      target: [agentMemories.gameId, agentMemories.teamId],
      set: { memoryJson, updatedAt },
    });
}
```

### 6.3 `src/lib/ai/tools/cluedo-tools.ts`

```typescript
import { z } from 'zod';
import { ai } from '../genkit';
import { getGameStateTool } from '@/lib/mcp/tools/get-game-state';
import { getAgentMemory, saveAgentMemory } from '../agent-memory';

/** Tool 1: estado del juego */
export const cluedoGetGameState = ai.defineTool(
  {
    name: 'get_game_state',
    description:
      'Obtiene el estado actual de la partida desde la perspectiva del equipo: ' +
      'cartas en mano, historial de sugerencias, equipos activos y turno actual.',
    inputSchema: z.object({
      game_id: z.string().describe('ID de la partida'),
      team_id: z.string().describe('ID del equipo'),
    }),
    outputSchema: z.string().describe('JSON serializado de GameStateView'),
  },
  async (input) => {
    const result = await getGameStateTool.handler(input);
    return result.content[0].text;
  }
);

/** Tool 2: leer memoria persistente del agente */
export const cluedoGetAgentMemory = ai.defineTool(
  {
    name: 'get_agent_memory',
    description:
      'Recupera la memoria persistente del agente para esta partida. ' +
      'Contiene deducciones acumuladas de turnos anteriores. Vacío en el primer turno.',
    inputSchema: z.object({
      game_id: z.string(),
      team_id: z.string(),
    }),
    outputSchema: z.string().describe('JSON con la memoria del agente'),
  },
  async ({ game_id, team_id }) => {
    const memory = await getAgentMemory(game_id, team_id);
    return JSON.stringify(memory);
  }
);

/** Tool 3: guardar memoria persistente del agente */
export const cluedoSaveAgentMemory = ai.defineTool(
  {
    name: 'save_agent_memory',
    description:
      'Persiste un JSON con las deducciones y notas del agente para los siguientes turnos. ' +
      'Llama a esta herramienta antes de emitir tu respuesta final.',
    inputSchema: z.object({
      game_id: z.string(),
      team_id: z.string(),
      memory: z.record(z.unknown()).describe('Objeto JSON con la memoria a persistir'),
    }),
    outputSchema: z.literal('ok'),
  },
  async ({ game_id, team_id, memory }) => {
    await saveAgentMemory(game_id, team_id, memory);
    return 'ok' as const;
  }
);

/** Tools disponibles para play_turn (incluye save_agent_memory) */
export const PLAY_TURN_TOOLS = [
  cluedoGetGameState,
  cluedoGetAgentMemory,
  cluedoSaveAgentMemory,
] as const;

/** Tools disponibles para refute (sin save_agent_memory) */
export const REFUTE_TOOLS = [
  cluedoGetGameState,
  cluedoGetAgentMemory,
] as const;
```

### 6.4 `src/lib/ai/prompts/play-turn.ts` y `refute.ts`

```typescript
// src/lib/ai/prompts/play-turn.ts
export const PLAY_TURN_SYSTEM_PROMPT = `
Eres un agente detective de IA que participa en una partida de Cluedo competitiva.

## Objetivo
Identificar la solución del crimen (sospechoso + arma + habitación) antes que los demás equipos.

## Proceso obligatorio en cada turno
1. Llama a get_game_state para obtener el estado actual de la partida.
2. Llama a get_agent_memory para recuperar tus deducciones de turnos anteriores.
3. Razona: cruza las cartas en tu mano con el historial de sugerencias y tu memoria para descartar candidatos.
4. Llama a save_agent_memory con tu estado de deducción actualizado.
5. Devuelve tu decisión como JSON en la respuesta final.

## Formato de respuesta final (OBLIGATORIO)
Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional antes ni después:
{ "action": { "type": "suggestion", "suspect": "...", "weapon": "...", "room": "..." } }
o
{ "action": { "type": "accusation", "suspect": "...", "weapon": "...", "room": "..." } }

## Estrategia
- Haz sugerencias con combinaciones donde al menos dos de las tres cartas sean desconocidas para ti.
- Acusa solo cuando hayas descartado con certeza todas las demás opciones.
- Usa save_agent_memory para registrar qué cartas has visto revelar (no están en el sobre).
`;

// src/lib/ai/prompts/refute.ts
export const REFUTE_SYSTEM_PROMPT = `
Eres un agente detective de IA en una partida de Cluedo.

## Tarea
Decidir si puedes refutar la combinación indicada en el mensaje del usuario.

## Proceso
1. Llama a get_game_state para ver las cartas que tienes en mano.
2. Comprueba si tienes en mano el sospechoso, el arma o la habitación de la combinación indicada.
3. Si tienes al menos una carta coincidente, elige la que menos información estratégica revele.
   Devuelve show_card con esa carta.
4. Si no tienes ninguna carta de la combinación, devuelve cannot_refute.

## Formato de respuesta final (OBLIGATORIO)
Responde ÚNICAMENTE con un objeto JSON válido:
{ "action": { "type": "show_card", "card": "NombreDeLaCarta" } }
o
{ "action": { "type": "cannot_refute" } }
`;
```

### 6.5 `src/lib/api/local-agent.ts`

```typescript
/**
 * Local agent backend using Genkit — implements AgentRequest/AgentResponse contract.
 * Server-side only. Never import this in client components.
 */
import { z } from 'zod';
import type { AgentRequest, AgentResponse, AgentAction } from '@/types/api';
import { ai, DEFAULT_MODEL } from '@/lib/ai/genkit';
import { PLAY_TURN_TOOLS, REFUTE_TOOLS } from '@/lib/ai/tools/cluedo-tools';
import { PLAY_TURN_SYSTEM_PROMPT } from '@/lib/ai/prompts/play-turn';
import { REFUTE_SYSTEM_PROMPT } from '@/lib/ai/prompts/refute';

// --- Zod schemas for validating LLM JSON output ---
const PlayTurnResponseSchema = z.union([
  z.object({ action: z.object({ type: z.literal('suggestion'), suspect: z.string(), weapon: z.string(), room: z.string() }) }),
  z.object({ action: z.object({ type: z.literal('accusation'), suspect: z.string(), weapon: z.string(), room: z.string() }) }),
]);

const RefuteResponseSchema = z.union([
  z.object({ action: z.object({ type: z.literal('show_card'), card: z.string() }) }),
  z.object({ action: z.object({ type: z.literal('cannot_refute') }) }),
]);

// --- Main export ---
export async function invokeAgent(request: AgentRequest): Promise<AgentResponse> {
  const isPlayTurn = request.type === 'play_turn';

  const userPrompt = isPlayTurn
    ? `game_id: ${request.gameId}\nteam_id: ${request.teamId}\nJuega tu turno.`
    : `game_id: ${request.gameId}\nteam_id: ${request.teamId}\n` +
      `Refuta la combinación: sospechoso="${request.suspect}", arma="${request.weapon}", habitación="${request.room}".`;

  const response = await ai.generate({
    model: DEFAULT_MODEL,
    system: isPlayTurn ? PLAY_TURN_SYSTEM_PROMPT : REFUTE_SYSTEM_PROMPT,
    prompt: userPrompt,
    tools: isPlayTurn ? PLAY_TURN_TOOLS : REFUTE_TOOLS,
    output: { format: 'json' },
  });

  // Accumulate reasoning text from all model messages
  const reasoning = response.messages
    .filter((m) => m.role === 'model')
    .flatMap((m) => m.content)
    .filter((p) => p.text)
    .map((p) => p.text!)
    .join('');

  // Parse and validate the structured action
  const schema = isPlayTurn ? PlayTurnResponseSchema : RefuteResponseSchema;
  const parsed = schema.safeParse(response.output);

  if (!parsed.success) {
    throw new AgentResponseError(
      `Respuesta del agente no válida: ${parsed.error.message}`,
      reasoning
    );
  }

  return {
    action: parsed.data.action as AgentAction,
    reasoning,
    done: true,
  };
}

export class AgentResponseError extends Error {
  constructor(message: string, public readonly reasoning: string) {
    super(message);
    this.name = 'AgentResponseError';
  }
}
```

---

## 7. Modo de operación y configuración

### 7.1 Desarrollo local con Gemini Flash (recomendado)

```bash
# .env.local
AGENT_BACKEND=local
GEMINI_API_KEY=AIza...
GENKIT_MODEL=googleai/gemini-2.0-flash-exp
```

Gemini Flash 2.0 es gratuito en Google AI Studio con límites generosos, suficientes para el ciclo de desarrollo.

### 7.2 Desarrollo local sin API key (Ollama)

```bash
# Arrancar Ollama con un modelo con buen tool-calling
ollama pull llama3.2
ollama serve

# .env.local
AGENT_BACKEND=local
GENKIT_MODEL=ollama/llama3.2
OLLAMA_SERVER_URL=http://localhost:11434
```

Para activar el plugin Ollama, descomentar la línea correspondiente en `src/lib/ai/genkit.ts`.

### 7.3 CI (GitHub Actions)

```yaml
# .github/workflows/ci.yml (fragmento)
env:
  AGENT_BACKEND: local
  GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  GENKIT_MODEL: googleai/gemini-2.0-flash-exp
```

### 7.4 Producción (MattinAI)

```bash
# .env.production
AGENT_BACKEND=mattin        # o simplemente omitir (default)
MATTIN_API_URL=https://...
MATTIN_API_KEY=...
```

---

## 8. Testing

### 8.1 Test unitario del agente local (`src/tests/local-agent.test.ts`)

- Mock de `ai.generate` (Genkit) para retornar respuestas JSON predefinidas para `play_turn` y `refute`.
- Verificar que `invokeAgent` parsea correctamente el output del LLM a `AgentResponse`.
- Verificar que `AgentResponseError` se lanza cuando el JSON no cumple el esquema Zod.
- No hacer llamadas reales al LLM en tests unitarios.

**Casos a cubrir:**

| Request type | Output LLM | `action.type` esperado |
|---|---|---|
| `play_turn` | `{ action: { type: 'suggestion', ... } }` | `suggestion` |
| `play_turn` | `{ action: { type: 'accusation', ... } }` | `accusation` |
| `play_turn` | JSON inválido / sin `action` | lanza `AgentResponseError` |
| `refute` | `{ action: { type: 'show_card', card: '...' } }` | `show_card` |
| `refute` | `{ action: { type: 'cannot_refute' } }` | `cannot_refute` |
| `refute` | `{ action: { type: 'suggestion', ... } }` | lanza `AgentResponseError` (tipo inválido para refute) |

### 8.2 Test unitario de memoria (`src/tests/agent-memory.test.ts`)

- Crear en DB de test, leer, actualizar y leer de nuevo la memoria de un agente.
- Verificar que `getAgentMemory` retorna `{}` si no existe registro previo.
- Verificar que `saveAgentMemory` hace upsert (no duplica registros al llamar dos veces).

### 8.3 Test de integración del flujo de turno

- Usar `AGENT_BACKEND=local` + `GEMINI_API_KEY` real en CI.
- Crear partida de prueba en DB de test e invocar `invokeAgent({ type: 'play_turn', ... })`.
- Verificar que:
  - `action.type` es `suggestion` o `accusation`.
  - La tabla `agent_memories` tiene un registro para `(gameId, teamId)` tras el turno.
  - El motor de juego puede aplicar la acción devuelta sin errores.
- Invocar `invokeAgent({ type: 'refute', ... })` y verificar que `action.type` es `show_card` o `cannot_refute`.

### 8.4 Tests E2E con agente local

Los tests Playwright que cubren el flujo de partida completo usarán `AGENT_BACKEND=local`, eliminando la dependencia de MattinAI en la suite E2E.

---

## 9. Migración del código existente

### 9.1 Actualización de `src/types/api.ts`

Añadir los tipos `AgentRequest`, `AgentResponse` y `AgentAction` (ver sección 3.2). Los tipos anteriores `TurnResult` y `ToolCall` se eliminan de `mattin.ts` y no se re-exportan.

### 9.2 Actualización de `src/lib/api/mattin.ts`

`mattin.ts` se refactoriza para exportar `invokeAgent(request: AgentRequest): Promise<AgentResponse>`:

- Envía la request como `play_turn` o `refute` al endpoint HTTP de MattinAI.
- Parsea la respuesta estructurada a `AgentResponse`.
- Los tipos `TurnResult` / `ToolCall` se eliminan del fichero.

### 9.3 Cambios en callers de `mattin.ts`

Todos los archivos que actualmente importan desde `@/lib/api/mattin` deben actualizarse:

```typescript
// ANTES
import { invokeTurn, TurnResult } from '@/lib/api/mattin';

// DESPUÉS
import { invokeAgent } from '@/lib/api/agent';
import type { AgentRequest, AgentResponse } from '@/types/api';
```

### 9.4 Migración Drizzle: tabla `agent_memories`

```bash
npm run db:generate   # genera la migración para agent_memories
npm run db:migrate    # aplica la migración
```

### 9.5 Sin cambios en el Route Handler `/api/mcp`

El endpoint MCP (`/api/mcp`) no cambia: sigue siendo el punto de entrada para agentes externos (MattinAI en producción). El backend local no lo usa; llama a los handlers directamente.

---

## 10. Decisiones de diseño

| Decisión | Alternativa considerada | Motivo de la elección |
|---|---|---|
| El agente retorna acciones estructuradas; el motor las aplica | El agente invoca tools de acción (make_suggestion, etc.) directamente | Separación de responsabilidades: el agente decide, el motor actúa. Permite validación, reintento y fallback sin depender de efectos secundarios del LLM. |
| Dos modos de invocación (`play_turn` / `refute`) | Un único endpoint con contexto libre | Prompts más pequeños y precisos; menor riesgo de alucinación; más fácil de testear y evaluar por separado. |
| Memoria persistente en BD (`agent_memories`) | Memoria en contexto (historial de mensajes Genkit) | La BD escala a partidas largas sin inflar el contexto del LLM; permite inspección y reset por el admin; operaciones de memoria son O(1) en tokens. |
| `save_agent_memory` solo disponible en `play_turn` | Disponible en ambos flujos | En `refute` el agente solo consulta; economiza tokens y elimina riesgo de mutación accidental de estado. |
| Validación Zod del JSON de salida del LLM | Confiar en el output tipado de Genkit | Los LLMs pueden halucinar el formato; la validación estricta falla rápido con `AgentResponseError` y permite reintentos controlados. |
| El agente local llama handlers directamente (sin HTTP) | Llamar a `/api/mcp` vía HTTP localhost | Elimina latencia de red; no requiere servidor arrancado; simplifica tests y CI. |
| Fachada `agent.ts` con importación dinámica | Condicional en cada caller | Un único punto de cambio; Genkit solo se carga en el bundle si `AGENT_BACKEND=local`. |
| System prompts separados por fichero | Un único prompt con condicionales | Cada prompt es más pequeño, legible y editable de forma independiente; facilita evaluación A/B. |

---

## 11. Limitaciones conocidas y trabajo futuro

| Limitación | Posible mejora futura |
|---|---|
| La memoria del agente es un JSON libre sin esquema fijo | Definir `AgentMemorySchema` (Zod) para garantizar coherencia entre turnos y facilitar debugging |
| No hay mecanismo de reintento automático si `AgentResponseError` | Añadir retry con backoff exponencial en `invokeAgent` (máx. 2 reintentos) antes de propagar el error |
| El agente no contempla estrategias de deducción multi-turno avanzadas | Mejorar el prompt con ejemplos few-shot de razonamiento sobre el espacio de cartas |
| No hay streaming del razonamiento del agente local | Implementar con `ai.generateStream` y mapear a SSE si el admin necesita visualizar el razonamiento en tiempo real |
| `genkitx-ollama` es un paquete de la comunidad, no oficial de Google | Evaluar plugins oficiales cuando Genkit publique soporte Ollama estable |
| La memoria no se limpia automáticamente al finalizar la partida | Añadir limpieza de `agent_memories` en el handler de cierre de partida (`POST /api/games/:id/stop`) |

---

## 12. Fuentes

| URL | Fecha | Información extraída |
|---|---|---|
| https://firebase.google.com/docs/genkit | 2026-02-26 | API de `genkit`, `defineTool`, `generate`, plugins disponibles |
| https://github.com/firebase/genkit | 2026-02-26 | Estructura del monorepo, paquetes `genkit`, `@genkit-ai/googleai`, versiones |
| https://ai.google.dev/gemini-api/docs/models | 2026-02-26 | Disponibilidad y límites de Gemini Flash 2.0 en Google AI Studio |
| https://github.com/hserranome/genkitx-ollama | 2026-02-26 | Plugin Ollama para Genkit (comunidad) |
