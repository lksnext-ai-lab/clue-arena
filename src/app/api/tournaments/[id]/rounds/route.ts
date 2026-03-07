// GET /api/tournaments/:id/rounds — list all rounds with status

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  tournaments,
  tournamentRounds,
  tournamentRoundGames,
} from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

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

  const rounds = await db
    .select()
    .from(tournamentRounds)
    .where(eq(tournamentRounds.tournamentId, id))
    .orderBy(asc(tournamentRounds.roundNumber))
    .all();

  const roundsData = await Promise.all(
    rounds.map(async (r) => {
      const games = await db
        .select()
        .from(tournamentRoundGames)
        .where(eq(tournamentRoundGames.roundId, r.id))
        .all();

      return {
        id:           r.id,
        tournamentId: id,
        roundNumber:  r.roundNumber,
        phase:        r.phase,
        status:       r.status,
        generatedAt:  r.generatedAt?.toISOString() ?? null,
        finishedAt:   r.finishedAt?.toISOString() ?? null,
        gamesCount:   games.filter((g) => !g.isBye).length,
        byesCount:    games.filter((g) => g.isBye).length,
      };
    }),
  );

  return NextResponse.json({ rounds: roundsData });
}
