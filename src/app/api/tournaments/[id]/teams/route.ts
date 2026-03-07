// GET /api/tournaments/:id/teams — list enrolled teams
// POST /api/tournaments/:id/teams — enroll team(s) (admin, draft only)

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { tournaments, tournamentTeams, equipos } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { EnrollTeamsSchema } from '@/lib/schemas/tournament-config';

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

  const teams = await db
    .select({ tt: tournamentTeams, e: equipos })
    .from(tournamentTeams)
    .innerJoin(equipos, eq(tournamentTeams.teamId, equipos.id))
    .where(eq(tournamentTeams.tournamentId, id))
    .all();

  return NextResponse.json({
    teams: teams.map(({ tt, e }) => ({
      id:           tt.id,
      tournamentId: id,
      teamId:       tt.teamId,
      teamName:     e.nombre,
      avatarUrl:    e.avatarUrl ?? null,
      seed:         tt.seed ?? null,
      groupIndex:   tt.groupIndex ?? null,
      eliminated:   tt.eliminated,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const { id } = await params;
  const t = await db.select().from(tournaments).where(eq(tournaments.id, id)).get();
  if (!t) return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 });
  if (t.status !== 'draft') {
    return NextResponse.json(
      { error: 'Solo se pueden inscribir equipos en un torneo en estado draft' },
      { status: 409 },
    );
  }

  const body = await request.json();
  const parsed = EnrollTeamsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { teamIds, seeds } = parsed.data;

  // Validate teams exist
  const teamRows = await Promise.all(
    teamIds.map((tid) => db.select().from(equipos).where(eq(equipos.id, tid)).get()),
  );
  if (teamRows.some((r) => !r)) {
    return NextResponse.json({ error: 'Uno o más equipos no existen' }, { status: 400 });
  }

  // Insert (ignore already enrolled)
  const inserted: string[] = [];
  for (const teamId of teamIds) {
    const existing = await db
      .select()
      .from(tournamentTeams)
      .where(and(eq(tournamentTeams.tournamentId, id), eq(tournamentTeams.teamId, teamId)))
      .get();

    if (!existing) {
      await db.insert(tournamentTeams).values({
        id:           uuidv4(),
        tournamentId: id,
        teamId,
        seed:         seeds?.[teamId] ?? null,
        groupIndex:   null,
        eliminated:   false,
      });
      inserted.push(teamId);
    }
  }

  return NextResponse.json({ ok: true, inserted }, { status: 201 });
}
