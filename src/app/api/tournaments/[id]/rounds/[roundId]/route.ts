// GET /api/tournaments/:id/rounds/:roundId — round detail with games and results

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  tournaments,
  tournamentRounds,
  tournamentRoundGames,
  partidas,
  partidaEquipos,
  equipos,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; roundId: string }> },
) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id, roundId } = await params;

  const t = await db.select().from(tournaments).where(eq(tournaments.id, id)).get();
  if (!t) return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 });

  const round = await db
    .select()
    .from(tournamentRounds)
    .where(and(eq(tournamentRounds.id, roundId), eq(tournamentRounds.tournamentId, id)))
    .get();

  if (!round) return NextResponse.json({ error: 'Ronda no encontrada' }, { status: 404 });

  const roundGames = await db
    .select()
    .from(tournamentRoundGames)
    .where(eq(tournamentRoundGames.roundId, roundId))
    .all();

  const gamesData = await Promise.all(
    roundGames.map(async (rg) => {
      if (rg.isBye || !rg.gameId) {
        return { id: rg.id, gameId: null, isBye: true, teams: [], estado: null };
      }

      const gameId = rg.gameId!;
      const game = await db.select().from(partidas).where(eq(partidas.id, gameId)).get();
      const teamScores = await db
        .select({ pe: partidaEquipos, e: equipos })
        .from(partidaEquipos)
        .innerJoin(equipos, eq(partidaEquipos.equipoId, equipos.id))
        .where(eq(partidaEquipos.partidaId, gameId))
        .all();

      return {
        id:     rg.id,
        gameId: rg.gameId,
        isBye:  false,
        estado: game?.estado ?? null,
        teams:  teamScores.map(({ pe, e }) => ({
          teamId:    pe.equipoId,
          teamName:  e.nombre,
          avatarUrl: e.avatarUrl ?? null,
          puntos:    pe.puntos,
          eliminado: pe.eliminado,
        })),
      };
    }),
  );

  return NextResponse.json({
    id:           round.id,
    tournamentId: id,
    roundNumber:  round.roundNumber,
    phase:        round.phase,
    status:       round.status,
    generatedAt:  round.generatedAt?.toISOString() ?? null,
    finishedAt:   round.finishedAt?.toISOString() ?? null,
    games:        gamesData,
  });
}
