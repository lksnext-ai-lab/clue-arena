// GET /api/tournaments/:id/standings — current standings

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  tournaments,
  tournamentTeams,
  tournamentRounds,
  tournamentRoundGames,
  partidaEquipos,
  equipos,
} from '@/lib/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { computeTournamentStandings } from '@/lib/tournament';
import type { GameResult, TeamId, GameId } from '@/lib/tournament/types';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const t = await db.select().from(tournaments).where(eq(tournaments.id, id)).get();
  if (!t) return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 });

  // Load enrolled teams with their team info
  const enrolled = await db
    .select({ tt: tournamentTeams, e: equipos })
    .from(tournamentTeams)
    .innerJoin(equipos, eq(tournamentTeams.teamId, equipos.id))
    .where(eq(tournamentTeams.tournamentId, id))
    .all();

  // Load all rounds
  const rounds = await db
    .select()
    .from(tournamentRounds)
    .where(eq(tournamentRounds.tournamentId, id))
    .orderBy(asc(tournamentRounds.roundNumber))
    .all();

  // Build game → round number map and collect all game results
  const gameRoundMap = new Map<GameId, number>();
  const gameResults: GameResult[] = [];

  for (const round of rounds) {
    const roundGames = await db
      .select()
      .from(tournamentRoundGames)
      .where(and(eq(tournamentRoundGames.roundId, round.id), eq(tournamentRoundGames.isBye, false)))
      .all();

    for (const rg of roundGames) {
      if (!rg.gameId) continue;
      const gameId = rg.gameId;
      gameRoundMap.set(gameId, round.roundNumber);

      const teamScores = await db
        .select({ equipoId: partidaEquipos.equipoId, puntos: partidaEquipos.puntos })
        .from(partidaEquipos)
        .where(eq(partidaEquipos.partidaId, gameId))
        .all();

      const maxScore = teamScores.length > 0 ? Math.max(...teamScores.map((ts) => ts.puntos)) : 0;

      for (const ts of teamScores) {
        gameResults.push({
          gameId,
          teamId:  ts.equipoId as TeamId,
          score:   ts.puntos,
          won:     ts.puntos === maxScore && maxScore > 0,
          elims:   0, // simplified: eliminations tracked separately
        });
      }
    }
  }

  const teamDomain = enrolled.map(({ tt }) => ({
    teamId:     tt.teamId as TeamId,
    seed:       tt.seed ?? null,
    groupIndex: tt.groupIndex ?? null,
    eliminated: tt.eliminated,
  }));

  const roundDomain = rounds.map((r) => ({
    id:          r.id,
    roundNumber: r.roundNumber,
    phase:       r.phase,
    status:      r.status,
  }));

  const rawStandings = computeTournamentStandings(
    teamDomain,
    roundDomain,
    gameResults,
    gameRoundMap,
  );

  // Find the current active round number
  const activeRound = rounds.find((r) => r.status === 'active') ?? rounds[rounds.length - 1] ?? null;

  const teamMeta = new Map(enrolled.map(({ tt, e }) => [
    tt.teamId,
    { teamName: e.nombre, avatarUrl: e.avatarUrl ?? null },
  ]));

  const standings = rawStandings.map((s, idx) => ({
    rank:               idx + 1,
    teamId:             s.teamId,
    teamName:           teamMeta.get(s.teamId)?.teamName ?? s.teamId,
    avatarUrl:          teamMeta.get(s.teamId)?.avatarUrl ?? null,
    groupIndex:         s.groupIndex,
    totalScore:         s.totalScore,
    gamesPlayed:        s.gamesPlayed,
    wins:               s.wins,
    eliminations:       s.eliminations,
    isEliminated:       s.isEliminated,
    advancedToPlayoffs: s.advancedToPlayoffs,
    roundScores:        s.roundScores,
  }));

  return NextResponse.json({
    tournamentId:   id,
    tournamentName: t.name,
    format:         t.format,
    status:         t.status,
    currentRound:   activeRound?.roundNumber ?? null,
    standings,
  });
}
