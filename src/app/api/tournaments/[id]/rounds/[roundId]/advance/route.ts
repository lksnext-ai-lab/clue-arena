// POST /api/tournaments/:id/rounds/:roundId/advance
// Finish current round, compute results, and generate the next round.

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  tournaments,
  tournamentTeams,
  tournamentRounds,
  tournamentRoundGames,
  partidaEquipos,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  generateRoundRobinPairings,
  generateBracketRound,
  generateGroupStagePairings,
  getEliminatedTeams,
  bracketGameWinner,
  bracketPhase,
} from '@/lib/tournament';
import { createRound, checkRoundComplete } from '@/lib/tournament/service';
import { TournamentConfigSchema } from '@/lib/schemas/tournament-config';
import { notificationEmitter } from '@/lib/ws/NotificationEmitter';
import type { TeamId } from '@/lib/tournament/types';

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
  if (round.status === 'finished') {
    return NextResponse.json({ error: 'La ronda ya ha finalizado' }, { status: 409 });
  }

  // Check all games are done
  const { complete, unfinishedGameIds } = await checkRoundComplete(roundId);
  if (!complete) {
    return NextResponse.json(
      { error: 'Faltan partidas por finalizar', unfinishedGameIds },
      { status: 409 },
    );
  }

  const now = new Date();

  // Mark round finished
  await db
    .update(tournamentRounds)
    .set({ status: 'finished', finishedAt: now })
    .where(eq(tournamentRounds.id, roundId));

  // Parse config
  const configParsed = TournamentConfigSchema.safeParse(JSON.parse(t.config));
  if (!configParsed.success) {
    return NextResponse.json({ error: 'Configuración de torneo inválida' }, { status: 500 });
  }
  const config = configParsed.data;

  // Load all enrolled teams
  const allEnrolled = await db
    .select()
    .from(tournamentTeams)
    .where(eq(tournamentTeams.tournamentId, id))
    .all();

  // Gather per-game scores for this round
  const roundGames = await db
    .select()
    .from(tournamentRoundGames)
    .where(and(eq(tournamentRoundGames.roundId, roundId), eq(tournamentRoundGames.isBye, false)))
    .all();

  // Compute per-game winners and aggregate standings for this round
  const roundGameWinners: TeamId[] = [];
  const roundStandings: { teamId: TeamId; score: number }[] = [];

  for (const rg of roundGames) {
    // rg.gameId can be null for bye entries
    if (!rg.gameId) continue;

    const teamScores = await db
      .select({ equipoId: partidaEquipos.equipoId, puntos: partidaEquipos.puntos })
      .from(partidaEquipos)
      .where(eq(partidaEquipos.partidaId, rg.gameId))
      .all();

    for (const ts of teamScores) {
      const existing = roundStandings.find((s) => s.teamId === ts.equipoId);
      if (existing) {
        existing.score += ts.puntos;
      } else {
        roundStandings.push({ teamId: ts.equipoId as TeamId, score: ts.puntos });
      }
    }

    const winner = bracketGameWinner(teamScores.map((ts) => ({ teamId: ts.equipoId as TeamId, score: ts.puntos })));
    if (winner) roundGameWinners.push(winner);
  }

  // Emit round finished event
  notificationEmitter.emitGlobal({
    type:         'tournament:round_finished',
    tournamentId: id,
    roundId,
    standings:    [],
    ts:           Date.now(),
  });

  // ── Determine next round ──────────────────────────────────────────────────

  if (config.format === 'round_robin') {
    const totalRounds = config.totalRounds;
    const nextRoundNumber = round.roundNumber + 1;

    if (nextRoundNumber > totalRounds) {
      await db.update(tournaments).set({ status: 'finished', finishedAt: now }).where(eq(tournaments.id, id));
      notificationEmitter.emitGlobal({ type: 'tournament:finished', tournamentId: id, winnerId: null, finalStandings: [], ts: Date.now() });
      return NextResponse.json({ ok: true, tournamentId: id, finished: true });
    }

    const activeTeams = allEnrolled.filter((e) => !e.eliminated).map((e) => e.teamId as TeamId);
    const pairings = generateRoundRobinPairings(activeTeams, round.roundNumber, config.playersPerGame);

    const { roundId: newRoundId } = await createRound(
      id, nextRoundNumber, 'round', pairings, [], `${t.name} — Ronda ${nextRoundNumber}`, config.maxTurnosPorPartida,
    );
    return NextResponse.json({ ok: true, nextRoundId: newRoundId, nextRoundNumber });
  }

  if (config.format === 'single_bracket') {
    // Collect teams that actually played in this round
    const playingTeams: TeamId[] = [];
    for (const rg of roundGames) {
      if (!rg.gameId) continue;
      const gameId = rg.gameId;
      const ts = await db.select({ equipoId: partidaEquipos.equipoId }).from(partidaEquipos).where(eq(partidaEquipos.partidaId, gameId)).all();
      playingTeams.push(...ts.map((row) => row.equipoId as TeamId));
    }

    const eliminatedInRound = getEliminatedTeams(playingTeams, roundGameWinners);

    for (const teamId of eliminatedInRound) {
      await db
        .update(tournamentTeams)
        .set({ eliminated: true })
        .where(and(eq(tournamentTeams.tournamentId, id), eq(tournamentTeams.teamId, teamId)));

      notificationEmitter.emitGlobal({
        type: 'tournament:team_eliminated', tournamentId: id, teamId, roundId, ts: Date.now(),
      });
    }

    const reloaded = await db.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, id)).all();
    const survivors = reloaded.filter((e) => !e.eliminated);

    if (survivors.length <= 1) {
      const winnerId = survivors[0]?.teamId ?? null;
      await db.update(tournaments).set({ status: 'finished', finishedAt: now }).where(eq(tournaments.id, id));
      notificationEmitter.emitGlobal({ type: 'tournament:finished', tournamentId: id, winnerId, finalStandings: [], ts: Date.now() });
      return NextResponse.json({ ok: true, finished: true, winnerId });
    }

    const nextRoundNumber = round.roundNumber + 1;
    const survivorStandings = survivors.map((e) => ({
      teamId: e.teamId as TeamId,
      score:  roundStandings.find((s) => s.teamId === e.teamId)?.score ?? 0,
    }));

    const { matches: nextMatches, byes: nextByes } = generateBracketRound(survivorStandings, config.playersPerGame);
    const phase = bracketPhase(survivors.length);
    const { roundId: newRoundId } = await createRound(id, nextRoundNumber, phase, nextMatches, nextByes, `${t.name} — ${phase}`, config.maxTurnosPorPartida);
    return NextResponse.json({ ok: true, nextRoundId: newRoundId, nextRoundNumber });
  }

  if (config.format === 'group_stage') {
    const nextRoundNumber = round.roundNumber + 1;

    if (round.phase === 'group_stage') {
      if (nextRoundNumber <= config.groupRounds) {
        // More group rounds
        const groups: TeamId[][] = Array.from({ length: config.numGroups }, () => []);
        for (const e of allEnrolled.filter((e) => !e.eliminated)) {
          const g = e.groupIndex ?? 0;
          if (g >= 0 && g < config.numGroups) groups[g].push(e.teamId as TeamId);
        }
        const pairings = generateGroupStagePairings(groups, round.roundNumber, config.playersPerGame);
        const { roundId: newRoundId } = await createRound(id, nextRoundNumber, 'group_stage', pairings, [], `${t.name} — Fase de Grupos Ronda ${nextRoundNumber}`, config.maxTurnosPorPartida);
        return NextResponse.json({ ok: true, nextRoundId: newRoundId, nextRoundNumber });
      }

      // Transition to playoffs: pick top N per group
      const groupStandings: Map<number, { teamId: TeamId; score: number }[]> = new Map();
      for (const e of allEnrolled.filter((e) => !e.eliminated)) {
        const g = e.groupIndex ?? 0;
        if (!groupStandings.has(g)) groupStandings.set(g, []);
        const score = roundStandings.find((s) => s.teamId === e.teamId)?.score ?? 0;
        groupStandings.get(g)!.push({ teamId: e.teamId as TeamId, score });
      }

      const qualifiers: TeamId[] = [];
      for (const [, standings] of groupStandings) {
        const sorted = standings.sort((a, b) => b.score - a.score);
        qualifiers.push(...sorted.slice(0, config.advancePerGroup).map((s) => s.teamId));
      }

      for (const e of allEnrolled) {
        if (!qualifiers.includes(e.teamId as TeamId)) {
          await db.update(tournamentTeams).set({ eliminated: true })
            .where(and(eq(tournamentTeams.tournamentId, id), eq(tournamentTeams.teamId, e.teamId)));
        }
      }

      const qualifierStandings = qualifiers.map((tid) => ({
        teamId: tid,
        score:  roundStandings.find((s) => s.teamId === tid)?.score ?? 0,
      }));

      const { matches, byes } = generateBracketRound(qualifierStandings, config.playersPerGame);
      const phase = bracketPhase(qualifiers.length);
      const { roundId: newRoundId } = await createRound(id, nextRoundNumber, phase, matches, byes, `${t.name} — Playoffs`, config.maxTurnosPorPartida);
      return NextResponse.json({ ok: true, nextRoundId: newRoundId, nextRoundNumber, phase, qualified: qualifiers });
    }

    // Playoffs bracket advance
    const playingInRound: TeamId[] = [];
    for (const rg of roundGames) {
      if (!rg.gameId) continue;
      const ts = await db.select({ equipoId: partidaEquipos.equipoId }).from(partidaEquipos).where(eq(partidaEquipos.partidaId, rg.gameId)).all();
      playingInRound.push(...ts.map((row) => row.equipoId as TeamId));
    }

    const eliminatedInRound = getEliminatedTeams(playingInRound, roundGameWinners);
    for (const teamId of eliminatedInRound) {
      await db.update(tournamentTeams).set({ eliminated: true })
        .where(and(eq(tournamentTeams.tournamentId, id), eq(tournamentTeams.teamId, teamId)));
    }

    const reloaded = await db.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, id)).all();
    const survivors = reloaded.filter((e) => !e.eliminated);

    if (survivors.length <= 1) {
      const winnerId = survivors[0]?.teamId ?? null;
      await db.update(tournaments).set({ status: 'finished', finishedAt: now }).where(eq(tournaments.id, id));
      notificationEmitter.emitGlobal({ type: 'tournament:finished', tournamentId: id, winnerId, finalStandings: [], ts: Date.now() });
      return NextResponse.json({ ok: true, finished: true, winnerId });
    }

    const survivorStandings = survivors.map((e) => ({
      teamId: e.teamId as TeamId,
      score:  roundStandings.find((s) => s.teamId === e.teamId)?.score ?? 0,
    }));

    const { matches: nextMatches, byes: nextByes } = generateBracketRound(survivorStandings, config.playersPerGame);
    const phaseLabel = bracketPhase(survivors.length);
    const { roundId: newRoundId } = await createRound(id, nextRoundNumber, phaseLabel, nextMatches, nextByes, `${t.name} — ${phaseLabel}`, config.maxTurnosPorPartida);
    return NextResponse.json({ ok: true, nextRoundId: newRoundId, nextRoundNumber });
  }

  // custom: no auto-generation
  return NextResponse.json({ ok: true, finished: false, note: 'Formato custom: genera la siguiente ronda manualmente' });
}
