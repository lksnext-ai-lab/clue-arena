import { z } from 'zod';
import { db } from '@/lib/db';
import {
  partidas,
  partidaEquipos,
  turnos,
  acusaciones,
  sobres,
  ranking,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { SOSPECHOSOS, ARMAS, HABITACIONES } from '@/types/domain';

export const makeAccusationTool = {
  schema: {
    game_id: z.string().describe('ID de la partida'),
    team_id: z.string().describe('ID del equipo que realiza la acusación'),
    suspect: z.enum(SOSPECHOSOS).describe('Sospechoso acusado (canónico del evento)'),
    weapon: z.enum(ARMAS).describe('Arma acusada (canónica del evento)'),
    room: z.enum(HABITACIONES).describe('Habitación acusada (canónica del evento)'),
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

    const sobre = await db
      .select()
      .from(sobres)
      .where(eq(sobres.partidaId, game_id))
      .get();

    if (!sobre) throw new Error('Sobre no encontrado para esta partida');

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

    const correcta =
      suspect === sobre.sospechoso &&
      weapon === sobre.arma &&
      room === sobre.habitacion;

    // Persist accusation
    await db.insert(acusaciones).values({
      id: uuidv4(),
      turnoId: turno.id,
      partidaId: game_id,
      equipoId: team_id,
      sospechoso: suspect,
      arma: weapon,
      habitacion: room,
      correcta,
      createdAt: new Date(),
    });

    // Mark turn as completed
    await db
      .update(turnos)
      .set({ estado: 'completado', finishedAt: new Date() })
      .where(eq(turnos.id, turno.id));

    if (correcta) {
      // Game over: mark game as finished, team as winner
      await db
        .update(partidas)
        .set({ estado: 'finalizada', finishedAt: new Date() })
        .where(eq(partidas.id, game_id));

      await db
        .update(partidaEquipos)
        .set({ puntos: 100 })
        .where(
          and(eq(partidaEquipos.partidaId, game_id), eq(partidaEquipos.equipoId, team_id))
        );
    } else {
      // Eliminate team
      await db
        .update(partidaEquipos)
        .set({ eliminado: true })
        .where(
          and(eq(partidaEquipos.partidaId, game_id), eq(partidaEquipos.equipoId, team_id))
        );

      // Check if all teams are eliminated
      const remaining = await db
        .select()
        .from(partidaEquipos)
        .where(and(eq(partidaEquipos.partidaId, game_id)))
        .all();

      const allEliminated = remaining.every((e) => e.eliminado);
      if (allEliminated) {
        await db
          .update(partidas)
          .set({ estado: 'finalizada', finishedAt: new Date() })
          .where(eq(partidas.id, game_id));
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            correcta,
            ganador: correcta ? team_id : null,
            eliminado: !correcta,
          }),
        },
      ],
    };
  },
};
