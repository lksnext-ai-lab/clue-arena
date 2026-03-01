import { z } from 'zod';
import { db } from '@/lib/db';
import { agentMemories } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export const getAgentMemoryTool = {
  schema: {
    game_id: z.string().describe('ID de la partida'),
    team_id: z.string().describe('ID del equipo propietario de la memoria'),
  },

  handler: async ({ game_id, team_id }: { game_id: string; team_id: string }) => {
    const row = await db
      .select()
      .from(agentMemories)
      .where(and(eq(agentMemories.gameId, game_id), eq(agentMemories.teamId, team_id)))
      .get();

    const memory: Record<string, unknown> = row ? JSON.parse(row.memoryJson) : {};
    const updatedAt: string | null = row?.updatedAt ?? null;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ memory, updatedAt }),
        },
      ],
    };
  },
};
