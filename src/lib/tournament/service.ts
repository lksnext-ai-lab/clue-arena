// src/lib/tournament/service.ts
// Server-side helpers for tournament orchestration.
// This file CAN import from @/lib/db — it runs on Node.js runtime only.

import { db } from '@/lib/db';
import {
  tournamentRounds,
  tournamentRoundGames,
  partidas,
  partidaEquipos,
  sobres,
} from '@/lib/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { initGame } from '@/lib/game/engine';
import {
  generateRoundRobinPairings,
  generateBracketRound,
  generateGroupStagePairings,
} from './index';
import type { TeamId, GameId } from './types';
import type { TournamentConfig } from '@/lib/schemas/tournament-config';
import type { TournamentRoundPhase } from '@/types/domain';

// ── Helper: create a Cluedo game for a set of teams ──────────────────────────

export async function createGameForTeams(
  teamIds: TeamId[],
  gameName: string,
  maxTurnos?: number | null,
): Promise<string> {
  const gameState = initGame(teamIds);
  const gameId = uuidv4();
  const now = new Date();

  await db.insert(partidas).values({
    id:    gameId,
    nombre: gameName,
    estado: 'pendiente',
    turnoActual: 0,
    maxTurnos: maxTurnos ?? null,
    createdAt: now,
  });

  await db.insert(sobres).values({
    id:         uuidv4(),
    partidaId:  gameId,
    sospechoso: gameState.sobre.sospechoso,
    arma:       gameState.sobre.arma,
    habitacion: gameState.sobre.habitacion,
  });

  for (const eq of gameState.equipos) {
    await db.insert(partidaEquipos).values({
      id:        uuidv4(),
      partidaId: gameId,
      equipoId:  eq.equipoId,
      orden:     eq.orden,
      eliminado: false,
      puntos:    0,
      cartas:    JSON.stringify(eq.cartas),
    });
  }

  return gameId;
}

// ── Helper: generate round 1 pairings for any format ────────────────────────

export function round1Pairings(
  config: TournamentConfig,
  enrolledTeams: { teamId: TeamId; seed: number | null; groupIndex: number | null }[],
): TeamId[][] {
  if (config.format === 'round_robin') {
    return generateRoundRobinPairings(
      enrolledTeams.map((t) => t.teamId),
      0,
      config.playersPerGame,
    );
  }

  if (config.format === 'single_bracket') {
    const standings = enrolledTeams.map((t) => ({ teamId: t.teamId, score: t.seed ?? 0 }));
    const { matches } = generateBracketRound(standings, config.playersPerGame);
    return matches;
  }

  if (config.format === 'group_stage') {
    const groups = buildGroupArrays(enrolledTeams, config.numGroups);
    return generateGroupStagePairings(groups, 0, config.playersPerGame);
  }

  // custom: no auto pairings
  return [];
}

function buildGroupArrays(
  enrolledTeams: { teamId: TeamId; groupIndex: number | null }[],
  numGroups: number,
): TeamId[][] {
  const groups: TeamId[][] = Array.from({ length: numGroups }, () => []);
  for (const t of enrolledTeams) {
    const g = t.groupIndex ?? 0;
    if (g >= 0 && g < numGroups) groups[g].push(t.teamId);
  }
  return groups;
}

// ── Helper: load full round info (round + games + team assignments) ─────────

export interface RoundInfo {
  roundId:  string;
  gameIds:  GameId[];
  byeTeams: TeamId[];
}

export async function createRound(
  tournamentId: string,
  roundNumber:  number,
  phase:        TournamentRoundPhase,
  pairings:     TeamId[][],
  byeTeamIds:   TeamId[],
  roundLabel:   string,
  maxTurnos?:   number | null,
): Promise<RoundInfo> {
  const roundId = uuidv4();
  const now = new Date();

  await db.insert(tournamentRounds).values({
    id:           roundId,
    tournamentId,
    roundNumber,
    phase,
    status:       'pending',
    generatedAt:  now,
  });

  const gameIds: GameId[] = [];

  for (let i = 0; i < pairings.length; i++) {
    const teamIds = pairings[i];
    const gameId = await createGameForTeams(
      teamIds,
      `${roundLabel} — partida ${i + 1}`,
      maxTurnos,
    );
    gameIds.push(gameId);

    await db.insert(tournamentRoundGames).values({
      id:      uuidv4(),
      roundId,
      gameId,
      isBye:   false,
    });
  }

  // Insert bye entries (no real game — gameId is null for byes)
  for (const _byeTeam of byeTeamIds) {
    await db.insert(tournamentRoundGames).values({
      id:      uuidv4(),
      roundId,
      gameId:  null,
      isBye:   true,
    });
  }

  return { roundId, gameIds, byeTeams: byeTeamIds };
}

// ── Helper: compute game results for a finished round ───────────────────────

export async function computeRoundResults(
  roundId: string,
): Promise<{ teamId: TeamId; gameId: GameId; score: number; won: boolean }[]> {
  // Get round games
  const roundGames = await db
    .select()
    .from(tournamentRoundGames)
    .where(and(eq(tournamentRoundGames.roundId, roundId), eq(tournamentRoundGames.isBye, false)))
    .all();

  const results: { teamId: TeamId; gameId: GameId; score: number; won: boolean }[] = [];

  for (const rg of roundGames) {
    const gameId = rg.gameId;
    const teamScores = await db
      .select({ equipoId: partidaEquipos.equipoId, puntos: partidaEquipos.puntos })
      .from(partidaEquipos)
      .where(eq(partidaEquipos.partidaId, gameId))
      .all();

    const maxScore = Math.max(...teamScores.map((t) => t.puntos));

    for (const ts of teamScores) {
      results.push({
        teamId: ts.equipoId,
        gameId,
        score:  ts.puntos,
        won:    ts.puntos === maxScore && maxScore > 0,
      });
    }
  }

  return results;
}

// ── Helper: check all games in a round are finished ─────────────────────────

export async function checkRoundComplete(roundId: string): Promise<{
  complete: boolean;
  unfinishedGameIds: GameId[];
}> {
  const roundGames = await db
    .select()
    .from(tournamentRoundGames)
    .where(and(eq(tournamentRoundGames.roundId, roundId), eq(tournamentRoundGames.isBye, false)))
    .all();

  if (roundGames.length === 0) return { complete: true, unfinishedGameIds: [] };

  const gameIds = roundGames.map((rg) => rg.gameId);
  const games = await db
    .select({ id: partidas.id, estado: partidas.estado })
    .from(partidas)
    .where(inArray(partidas.id, gameIds))
    .all();

  const statusMap = new Map(games.map((g) => [g.id, g.estado === 'finalizada']));
  const unfinished = gameIds.filter((gid) => !statusMap.get(gid));

  return {
    complete:          unfinished.length === 0,
    unfinishedGameIds: unfinished,
  };
}
