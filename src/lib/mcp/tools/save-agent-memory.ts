import { z } from 'zod';
import { saveAgentMemory } from '@/lib/ai/agent-memory';

export const saveAgentMemoryTool = {
  schema: {
    game_id: z.string().describe('ID de la partida'),
    team_id: z.string().describe('ID del equipo propietario de la memoria'),
    memory: z
      .union([z.string(), z.record(z.unknown())])
      .describe('Estado de deducción del agente — objeto JSON o string JSON serializado'),
  },

  handler: async ({
    game_id,
    team_id,
    memory,
  }: {
    game_id: string;
    team_id: string;
    memory: string | Record<string, unknown>;
  }) => {
    const now = new Date().toISOString();
    // Accept both a pre-parsed object and a raw JSON string
    let memoryJson: string;
    if (typeof memory === 'string') {
      try {
        JSON.parse(memory);
        memoryJson = memory;
      } catch {
        memoryJson = JSON.stringify({ raw: memory });
      }
    } else {
      memoryJson = JSON.stringify(memory);
    }

    await saveAgentMemory(game_id, team_id, JSON.parse(memoryJson) as Record<string, unknown>);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ ok: true, updatedAt: now }),
        },
      ],
    };
  },
};
