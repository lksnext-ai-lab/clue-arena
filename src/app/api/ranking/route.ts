import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { equipos, partidas, scoreEvents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/ranking
export async function GET() {
  // 1. All teams and finished game IDs
  const [allTeams, finishedGames] = await Promise.all([
    db.select().from(equipos).all(),
    db.select({ id: partidas.id }).from(partidas).where(eq(partidas.estado, 'finalizada')).all(),
  ]);

  const finishedGameIds = finishedGames.map((g) => g.id);

  if (finishedGameIds.length === 0) {
    // No finished games yet — return all teams with 0 points
    const ranked = allTeams.map((team, idx) => ({
      id: `${team.id}-ranking`,
      equipoId: team.id,
      equipoNombre: team.nombre,
      avatarUrl: team.avatarUrl ?? null,
      puntos: 0,
      partidasJugadas: 0,
      aciertos: 0,
      posicion: idx + 1,
    }));
    return NextResponse.json({ ranking: ranked, updatedAt: new Date().toISOString() });
  }

  // 2. Load all score events for finished games in a single query
  const allEvents = await db
    .select()
    .from(scoreEvents)
    .where(
      finishedGameIds.length === 1
        ? eq(scoreEvents.gameId, finishedGameIds[0])
        : and(...(finishedGameIds.map((id) => eq(scoreEvents.gameId, id)) as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])),
    )
    .all();

  // 3. Compute per-team aggregates with per-partida floor
  const rankingData = allTeams.map((team) => {
    const teamEvents = allEvents.filter((e) => e.equipoId === team.id);

    // Group by gameId
    let scoreEvento = 0;
    let wins = 0;
    let effBonusTotal = 0;
    let gamesWithPoints = 0;
    let refutations = 0;

    for (const gameId of finishedGameIds) {
      const gameEvents = teamEvents.filter((e) => e.gameId === gameId);
      if (gameEvents.length === 0) continue;

      const rawScore = gameEvents.reduce((sum, e) => sum + e.points, 0);
      const flooredScore = Math.max(0, rawScore);
      scoreEvento += flooredScore;

      if (flooredScore > 0) gamesWithPoints++;

      wins += gameEvents.filter((e) => e.type === 'EVT_WIN').length;
      effBonusTotal += gameEvents
        .filter((e) => e.type === 'EVT_WIN_EFFICIENCY')
        .reduce((s, e) => s + e.points, 0);
      refutations += gameEvents.filter((e) => e.type === 'EVT_REFUTATION').length;
    }

    const partidasJugadas = finishedGameIds.filter((gId) =>
      teamEvents.some((e) => e.gameId === gId),
    ).length;

    return {
      equipoId: team.id,
      equipoNombre: team.nombre,
      avatarUrl: team.avatarUrl ?? null,
      puntos: scoreEvento,
      partidasJugadas,
      aciertos: wins,
      // Tiebreaker fields
      _wins: wins,
      _effBonusTotal: effBonusTotal,
      _gamesWithPoints: gamesWithPoints,
      _refutations: refutations,
      _createdAt: team.createdAt ? new Date(team.createdAt).getTime() : 0,
    };
  });

  // 4. Sort with tiebreakers (RFC §5.2)
  rankingData.sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    if (b._wins !== a._wins) return b._wins - a._wins;
    if (b._effBonusTotal !== a._effBonusTotal) return b._effBonusTotal - a._effBonusTotal;
    if (b._gamesWithPoints !== a._gamesWithPoints) return b._gamesWithPoints - a._gamesWithPoints;
    if (b._refutations !== a._refutations) return b._refutations - a._refutations;
    return a._createdAt - b._createdAt; // Earlier registration wins tiebreaker
  });

  const ranked = rankingData.map((entry, idx) => ({
    id: `${entry.equipoId}-ranking`,
    equipoId: entry.equipoId,
    equipoNombre: entry.equipoNombre,
    avatarUrl: entry.avatarUrl,
    puntos: entry.puntos,
    partidasJugadas: entry.partidasJugadas,
    aciertos: entry.aciertos,
    posicion: idx + 1,
  }));

  return NextResponse.json({
    ranking: ranked,
    updatedAt: new Date().toISOString(),
  });
}
