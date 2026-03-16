import type { Sospechoso, Arma, Habitacion, Carta } from '@/types/domain';

// Internal game engine types

export type { Sospechoso, Arma, Habitacion, Carta };

export interface GameState {
  gameId: string;
  estado: 'pendiente' | 'en_curso' | 'finalizada';
  turnoActual: number;
  /** Número máximo de turnos configurado para la partida. null = sin límite */
  maxTurnos: number | null;
  sobre: { sospechoso: Sospechoso; arma: Arma; habitacion: Habitacion };
  equipos: EquipoState[];
  historial: ActionRecord[];
  ganadorId: string | null;
  seed: number;
}

export interface EquipoState {
  equipoId: string;
  orden: number;
  cartas: Carta[];
  eliminado: boolean;
  /** G006: cause of elimination (null = not eliminated) */
  eliminacionRazon: 'acusacion_incorrecta' | 'warnings' | null;
  /** G006: number of warnings accumulated this game session (0–3) */
  warnings: number;
  puntos: number;
  turnosJugados: number;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type ScoreEventType =
  | 'EVT_WIN'
  | 'EVT_WIN_EFFICIENCY'
  | 'EVT_TURN_SPEED'
  | 'EVT_SURVIVE'
  | 'EVT_SUGGESTION'
  | 'EVT_REFUTATION'
  | 'EVT_FALSE_CANNOT_REFUTE'
  | 'EVT_WRONG_ACCUSATION'
  | 'EVT_PASS'
  | 'EVT_TIMEOUT'
  | 'EVT_INVALID_CARD'
  | 'EVT_REDUNDANT_SUGGESTION'
  | 'EVT_INVALID_FORMAT'
  | 'EVT_COMM_ERROR'          // communication error (agent request failed)
  | 'EVT_WRONG_REFUTATION'    // refutador showed card not in hand or not in suggestion
  | 'EVT_WARNING'             // informational: team accumulated a warning (0 pts)
  | 'EVT_WARNING_ELIMINATION';// team eliminated upon reaching 3 warnings

export interface ScoreEvent {
  equipoId: string;
  type: ScoreEventType;
  points: number;
  turno: number;
  meta?: Record<string, unknown>;
}

export interface ApplyActionResult {
  state: GameState;
  scoreEvents: ScoreEvent[];
  suggestionResult?: SuggestionResult;
  accusationResult?: AccusationResult;
  /** G006: populated when the action was warning_elimination */
  warningEliminationResult?: {
    equipoId: string;
    redistribucion: { equipoId: string; cartas: Carta[] }[];
  };
}

export type GameAction =
  | SuggestionAction
  | AccusationAction
  | PassAction
  | WarningEliminationAction; // G006

export interface SuggestionAction {
  type: 'suggestion';
  equipoId: string;
  sospechoso: Sospechoso;
  arma: Arma;
  habitacion: Habitacion;
}

export interface AccusationAction {
  type: 'accusation';
  equipoId: string;
  sospechoso: Sospechoso;
  arma: Arma;
  habitacion: Habitacion;
}

export interface PassAction {
  type: 'pass';
  equipoId: string;
}

export interface SuggestionResult {
  refutadaPor: string | null;
  cartaMostrada: Carta | null;
}

export interface AccusationResult {
  correcta: boolean;
  ganador: string | null;
}

/** G006: action type for warning-based elimination */
export interface WarningEliminationAction {
  type: 'warning_elimination';
  equipoId: string;
}

/** G006: record written to historial when a team is eliminated by warnings */
export interface WarningEliminationRecord {
  type: 'warning_elimination';
  equipoId: string;
  turno: number;
  cartasRepartidas: number;
  /** IDs of teams that received ≥1 card (does not reveal which cards) */
  equiposReceptores: string[];
}

export interface ActionRecord {
  turno: number;
  equipoId: string;
  action: GameAction;
  result: SuggestionResult | AccusationResult | null;
  timestamp: number;
}

// View type: hides private info based on requesting team
export interface GameStateView {
  gameId: string;
  estado: string;
  turnoActual: number;
  /** copia del campo maxTurnos del estado para que los agentes conozcan cuántos giros quedan */
  maxTurnos: number | null;
  equipos: EquipoStateView[];
  historial: ActionRecordView[];
  esElTurnoDeEquipo: boolean;
  /** Cartas permitidas en el juego: lista completa de sospechosos */
  sospechosos: readonly Sospechoso[];
  /** Cartas permitidas en el juego: lista completa de armas */
  armas: readonly Arma[];
  /** Cartas permitidas en el juego: lista completa de habitaciones */
  habitaciones: readonly Habitacion[];
}

export interface EquipoStateView {
  equipoId: string;
  orden: number;
  cartas: Carta[]; // Only own cards; empty for others
  numCartas: number; // Public: number of cards in hand
  esPropio: boolean;
  eliminado: boolean;
  /** G006: cause of elimination visible to all agents for strategic reasoning */
  eliminadoPorWarnings: boolean;
  /** G006: warning counter visible to all agents (0–3) */
  warnings: number;
  puntos: number;
  turnosJugados: number; // Public: how many turns this team has played
}

export interface ActionRecordView {
  turno: number;
  equipoId: string;
  tipo: 'suggestion' | 'accusation' | 'pass';
  sospechoso?: string;
  arma?: string;
  habitacion?: string;
  refutadaPor?: string | null;
  cartaMostrada?: Carta | null;     // Private: only for the team that made the suggestion
  cartaMostradaPorMi?: Carta | null; // Private: only for the team that refuted
  correcta?: boolean;
  timestamp: number;
}
