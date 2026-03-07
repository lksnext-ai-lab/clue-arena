// GET /api/tournaments/:id — tournament detail + rounds + current standings
// PATCH /api/tournaments/:id — update name/config (draft only, admin)
// DELETE /api/tournaments/:id — delete tournament (draft only, admin)

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  tournaments,
  tournamentTeams,
  tournamentRounds,
  tournamentRoundGames,
  equipos,
} from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { UpdateTournamentSchema } from '@/lib/schemas/tournament-config';

async function loadTournamentDetail(id: string) {
  const t = await db.select().from(tournaments).where(eq(tournaments.id, id)).get();
  if (!t) return null;

  const teams = await db
    .select({ tt: tournamentTeams, e: equipos })
    .from(tournamentTeams)
    .innerJoin(equipos, eq(tournamentTeams.teamId, equipos.id))
    .where(eq(tournamentTeams.tournamentId, id))
    .all();

  const rounds = await db
    .select()
    .from(tournamentRounds)
    .where(eq(tournamentRounds.tournamentId, id))
    .orderBy(asc(tournamentRounds.roundNumber))
    .all();

  const roundsWithGames = await Promise.all(
    rounds.map(async (r) => {
      const games = await db
        .select()
        .from(tournamentRoundGames)
        .where(eq(tournamentRoundGames.roundId, r.id))
        .all();
      return {
        id:          r.id,
        tournamentId: id,
        roundNumber: r.roundNumber,
        phase:       r.phase,
        status:      r.status,
        generatedAt: r.generatedAt?.toISOString() ?? null,
        finishedAt:  r.finishedAt?.toISOString() ?? null,
        games: games.map((g) => ({
          id:      g.id,
          gameId:  g.isBye ? null : g.gameId,
          isBye:   g.isBye,
          teamIds: [] as string[], // populated if needed
        })),
      };
    }),
  );

  return {
    id:         t.id,
    name:       t.name,
    format:     t.format,
    status:     t.status,
    config:     JSON.parse(t.config),
    createdAt:  t.createdAt?.toISOString() ?? null,
    startedAt:  t.startedAt?.toISOString() ?? null,
    finishedAt: t.finishedAt?.toISOString() ?? null,
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
    rounds: roundsWithGames,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const detail = await loadTournamentDetail(id);
  if (!detail) return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 });

  return NextResponse.json(detail);
}

export async function PATCH(
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
      { error: 'Solo se puede editar un torneo en estado draft' },
      { status: 409 },
    );
  }

  const body = await request.json();
  const parsed = UpdateTournamentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const updates: Partial<typeof t> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.config !== undefined) {
    updates.config = JSON.stringify(parsed.data.config);
    updates.format = parsed.data.config.format;
  }

  await db.update(tournaments).set(updates).where(eq(tournaments.id, id));

  const updated = await loadTournamentDetail(id);
  return NextResponse.json(updated);
}

export async function DELETE(
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
  if (t.status !== 'draft') {
    return NextResponse.json(
      { error: 'Solo se puede eliminar un torneo en estado draft' },
      { status: 409 },
    );
  }

  await db.delete(tournaments).where(eq(tournaments.id, id));
  return NextResponse.json({ ok: true });
}
