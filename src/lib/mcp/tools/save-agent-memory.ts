import { z } from 'zod';
import { db } from '@/lib/db';
import { agentMemories } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export const saveAgentMemoryTool = {
  schema: {
    game_id: z.string().describe('ID de la partida'),
    team_id: z.string().describe('ID del equipo propietario de la memoria'),
    memory: z
      .record(z.unknown())
      .describe('Objeto JSON con el estado de deducción persistente del agente'),
  },

  handler: async ({
    game_id,
    team_id,
    memory,
  }: {
    game_id: string;
    team_id: string;
    memory: Record<string, unknown>;
  }) => {
    const now = new Date().toISOString();
    const memoryJson = JSON.stringify(memory);

    const existing = await db
      .select({ gameId: agentMemories.gameId })
      .from(agentMemories)
      .where(and(eq(agentMemories.gameId, game_id), eq(agentMemories.teamId, team_id)))
      .get();

    if (existing) {
      await db
        .update(agentMemories)
        .set({ memoryJson, updatedAt: now })
        .where(and(eq(agentMemories.gameId, game_id), eq(agentMemories.teamId, team_id)));
    } else {
      await db.insert(agentMemories).values({
        gameId: game_id,
        teamId: team_id,
        memoryJson,
        updatedAt: now,
      });
    }

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
