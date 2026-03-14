/**
 * Training agent wrapper (F015) — invokeAgentWithTrace.
 *
 * Wraps the agent invocation to capture the full interaction trace
 * (prompts, raw LLM responses, tool calls, memory state) exclusively for
 * training game turns of the real team.
 *
 * Accepts a pre-built GameStateView JSON string (from engine.getGameStateView)
 * so that training games do not need to be persisted in the official partidas table.
 *
 * Supports both backends:
 *   - 'local' (default): Genkit/local — full prompt/response/tool-call trace captured here.
 *   - 'mattin': Remote MattinAI — calls the real production agent; only input/output
 *     are observable. Internal tool calls are visible via F012 MCP logs (invocacionId).
 *     Per-turn timeout of MATTIN_TURN_TIMEOUT_MS applies to avoid runaway training games.
 */

import { z } from 'zod';
import type { AgentRequest, AgentResponse, AgentAction, AgentInteractionTrace, AgentLlmExchange, AgentToolCall } from '@/types/api';
import { ai, DEFAULT_MODEL } from '@/lib/ai/genkit';
import { PLAY_TURN_SYSTEM_PROMPT } from '@/lib/ai/prompts/play-turn';
import { REFUTE_SYSTEM_PROMPT } from '@/lib/ai/prompts/refute';
import { getAgentMemory, saveAgentMemory } from '@/lib/ai/agent-memory';

const MATTIN_TURN_TIMEOUT_MS = 90_000; // 90 s per-turn cap for Mattin training turns

// ---------------------------------------------------------------------------
// Zod schemas (mirrored from local-agent.ts)
// ---------------------------------------------------------------------------

const PlayTurnResponseSchema = z.object({
  action: z.union([
    z.object({
      type: z.literal('suggestion'),
      suspect: z.string(),
      weapon: z.string(),
      room: z.string(),
    }),
    z.object({
      type: z.literal('accusation'),
      suspect: z.string(),
      weapon: z.string(),
      room: z.string(),
    }),
    z.object({ type: z.literal('pass') }),
  ]),
  memory: z.record(z.unknown()).optional(),
});

const RefuteResponseSchema = z.union([
  z.object({
    action: z.object({ type: z.literal('show_card'), card: z.string() }),
  }),
  z.object({
    action: z.object({ type: z.literal('cannot_refute') }),
  }),
]);

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface InvokeAgentWithTraceResult {
  agentResponse:  AgentResponse;
  trace:          AgentInteractionTrace;
  memoriaInicial: Record<string, unknown>;
  memoriaFinal:   Record<string, unknown>;
  durationMs:     number;
}

