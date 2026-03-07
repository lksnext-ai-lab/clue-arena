// POST /api/tournaments/:id/start — activate tournament and generate round 1

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { tournaments, tournamentTeams, equipos } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  generateRoundRobinPairings,
  generateBracketRound,
  generateGroupStagePairings,
  assignTeamsToGroups,
  bracketPhase,
} from '@/lib/tournament';
import { createRound } from '@/lib/tournament/service';
import { TournamentConfigSchema } from '@/lib/schemas/tournament-config';
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
  if (t.status !== 'draft') {
    return NextResponse.json({ error: 'El torneo ya ha sido iniciado' }, { status: 409 });
  }

  // Parse and validate config
  const configParsed = TournamentConfigSchema.safeParse(JSON.parse(t.config));
  if (!configParsed.success) {
    return NextResponse.json({ error: 'Configuración de torneo inválida' }, { status: 400 });
  }
  const config = configParsed.data;

  // Load enrolled teams
  const enrolled = await db
    .select({ tt: tournamentTeams, e: equipos })
    .from(tournamentTeams)
    .innerJoin(equipos, eq(tournamentTeams.teamId, equipos.id))
    .where(eq(tournamentTeams.tournamentId, id))
    .all();

  if (enrolled.length < 2) {
    return NextResponse.json(
      { error: 'Se necesitan al menos 2 equipos para iniciar el torneo' },
      { status: 400 },
    );
  }

  const enrolledTeams = enrolled.map(({ tt }) => ({
    teamId:     tt.teamId,
    seed:       tt.seed ?? null,
    groupIndex: tt.groupIndex ?? null,
    eliminated: tt.eliminated,
  }));

  // Validate group_stage config coherence
  if (config.format === 'group_stage' && config.numGroups > Math.floor(enrolled.length / 2)) {
    return NextResponse.json(
      { error: 'numGroups no puede ser mayor que la mitad del número de equipos' },
      { status: 400 },
    );
  }

  // For group_stage: assign groups if not already set
  if (config.format === 'group_stage') {
    const needsGroupAssignment = enrolledTeams.some((te) => te.groupIndex === null);
    if (needsGroupAssignment) {
      const groups = assignTeamsToGroups(enrolledTeams, config.numGroups);
      for (let g = 0; g < groups.length; g++) {
        for (const teamId of groups[g]) {
          await db
            .update(tournamentTeams)
            .set({ groupIndex: g })
            .where(and(eq(tournamentTeams.tournamentId, id), eq(tournamentTeams.teamId, teamId)));
          const et = enrolledTeams.find((e) => e.teamId === teamId);
          if (et) et.groupIndex = g;
        }
      }
    }
  }

  // Generate pairings for round 1
  let pairings: string[][] = [];
  let byeTeams: string[] = [];

  if (config.format === 'round_robin') {
    pairings = generateRoundRobinPairings(
      enrolledTeams.map((te) => te.teamId),
      0,
      config.playersPerGame,
    );
  } else if (config.format === 'single_bracket') {
    const standings = enrolledTeams.map((te) => ({ teamId: te.teamId, score: te.seed ?? 0 }));
    const result = generateBracketRound(standings, config.playersPerGame);
    pairings = result.matches;
    byeTeams = result.byes;
  } else if (config.format === 'group_stage') {
    const groups: string[][] = Array.from({ length: config.numGroups }, () => []);
    for (const team of enrolledTeams) {
      const g = team.groupIndex ?? 0;
      if (g >= 0 && g < config.numGroups) groups[g].push(team.teamId);
    }
    pairings = generateGroupStagePairings(groups, 0, config.playersPerGame);
  }
  // custom: no auto pairings

  const phase =
    config.format === 'group_stage'
      ? 'group_stage'
      : config.format === 'single_bracket'
      ? bracketPhase(enrolledTeams.length)
      : 'round';

  const now = new Date();

  // Create round 1
  const { roundId } = await createRound(
    id,
    1,
    phase,
    pairings,
    byeTeams,
    `${t.name} — Ronda 1`,
    config.maxTurnosPorPartida,
  );

  // Mark tournament active
  await db
    .update(tournaments)
    .set({ status: 'active', startedAt: now })
    .where(eq(tournaments.id, id));

  notificationEmitter.emitGlobal({
    type:         'tournament:round_started',
    tournamentId: id,
    roundId,
    roundNumber:  1,
    phase:        phase as string,
    ts:           Date.now(),
  });

  return NextResponse.json({ ok: true, tournamentId: id, roundId, roundNumber: 1, phase });
}
