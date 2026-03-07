// src/tests/tournament-engine.test.ts
import { describe, it, expect } from 'vitest';
import {
  computeTournamentStandings,
  isRoundComplete,
  getEliminatedTeams,
  bracketGameWinner,
  roundRobinTotalRounds,
  bracketPhase,
} from '@/lib/tournament/engine';
import type { TournamentTeam, TournamentRound, GameResult } from '@/lib/tournament/types';

// ── computeTournamentStandings ────────────────────────────────────────────────

describe('computeTournamentStandings', () => {
  const makeTeam = (teamId: string, opts?: Partial<TournamentTeam>): TournamentTeam => ({
    teamId,
    seed:       null,
    groupIndex: null,
    eliminated: false,
    ...opts,
  });

  const makeRound = (id: string, n: number): TournamentRound => ({
    id,
    roundNumber: n,
    phase:       'round',
    status:      'finished',
  });

  it('teams with no results all start at 0', () => {
    const teams = [makeTeam('T1'), makeTeam('T2')];
    const standings = computeTournamentStandings(teams, [], [], new Map());
    expect(standings).toHaveLength(2);
    standings.forEach((s) => {
      expect(s.totalScore).toBe(0);
      expect(s.gamesPlayed).toBe(0);
    });
  });

  it('accumulates scores from multiple rounds', () => {
    const teams = [makeTeam('T1'), makeTeam('T2')];
    const rounds = [makeRound('R1', 1), makeRound('R2', 2)];
    const gameRoundMap = new Map([
      ['G1', 1],
      ['G2', 2],
    ]);
    const results: GameResult[] = [
      { gameId: 'G1', teamId: 'T1', score: 10, won: true,  elims: 1 },
      { gameId: 'G1', teamId: 'T2', score: 5,  won: false, elims: 0 },
      { gameId: 'G2', teamId: 'T1', score: 8,  won: false, elims: 0 },
      { gameId: 'G2', teamId: 'T2', score: 12, won: true,  elims: 0 },
    ];

    const standings = computeTournamentStandings(teams, rounds, results, gameRoundMap);

    const t1 = standings.find((s) => s.teamId === 'T1')!;
    const t2 = standings.find((s) => s.teamId === 'T2')!;

    expect(t1.totalScore).toBe(18);
    expect(t2.totalScore).toBe(17);
    expect(t1.wins).toBe(1);
    expect(t2.wins).toBe(1);
    expect(t1.gamesPlayed).toBe(2);
  });

  it('ranks teams by total score descending', () => {
    const teams = [makeTeam('T1'), makeTeam('T2'), makeTeam('T3')];
    const gameRoundMap = new Map([['G1', 1]]);
    const results: GameResult[] = [
      { gameId: 'G1', teamId: 'T1', score: 5,  won: false, elims: 0 },
      { gameId: 'G1', teamId: 'T2', score: 20, won: true,  elims: 0 },
      { gameId: 'G1', teamId: 'T3', score: 10, won: false, elims: 0 },
    ];

    const standings = computeTournamentStandings(teams, [], results, gameRoundMap);
    expect(standings[0].teamId).toBe('T2');
    expect(standings[1].teamId).toBe('T3');
    expect(standings[2].teamId).toBe('T1');
  });

  it('preserves eliminated flag from team record', () => {
    const teams = [makeTeam('T1', { eliminated: true }), makeTeam('T2')];
    const standings = computeTournamentStandings(teams, [], [], new Map());
    const t1 = standings.find((s) => s.teamId === 'T1')!;
    expect(t1.isEliminated).toBe(true);
  });

  it('builds per-round score breakdown', () => {
    const teams = [makeTeam('T1')];
    const gameRoundMap = new Map([['G1', 1], ['G2', 2]]);
    const results: GameResult[] = [
      { gameId: 'G1', teamId: 'T1', score: 10, won: true,  elims: 0 },
      { gameId: 'G2', teamId: 'T1', score: 5,  won: false, elims: 0 },
    ];

    const standings = computeTournamentStandings(teams, [], results, gameRoundMap);
    const t1 = standings[0];
    expect(t1.roundScores).toHaveLength(2);
    expect(t1.roundScores.find((r) => r.roundNumber === 1)?.score).toBe(10);
    expect(t1.roundScores.find((r) => r.roundNumber === 2)?.score).toBe(5);
  });

  it('ignores results for teams not in tournament', () => {
    const teams = [makeTeam('T1')];
    const results: GameResult[] = [
      { gameId: 'G1', teamId: 'T1',  score: 10, won: true,  elims: 0 },
      { gameId: 'G1', teamId: 'T99', score: 20, won: false, elims: 0 }, // not enrolled
    ];
    const standings = computeTournamentStandings(teams, [], results, new Map([['G1', 1]]));
    expect(standings).toHaveLength(1);
    expect(standings[0].teamId).toBe('T1');
  });
});

