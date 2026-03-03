import { z } from 'zod';
import { db } from '@/lib/db';
import { sugerencias } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const showCardTool = {
  schema: {
    game_id: z.string().describe('ID de la partida'),
    team_id: z.string().describe('ID del equipo solicitante (debe ser el que hizo la sugerencia)'),
    suggestion_id: z.string().describe('ID de la sugerencia'),
  },

  handler: async ({
    game_id,
    team_id,
    suggestion_id,
  }: {
    game_id: string;
    team_id: string;
    suggestion_id: string;
  }) => {
    const sugerencia = await db
      .select()
      .from(sugerencias)
      .where(
        and(
          eq(sugerencias.id, suggestion_id),
          eq(sugerencias.partidaId, game_id)
        )
      )
      .get();

    if (!sugerencia) throw new Error('Sugerencia no encontrada');

    // Only the team that made the suggestion can see the shown card (RI-005)
    if (sugerencia.equipoId !== team_id) {
      throw new Error('No tienes acceso a la carta mostrada de esta sugerencia');
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            suggestion_id,
            cartaMostrada: sugerencia.cartaMostrada,
            refutadaPor: sugerencia.refutadaPor,
          }),
        },
      ],
    };
  },
};
