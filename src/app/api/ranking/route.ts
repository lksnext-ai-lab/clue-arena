import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  equipos,
  partidas,
  scoreEvents,
  tournaments,
  tournamentRoundGames,
  tournamentRounds,
  tournamentTeams,
} from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

interface ScopedTeam {
  id: string;
  nombre: string;
  avatarUrl: string | null;
  createdAt: Date;
}

interface TournamentMeta {
  id: string;
  name: string;
}

async function loadScopedContext(tournamentId: string | null): Promise<{
  teams: ScopedTeam[];
  finishedGameIds: string[];
  tournament: TournamentMeta | null;
}> {
  if (!tournamentId) {
    const [teams, finishedGames] = await Promise.all([
      db.select({
        id: equipos.id,
        nombre: equipos.nombre,
        avatarUrl: equipos.avatarUrl,
        createdAt: equipos.createdAt,
      }).from(equipos).all(),
      db.select({ id: partidas.id }).from(partidas).where(eq(partidas.estado, 'finalizada')).all(),
    ]);

    return {
      teams,
      finishedGameIds: finishedGames.map((game) => game.id),
      tournament: null,
    };
  }

  const tournament = await db
    .select({ id: tournaments.id, name: tournaments.name })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .get();

  if (!tournament) {
    throw new Error('TOURNAMENT_NOT_FOUND');
  }

  const [teams, rounds] = await Promise.all([
    db
      .select({
        id: equipos.id,
        nombre: equipos.nombre,
        avatarUrl: equipos.avatarUrl,
        createdAt: equipos.createdAt,
      })
      .from(tournamentTeams)
      .innerJoin(equipos, eq(tournamentTeams.teamId, equipos.id))
      .where(eq(tournamentTeams.tournamentId, tournamentId))
      .all(),
    db
      .select({ id: tournamentRounds.id })
      .from(tournamentRounds)
      .where(eq(tournamentRounds.tournamentId, tournamentId))
      .all(),
  ]);

  const roundIds = rounds.map((round) => round.id);
  if (roundIds.length === 0) {
    return {
      teams,
      finishedGameIds: [],
      tournament,
    };
  }

  const scopedGames = await db
    .select({ gameId: tournamentRoundGames.gameId, isBye: tournamentRoundGames.isBye })
    .from(tournamentRoundGames)
    .where(inArray(tournamentRoundGames.roundId, roundIds))
    .all();

  const candidateGameIds = scopedGames
    .filter((game) => !game.isBye && Boolean(game.gameId))
    .map((game) => game.gameId as string);

  if (candidateGameIds.length === 0) {
    return {
      teams,
      finishedGameIds: [],
      tournament,
    };
  }

  const finishedGames = await db
    .select({ id: partidas.id })
    .from(partidas)
    .where(and(inArray(partidas.id, candidateGameIds), eq(partidas.estado, 'finalizada')))
    .all();

  return {
    teams,
    finishedGameIds: finishedGames.map((game) => game.id),
    tournament,
  };
}

// GET /api/ranking?tournamentId=<id>
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId')?.trim() || null;

  try {
    const { teams, finishedGameIds, tournament } = await loadScopedContext(tournamentId);

    const allEvents = finishedGameIds.length > 0
      ? await db
          .select()
          .from(scoreEvents)
          .where(inArray(scoreEvents.gameId, finishedGameIds))
          .all()
      : [];

    const rankingData = teams.map((team) => {
      const teamEvents = allEvents.filter((event) => event.equipoId === team.id);

      let puntos = 0;
      let wins = 0;
      let efficiencyBonus = 0;
      let speedBonus = 0;
      let gamesWithPoints = 0;
      let refutations = 0;

      for (const gameId of finishedGameIds) {
        const gameEvents = teamEvents.filter((event) => event.gameId === gameId);
        if (gameEvents.length === 0) continue;

        const rawScore = gameEvents.reduce((sum, event) => sum + event.points, 0);
        const flooredScore = Math.max(0, rawScore);
        puntos += flooredScore;

        if (flooredScore > 0) {
          gamesWithPoints += 1;
        }

        wins += gameEvents.filter((event) => event.type === 'EVT_WIN').length;
        efficiencyBonus += gameEvents
          .filter((event) => event.type === 'EVT_WIN_EFFICIENCY')
          .reduce((sum, event) => sum + event.points, 0);
        speedBonus += gameEvents
          .filter((event) => event.type === 'EVT_TURN_SPEED')
          .reduce((sum, event) => sum + event.points, 0);
        refutations += gameEvents.filter((event) => event.type === 'EVT_REFUTATION').length;
      }

      return {
        equipoId: team.id,
        equipoNombre: team.nombre,
        avatarUrl: team.avatarUrl ?? null,
        puntos,
        partidasJugadas: finishedGameIds.filter((gameId) =>
          teamEvents.some((event) => event.gameId === gameId),
        ).length,
        aciertos: wins,
        _wins: wins,
        _efficiencyBonus: efficiencyBonus,
        _speedBonus: speedBonus,
        _gamesWithPoints: gamesWithPoints,
        _refutations: refutations,
        _createdAt: new Date(team.createdAt).getTime(),
      };
    });

    rankingData.sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      if (b._wins !== a._wins) return b._wins - a._wins;
      if (b._efficiencyBonus !== a._efficiencyBonus) return b._efficiencyBonus - a._efficiencyBonus;
      if (b._speedBonus !== a._speedBonus) return b._speedBonus - a._speedBonus;
      if (b._gamesWithPoints !== a._gamesWithPoints) return b._gamesWithPoints - a._gamesWithPoints;
      if (b._refutations !== a._refutations) return b._refutations - a._refutations;
      return a._createdAt - b._createdAt;
    });

    return NextResponse.json({
      ranking: rankingData.map((entry, index) => ({
        id: `${entry.equipoId}-ranking`,
        equipoId: entry.equipoId,
        equipoNombre: entry.equipoNombre,
        avatarUrl: entry.avatarUrl,
        puntos: entry.puntos,
        partidasJugadas: entry.partidasJugadas,
        aciertos: entry.aciertos,
        posicion: index + 1,
      })),
      updatedAt: new Date().toISOString(),
      scope: tournament ? 'tournament' : 'global',
      tournament,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'TOURNAMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 });
    }

    throw error;
  }
}
