import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scoreEvents } from '@/lib/db/schema';
import { partidas } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/games/:id/score-events
 * Returns all scoring events for a game, grouped by team.
 * Public endpoint — session not required (game results are spectator-visible).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: gameId } = await params;

  const partida = await db
    .select({ id: partidas.id })
    .from(partidas)
    .where(eq(partidas.id, gameId))
    .get();

  if (!partida) {
    return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
  }

  const events = await db
    .select()
    .from(scoreEvents)
    .where(eq(scoreEvents.gameId, gameId))
    .all();

  return NextResponse.json({
    events: events.map((ev) => ({
      id: ev.id,
      equipoId: ev.equipoId,
      turno: ev.turno,
      type: ev.type,
      points: ev.points,
      meta: ev.meta ? (JSON.parse(ev.meta) as Record<string, unknown>) : null,
      createdAt: (ev.createdAt as Date | null)?.toISOString() ?? null,
    })),
  });
}