// ── isRoundComplete ────────────────────────────────────────────────────────────

describe('isRoundComplete', () => {
  it('returns true for empty round', () => {
    expect(isRoundComplete([], new Map())).toBe(true);
  });

  it('returns true when all games are finished', () => {
    const statuses = new Map([['G1', true], ['G2', true]]);
    expect(isRoundComplete(['G1', 'G2'], statuses)).toBe(true);
  });

  it('returns false when some games are not finished', () => {
    const statuses = new Map([['G1', true], ['G2', false]]);
    expect(isRoundComplete(['G1', 'G2'], statuses)).toBe(false);
  });

  it('returns false when a game is not in the map', () => {
    const statuses = new Map([['G1', true]]);
    expect(isRoundComplete(['G1', 'G2'], statuses)).toBe(false);
  });
});

// ── getEliminatedTeams ────────────────────────────────────────────────────────

describe('getEliminatedTeams', () => {
  it('returns teams not in winners set', () => {
    const active = ['T1', 'T2', 'T3', 'T4'];
    const winners = ['T1', 'T3'];
    expect(getEliminatedTeams(active, winners).sort()).toEqual(['T2', 'T4']);
  });

  it('no eliminations when all active teams win', () => {
    const active = ['T1', 'T2'];
    expect(getEliminatedTeams(active, active)).toEqual([]);
  });

  it('all eliminated when winner set is empty', () => {
    const active = ['T1', 'T2', 'T3'];
    expect(getEliminatedTeams(active, []).sort()).toEqual(['T1', 'T2', 'T3']);
  });
});

// ── bracketGameWinner ─────────────────────────────────────────────────────────

describe('bracketGameWinner', () => {
  it('returns team with highest score', () => {
    expect(bracketGameWinner([
      { teamId: 'T1', score: 10 },
      { teamId: 'T2', score: 25 },
      { teamId: 'T3', score: 15 },
    ])).toBe('T2');
  });

  it('on tie, returns lexicographically first teamId', () => {
    expect(bracketGameWinner([
      { teamId: 'T2', score: 10 },
      { teamId: 'T1', score: 10 },
    ])).toBe('T1');
  });

  it('returns null for empty input', () => {
    expect(bracketGameWinner([])).toBeNull();
  });

  it('single team always wins', () => {
    expect(bracketGameWinner([{ teamId: 'T1', score: 0 }])).toBe('T1');
  });
});

// ── roundRobinTotalRounds ─────────────────────────────────────────────────────

describe('roundRobinTotalRounds', () => {
  it('returns N-1 for even N', () => {
    expect(roundRobinTotalRounds(4)).toBe(3);
    expect(roundRobinTotalRounds(6)).toBe(5);
    expect(roundRobinTotalRounds(8)).toBe(7);
  });

  it('returns N for odd N', () => {
    expect(roundRobinTotalRounds(3)).toBe(3);
    expect(roundRobinTotalRounds(5)).toBe(5);
    expect(roundRobinTotalRounds(7)).toBe(7);
  });
});

// ── bracketPhase ──────────────────────────────────────────────────────────────

describe('bracketPhase', () => {
  it('2 teams → final', () => expect(bracketPhase(2)).toBe('final'));
  it('3 teams → semifinal', () => expect(bracketPhase(3)).toBe('semifinal'));
  it('4 teams → semifinal', () => expect(bracketPhase(4)).toBe('semifinal'));
  it('5 teams → quarterfinal', () => expect(bracketPhase(5)).toBe('quarterfinal'));
  it('8 teams → quarterfinal', () => expect(bracketPhase(8)).toBe('quarterfinal'));
  it('9 teams → round_of_16', () => expect(bracketPhase(9)).toBe('round_of_16'));
  it('16 teams → round_of_16', () => expect(bracketPhase(16)).toBe('round_of_16'));
  it('17 teams → round', () => expect(bracketPhase(17)).toBe('round'));
});
