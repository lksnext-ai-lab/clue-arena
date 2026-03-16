import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scoreEvents, turnos } from '@/lib/db/schema';
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

  const gameTurns = await db
    .select({
      numero: turnos.numero,
      startedAt: turnos.startedAt,
      finishedAt: turnos.finishedAt,
    })
    .from(turnos)
    .where(eq(turnos.partidaId, gameId))
    .all();

  const sortedTurns = gameTurns
    .filter((turno) => turno.startedAt)
    .sort((a, b) => (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0));

  function resolveDisplayTurn(eventTurn: number, createdAt: Date | null): number {
    if (createdAt && sortedTurns.length > 0) {
      const createdMs = createdAt.getTime();
      for (let i = 0; i < sortedTurns.length; i++) {
        const current = sortedTurns[i];
        const startMs = current.startedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
        const nextStartMs = sortedTurns[i + 1]?.startedAt?.getTime() ?? Number.POSITIVE_INFINITY;
        const finishMs = current.finishedAt?.getTime() ?? nextStartMs;
        if (createdMs >= startMs && createdMs <= Math.max(finishMs, nextStartMs)) {
          return current.numero;
        }
      }
    }

    // Fallback: most legacy score events persisted the internal zero-based
    // turnoActual counter instead of the spectator-facing turn number.
    return Math.max(1, eventTurn + 1);
  }

  return NextResponse.json({
    events: events.map((ev) => ({
      id: ev.id,
      equipoId: ev.equipoId,
      turno: ev.turno,
      displayTurn: resolveDisplayTurn(ev.turno, ev.createdAt as Date | null),
      type: ev.type,
      points: ev.points,
      meta: ev.meta ? (JSON.parse(ev.meta) as Record<string, unknown>) : null,
      createdAt: (ev.createdAt as Date | null)?.toISOString() ?? null,
    })),
  });
}
