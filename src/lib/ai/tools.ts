/**
 * Genkit-native tool definitions for the local agent.
 *
 * Each tool wraps the existing handler (get-game-state, agent-memory) through
 * the `withMcpLog` middleware so F012 log entries are emitted exactly as they
 * would be for MattinAI tool calls via the MCP HTTP endpoint.
 *
 * Context propagation:
 *   The caller must wrap `ai.generate()` inside
 *   `mcpContextStorage.run(mcpCtx, ...)` so AsyncLocalStorage propagates the
 *   McpCallContext into these handlers when Genkit invokes them.
 *
 * Registered once at module-init time; safe to reuse across invocations.
 *
 * Server-side only — do NOT import in Edge runtime or client components.
 */

import { z } from 'zod';
import { ai } from '@/lib/ai/genkit';
import { getGameStateTool } from '@/lib/mcp/tools/get-game-state';
import { withMcpLog } from '@/lib/mcp/tools/_log-wrapper';
import { getAgentMemory, saveAgentMemory } from '@/lib/ai/agent-memory';

// ---------------------------------------------------------------------------
// Instrumented plain handlers
// ---------------------------------------------------------------------------
// Each handler is shaped as (input: Record<string,unknown>) => Promise<unknown>
// so it fits the `withMcpLog` generic constraint.

/** Returns the filtered GameStateView as a JSON string. */
const loggedGetGameState = withMcpLog(
  'get_game_state',
  getGameStateTool.handler,
);

/** Returns the agent's stored memory as a JSON string. */
const loggedGetAgentMemory = withMcpLog(
  'get_agent_memory',
  async ({ game_id, team_id }: { game_id: string; team_id: string }) => {
    const memory = await getAgentMemory(game_id, team_id);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(memory) }],
    };
  },
);

/** Persists updated agent memory and returns "ok". */
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
// Genkit tool definitions
// ---------------------------------------------------------------------------

/**
 * Lets the agent fetch the current game state (cards in hand, suggestion
 * history, active teams, current turn) filtered to its own perspective.
 */
export const genkitGetGameState = ai.defineTool(
  {
    name: 'get_game_state',
    description:
      'Obtiene el estado actual de la partida desde la perspectiva de tu equipo: ' +
      'cartas en mano, historial de sugerencias, equipos activos y estado del turno actual.',
    inputSchema: z.object({
      game_id: z.string().describe('ID de la partida'),
      team_id: z.string().describe('ID de tu equipo'),
    }),
    outputSchema: z
      .string()
      .describe('JSON con el GameStateView filtrado para tu equipo'),
  },
  async ({ game_id, team_id }) => {
    const result = await loggedGetGameState({ game_id, team_id }) as {
      content: { text: string }[];
    };
    return result.content[0].text;
  },
);

/**
 * Retrieves the agent's persistent memory from previous turns: deductions,
 * seen cards, elimination notes.
 * Returns an empty object on the first turn.
 */
export const genkitGetAgentMemory = ai.defineTool(
  {
    name: 'get_agent_memory',
    description:
      'Recupera tu memoria de turnos anteriores: deducciones, cartas vistas, ' +
      'y cualquier nota estratégica que hayas guardado. ' +
      'Devuelve un objeto vacío en el primer turno.',
    inputSchema: z.object({
      game_id: z.string().describe('ID de la partida'),
      team_id: z.string().describe('ID de tu equipo'),
    }),
    outputSchema: z
      .string()
      .describe('JSON con la memoria persistente del agente'),
  },
  async ({ game_id, team_id }) => {
    const result = await loggedGetAgentMemory({ game_id, team_id }) as {
      content: { text: string }[];
    };
    return result.content[0].text;
  },
);

/**
 * Persists the agent's updated memory so it is available in future turns.
 * Call this BEFORE emitting the final JSON action.
 */
export const genkitSaveAgentMemory = ai.defineTool(
  {
    name: 'save_agent_memory',
    description:
      'Guarda o actualiza tu memoria para los siguientes turnos. ' +
      'Llama a esta herramienta al final de tu razonamiento, ANTES de emitir la acción final, ' +
      'para persistir tus deducciones actualizadas.',
    inputSchema: z.object({
      game_id: z.string().describe('ID de la partida'),
      team_id: z.string().describe('ID de tu equipo'),
      memory: z
        .record(z.unknown())
        .describe(
          'Objeto JSON con tus deducciones: cartas descartadas, cartas vistas de otros, hipótesis activa',
        ),
    }),
    outputSchema: z.string().describe('"ok" si la memoria se guardó correctamente'),
  },
  async ({ game_id, team_id, memory }) => {
    const result = await loggedSaveAgentMemory({ game_id, team_id, memory }) as {
      content: { text: string }[];
    };
    return result.content[0].text;
  },
);
