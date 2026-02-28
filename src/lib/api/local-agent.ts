/**
 * Local agent backend using Genkit — implements AgentRequest/AgentResponse contract.
 * Server-side only. Never import this in client components.
 *
 * NOTE: We do NOT use Genkit tools here. Models in the gemini-2.5/3.x family attach
 * thought_signatures to function-call responses; Genkit does not echo them back in the
 * subsequent tool-result turn, causing a 400 error. Instead we pre-fetch all context
 * (game state + memory) and inject it into a single-turn prompt.
 */
import { z } from 'zod';
import type { AgentRequest, AgentResponse, AgentAction } from '@/types/api';
import { ai, DEFAULT_MODEL } from '@/lib/ai/genkit';
import { getGameStateTool } from '@/lib/mcp/tools/get-game-state';
import { withMcpLog } from '@/lib/mcp/tools/_log-wrapper';
import { createMcpCallContext, mcpContextStorage } from '@/lib/mcp/tools/context';
import { getAgentMemory, saveAgentMemory } from '@/lib/ai/agent-memory';
import { PLAY_TURN_SYSTEM_PROMPT } from '@/lib/ai/prompts/play-turn';
import { REFUTE_SYSTEM_PROMPT } from '@/lib/ai/prompts/refute';
import { logGenkitRequest, logGenkitResponse } from '@/lib/ai/genkit-log';

// --- Zod schemas for validating LLM JSON output ---
const PlayTurnResponseSchema = z.union([
  z.object({
    action: z.object({
      type: z.literal('suggestion'),
      suspect: z.string(),
      weapon: z.string(),
      room: z.string(),
    }),
    memory: z.record(z.unknown()).optional(),
  }),
  z.object({
    action: z.object({
      type: z.literal('accusation'),
      suspect: z.string(),
      weapon: z.string(),
      room: z.string(),
    }),
    memory: z.record(z.unknown()).optional(),
  }),
]);

const RefuteResponseSchema = z.union([
  z.object({
    action: z.object({ type: z.literal('show_card'), card: z.string() }),
  }),
  z.object({
    action: z.object({ type: z.literal('cannot_refute') }),
  }),
]);

export interface LocalAgentOptions {
  /** F012: UUID from the parent invokeAgent call for log correlation */
  invocacionId: string;
  turnoId: string;
}

// Wrapped handlers for consistent MCP tool call logging (F012)
const loggedGetGameState = withMcpLog('get_game_state', getGameStateTool.handler);

// --- Main export ---
export async function invokeAgent(
  request: AgentRequest,
  options: LocalAgentOptions,
): Promise<AgentResponse> {
  const isPlayTurn = request.type === 'play_turn';

  // F012: create McpCallContext so withMcpLog can correlate tool calls
  const mcpCtx = createMcpCallContext(
    options.invocacionId,
    request.gameId,
    request.teamId,
    options.turnoId,
  );

  // Pre-fetch context so the model doesn't need tool calls (single-turn safe).
  // Run inside mcpContextStorage so withMcpLog picks up the context.
  const [gameStateJson, agentMemory] = await mcpContextStorage.run(mcpCtx, () =>
    Promise.all([
      loggedGetGameState({ game_id: request.gameId, team_id: request.teamId })
        .then((r) => (r as { content: { text: string }[] }).content[0].text)
        .catch(() => '{}'),
      getAgentMemory(request.gameId, request.teamId).catch(() => ({})),
    ]),
  );

  const contextBlock =
    `## Estado actual de la partida\n\`\`\`json\n${gameStateJson}\n\`\`\`\n\n` +
    `## Tu memoria de turnos anteriores\n\`\`\`json\n${JSON.stringify(agentMemory, null, 2)}\n\`\`\``;

  const systemPrompt = isPlayTurn ? PLAY_TURN_SYSTEM_PROMPT : REFUTE_SYSTEM_PROMPT;

  const userPrompt = isPlayTurn
    ? `${contextBlock}\n\nJuega tu turno.`
    : `${contextBlock}\n\n` +
      `Refuta la combinación: sospechoso="${request.suspect}", arma="${request.weapon}", habitación="${request.room}".`;

  // F012 §4.4 — log the LLM request before calling ai.generate()
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

  const tsLlm = Date.now();

  // F012 §4.4 — shared log params reused in both catch and success paths
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
    llmResponse = await ai.generate({
      model: DEFAULT_MODEL,
      system: systemPrompt,
      prompt: userPrompt,
      output: { format: 'json' },
    });
  } catch (err) {
    logGenkitResponse({
      ...baseResponseParams,
      estado: 'error',
      durationMs: Date.now() - tsLlm,
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

  // Accumulate reasoning text from all model messages
  const reasoning = llmResponse.messages
    .filter((m) => m.role === 'model')
    .flatMap((m) => m.content)
    .filter((p) => p.text)
    .map((p) => p.text!)
    .join('');

  // Parse and validate the structured action
  const schema = isPlayTurn ? PlayTurnResponseSchema : RefuteResponseSchema;
  const parsed = schema.safeParse(llmResponse.output);

  // F012 §4.4 — log response after Zod validation so estado reflects parse errors too
  logGenkitResponse({
    ...baseResponseParams,
    estado: parsed.success ? 'ok' : 'parse_error',
    durationMs: Date.now() - tsLlm,
    finishReason: llmResponse.finishReason ?? null,
    tokensInput: (llmResponse.usage as { inputTokens?: number } | undefined)?.inputTokens ?? null,
    tokensOutput: (llmResponse.usage as { outputTokens?: number } | undefined)?.outputTokens ?? null,
    tokensTotal: (llmResponse.usage as { totalTokens?: number } | undefined)?.totalTokens ?? null,
    messageCount: llmResponse.messages.length,
    outputValid: parsed.success,
    errorMessage: parsed.success ? null : parsed.error.message,
    responseText: llmResponse.text ?? null,
  });

  if (!parsed.success) {
    throw new AgentResponseError(
      `Respuesta del agente no válida: ${parsed.error.message}`,
      reasoning
    );
  }

  // Persist memory if the model included it (play_turn only)
  if (isPlayTurn && 'memory' in parsed.data && parsed.data.memory) {
    await saveAgentMemory(request.gameId, request.teamId, parsed.data.memory).catch(
      (e) => console.warn('[local-agent] Failed to save memory:', e)
    );
  }

  return {
    action: parsed.data.action as AgentAction,
    reasoning,
    done: true,
  };
}

export class AgentResponseError extends Error {
  constructor(
    message: string,
    public readonly reasoning: string
  ) {
    super(message);
    this.name = 'AgentResponseError';
  }
}
