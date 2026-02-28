import type { Sospechoso, Arma, Habitacion, Carta } from '@/types/domain';

// Internal game engine types

export type { Sospechoso, Arma, Habitacion, Carta };

export interface GameState {
  gameId: string;
  estado: 'pendiente' | 'en_curso' | 'finalizada';
  turnoActual: number;
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
  puntos: number;
  turnosJugados: number;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type ScoreEventType =
  | 'EVT_WIN'
  | 'EVT_WIN_EFFICIENCY'
  | 'EVT_SURVIVE'
  | 'EVT_SUGGESTION'
  | 'EVT_REFUTATION'
  | 'EVT_WRONG_ACCUSATION'
  | 'EVT_PASS'
  | 'EVT_TIMEOUT'
  | 'EVT_INVALID_CARD'
  | 'EVT_REDUNDANT_SUGGESTION'
  | 'EVT_INVALID_FORMAT';

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
}

export type GameAction =
  | SuggestionAction
  | AccusationAction
  | PassAction;

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
  equipos: EquipoStateView[];
  historial: ActionRecordView[];
  esElTurnoDeEquipo: boolean;
}

export interface EquipoStateView {
  equipoId: string;
  orden: number;
  cartas: Carta[]; // Only own cards; empty for others
  esPropio: boolean;
  eliminado: boolean;
  puntos: number;
}

export interface ActionRecordView {
  turno: number;
  equipoId: string;
  tipo: 'suggestion' | 'accusation' | 'pass';
  sospechoso?: string;
  arma?: string;
  habitacion?: string;
  refutadaPor?: string | null;
  cartaMostrada?: Carta | null; // Only for requesting team
  correcta?: boolean;
  timestamp: number;
}
