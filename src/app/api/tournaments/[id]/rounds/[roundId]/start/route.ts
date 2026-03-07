// POST /api/tournaments/:id/rounds/:roundId/start — activate a round (pending → active)

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { tournaments, tournamentRounds } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { notificationEmitter } from '@/lib/ws/NotificationEmitter';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; roundId: string }> },
) {
  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const { id, roundId } = await params;

  const t = await db.select().from(tournaments).where(eq(tournaments.id, id)).get();
  if (!t) return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 });
  if (t.status !== 'active') {
    return NextResponse.json({ error: 'El torneo no está activo' }, { status: 409 });
  }

  const round = await db
    .select()
    .from(tournamentRounds)
    .where(and(eq(tournamentRounds.id, roundId), eq(tournamentRounds.tournamentId, id)))
    .get();

  if (!round) return NextResponse.json({ error: 'Ronda no encontrada' }, { status: 404 });
  if (round.status !== 'pending') {
    return NextResponse.json({ error: 'La ronda no está en estado pendiente' }, { status: 409 });
  }

  await db
    .update(tournamentRounds)
    .set({ status: 'active' })
    .where(eq(tournamentRounds.id, roundId));

  notificationEmitter.emitGlobal({
    type: 'tournament:round_started' as never,
    tournamentId: id,
    roundId,
    roundNumber:  round.roundNumber,
    phase:        round.phase,
    ts:           Date.now(),
  } as never);

  return NextResponse.json({ ok: true, roundId, roundNumber: round.roundNumber });
}
