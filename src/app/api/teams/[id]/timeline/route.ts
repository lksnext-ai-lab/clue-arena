import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  equipos,
  partidas,
  partidaEquipos,
  tournamentRoundGames,
  tournamentRounds,
  tournamentTeams,
  tournaments,
  usuarios,
} from '@/lib/db/schema';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const session = await getAuthSession();
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId')?.trim() || null;

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const team = await db.select().from(equipos).where(eq(equipos.id, id)).get();
  if (!team) {
    return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
  }

  if (session.user.rol !== 'admin') {
    const user = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.email, session.user.email))
      .get();

    if (!user || team.usuarioId !== user.id) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
  }

  const teamTournaments = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      status: tournaments.status,
    })
    .from(tournamentTeams)
    .innerJoin(tournaments, eq(tournamentTeams.tournamentId, tournaments.id))
    .where(eq(tournamentTeams.teamId, id))
    .all();

  if (tournamentId && !teamTournaments.some((entry) => entry.id === tournamentId)) {
    return NextResponse.json({ error: 'Torneo no encontrado para este equipo' }, { status: 404 });
  }

  let allowedGameIds: string[] | null = null;
  if (tournamentId) {
    const rounds = await db
      .select({ id: tournamentRounds.id })
      .from(tournamentRounds)
      .where(eq(tournamentRounds.tournamentId, tournamentId))
      .all();

    const roundIds = rounds.map((round) => round.id);
    if (roundIds.length === 0) {
      allowedGameIds = [];
    } else {
      const games = await db
        .select({ gameId: tournamentRoundGames.gameId })
        .from(tournamentRoundGames)
        .where(inArray(tournamentRoundGames.roundId, roundIds))
        .all();
      allowedGameIds = games.map((game) => game.gameId).filter((gameId): gameId is string => !!gameId);
    }
  }

  const rows = await db
    .select({
      gameId: partidas.id,
      gameName: partidas.nombre,
      gameStatus: partidas.estado,
      createdAt: partidas.createdAt,
      startedAt: partidas.startedAt,
      finishedAt: partidas.finishedAt,
      points: partidaEquipos.puntos,
    })
    .from(partidaEquipos)
    .innerJoin(partidas, eq(partidaEquipos.partidaId, partidas.id))
    .where(and(eq(partidaEquipos.equipoId, id), eq(partidas.estado, 'finalizada')))
    .all();

  const scopedRows = allowedGameIds
    ? rows.filter((row) => allowedGameIds.includes(row.gameId))
    : rows;

  const sorted = scopedRows.sort((a, b) => {
    const aTime = (a.finishedAt ?? a.startedAt ?? a.createdAt)?.getTime?.() ?? 0;
    const bTime = (b.finishedAt ?? b.startedAt ?? b.createdAt)?.getTime?.() ?? 0;
    return aTime - bTime;
  });

  let cumulativePoints = 0;
  const timeline = sorted.map((row, index) => {
    const date = row.finishedAt ?? row.startedAt ?? row.createdAt;
    cumulativePoints += row.points;

    return {
      index: index + 1,
      gameId: row.gameId,
      gameName: row.gameName,
      gameStatus: row.gameStatus,
      points: row.points,
      cumulativePoints,
      playedAt: date instanceof Date ? date.toISOString() : String(date),
    };
  });

  return NextResponse.json({
    teamId: id,
    scope: tournamentId ? 'tournament' : 'global',
    tournament: tournamentId
      ? teamTournaments.find((entry) => entry.id === tournamentId) ?? null
      : null,
    tournaments: teamTournaments,
    timeline,
  });
}
