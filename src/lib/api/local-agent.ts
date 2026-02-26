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
import { getAgentMemory, saveAgentMemory } from '@/lib/ai/agent-memory';
import { PLAY_TURN_SYSTEM_PROMPT } from '@/lib/ai/prompts/play-turn';
import { REFUTE_SYSTEM_PROMPT } from '@/lib/ai/prompts/refute';

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

// --- Main export ---
export async function invokeAgent(request: AgentRequest): Promise<AgentResponse> {
  const isPlayTurn = request.type === 'play_turn';

  // Pre-fetch context so the model doesn't need tool calls (single-turn safe).
  const [gameStateJson, agentMemory] = await Promise.all([
    getGameStateTool.handler({ game_id: request.gameId, team_id: request.teamId })
      .then((r) => r.content[0].text)
      .catch(() => '{}'),
    getAgentMemory(request.gameId, request.teamId).catch(() => ({})),
  ]);

  const contextBlock =
    `## Estado actual de la partida\n\`\`\`json\n${gameStateJson}\n\`\`\`\n\n` +
    `## Tu memoria de turnos anteriores\n\`\`\`json\n${JSON.stringify(agentMemory, null, 2)}\n\`\`\``;

  const userPrompt = isPlayTurn
    ? `${contextBlock}\n\nJuega tu turno.`
    : `${contextBlock}\n\n` +
      `Refuta la combinación: sospechoso="${request.suspect}", arma="${request.weapon}", habitación="${request.room}".`;

  const response = await ai.generate({
    model: DEFAULT_MODEL,
    system: isPlayTurn ? PLAY_TURN_SYSTEM_PROMPT : REFUTE_SYSTEM_PROMPT,
    prompt: userPrompt,
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
