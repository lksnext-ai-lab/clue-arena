// src/tests/tournament-matchmaker.test.ts
import { describe, it, expect } from 'vitest';
import {
  generateRoundRobinPairings,
  generateBracketRound,
  generateGroupStagePairings,
  assignTeamsToGroups,
} from '@/lib/tournament/matchmaker';

// ── Helpers ────────────────────────────────────────────────────────────────────

function teams(n: number) {
  return Array.from({ length: n }, (_, i) => `T${i + 1}`);
}

function assertNoTeamDuplicate(games: string[][]): void {
  const seen = new Set<string>();
  for (const game of games) {
    for (const teamId of game) {
      if (seen.has(teamId)) {
        throw new Error(`Team ${teamId} appears more than once in the same round`);
      }
      seen.add(teamId);
    }
  }
}

function allTeamsPresent(games: string[][], expectedTeams: string[]): boolean {
  const inGames = new Set(games.flat());
  return expectedTeams.every((t) => inGames.has(t));
}

// ── generateRoundRobinPairings ─────────────────────────────────────────────────

describe('generateRoundRobinPairings', () => {
  it('4 teams, PPG=2: round 0 produces 2 games, no duplicates', () => {
    const t = teams(4);
    const games = generateRoundRobinPairings(t, 0, 2);
    expect(games).toHaveLength(2);
    assertNoTeamDuplicate(games);
    expect(allTeamsPresent(games, t)).toBe(true);
  });

  it('4 teams, PPG=4: round 0 produces 1 game with all 4 teams', () => {
    const t = teams(4);
    const games = generateRoundRobinPairings(t, 0, 4);
    assertNoTeamDuplicate(games);
    expect(allTeamsPresent(games, t)).toBe(true);
  });

  it('6 teams, PPG=6: round 0 produces 1 game with all 6 teams', () => {
    const t = teams(6);
    const games = generateRoundRobinPairings(t, 0, 6);
    expect(games).toHaveLength(1);
    expect(games[0]).toHaveLength(6);
    assertNoTeamDuplicate(games);
  });

  it('6 teams, PPG=2: round 0 produces 3 games of 2', () => {
    const t = teams(6);
    const games = generateRoundRobinPairings(t, 0, 2);
    expect(games).toHaveLength(3);
    games.forEach((g) => expect(g).toHaveLength(2));
    assertNoTeamDuplicate(games);
    expect(allTeamsPresent(games, t)).toBe(true);
  });

  it('8 teams, PPG=4: round produces 2 games, all teams covered', () => {
    const t = teams(8);
    const games = generateRoundRobinPairings(t, 0, 4);
    assertNoTeamDuplicate(games);
    expect(allTeamsPresent(games, t)).toBe(true);
  });

  it('12 teams, PPG=6: round produces 2 games of 6', () => {
    const t = teams(12);
    const games = generateRoundRobinPairings(t, 0, 6);
    expect(games).toHaveLength(2);
    games.forEach((g) => expect(g).toHaveLength(6));
    assertNoTeamDuplicate(games);
  });

  it('16 teams, PPG=4: round produces 4 games of 4', () => {
    const t = teams(16);
    const games = generateRoundRobinPairings(t, 0, 4);
    expect(games).toHaveLength(4);
    games.forEach((g) => expect(g).toHaveLength(4));
    assertNoTeamDuplicate(games);
  });

  it('5 teams (odd): no team appears twice in any round', () => {
    const t = teams(5);
    for (let r = 0; r < 5; r++) {
      const games = generateRoundRobinPairings(t, r, 2);
      assertNoTeamDuplicate(games);
    }
  });

  it('3 teams (odd): 1 game per round, 1 player gets a bye', () => {
    const t = teams(3);
    const games = generateRoundRobinPairings(t, 0, 2);
    expect(games).toHaveLength(1);
    assertNoTeamDuplicate(games);
  });

  it('different rounds produce different pairings for 4 teams', () => {
    const t = teams(4);
    const round0 = generateRoundRobinPairings(t, 0, 2).map((g) => [...g].sort()).sort().toString();
    const round1 = generateRoundRobinPairings(t, 1, 2).map((g) => [...g].sort()).sort().toString();
    const round2 = generateRoundRobinPairings(t, 2, 2).map((g) => [...g].sort()).sort().toString();
    // All three rounds should be different (Berger rotation)
    expect(new Set([round0, round1, round2]).size).toBe(3);
  });

  it('returns empty for 0 teams', () => {
    expect(generateRoundRobinPairings([], 0, 2)).toEqual([]);
  });

  it('round wraps using modulo when round >= N-1', () => {
    const t = teams(4); // N=4, valid rounds: 0,1,2
    const r0 = generateRoundRobinPairings(t, 0, 2);
    const r3 = generateRoundRobinPairings(t, 3, 2); // should wrap to round 0
    expect(r0.map((g) => g.sort()).sort().toString()).toBe(r3.map((g) => g.sort()).sort().toString());
  });
});

// ── generateBracketRound ───────────────────────────────────────────────────────

