// src/lib/tournament/engine.ts
// Pure tournament engine — no I/O, no DB.

import type {
  TeamId,
  GameId,
  TournamentTeam,
  TournamentRound,
  GameResult,
  TournamentStanding,
} from './types';

/**
 * Compute standings for all enrolled teams based on game results across rounds.
 *
 * For each team, accumulates:
 *  - totalScore: sum of `score` across all games played.
 *  - gamesPlayed: number of games participated in.
 *  - wins: games where `won = true`.
 *  - eliminations: sum of `elims` across games (eliminations scored against others).
 *  - roundScores: per-round score breakdown for display.
 */
export function computeTournamentStandings(
  teams: TournamentTeam[],
  rounds: TournamentRound[],
  gameResults: GameResult[],
  /** Map from gameId → roundNumber, used to build per-round breakdown */
  gameRoundMap: Map<GameId, number>,
): TournamentStanding[] {
  const standings = new Map<TeamId, TournamentStanding>();

  // Initialise entry for every enrolled team
  for (const team of teams) {
    standings.set(team.teamId, {
      teamId:             team.teamId,
      totalScore:         0,
      gamesPlayed:        0,
      wins:               0,
      eliminations:       0,
      isEliminated:       team.eliminated,
      advancedToPlayoffs: false,
      groupIndex:         team.groupIndex,
      roundScores:        [],
    });
  }

  // Aggregate game results
  for (const result of gameResults) {
    const entry = standings.get(result.teamId);
    if (!entry) continue; // team not in this tournament (safety guard)

    entry.totalScore  += result.score;
    entry.gamesPlayed += 1;
    if (result.won) entry.wins += 1;
    entry.eliminations += result.elims;

    const roundNumber = gameRoundMap.get(result.gameId) ?? null;
    const existing = entry.roundScores.find((rs) => rs.roundNumber === roundNumber);
    if (existing) {
      existing.score += result.score;
    } else {
      entry.roundScores.push({
        roundNumber: roundNumber ?? -1,
        score:       result.score,
        gameId:      result.gameId,
      });
    }
  }

  // Sort: totalScore desc, wins desc, teamId asc (stable deterministic)
  const sorted = Array.from(standings.values()).sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.eliminations !== a.eliminations) return b.eliminations - a.eliminations;
    return a.teamId.localeCompare(b.teamId);
  });

  return sorted;
}

/**
 * Returns true when every game (non-bye) in a round has finished.
 * `gameStatuses` maps gameId → whether the game has finished.
 */
export function isRoundComplete(
  roundGameIds: GameId[],
  gameStatuses: Map<GameId, boolean /* isFinished */>,
): boolean {
  if (roundGameIds.length === 0) return true;
  return roundGameIds.every((gid) => gameStatuses.get(gid) === true);
}

/**
 * Returns the teamIds that should be eliminated after this round in bracket formats.
 * The `winners` set contains teamIds that advance (one per game in bracket).
 * Everyone in `activeBracketTeams` not in `winners` is eliminated.
 */
export function getEliminatedTeams(
  activeBracketTeams: TeamId[],
  winners: TeamId[],
): TeamId[] {
  const winnerSet = new Set(winners);
  return activeBracketTeams.filter((tid) => !winnerSet.has(tid));
}

/**
 * Determine the winner of a single bracket game given the per-team scores.
 * Returns the teamId with the highest score (or lexicographically first on tie).
 */
export function bracketGameWinner(
  gameResults: Array<{ teamId: TeamId; score: number }>,
): TeamId | null {
  if (gameResults.length === 0) return null;
  const sorted = [...gameResults].sort((a, b) =>
    b.score !== a.score
      ? b.score - a.score
      : a.teamId.localeCompare(b.teamId),
  );
  return sorted[0].teamId;
}

/**
 * Determine how many total rounds are expected for a round-robin tournament.
 * With N teams (N even), total rounds = N - 1.
 * With N teams (N odd), total rounds = N (Berger adds a BYE).
 */
export function roundRobinTotalRounds(numTeams: number): number {
  return numTeams % 2 === 0 ? numTeams - 1 : numTeams;
}

/**
 * Determine the bracket phase label based on teams remaining.
 */
export function bracketPhase(
  teamsRemaining: number,
): TournamentRound['phase'] {
  if (teamsRemaining <= 2)  return 'final';
  if (teamsRemaining <= 4)  return 'semifinal';
  if (teamsRemaining <= 8)  return 'quarterfinal';
  if (teamsRemaining <= 16) return 'round_of_16';
  return 'round';
}
