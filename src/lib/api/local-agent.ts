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
  z.object({
    action: z.object({
      type: z.literal('suggestion'),
      suspect: z.string(),
      weapon: z.string(),
      room: z.string(),
    }),
  }),
  z.object({
    action: z.object({
      type: z.literal('accusation'),
      suspect: z.string(),
      weapon: z.string(),
      room: z.string(),
    }),
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

  const userPrompt = isPlayTurn
    ? `game_id: ${request.gameId}\nteam_id: ${request.teamId}\nJuega tu turno.`
    : `game_id: ${request.gameId}\nteam_id: ${request.teamId}\n` +
      `Refuta la combinación: sospechoso="${request.suspect}", arma="${request.weapon}", habitación="${request.room}".`;

  const response = await ai.generate({
    model: DEFAULT_MODEL,
    system: isPlayTurn ? PLAY_TURN_SYSTEM_PROMPT : REFUTE_SYSTEM_PROMPT,
    prompt: userPrompt,
    tools: isPlayTurn ? [...PLAY_TURN_TOOLS] : [...REFUTE_TOOLS],
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
  constructor(
    message: string,
    public readonly reasoning: string
  ) {
    super(message);
    this.name = 'AgentResponseError';
  }
}
