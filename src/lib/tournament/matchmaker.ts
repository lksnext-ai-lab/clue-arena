// src/lib/tournament/matchmaker.ts
// Pure matchmaking algorithms — no I/O, no DB.

import type { TeamId } from './types';

/**
 * Berger round-robin rotation.
 * Returns the ordered list of teams for round `round` (0-based).
 * The fixed team stays at index 0; positions 1..N-1 rotate clockwise.
 */
function bergerRotation(teams: TeamId[], round: number): TeamId[] {
  const N = teams.length;
  if (N <= 1) return [...teams];

  // positions[0] is fixed; positions[1..N-1] rotate
  const rotatable = teams.slice(1);
  const offset = round % rotatable.length;
  const rotated = [
    ...rotatable.slice(rotatable.length - offset),
    ...rotatable.slice(0, rotatable.length - offset),
  ];
  return [teams[0], ...rotated];
}

/**
 * Given an ordered list of teams (after Berger rotation), produce the
 * standard Berger pairings: team[k] paired with team[N-1-k].
 * Returns an array of pairs [teamA, teamB].
 */
function bergerPairs(rotated: TeamId[]): [TeamId, TeamId][] {
  const N = rotated.length;
  const pairs: [TeamId, TeamId][] = [];
  for (let k = 0; k < Math.floor(N / 2); k++) {
    pairs.push([rotated[k], rotated[N - 1 - k]]);
  }
  return pairs;
}

/**
 * Merge consecutive pairs into games of `playersPerGame` players.
 * Maximises fully-filled games first.
 */
function packPairsIntoGames(pairs: [TeamId, TeamId][], playersPerGame: number): TeamId[][] {
  const pairsPerGame = Math.floor(playersPerGame / 2);
  const games: TeamId[][] = [];
  let i = 0;
  while (i < pairs.length) {
    const chunk = pairs.slice(i, i + pairsPerGame);
    games.push(chunk.flat());
    i += pairsPerGame;
  }
  return games;
}

/**
 * Generate round-robin pairings for a given round (0-based) using Berger rotation.
 *
 * If the number of teams is odd, a virtual BYE team is added so all teams
 * rotate correctly; games containing the BYE are filtered out.
 *
 * @returns Array of games, where each game is an array of teamIds.
 */
export function generateRoundRobinPairings(
  teams: TeamId[],
  round: number,
  playersPerGame: number,
): TeamId[][] {
  if (teams.length === 0) return [];

  const BYE = '__BYE__';
  const paddedTeams = teams.length % 2 !== 0 ? [...teams, BYE] : [...teams];
  const N = paddedTeams.length;

  // Clamp round to valid range (0-based: 0..N-2)
  const clampedRound = round % (N - 1);
  const rotated = bergerRotation(paddedTeams, clampedRound);
  const pairs = bergerPairs(rotated);

  // Remove pairs that include the BYE slot
  const realPairs = pairs.filter(([a, b]) => a !== BYE && b !== BYE) as [TeamId, TeamId][];

  return packPairsIntoGames(realPairs, playersPerGame);
}

/**
 * Generate bracket round pairings.
 * Seeds teams by score (highest first), then pairs 1st vs last, 2nd vs 2nd-to-last, etc.
 * If the number of active teams is not divisible by playersPerGame, the
 * highest-seeded remainder set receives byes.
 *
 * @returns matches — groups of teams that play against each other.
 *          byes   — teams that advance without playing this round.
 */
export function generateBracketRound(
  standings: { teamId: TeamId; score: number }[],
  playersPerGame: number,
): { matches: TeamId[][]; byes: TeamId[] } {
  if (standings.length === 0) return { matches: [], byes: [] };
  if (standings.length === 1) return { matches: [], byes: [standings[0].teamId] };

  const sorted = [...standings].sort((a, b) => b.score - a.score || a.teamId.localeCompare(b.teamId));

  const N = sorted.length;

  // When fewer teams remain than playersPerGame, play them all in one game
  // rather than giving everyone a bye and producing no actual match.
  if (N < playersPerGame) {
    return { matches: [sorted.map((t) => t.teamId)], byes: [] };
  }

  const numInGames = Math.floor(N / playersPerGame) * playersPerGame;
  const numByes = N - numInGames;

  // Best-seeded teams get byes
  const byeTeams = sorted.slice(0, numByes).map((t) => t.teamId);
  const playingTeams = sorted.slice(numByes).map((t) => t.teamId);

  // Serpentine pairing: alternate front and back to spread top seeds across games
  const matches: TeamId[][] = [];
  let left = 0;
  let right = playingTeams.length - 1;
  const numGames = playingTeams.length / playersPerGame;

  for (let g = 0; g < numGames; g++) {
    const match: TeamId[] = [];
    for (let p = 0; p < playersPerGame; p++) {
      if (p % 2 === 0) {
        match.push(playingTeams[left++]);
      } else {
        match.push(playingTeams[right--]);
      }
    }
    matches.push(match);
  }

  return { matches, byes: byeTeams };
}

/**
 * Generate group stage pairings.
 * Each group is paired independently using round-robin; results are merged.
 *
 * @param groups   Array of groups, each group is an array of teamIds.
 * @param round    0-based round number within the group stage.
 * @param playersPerGame  Max players per game.
 * @returns Flat array of games (each game = array of teamIds) across all groups.
 */
export function generateGroupStagePairings(
  groups: TeamId[][],
  round: number,
  playersPerGame: number,
): TeamId[][] {
  return groups.flatMap((group) => generateRoundRobinPairings(group, round, playersPerGame));
}

/**
 * Assign teams to groups using a serpentine (snake draft) distribution
 * to balance seeding across groups.
 * e.g., 8 teams, 2 groups:  G0←t1, G1←t2, G1←t3, G0←t4, G0←t5, G1←t6, ...
 */
export function assignTeamsToGroups(
  seededTeams: { teamId: TeamId; seed: number | null }[],
  numGroups: number,
): TeamId[][] {
  // Sort by seed ascending (lower seed = better; null → end)
  const sorted = [...seededTeams].sort((a, b) => {
    if (a.seed === null && b.seed === null) return 0;
    if (a.seed === null) return 1;
    if (b.seed === null) return -1;
    return a.seed - b.seed;
  });

  const groups: TeamId[][] = Array.from({ length: numGroups }, () => []);
  let forward = true;
  let groupIdx = 0;

  for (const { teamId } of sorted) {
    groups[groupIdx].push(teamId);
    if (forward) {
      groupIdx++;
      if (groupIdx >= numGroups) {
        groupIdx = numGroups - 1;
        forward = false;
      }
    } else {
      groupIdx--;
      if (groupIdx < 0) {
        groupIdx = 0;
        forward = true;
      }
    }
  }

  return groups;
}
