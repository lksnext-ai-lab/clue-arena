import { z } from 'zod';
import { db } from '@/lib/db';
import { partidas, partidaEquipos, equipos, turnos, sugerencias, acusaciones } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getGameStateView } from '@/lib/game/engine';
import type { GameState } from '@/lib/game/types';

export const getGameStateTool = {
  schema: {
    game_id: z.string().describe('ID de la partida'),
    team_id: z.string().describe('ID del equipo solicitante'),
  },

  handler: async ({ game_id, team_id }: { game_id: string; team_id: string }) => {
    const partida = await db
      .select()
      .from(partidas)
      .where(eq(partidas.id, game_id))
      .get();

    if (!partida) throw new Error(`Partida ${game_id} no encontrada`);

    const equipoRows = await db
      .select()
      .from(partidaEquipos)
      .where(eq(partidaEquipos.partidaId, game_id))
      .all();

    // Check team is part of the game
    const teamInGame = equipoRows.find((e) => e.equipoId === team_id);
    if (!teamInGame) throw new Error('El equipo no participa en esta partida');

    // Build GameState from DB
    const state: GameState = {
      gameId: game_id,
      estado: partida.estado as GameState['estado'],
      turnoActual: partida.turnoActual,
      sobre: { sospechoso: '' as any, arma: '' as any, habitacion: '' as any }, // envelope is hidden
      equipos: equipoRows.map((e) => ({
        equipoId: e.equipoId,
        orden: e.orden,
        cartas: JSON.parse(e.cartas),
        eliminado: e.eliminado,
        puntos: e.puntos,
      })),
      historial: [],
      ganadorId: null,
      seed: 0,
    };

    const view = getGameStateView(state, team_id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(view) }] };
  },
};