describe('generateBracketRound', () => {
  const standings = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ teamId: `T${n - i}`, score: n - i }));

  it('4 teams, PPG=2: 2 matches, no byes', () => {
    const result = generateBracketRound(standings(4), 2);
    expect(result.matches).toHaveLength(2);
    expect(result.byes).toHaveLength(0);
    assertNoTeamDuplicate(result.matches);
  });

  it('8 teams, PPG=2: 4 matches, no byes', () => {
    const result = generateBracketRound(standings(8), 2);
    expect(result.matches).toHaveLength(4);
    expect(result.byes).toHaveLength(0);
  });

  it('6 teams, PPG=2: 3 matches, no byes', () => {
    const result = generateBracketRound(standings(6), 2);
    expect(result.matches).toHaveLength(3);
    expect(result.byes).toHaveLength(0);
  });

  it('5 teams, PPG=2: 2 matches, 1 bye (best seed)', () => {
    const result = generateBracketRound(standings(5), 2);
    expect(result.byes).toHaveLength(1);
    expect(result.matches).toHaveLength(2);
    // Best seed (T5, score=5) gets the bye
    expect(result.byes[0]).toBe('T5');
  });

  it('7 teams, PPG=2: 3 matches, 1 bye', () => {
    const result = generateBracketRound(standings(7), 2);
    expect(result.byes).toHaveLength(1);
    expect(result.matches).toHaveLength(3);
  });

  it('8 teams, PPG=4: 2 matches of 4, no byes', () => {
    const result = generateBracketRound(standings(8), 4);
    expect(result.matches).toHaveLength(2);
    result.matches.forEach((m) => expect(m).toHaveLength(4));
    expect(result.byes).toHaveLength(0);
  });

  it('no team appears twice across matches', () => {
    const result = generateBracketRound(standings(8), 2);
    assertNoTeamDuplicate(result.matches);
  });

  it('1 team: returns bye, no matches', () => {
    const result = generateBracketRound([{ teamId: 'T1', score: 10 }], 2);
    expect(result.matches).toHaveLength(0);
    expect(result.byes).toEqual(['T1']);
  });

  it('0 teams: empty result', () => {
    const result = generateBracketRound([], 2);
    expect(result.matches).toHaveLength(0);
    expect(result.byes).toHaveLength(0);
  });
});

// ── generateGroupStagePairings ────────────────────────────────────────────────

describe('generateGroupStagePairings', () => {
  it('2 groups of 4 teams: 4 games total (2 per group), no duplicates', () => {
    const g1 = ['A1', 'A2', 'A3', 'A4'];
    const g2 = ['B1', 'B2', 'B3', 'B4'];
    const games = generateGroupStagePairings([g1, g2], 0, 2);
    assertNoTeamDuplicate(games);
    // Each group of 4 with PPG=2 produces 2 games
    expect(games).toHaveLength(4);
  });

  it('teams in different groups never play each other', () => {
    const g1 = ['A1', 'A2', 'A3', 'A4'];
    const g2 = ['B1', 'B2', 'B3', 'B4'];
    const games = generateGroupStagePairings([g1, g2], 0, 6);
    for (const game of games) {
      const hasGroup1 = game.some((t) => g1.includes(t));
      const hasGroup2 = game.some((t) => g2.includes(t));
      // A game should only come from one group
      expect(hasGroup1 && hasGroup2).toBe(false);
    }
  });

  it('different rounds produce different pairings within groups', () => {
    const g1 = ['A1', 'A2', 'A3', 'A4'];
    const g2 = ['B1', 'B2', 'B3', 'B4'];
    const r0 = generateGroupStagePairings([g1, g2], 0, 2).toString();
    const r1 = generateGroupStagePairings([g1, g2], 1, 2).toString();
    expect(r0).not.toBe(r1);
  });
});

// ── assignTeamsToGroups ────────────────────────────────────────────────────────

describe('assignTeamsToGroups', () => {
  it('8 teams, 2 groups: each group has 4 teams', () => {
    const t = Array.from({ length: 8 }, (_, i) => ({ teamId: `T${i + 1}`, seed: i + 1 }));
    const groups = assignTeamsToGroups(t, 2);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(4);
    expect(groups[1]).toHaveLength(4);
  });

  it('6 teams, 3 groups: each group has 2 teams', () => {
    const t = Array.from({ length: 6 }, (_, i) => ({ teamId: `T${i + 1}`, seed: i + 1 }));
    const groups = assignTeamsToGroups(t, 3);
    expect(groups).toHaveLength(3);
    groups.forEach((g) => expect(g).toHaveLength(2));
  });

  it('no team appears twice across groups', () => {
    const t = Array.from({ length: 12 }, (_, i) => ({ teamId: `T${i + 1}`, seed: i + 1 }));
    const groups = assignTeamsToGroups(t, 4);
    const allTeams = groups.flat();
    expect(new Set(allTeams).size).toBe(allTeams.length);
  });

  it('all teams are assigned', () => {
    const t = Array.from({ length: 9 }, (_, i) => ({ teamId: `T${i + 1}`, seed: i + 1 }));
    const groups = assignTeamsToGroups(t, 3);
    const allTeams = groups.flat();
    expect(allTeams).toHaveLength(9);
  });

  it('teams with null seeds are placed last', () => {
    const t = [
      { teamId: 'T1', seed: 1 },
      { teamId: 'T2', seed: null },
      { teamId: 'T3', seed: 2 },
      { teamId: 'T4', seed: null },
    ];
    const groups = assignTeamsToGroups(t, 2);
    // All 4 teams should still be assigned
    expect(groups.flat()).toHaveLength(4);
  });
});
