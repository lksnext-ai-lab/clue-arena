# RFC F012 — Log de Interacción Coordinador-Agente

| Campo | Valor |
|---|---|
| **ID** | F012 |
| **Título** | Diseño del registro de interacción entre el coordinador y los agentes de equipo |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-02-27 |
| **Refs. spec** | [40-arquitectura](../../clue-arena-spec/docs/spec/40-arquitectura.md) · [60-backend](../../clue-arena-spec/docs/spec/60-backend.md) · [80-seguridad](../../clue-arena-spec/docs/spec/80-seguridad.md) |
| **Deps.** | RFC F006 · RFC F007 · RFC F011 |

---

## 1. Resumen

Este RFC diseña el sistema de **registro de interacción** (interaction log) entre el coordinador del motor de juego y los agentes de equipo en Clue Arena. El objetivo es disponer de trazabilidad completa de cada ciclo de invocación agente ↔ coordinador: cuándo se invocó el agente, con qué estado del juego, qué respondió, qué acción aplicó el coordinador, qué herramientas MCP llamó el agente durante su razonamiento y si hubo errores o timeouts en el proceso.

El log sirve a tres propósitos:

1. **Observabilidad operacional**: el equipo organizador puede diagnosticar problemas durante el evento (agente que no responde, acción inválida, error de herramienta MCP).
2. **Auditoría y fairness**: garantizar que todos los agentes recibieron información equivalente y que el coordinador aplicó las reglas de forma consistente.
3. **Análisis post-evento**: permitir la revisión paso a paso de cada partida para evaluar la calidad de los agentes y detectar estrategias anómalas.

El log es **append-only**, estructurado (JSON lines emitidos por el logger del servidor, sin persistencia en BD), y nunca expone el contenido del sobre secreto ni las cartas de otros equipos a los agentes.

---

## 2. Motivación y contexto

### 2.1 Problema actual

El coordinador definido en F007 invoca los agentes a través de la fachada `invokeAgent` y aplica la respuesta recibida. Sin embargo, actualmente no existe ningún registro estructurado de:

- Qué `AgentRequest` se envió y en qué momento (`ts_invocada`).
- Cuánto tardó el agente en responder (`durationMs`).
- Qué herramientas MCP llamó el agente durante su razonamiento y con qué argumentos/resultados.
- Qué `AgentResponse` se recibió y si fue válida o rechazada por el motor.
- Si el agente llegó a timeout o lanzó un error.
- Qué prompts/contexto se generaron internamente (en modo Genkit local).

Sin este registro es imposible:
- Diagnosticar por qué un agente hizo una acusación incorrecta.
- Verificar que el motor filtró correctamente la `GameStateView`.
- Reproducir una partida con fines de auditoría.
- Detectar agentes que consultan `get_game_state` de forma abusiva (> N veces por turno).

### 2.2 Alcance de este RFC

| Incluido | Excluido |
|---|---|
| Estructura de entradas de log (TypeScript types + pino) | Persistencia de logs en BD (SQLite/Drizzle) |
| Registro automático en la fachada `invokeAgent` | Sistema de alertas en tiempo real |
| Registro de llamadas a herramientas MCP | Análisis estadístico automático de estrategias |
| Endpoint de streaming de log en tiempo real (admin) | Exportación a formatos externos (CSV) — post-evento |
| Visibilidad en UI admin via streaming SSE del log | Replay automático de partida |
| Correlación por `invocacionId` (header + log field) | — |

---

## 3. Modelo de entradas de log

### 3.1 Principio de diseño

