/**
 * Genkit tools for the local Cluedo agent.
 * Server-side only.
 */
import { z } from 'zod';
import { ai } from '../genkit';
import { getGameStateTool } from '@/lib/mcp/tools/get-game-state';
import { getAgentMemory, saveAgentMemory } from '../agent-memory';

/** Tool 1: estado del juego — reutiliza el handler del tool MCP existente */
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