export interface TrainingAgentRequest {
  agentRequest:   AgentRequest;
  /** Pre-built GameStateView JSON string from engine.getGameStateView() */
  gameStateJson:  string;
  /** Agent backend to use. Defaults to 'local'. */
  agentBackend?:  'mattin' | 'local';
  /** Required when agentBackend === 'mattin' */
  mattinAgentId?: string;
  mattinAppId?:   string;
  mattinApiKey?:  string;
  /** Correlation IDs for F012 logs (training loop provides these) */
  invocacionId?:  string;
  turnoId?:       string;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Invokes the agent for a training turn and captures the full interaction
 * trace (prompts, LLM response, tool calls, memory diff).
 *
 * When agentBackend === 'local' (default): full Genkit trace is captured here.
 * When agentBackend === 'mattin': the real production agent is invoked; only
 *   input/output are observable—internal tool calls appear in F012 MCP logs.
 */
export async function invokeAgentWithTrace(
  req: TrainingAgentRequest,
): Promise<InvokeAgentWithTraceResult> {
  const backend = req.agentBackend ?? 'local';

  if (backend === 'mattin') {
    return invokeAgentWithTraceMatttin(req);
  }
  return invokeAgentWithTraceLocal(req);
}

// ---------------------------------------------------------------------------
// Local / Genkit backend
// ---------------------------------------------------------------------------

async function invokeAgentWithTraceLocal(
  req: TrainingAgentRequest,
): Promise<InvokeAgentWithTraceResult> {
  const { agentRequest: request, gameStateJson } = req;
  const tsStart = Date.now();
  const isPlayTurn = request.type === 'play_turn';
  const systemPrompt = isPlayTurn ? PLAY_TURN_SYSTEM_PROMPT : REFUTE_SYSTEM_PROMPT;

  // --- Step 1: capture memory before the turn ---
  const memoriaInicial = await getAgentMemory(request.gameId, request.teamId);
  const memoryJson = JSON.stringify(memoriaInicial);

  // --- Step 2: build user prompt (context-injection, same as local-agent.ts) ---
  const baseContext =
    `gameId="${request.gameId}" teamId="${request.teamId}"\n\n` +
    `## Estado actual de la partida\n${gameStateJson}\n\n` +
    `## Tu memoria de turnos anteriores\n${memoryJson}\n\n`;

  const refuteRequest = request as Extract<AgentRequest, { type: 'refute' }>;
  const userPrompt = isPlayTurn
    ? `${baseContext}Razona a partir del contexto y decide tu acción. Devuelve ÚNICAMENTE el JSON solicitado.`
    : `${baseContext}` +
      `Refuta la combinación: sospechoso="${refuteRequest.suspect}", ` +
      `arma="${refuteRequest.weapon}", ` +
      `habitación="${refuteRequest.room}".\n\n` +
      `Devuelve ÚNICAMENTE el JSON solicitado.`;

  // --- Step 3: call the LLM ---
  const tsLlm = Date.now();
  let rawResponse = '';
  let parseError: string | null = null;
  let parsedAction: AgentResponse | null = null;

  let llmResponse: Awaited<ReturnType<typeof ai.generate>>;
  try {
    llmResponse = await ai.generate({
      model: DEFAULT_MODEL,
      system: systemPrompt,
      prompt: userPrompt,
      output: { format: 'json' },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const toolCalls: AgentToolCall[] = buildContextToolCalls(request, gameStateJson, memoryJson);
    const exchange: AgentLlmExchange = {
      index: 0,
      systemPrompt,
      userPrompt,
      rawResponse: '',
      toolCalls,
      durationMs: Date.now() - tsLlm,
    };
    const trace: AgentInteractionTrace = {
      type: request.type,
      backendType: 'local',
      exchanges: [exchange],
      totalToolCalls: toolCalls.length,
      parsedAction: null,
      parseError: errMsg,
    };
    throw new TrainingAgentError(errMsg, trace);
  }

  const llmDurationMs = Date.now() - tsLlm;

  // Collect raw response text
  rawResponse = llmResponse.messages
    .filter((m) => m.role === 'model')
    .flatMap((m) => m.content)
    .filter((p) => p.text)
    .map((p) => p.text!)
    .join('\n');

  // --- Step 4: persist memory update if present (play_turn only) ---
  if (isPlayTurn) {
    const rawOutput = llmResponse.output as Record<string, unknown> | null;
    const updatedMemory = rawOutput?.memory;
    if (updatedMemory && typeof updatedMemory === 'object') {
      await saveAgentMemory(request.gameId, request.teamId, updatedMemory as Record<string, unknown>);
    }
  }

  // --- Step 5: capture memory after the turn ---
  const memoriaFinal = await getAgentMemory(request.gameId, request.teamId);

  // --- Step 6: build synthetic "tool calls" for transparency ---
  // For the context-injection approach, represent the context fetches as
  // synthetic tool calls so the trace is still meaningful.
  const toolCalls: AgentToolCall[] = buildContextToolCalls(request, gameStateJson, memoryJson);

  // --- Step 7: validate parsed output ---
  const schema = isPlayTurn ? PlayTurnResponseSchema : RefuteResponseSchema;
  const parsed = schema.safeParse(llmResponse.output);

  if (parsed.success) {
    parsedAction = {
      action: parsed.data.action as AgentAction,
      reasoning: rawResponse,
      done: true,
    };
  } else {
    parseError = parsed.error.message;
  }

  // --- Step 8: assemble trace ---
  const exchange: AgentLlmExchange = {
    index: 0,
    systemPrompt,
    userPrompt,
    rawResponse,
    toolCalls,
    durationMs: llmDurationMs,
  };

  const trace: AgentInteractionTrace = {
    type: request.type,
    backendType: 'local',
    exchanges: [exchange],
    totalToolCalls: toolCalls.length,
    parsedAction,
    parseError,
  };

  if (!parsedAction) {
    throw new TrainingAgentError(parseError ?? 'Parse error', trace);
  }

  return {
    agentResponse: parsedAction,
    trace,
    memoriaInicial,
    memoriaFinal,
    durationMs: Date.now() - tsStart,
  };
}

// ---------------------------------------------------------------------------
// Mattin (remote) backend
// ---------------------------------------------------------------------------

async function invokeAgentWithTraceMatttin(
  req: TrainingAgentRequest,
): Promise<InvokeAgentWithTraceResult> {
  const { agentRequest: request } = req;
  const tsStart = Date.now();
  const isPlayTurn = request.type === 'play_turn';
  const systemPrompt = isPlayTurn ? PLAY_TURN_SYSTEM_PROMPT : REFUTE_SYSTEM_PROMPT;

  // Memory before the turn (Mattin reads memory via MCP, but we snapshot here for the trace)
  const memoriaInicial = await getAgentMemory(request.gameId, request.teamId);

  // User prompt stub — Mattin builds its own prompt internally; we record what we sent
  // as the AgentRequest message so the trace is meaningful.
  const userPromptRecord = JSON.stringify(request);

  const invocacionId = req.invocacionId ?? crypto.randomUUID();
  const turnoId      = req.turnoId      ?? crypto.randomUUID();

  // Wrap with per-turn timeout to prevent runaway training games
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`MattinAI training turn timed out after ${MATTIN_TURN_TIMEOUT_MS} ms`)),
      MATTIN_TURN_TIMEOUT_MS,
    ),
  );

  let rawResponse = '';
  let parsedAction: AgentResponse | null = null;
  let parseError: string | null = null;

  try {
    const { invokeAgent: invokeMattinAgent } = await import('./mattin');
    const agentResponse = await Promise.race([
      invokeMattinAgent(request, {
        invocacionId,
        turnoId,
        agentId: req.mattinAgentId,
        appId:   req.mattinAppId,
        apiKey:  req.mattinApiKey,
      }),
      timeoutPromise,
    ]);

    parsedAction = agentResponse;
    rawResponse = JSON.stringify(agentResponse);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const trace: AgentInteractionTrace = {
      type: request.type,
      backendType: 'mattin',
      exchanges: [
        {
          index: 0,
          systemPrompt,
          userPrompt: userPromptRecord,
          rawResponse: '',
          toolCalls: [],
          durationMs: Date.now() - tsStart,
        },
      ],
      totalToolCalls: 0,
      parsedAction: null,
      parseError: errMsg,
    };
    throw new TrainingAgentError(errMsg, trace);
  }

  // Memory after the turn (Mattin may have called save_agent_memory via MCP)
  const memoriaFinal = await getAgentMemory(request.gameId, request.teamId);

  const exchange: AgentLlmExchange = {
    index: 0,
    systemPrompt,
    // userPrompt for Mattin: we record the serialised AgentRequest (what we sent to the API)
    userPrompt: userPromptRecord,
    rawResponse,
    // Tool calls are not observable here; they appear in F012 MCP logs under invocacionId
    toolCalls: [],
    durationMs: Date.now() - tsStart,
  };

  const trace: AgentInteractionTrace = {
    type: request.type,
    backendType: 'mattin',
    exchanges: [exchange],
    totalToolCalls: 0,
    parsedAction,
    parseError: null,
  };

  return {
    agentResponse: parsedAction,
    trace,
    memoriaInicial,
    memoriaFinal,
    durationMs: Date.now() - tsStart,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildContextToolCalls(
  request: AgentRequest,
  gameStateJson: string,
  memoryJson: string,
): AgentToolCall[] {
  return [
    {
      tool: 'get_game_state',
      args: { game_id: request.gameId, team_id: request.teamId },
      result: { content: gameStateJson },
      durationMs: 0,
    },
    {
      tool: 'get_agent_memory',
      args: { game_id: request.gameId, team_id: request.teamId },
      result: { content: memoryJson },
      durationMs: 0,
    },
  ];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class TrainingAgentError extends Error {
  constructor(
    message: string,
    public readonly trace: AgentInteractionTrace,
  ) {
    super(message);
    this.name = 'TrainingAgentError';
  }
}