El log de interacción **no se almacena en la base de datos**. Cada evento se emite como una línea JSON estructurada al logger del servidor mediante [`pino`](https://getpino.io/), que escribe a `stdout`. Esto permite:

- **Desarrollo**: visualizar con `pino-pretty` durante `npm run dev`.
- **Producción/evento**: redirigir `stdout` a un archivo o a cualquier agregador compatible con JSON lines (`loki`, `datadog`, etc.).
- **Sin esquema adicional de BD**: el schema Drizzle no se modifica.

La correlación entre eventos del mismo ciclo de invocación se hace mediante el campo `invocacionId` (UUID v4), presente en todas las entradas relacionadas.

### 3.2 Configuración del logger

```typescript
// src/lib/utils/logger.ts
import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'clue-arena' },
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,   // JSON lines puro en producción
});

export const agentLog = logger.child({ component: 'agent-coordinator' });
export const mcpLog   = logger.child({ component: 'mcp-tools' });
```

`pino` es una dependencia de producción (`npm install pino`); `pino-pretty` solo dev (`npm install -D pino-pretty`).

### 3.3 Tipos de entradas de log

Cada tipo de evento tiene un campo discriminante `event`. Los campos comunes a todos los eventos son:

```typescript
// src/lib/utils/log-types.ts

/** Campos presentes en todos los eventos del log de interacción */
interface BaseLogEntry {
  event: string;
  invocacionId: string;   // UUID v4 — clave de correlación de un ciclo completo
  gameId: string;
  teamId: string;
  turnoId: string;
}

// ─── Ciclo de invocación al agente ───────────────────────────────

export interface AgentInvocationStartLog extends BaseLogEntry {
  event: 'agent_invocation_start';
  tipo: 'play_turn' | 'refute';
  agentBackend: 'mattin' | 'local' | 'unknown';
  gameStateViewHash: string | null;   // SHA-256 de la GameStateView enviada
}

export interface AgentInvocationCompleteLog extends BaseLogEntry {
  event: 'agent_invocation_complete';
  estado: 'completada' | 'timeout' | 'error';
  durationMs: number;
  responseValid: boolean | null;      // null = aún no validada (no debería ocurrir)
  validationError: string | null;
  errorMessage: string | null;
  // responsePayload NO se incluye: puede contener estrategia del agente
  // (guardarlo en log de servidor podría exponer información entre equipos
  //  si los logs son accesibles sin RBAC). Solo se loguea el tipo de acción.
  actionType: 'suggestion' | 'accusation' | 'show_card' | 'cannot_refute' | null;
}

// ─── Llamadas a herramientas MCP ─────────────────────────────────

export interface McpToolCallLog extends BaseLogEntry {
  event: 'mcp_tool_call';
  herramienta: string;
  secuencia: number;         // orden dentro de la invocación, 1-based
  estado: 'ok' | 'error';
  durationMs: number;
  errorMessage: string | null;
  outputHash: string | null;  // SHA-256(JSON.stringify(output)) para verificar integridad
  // inputPayload y outputPayload completos NO se incluyen por defecto;
  // activar con LOG_LEVEL=debug para diagnóstico profundo.
}

// ─── Límite de herramientas superado ─────────────────────────────

export interface McpToolLimitLog extends BaseLogEntry {
  event: 'mcp_tool_limit_exceeded';
  herramienta: string;
  secuencia: number;
}

// ─── Backend Genkit local (llamada al LLM) ───────────────────────

export interface GenkitLlmRequestLog extends BaseLogEntry {
  event: 'genkit_llm_request';
  model: string;                     // e.g. 'googleai/gemini-2.0-flash-exp'
  tipo: 'play_turn' | 'refute';
  systemPromptHash: string;          // SHA-256 del system prompt activo
  userPromptHash: string;            // SHA-256 del user prompt completo (incluye contexto de partida)
  outputFormat: 'json' | 'text';
  // Solo con LOG_LEVEL=debug (pueden contener cartas del equipo solicitante):
  // systemPrompt?: string;
  // userPrompt?: string;
}

export interface GenkitLlmResponseLog extends BaseLogEntry {
  event: 'genkit_llm_response';
  model: string;
  tipo: 'play_turn' | 'refute';
  estado: 'ok' | 'error' | 'parse_error';  // 'parse_error' = LLM respondió pero JSON no valida Zod
  durationMs: number;                       // desde justo antes de ai.generate() hasta validación Zod
  finishReason: string | null;              // 'stop', 'max-tokens', 'other', null si no disponible
  tokensInput: number | null;              // response.usage?.inputTokens
  tokensOutput: number | null;             // response.usage?.outputTokens
  tokensTotal: number | null;
  messageCount: number;                    // response.messages.length
  outputValid: boolean;                    // true si el JSON pasa la validación Zod posterior
  errorMessage: string | null;
  // Solo con LOG_LEVEL=debug (puede incluir razonamiento interno del agente):
  // responseText?: string | null;
}
```

### 3.4 Ejemplo de salida JSON lines (producción)

```jsonl
{"level":30,"service":"clue-arena","component":"agent-coordinator","event":"agent_invocation_start","invocacionId":"a1b2c3d4","gameId":"g-01","teamId":"t-05","turnoId":"tr-42","tipo":"play_turn","agentBackend":"mattin","gameStateViewHash":"sha256:abcdef...","time":1740650000000}
{"level":30,"service":"clue-arena","component":"mcp-tools","event":"mcp_tool_call","invocacionId":"a1b2c3d4","gameId":"g-01","teamId":"t-05","turnoId":"tr-42","herramienta":"get_game_state","secuencia":1,"estado":"ok","durationMs":14,"errorMessage":null,"outputHash":"sha256:9f8e7d...","time":1740650001000}
{"level":30,"service":"clue-arena","component":"mcp-tools","event":"mcp_tool_call","invocacionId":"a1b2c3d4","gameId":"g-01","teamId":"t-05","turnoId":"tr-42","herramienta":"get_agent_memory","secuencia":2,"estado":"ok","durationMs":8,"errorMessage":null,"outputHash":null,"time":1740650001200}
{"level":30,"service":"clue-arena","component":"agent-coordinator","event":"agent_invocation_complete","invocacionId":"a1b2c3d4","gameId":"g-01","teamId":"t-05","turnoId":"tr-42","estado":"completada","durationMs":1340,"responseValid":true,"validationError":null,"errorMessage":null,"actionType":"suggestion","time":1740650002000}
```

Consultas habituales durante el evento:

```bash
# Ver todas las entradas de una invocación concreta
cat server.log | jq 'select(.invocacionId == "a1b2c3d4")'

# Ver errores de agentes en una partida
cat server.log | jq 'select(.gameId == "g-01" and .estado == "error")'

# Contar llamadas MCP por herramienta en una partida
cat server.log | jq 'select(.event == "mcp_tool_call" and .gameId == "g-01") | .herramienta' | sort | uniq -c
```

### 3.5 Ejemplo de salida JSON lines (backend Genkit local)

Con `AGENT_BACKEND=local` se emiten adicionalmente los eventos de llamada al LLM. El pre-fetch de contexto ocurre antes de `ai.generate()` (las herramientas MCP se llaman en el mismo proceso), de modo que los `mcp_tool_call` preceden al `genkit_llm_request`:

```jsonl
{"level":30,"service":"clue-arena","component":"agent-coordinator","event":"agent_invocation_start","invocacionId":"a1b2c3d4","gameId":"g-01","teamId":"t-05","turnoId":"tr-42","tipo":"play_turn","agentBackend":"local","gameStateViewHash":"sha256:abcdef...","time":1740650000000}
{"level":30,"service":"clue-arena","component":"mcp-tools","event":"mcp_tool_call","invocacionId":"a1b2c3d4","gameId":"g-01","teamId":"t-05","turnoId":"tr-42","herramienta":"get_game_state","secuencia":1,"estado":"ok","durationMs":14,"errorMessage":null,"outputHash":"sha256:9f8e7d...","time":1740650000100}
{"level":30,"service":"clue-arena","component":"mcp-tools","event":"mcp_tool_call","invocacionId":"a1b2c3d4","gameId":"g-01","teamId":"t-05","turnoId":"tr-42","herramienta":"get_agent_memory","secuencia":2,"estado":"ok","durationMs":8,"errorMessage":null,"outputHash":null,"time":1740650000150}
{"level":30,"service":"clue-arena","component":"genkit-local","event":"genkit_llm_request","invocacionId":"a1b2c3d4","gameId":"g-01","teamId":"t-05","turnoId":"tr-42","model":"googleai/gemini-2.0-flash-exp","tipo":"play_turn","systemPromptHash":"sha256:c3d4e5...","userPromptHash":"sha256:f6a7b8...","outputFormat":"json","time":1740650000200}
{"level":30,"service":"clue-arena","component":"genkit-local","event":"genkit_llm_response","invocacionId":"a1b2c3d4","gameId":"g-01","teamId":"t-05","turnoId":"tr-42","model":"googleai/gemini-2.0-flash-exp","tipo":"play_turn","estado":"ok","durationMs":1240,"finishReason":"stop","tokensInput":1450,"tokensOutput":87,"tokensTotal":1537,"messageCount":1,"outputValid":true,"errorMessage":null,"time":1740650001440}
{"level":30,"service":"clue-arena","component":"agent-coordinator","event":"agent_invocation_complete","invocacionId":"a1b2c3d4","gameId":"g-01","teamId":"t-05","turnoId":"tr-42","estado":"completada","durationMs":1460,"responseValid":true,"validationError":null,"errorMessage":null,"actionType":"suggestion","time":1740650001460}
```

Consultas de diagnóstico específicas para el backend Genkit:

```bash
# Token usage por invocación en una partida
cat server.log | jq 'select(.event == "genkit_llm_response" and .gameId == "g-01") | {invocacionId, model, tokensTotal, durationMs, finishReason, outputValid}'

# Detectar respuestas con parse_error (LLM respondió JSON inválido)
cat server.log | jq 'select(.event == "genkit_llm_response" and .estado == "parse_error")'

# Tiempo LLM vs. total de invocación (para aislar latencia del modelo)
cat server.log | jq 'select(.event == "genkit_llm_response" or .event == "agent_invocation_complete") | {event, invocacionId, durationMs}'

# Coste estimado de tokens por partida (suma total)
cat server.log | jq '[select(.event == "genkit_llm_response" and .gameId == "g-01") | .tokensTotal] | add'
```

---

## 4. Instrumentación del coordinador

### 4.1 Punto de instrumentación: fachada `invokeAgent`

El registro se realiza **en la fachada `src/lib/api/agent.ts`**, no en los backends individuales (MattinAI o Genkit local). Así el log es transparente al backend activo. En lugar de escrituras a BD, se emiten entradas al logger estructurado.

```typescript
// src/lib/api/agent.ts (actualizado)
import { agentLog } from '@/lib/utils/logger';
import { hashSHA256 } from '@/lib/utils/crypto';
import type { AgentRequest, AgentResponse } from '@/types/api';

export async function invokeAgent(
  request: AgentRequest,
  context: AgentInvocationContext   // ← nuevo parámetro con turnoId y hash de vista
): Promise<{ response: AgentResponse; invocacionId: string }> {

  const invocacionId = crypto.randomUUID();
  const tsStart = Date.now();

  // 1. Emitir evento de inicio
  agentLog.info({
    event: 'agent_invocation_start',
    invocacionId,
    gameId: request.gameId,
    teamId: request.teamId,
    turnoId: context.turnoId,
    tipo: request.type,
    agentBackend: resolveBackendName(),
    gameStateViewHash: context.gameStateViewHash ?? null,
  });

  let response: AgentResponse | null = null;
  let estado: 'completada' | 'timeout' | 'error' = 'error';
  let errorMessage: string | null = null;

  try {
    // Propagar invocacionId al contexto MCP para correlacionar las tool calls
    response = await invokeBackend(request, { invocacionId });
    estado = 'completada';
    return { response, invocacionId };
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    estado = err instanceof AgentTimeoutError ? 'timeout' : 'error';
    throw err;   // re-lanzar para que el Route Handler gestione el turno
  } finally {
    const durationMs = Date.now() - tsStart;

    // 2. Emitir evento de resultado (siempre, incluso en error)
    agentLog.info({
      event: 'agent_invocation_complete',
      invocacionId,
      gameId: request.gameId,
      teamId: request.teamId,
      turnoId: context.turnoId,
      estado,
      durationMs,
      // responseValid se actualiza en el Route Handler tras validar (§4.2)
      responseValid: null,
      validationError: null,
      errorMessage,
      actionType: response?.action?.type ?? null,
    });
  }
}
```

#### `AgentInvocationContext`

```typescript
// src/types/api.ts (adición)
export interface AgentInvocationContext {
  turnoId: string;
  gameStateViewHash?: string;  // SHA-256 de la GameStateView enviada; calculado antes de invocar
}
```

### 4.2 Registro de validación

El motor valida la `AgentResponse` en el Route Handler. El resultado se emite como una entrada de log adicional vinculada al mismo `invocacionId`:

```typescript
// src/lib/utils/log.ts
import { agentLog } from '@/lib/utils/logger';

export function logInvocacionValidity(
  invocacionId: string,
  gameId: string,
  teamId: string,
  turnoId: string,
  valid: boolean,
  validationError?: string
): void {
  agentLog.info({
    event: 'agent_response_validation',
    invocacionId,
    gameId,
    teamId,
    turnoId,
    responseValid: valid,
    validationError: validationError ?? null,
  });
}
```

El `invocacionId` se devuelve desde `invokeAgent` para que el Route Handler lo use:

```typescript
// src/app/api/games/[id]/advance-turn/route.ts (fragmento)
const { response, invocacionId } = await invokeAgent(request, context);
const validationResult = validateAgentResponse(response, gameState);

logInvocacionValidity(
  invocacionId,
  request.gameId,
  request.teamId,
  context.turnoId,
  validationResult.valid,
  validationResult.error
);

if (!validationResult.valid) {
  // Penalizar turno o usar acción por defecto
}
```

### 4.3 Instrumentación de herramientas MCP

Las herramientas MCP se instrumentan mediante un **wrapper de logging** en `src/lib/mcp/tools/` que emite una entrada de log por cada llamada, en lugar de insertar en BD:

```typescript
// src/lib/mcp/tools/_log-wrapper.ts
import { mcpLog } from '@/lib/utils/logger';
import { hashSHA256 } from '@/lib/utils/crypto';

export function withMcpLog<TInput, TOutput>(
  toolName: string,
  handler: (input: TInput, ctx: McpCallContext) => Promise<TOutput>
): (input: TInput, ctx: McpCallContext) => Promise<TOutput> {

  return async (input: TInput, ctx: McpCallContext): Promise<TOutput> => {
    const tsStart = Date.now();
    const seq = ctx.nextSequence();   // también aplica límite (§6.4)
    let output: TOutput | undefined;
    let estado: 'ok' | 'error' = 'error';
    let errorMessage: string | null = null;

    try {
      output = await handler(input, ctx);
      estado = 'ok';
      return output;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const durationMs = Date.now() - tsStart;
      const outputJson = output !== undefined ? JSON.stringify(output) : null;

      mcpLog.info({
        event: 'mcp_tool_call',
        invocacionId: ctx.invocacionId,
        gameId: ctx.gameId,
        teamId: ctx.teamId,
        turnoId: ctx.turnoId,
        herramienta: toolName,
        secuencia: seq,
        estado,
        durationMs,
        errorMessage,
        outputHash: outputJson ? hashSHA256(outputJson) : null,
        // En LOG_LEVEL=debug se incluyen payloads completos para diagnóstico:
        ...(process.env.LOG_LEVEL === 'debug' && {
          inputPayload: input,
          outputPayload: output ?? null,
        }),
      });
    }
  };
}
```

Cada herramienta registrada en `src/lib/mcp/server.ts` pasa por este wrapper — sin cambio en la firma de registro:

```typescript
// src/lib/mcp/server.ts (fragmento)
import { withMcpLog } from './tools/_log-wrapper';
import { getGameStateHandler } from './tools/get-game-state';

server.tool(
  'get_game_state',
  getGameStateSchema,
  withMcpLog('get_game_state', getGameStateHandler)
);
```

#### Propagación del `invocacionId`, `turnoId` y `secuencia`

El coordinador crea un `McpCallContext` cuando lanza al agente. Para Genkit local se propaga a través del `toolContext`. Para MattinAI, el `invocacionId` viaja en el header `X-Clue-Invocation-Id` de cada request al endpoint `/api/mcp`.

```typescript
// src/lib/mcp/tools/context.ts
export interface McpCallContext {
  invocacionId: string;
  gameId: string;
  teamId: string;
  turnoId: string;
  nextSequence(): number;   // también aplica el límite MAX_TOOL_CALLS (§6.4)
}

export function createMcpCallContext(
  invocacionId: string,
  gameId: string,
  teamId: string,
  turnoId: string
): McpCallContext {
  let seq = 0;
  return {
    invocacionId,
    gameId,
    teamId,
    turnoId,
    nextSequence() {
      if (seq >= MAX_TOOL_CALLS_PER_INVOCATION) {
        mcpLog.warn({
          event: 'mcp_tool_limit_exceeded',
          invocacionId,
          gameId,
          teamId,
          turnoId,
          secuencia: seq + 1,
        });
        throw new McpToolLimitExceededError(
          `Máximo de ${MAX_TOOL_CALLS_PER_INVOCATION} llamadas MCP por invocación superado`
        );
      }
      return ++seq;
    },
  };
}
```

### 4.4 Instrumentación del backend Genkit local

El backend local (`src/lib/api/local-agent.ts`) emite dos eventos por cada llamada al LLM: `genkit_llm_request` antes de invocar `ai.generate()` y `genkit_llm_response` tras obtener la respuesta **y** validar el JSON con Zod. Esto permite distinguir errores de red/LLM (`estado='error'`) de respuestas sintácticamente incorrectas (`estado='parse_error'`).

```typescript
// src/lib/api/local-agent.ts (fragmento actualizado — sección ai.generate)
import { agentLog } from '@/lib/utils/logger';
import { hashSHA256 } from '@/lib/utils/crypto';
import { DEFAULT_MODEL } from '@/lib/ai/genkit';

// Dentro de invokeAgent(), tras construir systemPrompt y userPrompt:

const genkitLog = logger.child({ component: 'genkit-local' });

// 1. Log del request LLM
const systemPrompt = isPlayTurn ? PLAY_TURN_SYSTEM_PROMPT : REFUTE_SYSTEM_PROMPT;
const tsLlm = Date.now();

genkitLog.info({
  event: 'genkit_llm_request',
  invocacionId: options.invocacionId,
  gameId: request.gameId,
  teamId: request.teamId,
  turnoId: options.turnoId,
  model: DEFAULT_MODEL,
  tipo: request.type,
  systemPromptHash: hashSHA256(systemPrompt),
  userPromptHash: hashSHA256(userPrompt),
  outputFormat: 'json',
  ...(process.env.LOG_LEVEL === 'debug' && {
    systemPrompt,
    userPrompt,    // RISK: contiene cartas del equipo. Solo en diagnóstico puntual.
  }),
});

// 2. Llamada al LLM
let llmResponse: Awaited<ReturnType<typeof ai.generate>> | undefined;
let llmEstado: 'ok' | 'error' | 'parse_error' = 'error';
let llmError: string | null = null;

try {
  llmResponse = await ai.generate({
    model: DEFAULT_MODEL,
    system: systemPrompt,
    prompt: userPrompt,
    output: { format: 'json' },
  });
} catch (err) {
  llmError = err instanceof Error ? err.message : String(err);
  // 3a. Log response en caso de error de red / API
  genkitLog.info({
    event: 'genkit_llm_response',
    invocacionId: options.invocacionId,
    gameId: request.gameId,
    teamId: request.teamId,
    turnoId: options.turnoId,
    model: DEFAULT_MODEL,
    tipo: request.type,
    estado: 'error',
    durationMs: Date.now() - tsLlm,
    finishReason: null,
    tokensInput: null,
    tokensOutput: null,
    tokensTotal: null,
    messageCount: 0,
    outputValid: false,
    errorMessage: llmError,
  });
  throw err;
}

// 3b. Validación Zod del JSON devuelto por el LLM
const schema = isPlayTurn ? PlayTurnResponseSchema : RefuteResponseSchema;
const parsed = schema.safeParse(llmResponse.output);
llmEstado = parsed.success ? 'ok' : 'parse_error';
if (!parsed.success) llmError = parsed.error.message;

// 4. Log response (siempre, con el resultado real de la validación Zod)
genkitLog.info({
  event: 'genkit_llm_response',
  invocacionId: options.invocacionId,
  gameId: request.gameId,
  teamId: request.teamId,
  turnoId: options.turnoId,
  model: DEFAULT_MODEL,
  tipo: request.type,
  estado: llmEstado,
  durationMs: Date.now() - tsLlm,
  finishReason: llmResponse.finishReason ?? null,
  tokensInput: llmResponse.usage?.inputTokens ?? null,
  tokensOutput: llmResponse.usage?.outputTokens ?? null,
  tokensTotal: llmResponse.usage?.totalTokens ?? null,
  messageCount: llmResponse.messages.length,
  outputValid: parsed.success,
  errorMessage: llmError,
  ...(process.env.LOG_LEVEL === 'debug' && {
    responseText: llmResponse.text ?? null,  // RISK: puede incluir razonamiento del agente.
  }),
});

if (!parsed.success) {
  throw new AgentResponseError(
    `Respuesta del agente no válida: ${parsed.error.message}`,
    llmResponse.text ?? ''
  );
}
```

#### Campos disponibles en `GenerateResponse` (Genkit SDK)

| Campo | Tipo | Descripción |
|---|---|---|
| `response.finishReason` | `string \| undefined` | Razón de fin: `'stop'`, `'max-tokens'`, `'other'`, o `undefined` |
| `response.usage.inputTokens` | `number \| undefined` | Tokens consumidos por el prompt |
| `response.usage.outputTokens` | `number \| undefined` | Tokens generados en la respuesta |
| `response.usage.totalTokens` | `number \| undefined` | Suma de entrada + salida |
| `response.messages` | `Message[]` | Historial completo de mensajes del ciclo |
| `response.output` | `unknown` | Objeto parseado cuando `output.format === 'json'` |
| `response.text` | `string` | Texto crudo del último mensaje del modelo |

> **Nota**: la arquitectura actual pre-fetcha contexto antes de `ai.generate()` (single-turn, sin tool calls dentro de Genkit). Por tanto `messageCount` suele ser 1 y no hay iteraciones LLM adicionales. Si en el futuro se habilitara el modo multi-turn con tools nativas de Genkit, `messageCount` > 1 indicaría cuántas iteraciones realizó el modelo.

---

## 5. Flujo de datos completo

```
POST /api/games/{id}/advance-turn
  │
  ├─ Carga GameState desde BD
  ├─ Calcula GameStateView (filtrada por teamId)
  ├─ gameStateViewHash = SHA-256(JSON.stringify(view))
  │
  ├─ invokeAgent(request, { turnoId, gameStateViewHash })
  │    │
  │    ├─ INSERT invocaciones_agente (estado='invocada')  ─────────────────────┐
  │    │                                                                       │
  │    ├─ [Genkit local]                                                       │
    │    ├─ Pre-fetch ctx (en mcpContextStorage):                           │
    │    │    ├─ loggedGetGameState()                                        │
    │    │    │    └─ withMcpLog → LOG mcp_tool_call(secuencia=1) ──────────┤
    │    │    └─ getAgentMemory()                                            │
    │    │         └─ withMcpLog → LOG mcp_tool_call(secuencia=2) ──────────┤
    │    ├─ LOG genkit_llm_request (model, systemPromptHash, userPromptHash)│
    │    ├─ ai.generate({ system, prompt, output:{format:'json'} })         │
    │    │    └─ LLM genera → JSON con { action, memory? }                  │
    │    ├─ schema.safeParse(response.output)                               │
    │    ├─ LOG genkit_llm_response (durationMs, tokens, finishReason,      │
    │    │      outputValid, estado='ok'|'parse_error'|'error') ────────────┤
    │    └─ si outputValid y memory: saveAgentMemory()                      │
  │    │                                                                       │
  │    ├─ [MattinAI]                                                           │
  │    │    └─ POST /agents/{agentId}/run (SSE)                                │
  │    │         ├─ Agent calls GET /api/mcp  (get_game_state)                 │
  │    │         │    header: X-Invocation-Id: {logId}                         │
  │    │         │    └─ INSERT herramientas_mcp_log ──────────────────────────┤
  │    │         └─ SSE cierra → AgentResponse                                 │
  │    │                                                                       │
  │    ├─ UPDATE invocaciones_agente (estado='completada', durationMs, ...) ───┘
  │    └─ return { response, logId }
  │
  ├─ validateAgentResponse(response, gameState)
  ├─ markInvocacionValidity(logId, valid, ?)
  │
  ├─ applyAction(state, action)
  ├─ Persiste acción en BD (sugerencias / acusaciones)
  │
  └─ [si sugerencia con refutador]
       └─ invokeAgent(refuteRequest, { turnoId, ... })
            └─ nueva fila en invocaciones_agente (tipo='refute')
```

---

## 6. Consideraciones de privacidad y seguridad

### 6.1 Qué se guarda y qué no

| Campo de log | Valor registrado | Justificación |
|---|---|---|
| `requestPayload` | Solo en `LOG_LEVEL=debug` | En nivel `info` solo se loguean IDs (`gameId`, `teamId`, `type`), no datos de juego |
| `gameStateViewHash` | SHA-256 de la vista enviada | Permite verificar el filtrado sin volcar las cartas del equipo en el log |
| `actionType` | Tipo de acción (`suggestion`, `accusation`…) | No sensible; no incluye los valores concretos de la sugerencia |
| `inputPayload` (herramientas) | Solo en `LOG_LEVEL=debug` | Argumentos de la herramienta (solo IDs en nivel `info`) |
| `outputPayload` (herramientas) | Solo en `LOG_LEVEL=debug` | **Puede contener cartas del equipo** en `get_game_state`; en nivel `info` solo se registra `outputHash` |
| `outputHash` | SHA-256 de la salida de la herramienta | Siempre presente; permite verificar integridad sin exponer contenido |
| `genkit_llm_request.systemPromptHash` | SHA-256 del system prompt | Identifica la versión del prompt sin exponer su contenido; útil para detectar cambios en el sistema entre partidas |
| `genkit_llm_request.userPromptHash` | SHA-256 del user prompt | Verifica que el contexto enviado al LLM es correcto sin volcar cartas ni estado de partida |
| `genkit_llm_request.systemPrompt` + `userPrompt` | Solo en `LOG_LEVEL=debug` | **Contienen el estado de partida filtrado** (cartas en mano, historial) inyectado como contexto |
| `genkit_llm_response.tokensInput/Output/Total` | Siempre (numérico) | Útil para monitorizar consumo de API; no sensible |
| `genkit_llm_response.finishReason` | String (`'stop'`, `'max-tokens'`…) | Diagnóstico de truncado o comportamiento anómalo del modelo |
| `genkit_llm_response.responseText` | Solo en `LOG_LEVEL=debug` | Texto crudo del LLM: puede incluir razonamiento interno de la estrategia del agente |

> **RISK**: con `LOG_LEVEL=debug` el log contiene (1) la `GameStateView` con las cartas del equipo solicitante en los payloads de herramientas MCP, (2) el user prompt completo con el estado de partida inyectado, y (3) el texto de razonamiento del LLM. Activar este nivel solo para diagnóstico puntual (no en producción durante el evento). Los archivos de log con `debug` deben tratarse como datos sensibles (acceso restringido al equipo organizador).

### 6.2 El sobre secreto nunca aparece en el log

El coordinador nunca pasa el contenido del sobre al agente. `get_game_state` retorna la `GameStateView` filtrada que **no incluye el sobre**. Por lo tanto, el sobre no puede aparecer en ningún campo del log derivado de la vista.

### 6.3 Retención y rotación del log

El log del servidor se gestiona mediante rotación de archivos. Configuración recomendada para el evento:

```bash
# Redirección con rotación diaria (logrotate o similar)
node server.js 2>&1 | tee -a /var/log/clue-arena/app.log
```

| Parámetro | Valor recomendado |
|---|---|
| Retención | 30 días tras el evento |
| Rotación | Diaria o cada 100 MB |
| Compresin | gzip al rotar |
| Nivel en producción | `info` (sin payloads de juego) |
| Nivel en diagnóstico | `debug` (activa payloads; solo bajo demanda) |

Volumen estimado: ~4 entradas de log por turno (1 start + 1–3 mcp_tool_call + 1 complete) × 50 turnos × 10 partidas = ~2 000 líneas JSON ≈ 500 kB en nivel `info`. Manejable sin rotación especial para el evento.

### 6.4 Límite de llamadas MCP por invocación

Para prevenir comportamientos abusivos (agentes que llaman `get_game_state` cientos de veces en un turno), el coordinador aplica un **límite máximo de herramientas MCP por invocación**:

```typescript
// src/lib/mcp/tools/context.ts
const MAX_TOOL_CALLS_PER_INVOCATION = 20;

export function createMcpCallContext(...): McpCallContext {
  let seq = 0;
  return {
    nextSequence(): number {
      if (seq >= MAX_TOOL_CALLS_PER_INVOCATION) {
        throw new McpToolLimitExceededError(
          `Máximo de ${MAX_TOOL_CALLS_PER_INVOCATION} llamadas MCP por invocación superado`
        );
      }
      return ++seq;
    },
    ...
  };
}
```

El límite se registra en el log como `estado='error'` con `errorMessage` apropiado en la herramienta que lo dispara.

---

## 7. Acceso al log desde la UI admin

### 7.1 Endpoint de streaming en tiempo real

El log del servidor no se consulta vía BD. Para exponer las entradas de log recientes en la UI admin se usa un endpoint **SSE** que re-emite las entradas del logger a través de un `EventEmitter` intermedio:

```
Logger (pino)  ──┒
                ├──►  LogEventEmitter (singleton Node.js)──►  GET /api/admin/log/stream (SSE)
 stdout         ──┘                                              └─► navegador admin
```

El logger emite tanto a `stdout` (persistencia) como al `LogEventEmitter` (streaming en tiempo real). Los clientes SSE reciben las entradas JSON filtradas por `gameId` o `turnoId`.

```typescript
// src/lib/utils/log-emitter.ts
import { EventEmitter } from 'events';

export const logEmitter = new EventEmitter();
logEmitter.setMaxListeners(50);  // máx. 50 clientes simultanéos

// src/lib/utils/logger.ts (actualizado)
import { logEmitter } from './log-emitter';

const stdoutStream = pino.destination(1);  // stdout
const emitterStream = new Writable({
  write(chunk, _, cb) {
    const entry = JSON.parse(chunk.toString());
    logEmitter.emit('log', entry);
    cb();
  },
});

export const logger = pino(
  { level: process.env.LOG_LEVEL ?? 'info', base: { service: 'clue-arena' } },
  pino.multistream([{ stream: stdoutStream }, { stream: emitterStream }])
);
```

### 7.2 Endpoint SSE

```typescript
// src/app/api/admin/log/stream/route.ts
import { auth } from '@/lib/auth/config';
import { logEmitter } from '@/lib/utils/log-emitter';

// Este endpoint corre en Node.js runtime (no Edge)
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response('Unauthorized', { status: 401 });
  if (session.user.rol !== 'admin') return new Response('Forbidden', { status: 403 });

  const gameId = request.nextUrl.searchParams.get('gameId');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const handler = (entry: Record<string, unknown>) => {
        if (gameId && entry.gameId !== gameId) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`));
      };
      logEmitter.on('log', handler);
      request.signal.addEventListener('abort', () => {
        logEmitter.off('log', handler);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

### 7.3 Política de acceso

- **Admin**: acceso completo al stream sin filtro de equipo.
- **Equipo**: sin acceso al endpoint `/api/admin/log/stream`.
- **Espectador**: sin acceso.

En nivel `info` el stream no expone cartas ni payloads sensibles. Si se activa `LOG_LEVEL=debug`, el endpoint debe restringirse a conexiones desde la red local del evento.

---

## 8. Visualización en la UI admin

### 8.1 Panel de log en tiempo real

El panel de partida del admin (`/admin/partidas/{id}`) incluye una sección **"Log de agentes"** que consume el endpoint SSE `GET /api/admin/log/stream?gameId={id}` y muestra las entradas en tiempo real en un componente `"use client"`:

```
┌─ Log de agentes ───────────────────────────────────────────────────────┐
│ [LIVE]  filtrar por equipo: [todos ▾]                               │
├─────────────────────────────────────────────────────────────────┤
│ 14:02:01.234  [t-05] agent_invocation_start play_turn  mattin       │
│ 14:02:01.540  [t-05] mcp_tool_call get_game_state  ok  14ms          │
│ 14:02:01.712  [t-05] mcp_tool_call get_agent_memory  ok  8ms         │
│ 14:02:02.574  [t-05] agent_invocation_complete  ok  1340ms  ✓        │
│ 14:02:02.580  [t-05] agent_response_validation  válida  suggestion    │
│ 14:02:03.100  [t-03] agent_invocation_start refute  mattin           │
│ 14:02:03.560  [t-03] mcp_tool_call get_game_state  ok  11ms          │
│ 14:02:03.988  [t-03] agent_invocation_complete  ok  888ms  ✓         │
└─────────────────────────────────────────────────────────────────┘
```

Cada fila es expandible para ver el `invocacionId` y los campos completos de la entrada JSON. Las entradas de error se resaltan en rojo; los timeouts en amarillo.

### 8.2 Acceso al log completo (post-partida)

Una vez finalizada la partida, el admin puede descargar el archivo de log filtrado por `gameId` mediante:

```bash
# En el servidor, filtrar el log por partida y descargar
grep '"gameId":"g-01"' /var/log/clue-arena/app.log | npx pino-pretty > partida-g-01.txt
```

No hay endpoint HTTP de exportación en MVP; el acceso es directo al servidor (SSH). Si se requiere, añadir en post-MVP (`TODO-LOG-011`).

---

## 9. Propagación del `invocacionId` a MattinAI

Para que el servidor MCP pueda correlacionar las llamadas de herramientas con la invocación correcta cuando el backend es MattinAI (el agente externo llama a `/api/mcp` directamente), el coordinador pasa el `invocacionId` en la petición de invocación al agente:

```
POST /agents/{agentId}/run
Headers:
  X-Clue-Invocation-Id: {logId}
  Authorization: Bearer {MATTIN_API_KEY}
Body: { gameId, teamId, type }
```

El servidor MCP extrae el header `X-Clue-Invocation-Id` de cada request entrante y lo propaga al contexto de la herramienta:

```typescript
// src/app/api/mcp/route.ts (fragmento)
export async function POST(request: NextRequest) {
  const invocacionId = request.headers.get('x-clue-invocation-id') ?? 'unknown';
  // ... inyectar en McpCallContext
}
```

Si el header no está presente (llamadas directas en tests o modo Genkit local sin overhead de red), se genera un UUID local como fallback.

---

## 10. Preguntas abiertas

| ID | Pregunta | Impacto | Bloquea |
|---|---|---|---|
| `OPENQ-LOG-001` | ¿Restringir permisos del archivo de log en producción (chmod 640, propietario `node`)? Con `LOG_LEVEL=debug` el archivo contiene cartas de equipo. | Privacidad si el servidor es multiusuario | Sí (operacional) |
| `OPENQ-LOG-002` | ¿Añadir endpoint HTTP de exportación de log por `gameId` en JSONL para análisis post-evento sin acceso SSH? | Auditoría offline | No (post-MVP, ver `TODO-LOG-011`) |
| `OPENQ-LOG-003` | ¿Cuál es el timeout máximo para `invokeAgent` antes de emitir `estado='timeout'`? Opciones: 30 s, 60 s, 120 s. | Determina cuándo se penaliza un turno automáticamente | Sí (necesario para impl.) |
| `OPENQ-LOG-004` | ¿El `gameStateViewHash` debe firmarse (HMAC) para demostrar que el coordinador lo generó y no fue manipulado? | Auditoría de fairness | No (post-MVP) |
| `OPENQ-LOG-005` | ~~Resuelta~~: el streaming en tiempo real se implementa vía SSE en `GET /api/admin/log/stream` (§7). WebSocket (F011) queda para el panel de espectadores, no para el log. | — | — |

---

## 11. Trabajo pendiente (TODOs)

| ID | Tarea | Prioridad |
|---|---|---|
| `TODO-LOG-001` | Instalar `pino` (prod) y `pino-pretty` (dev); crear `src/lib/utils/logger.ts` y `src/lib/utils/log-emitter.ts` | Alta |
| `TODO-LOG-002` | Implementar `withMcpLog` wrapper y aplicarlo a todas las herramientas MCP existentes | Alta |
| `TODO-LOG-003` | Actualizar `invokeAgent` en `agent.ts` para emitir `agent_invocation_start` / `agent_invocation_complete` | Alta |
| `TODO-LOG-004` | Implementar `createMcpCallContext` con contador de secuencia y límite de llamadas (emit `mcp_tool_limit_exceeded`) | Alta |
| `TODO-LOG-005` | Añadir endpoint SSE `GET /api/admin/log/stream` con RBAC (`admin` únicamente) | Media |
| `TODO-LOG-006` | Implementar componente `AgentLogPanel` en la UI admin (consuma el SSE, filtre por equipo) | Media |
| `TODO-LOG-007` | Implementar propagación de `X-Clue-Invocation-Id` en el cliente MattinAI | Alta |
| `TODO-LOG-008` | Añadir `turnoId` al `McpCallContext` y propagarlo desde el Route Handler | Alta |
| `TODO-LOG-009` | Definir `LOG_LEVEL` en `.env.example` y documentar cuándo usar `debug` | Baja |
| `TODO-LOG-010` | Escribir tests unitarios para `withMcpLog` (mock del logger, verificar campos emitidos) | Media |
| `TODO-LOG-011` | (Post-MVP) Endpoint HTTP de exportación de log por partida en JSONL | Baja |
| `TODO-LOG-012` | Añadir tipos `GenkitLlmRequestLog` y `GenkitLlmResponseLog` a `src/lib/utils/log-types.ts` | Alta |
| `TODO-LOG-013` | Crear child logger `genkit-local` en `src/lib/utils/logger.ts` o directamente en `local-agent.ts` | Alta |
| `TODO-LOG-014` | Emitir `genkit_llm_request` en `local-agent.ts` antes de `ai.generate()` con `systemPromptHash` y `userPromptHash` (usar `hashSHA256` de `@/lib/utils/crypto`) | Alta |
| `TODO-LOG-015` | Emitir `genkit_llm_response` tras la validación Zod en `local-agent.ts` con `tokensInput/Output/Total`, `finishReason`, `outputValid` y `estado='ok'\|'parse_error'\|'error'` | Alta |
| `TODO-LOG-016` | En path de error de `ai.generate()` (catch), emitir `genkit_llm_response` con `estado='error'` antes de re-lanzar | Alta |
| `TODO-LOG-017` | Documentar en `.env.example` que `LOG_LEVEL=debug` vuelca el user prompt (contiene estado de partida) y el `responseText` del LLM | Baja |
| `TODO-LOG-018` | Escribir tests unitarios para la instrumentación Genkit: mock de `ai.generate()` → verificar campos emitidos en ambos eventos, incluyendo el path `parse_error` | Media |

---

## 12. Decisiones de diseño registradas

| Decisión | Alternativa considerada | Razón de la elección |
|---|---|---|
| Log del servidor (pino JSON lines) en lugar de BD | SQLite/Drizzle con tablas `invocaciones_agente` / `herramientas_mcp_log` | El log de interacción es tracing operacional, no datos de dominio. No requiere migraciones, no añade latencia transaccional y es compatible con cualquier agregador de logs sin cambios |
| `pino` como librería de logging | `winston`, `bunyan`, `console.log` estructurado | pino es la más rápida para Node.js, produce JSON lines nativamente, tiene soporte oficial de `multistream` para fan-out a stdout + EventEmitter, y `pino-pretty` para desarrollo |
| Fan-out a `LogEventEmitter` para SSE en tiempo real | Polling HTTP / Query a BD | Los eventos de log ya se producen en proceso; un EventEmitter es la forma más eficiente de propagarlos sin almacenamiento intermedio |
| `outputPayload` de herramientas solo con `LOG_LEVEL=debug` | Siempre en texto plano (como en el diseño anterior) | Evita registrar cartas de equipo en logs persistentes por defecto; el hash SHA-256 cubre el caso de verificación de integridad |
| `actionType` en el completion log (no `responsePayload` completo) | Serializar todo el `AgentResponse` | El tipo de acción (`suggestion`, `accusation`…) es suficiente para observabilidad en `info`; los detalles de la jugada ya se persisten en BD (tabla `sugerencias`/`acusaciones`) |
| Límite de 20 llamadas MCP: error emitido al logger, no a BD | Registro en BD / sin límite | Consistente con el enfoque de log-only; la detección de abuso se hace por análisis del log, no por query a BD |
| `genkit_llm_response` emitido **después** de la validación Zod (no en `finally` de `ai.generate`) | Emitir en `finally` (solo estado de red, sin estado de parseo) | Permite registrar `estado='parse_error'` cuando el LLM responde pero el JSON no es válido según el esquema. Diferencia crítica para diagnóstico de degradación de calidad del modelo. |
| `userPromptHash` en lugar de `userPrompt` en nivel `info` | Serializar el prompt completo siempre | El prompt incluye el estado de partida filtrado (cartas en mano, historial). Registrar solo el hash en `info` evita que los logs persistentes contengan datos de juego sensibles; el hash permite verificar que el contenido enviado no cambió entre ejecuciones. |
| `tokensInput/Output/Total` siempre en `info` (no restringidos a `debug`) | Solo en `debug` | Los valores de tokens son numéricos, no contienen datos de juego, y son esenciales para monitorizar el consumo de API (costes) durante el evento en tiempo real. |
