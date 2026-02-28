/**
 * Local agent backend using Genkit — implements AgentRequest/AgentResponse contract.
 * Server-side only. Never import this in client components.
 *
 * Context-injection approach (tool-free):
 *   Game state and agent memory are fetched directly before the LLM call and
 *   embedded in the user prompt.  A single ai.generate() call is made without
 *   any Genkit tools, making this implementation compatible with thinking models
 *   (Gemini 2.5 Pro / Flash Thinking) that cannot mix tool-calling with extended
 *   thinking mode.
 *
 *   For play_turn the model may include an optional "memory" field in its JSON
 *   response.  If present, it is persisted via saveAgentMemory so that future
 *   turns can benefit from accumulated deductions.
 *
 *   McpCallContext (AsyncLocalStorage) is set for the entire invocation so that
 *   the context-fetch helpers below emit F012-compatible log entries via the
 *   withMcpLog wrapper.
 */
import { z } from 'zod';
import type { AgentRequest, AgentResponse, AgentAction } from '@/types/api';
import { ai, DEFAULT_MODEL } from '@/lib/ai/genkit';
import { createMcpCallContext, mcpContextStorage } from '@/lib/mcp/tools/context';
import { withMcpLog } from '@/lib/mcp/tools/_log-wrapper';
import { PLAY_TURN_SYSTEM_PROMPT } from '@/lib/ai/prompts/play-turn';
import { REFUTE_SYSTEM_PROMPT } from '@/lib/ai/prompts/refute';
import { logGenkitRequest, logGenkitResponse } from '@/lib/ai/genkit-log';
import { getGameStateTool } from '@/lib/mcp/tools/get-game-state';
import { getAgentMemory, saveAgentMemory } from '@/lib/ai/agent-memory';

// ---------------------------------------------------------------------------
// Instrumented context-fetch helpers (F012 logging, no agentic tool calls)
// ---------------------------------------------------------------------------

const loggedGetGameState = withMcpLog('get_game_state', getGameStateTool.handler);

const loggedGetAgentMemory = withMcpLog(
  'get_agent_memory',
  async ({ game_id, team_id }: { game_id: string; team_id: string }) => {
    const memory = await getAgentMemory(game_id, team_id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(memory) }] };
  },
);

const loggedSaveAgentMemory = withMcpLog(
  'save_agent_memory',
  async ({
    game_id,
    team_id,
    memory,
  }: {
    game_id: string;
    team_id: string;
    memory: Record<string, unknown>;
  }) => {
    await saveAgentMemory(game_id, team_id, memory);
    return { content: [{ type: 'text' as const, text: 'ok' }] };
  },
);

// ---------------------------------------------------------------------------
// Zod schemas — validate the final JSON action emitted by the LLM
// ---------------------------------------------------------------------------

/**
 * play_turn: action + optional memory the model wants to persist for next turn.
 */
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

