// src/lib/tournament/types.ts
// Internal types for the tournament module — no DB or I/O dependencies.

export type TeamId = string;
export type GameId = string;

export type TournamentFormat = 'round_robin' | 'single_bracket' | 'group_stage' | 'custom';
export type TournamentStatus = 'draft' | 'active' | 'finished';
export type RoundPhase = 'group_stage' | 'round_of_16' | 'quarterfinal' | 'semifinal' | 'final' | 'round';
export type RoundStatus = 'pending' | 'active' | 'finished';

export interface TournamentTeam {
  teamId:     TeamId;
  seed:       number | null;
  groupIndex: number | null;
  eliminated: boolean;
}

export interface TournamentRound {
  id:          string;
  roundNumber: number;
  phase:       RoundPhase;
  status:      RoundStatus;
}

export interface GameResult {
  gameId:  GameId;
  teamId:  TeamId;
  score:   number;
  /** Whether this team resolved the mystery (made a correct accusation). */
  won:     boolean;
  /** Number of eliminations (incorrect accusations by other teams in this game). */
  elims:   number;
}

export interface TournamentStanding {
  teamId:             TeamId;
  totalScore:         number;
  gamesPlayed:        number;
  wins:               number;
  eliminations:       number;
  isEliminated:       boolean;
  advancedToPlayoffs: boolean;
  groupIndex:         number | null;
  roundScores:        { roundNumber: number; score: number; gameId: GameId | null }[];
}
