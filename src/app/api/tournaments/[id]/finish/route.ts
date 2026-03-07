// POST /api/tournaments/:id/finish — manually close an active tournament

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { tournaments, tournamentTeams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notificationEmitter } from '@/lib/ws/NotificationEmitter';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const { id } = await params;
  const t = await db.select().from(tournaments).where(eq(tournaments.id, id)).get();
  if (!t) return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 });
  if (t.status !== 'active') {
    return NextResponse.json({ error: 'El torneo no está activo' }, { status: 409 });
  }

  const now = new Date();
  await db
    .update(tournaments)
    .set({ status: 'finished', finishedAt: now })
    .where(eq(tournaments.id, id));

  // Find winner: team with lowest elimination flag and highest score (simplified)
  const teams = await db
    .select()
    .from(tournamentTeams)
    .where(eq(tournamentTeams.tournamentId, id))
    .all();

  const winner = teams.find((t) => !t.eliminated) ?? teams[0] ?? null;

  notificationEmitter.emitGlobal({
    type:           'tournament:finished',
    tournamentId:   id,
    winnerId:       winner?.teamId ?? null,
    finalStandings: [],
    ts:             Date.now(),
  });

  return NextResponse.json({ ok: true, tournamentId: id, finishedAt: now.toISOString() });
}