export interface LocalAgentOptions {
  /** F012: UUID from the parent invokeAgent call for log correlation */
  invocacionId: string;
  turnoId: string;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function invokeAgent(
  request: AgentRequest,
  options: LocalAgentOptions,
): Promise<AgentResponse> {
  const isPlayTurn = request.type === 'play_turn';

  // McpCallContext: provides F012 correlation IDs for context-fetch log entries.
  const mcpCtx = createMcpCallContext(
    options.invocacionId,
    request.gameId,
    request.teamId,
    options.turnoId,
  );

  const systemPrompt = isPlayTurn ? PLAY_TURN_SYSTEM_PROMPT : REFUTE_SYSTEM_PROMPT;

  const baseResponseParams = {
    invocacionId: options.invocacionId,
    gameId: request.gameId,
    teamId: request.teamId,
    turnoId: options.turnoId,
    model: DEFAULT_MODEL,
    tipo: request.type,
  } as const;

  let llmResponse: Awaited<ReturnType<typeof ai.generate>>;

  try {
    llmResponse = await mcpContextStorage.run(mcpCtx, async () => {
      // ── Step 1: fetch all context before the LLM call (parallel) ─────────
      // withMcpLog emits F012-compatible log entries for each fetch.
      const [gameStateResult, memoryResult] = await Promise.all([
        loggedGetGameState({ game_id: request.gameId, team_id: request.teamId }) as Promise<{
          content: { text: string }[];
        }>,
        loggedGetAgentMemory({ game_id: request.gameId, team_id: request.teamId }) as Promise<{
          content: { text: string }[];
        }>,
      ]);

      const gameStateJson = gameStateResult.content[0].text;
      const memoryJson = memoryResult.content[0].text;

      // ── Step 2: build context-rich user prompt ────────────────────────────
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

      // F012 §4.4 — log before the LLM call
      logGenkitRequest({
        invocacionId: options.invocacionId,
        gameId: request.gameId,
        teamId: request.teamId,
        turnoId: options.turnoId,
        model: DEFAULT_MODEL,
        tipo: request.type,
        systemPrompt,
        userPrompt,
      });

      // ── Step 3: single LLM call — no tools, compatible with thinking models
      const response = await ai.generate({
        model: DEFAULT_MODEL,
        system: systemPrompt,
        prompt: userPrompt,
        output: { format: 'json' },
      });

      // ── Step 4: persist memory update if the model included one ───────────
      if (isPlayTurn) {
        const rawOutput = response.output as Record<string, unknown> | null;
        const updatedMemory = rawOutput?.memory;
        if (updatedMemory && typeof updatedMemory === 'object') {
          await loggedSaveAgentMemory({
            game_id: request.gameId,
            team_id: request.teamId,
            memory: updatedMemory as Record<string, unknown>,
          });
        }
      }

      return response;
    });
  } catch (err) {
    logGenkitResponse({
      ...baseResponseParams,
      estado: 'error',
      durationMs: 0,
      finishReason: null,
      tokensInput: null,
      tokensOutput: null,
      tokensTotal: null,
      messageCount: 0,
      outputValid: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  // Collect reasoning/thinking text from model-role messages.
  const reasoning = llmResponse.messages
    .filter((m) => m.role === 'model')
    .flatMap((m) => m.content)
    .filter((p) => p.text)
    .map((p) => p.text!)
    .join('\n');

  // Validate the final structured JSON output with Zod.
  const schema = isPlayTurn ? PlayTurnResponseSchema : RefuteResponseSchema;
  const parsed = schema.safeParse(llmResponse.output);

  // F012 §4.4 — log after Zod validation.
  logGenkitResponse({
    ...baseResponseParams,
    estado: parsed.success ? 'ok' : 'parse_error',
    durationMs:
      (llmResponse.usage as { latencyMs?: number } | undefined)?.latencyMs ?? 0,
    finishReason: llmResponse.finishReason ?? null,
    tokensInput:
      (llmResponse.usage as { inputTokens?: number } | undefined)?.inputTokens ?? null,
    tokensOutput:
      (llmResponse.usage as { outputTokens?: number } | undefined)?.outputTokens ?? null,
    tokensTotal:
      (llmResponse.usage as { totalTokens?: number } | undefined)?.totalTokens ?? null,
    messageCount: llmResponse.messages.length,
    outputValid: parsed.success,
    errorMessage: parsed.success ? null : parsed.error.message,
    responseText: llmResponse.text ?? null,
  });

  if (!parsed.success) {
    throw new AgentResponseError(
      `Respuesta del agente no válida: ${parsed.error.message}`,
      reasoning,
    );
  }

  return {
    action: parsed.data.action as AgentAction,
    reasoning,
    done: true,
  };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AgentResponseError extends Error {
  constructor(
    message: string,
    public readonly reasoning: string,
  ) {
    super(message);
    this.name = 'AgentResponseError';
  }
}
