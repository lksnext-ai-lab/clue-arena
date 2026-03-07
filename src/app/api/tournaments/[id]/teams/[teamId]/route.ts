// DELETE /api/tournaments/:id/teams/:teamId — unenroll team (admin, draft only)

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { tournaments, tournamentTeams } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; teamId: string }> },
) {
  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const { id, teamId } = await params;

  const t = await db.select().from(tournaments).where(eq(tournaments.id, id)).get();
  if (!t) return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 });
  if (t.status !== 'draft') {
    return NextResponse.json(
      { error: 'Solo se pueden desinscribir equipos en un torneo en estado draft' },
      { status: 409 },
    );
  }

  const entry = await db
    .select()
    .from(tournamentTeams)
    .where(and(eq(tournamentTeams.tournamentId, id), eq(tournamentTeams.teamId, teamId)))
    .get();

  if (!entry) {
    return NextResponse.json({ error: 'El equipo no está inscrito en este torneo' }, { status: 404 });
  }

  await db
    .delete(tournamentTeams)
    .where(and(eq(tournamentTeams.tournamentId, id), eq(tournamentTeams.teamId, teamId)));

  return NextResponse.json({ ok: true });
}
