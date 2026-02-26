import { z } from 'zod';
import { db } from '@/lib/db';
import {
  partidas,
  partidaEquipos,
  turnos,
  sugerencias,
  sobres,
  equipos,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Carta } from '@/types/domain';

export const makeSuggestionTool = {
  schema: {
    game_id: z.string().describe('ID de la partida'),
    team_id: z.string().describe('ID del equipo que realiza la sugerencia'),
    suspect: z.string().describe('Nombre del sospechoso'),
    weapon: z.string().describe('Nombre del arma'),
    room: z.string().describe('Nombre de la habitación'),
  },

  handler: async ({
    game_id,
    team_id,
    suspect,
    weapon,
    room,
  }: {
    game_id: string;
    team_id: string;
    suspect: string;
    weapon: string;
    room: string;
  }) => {
    const partida = await db
      .select()
      .from(partidas)
      .where(eq(partidas.id, game_id))
      .get();

    if (!partida || partida.estado !== 'en_curso') {
      throw new Error('Partida no disponible o no en curso');
    }

    // Find current turn
    const turno = await db
      .select()
      .from(turnos)
      .where(
        and(
          eq(turnos.partidaId, game_id),
          eq(turnos.equipoId, team_id),
          eq(turnos.estado, 'en_curso')
        )
      )
      .get();

    if (!turno) throw new Error('No hay turno activo para este equipo');

    // Find refutador: other teams that have at least one of the cards, in order
    const allTeams = await db
      .select()
      .from(partidaEquipos)
      .where(eq(partidaEquipos.partidaId, game_id))
      .all();

    const suggesterIdx = allTeams.findIndex((t) => t.equipoId === team_id);
    let refutadoPor: string | null = null;
    let cartaMostrada: Carta | null = null;

    for (let i = 1; i < allTeams.length; i++) {
      const candidate = allTeams[(suggesterIdx + i) % allTeams.length];
      if (candidate.eliminado) continue;

      const cartas: Carta[] = JSON.parse(candidate.cartas);
      const matching = cartas.filter((c) => c === suspect || c === weapon || c === room);
      if (matching.length > 0) {
        refutadoPor = candidate.equipoId;
        cartaMostrada = matching[0];
        break;
      }
    }

    // Persist suggestion
    await db.insert(sugerencias).values({
      id: uuidv4(),
      turnoId: turno.id,
      partidaId: game_id,
      equipoId: team_id,
      sospechoso: suspect,
      arma: weapon,
      habitacion: room,
      refutadaPor: refutadoPor,
      cartaMostrada,
      createdAt: new Date(),
    });

    const result = {
      refutadaPor: refutadoPor,
      refutada: refutadoPor !== null,
    };

    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
  },
};
