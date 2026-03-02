// API request/response types

import type { UserRole, GameStatus, TeamStatus, RankingEntry } from './domain';

// --- Auth ---
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  rol: UserRole | null;
  equipo: { id: string; nombre: string; agentId: string } | null;
}

// --- Teams ---
export interface TeamResponse {
  id: string;
  nombre: string;
  descripcion: string | null;
  agentId: string;
  avatarUrl: string | null;
  usuarioId: string;
  estado: TeamStatus;
  miembros: string[]; // lista de emails de miembros del equipo
  createdAt: string;
}

export interface CreateTeamRequest {
  nombre: string;
  agentId: string;
  miembros?: string[];
}

export interface UpdateTeamRequest {
  nombre?: string;
  descripcion?: string | null;
  agentId?: string;
  avatarUrl?: string | null;
  estado?: TeamStatus;
  miembros?: string[];
}

// --- Games ---
export interface GameResponse {
  id: string;
  nombre: string;
  estado: GameStatus;
  turnoActual: number;
  maxTurnos: number | null;
  modoEjecucion: 'manual' | 'auto' | 'pausado';
  autoRunActivoDesde: string | null;
  equipos: GameTeamResponse[];
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface GameTeamResponse {
  id: string;
  equipoId: string;
  equipoNombre: string;
  avatarUrl: string | null;
  orden: number;
  eliminado: boolean;
  puntos: number;
  numCartas: number;   // Recuento público de cartas
  cartas?: string[];   // Solo para el equipo propietario o admin
}

// --- Arena (F009) ---

export interface ArenaActionRecord {
  turno: number;
  equipoId: string;
  equipoNombre: string;
  tipo: 'suggestion' | 'accusation' | 'pass';
  sospechoso?: string;
  arma?: string;
  habitacion?: string;
  refutadaPor?: string | null;     // equipoId (nunca la carta)
  refutadaPorNombre?: string | null;
  correcta?: boolean;              // Para acusaciones
  deltaPoints?: number;
  timestamp: string;
}

export interface GameDetailResponse extends GameResponse {
  activeEquipoId: string | null;
  turnos: TurnResponse[];
  sobre?: EnvelopeResponse; // Admin: siempre; Público: solo cuando finalizada
}

// --- Score events (GET /api/games/:id/score-events) ---

export interface ScoreEventPublic {
  id: number;
  equipoId: string;
  turno: number;
  type: string;
  points: number;
  meta: Record<string, unknown> | null;
  createdAt: string | null;
}

export interface ScoreEventsResponse {
  events: ScoreEventPublic[];
}

export interface PaseResponse {
  id: string;
  equipoId: string;
  origen: 'voluntario' | 'timeout' | 'invalid_format';
  createdAt: string;
}

export interface TurnResponse {
  id: string;
  equipoId: string;
  equipoNombre: string;
  numero: number;
  estado: string;
  sugerencias: SuggestionResponse[];
  acusacion?: AccusationResponse;
  pase?: PaseResponse;
  /** G004: comment from the active agent for this turn */
  agentSpectatorComment?: string | null;
  /** G004: comment from the first successful refutador */
  refutadorSpectatorComment?: string | null;
  /** Agent LLM reasoning for this turn (shown collapsed in feed) */
  agentReasoning?: string | null;
}

export interface SuggestionResponse {
  id: string;
  equipoId: string;
  sospechoso: string;
  arma: string;
  habitacion: string;
  refutadaPor: string | null;
  cartaMostrada?: string | null; // Solo para el equipo solicitante
  createdAt: string;
}

export interface AccusationResponse {
  id: string;
  equipoId: string;
  sospechoso: string;
  arma: string;
  habitacion: string;
  correcta: boolean;
  createdAt: string;
}

export interface EnvelopeResponse {
  sospechoso: string;
  arma: string;
  habitacion: string;
}

export interface CreateGameRequest {
  nombre: string;
  equipoIds: string[];
}

// --- Ranking ---
export interface RankingResponse {
  ranking: RankingEntry[];
  updatedAt: string;
}

// --- Errors ---
export interface ApiError {
  error: string;
  details?: unknown;
}

export interface ValidationError {
  errors: Record<string, string[]>;
}

// --- Agent contract (shared by MattinAI backend and local Genkit backend) ---

export interface PlayTurnRequest {
  type: 'play_turn';
  gameId: string;
  teamId: string;
}

export interface RefuteRequest {
  type: 'refute';
  gameId: string;
  teamId: string;
  suspect: string;
  weapon: string;
  room: string;
}

export type AgentRequest = PlayTurnRequest | RefuteRequest;

export interface SuggestionAction {
  type: 'suggestion';
  suspect: string;
  weapon: string;
  room: string;
}

export interface AccusationAction {
  type: 'accusation';
  suspect: string;
  weapon: string;
  room: string;
}

export interface ShowCardAction {
  type: 'show_card';
  card: string;
}

export interface CannotRefuteAction {
  type: 'cannot_refute';
}

export interface PassAgentAction {
  type: 'pass';
}

export type AgentAction =
  | SuggestionAction
  | AccusationAction
  | ShowCardAction
  | CannotRefuteAction
  | PassAgentAction;

export interface AgentResponse {
  /** Structured action that the game engine applies */
  action: AgentAction;
  /** LLM reasoning text (for logs/debug) */
  reasoning: string;
  /** Always true; allows future streaming extension */
  done: boolean;
  /**
   * G004: short natural-language comment for spectators (max 160 chars).
   * Optional — agents that omit it produce no visible comment in the Arena.
   */
  spectatorComment?: string;
}

// ── F012 — Agent invocation context ─────────────────────────────────────────

/**
 * Extra context passed alongside an AgentRequest so the coordinator can emit
 * structured interaction log entries correlated by invocacionId.
 */
export interface AgentInvocationContext {
  /** Turn record ID — used as correlation field in log entries */
  turnoId: string;
  /**
   * SHA-256 of the GameStateView sent to the agent.
   * Undefined when the view was not pre-computed by the caller.
   */
  gameStateViewHash?: string;
}

// ── F015 — Training Arena types ──────────────────────────────────────────────

export interface AgentToolCall {
  tool:       'get_game_state' | 'get_agent_memory' | 'save_agent_memory';
  args:       Record<string, unknown>;
  result:     Record<string, unknown>;
  durationMs: number;
}

export interface AgentLlmExchange {
  /** 0-based index within the same turn (ReAct may produce N exchanges) */
  index:        number;
  systemPrompt: string;
  userPrompt:   string;
  rawResponse:  string;
  toolCalls:    AgentToolCall[];
  durationMs:   number;
}

export interface AgentInteractionTrace {
  type:           'play_turn' | 'refute';
  exchanges:      AgentLlmExchange[];
  totalToolCalls: number;
  parsedAction:   AgentResponse | null;
  parseError:     string | null;
}

export interface TrainingGameResponse {
  id:          string;
  equipoId:    string;
  estado:      'en_curso' | 'finalizada' | 'abortada';
  numBots:     number;
  seed:        string | null;
  numTurnos:   number;
  ganador:     string | null;  // equipoId that won, or null
  sobres:      { sospechoso: string; arma: string; habitacion: string } | null; // visible when finalizada
  resultado:   TrainingResultado | null;
  motivoAbort: string | null;
  createdAt:   string;
  finishedAt:  string | null;
}

export interface TrainingResultado {
  ganadorId:     string | null;
  puntosSimulados: number;
  turnosJugados: number;
}

export interface TrainingTurnResponse {
  id:             string;
  partidaId:      string;
  equipoId:       string;
  esBot:          boolean;
  numero:         number;
  accion:         AgentResponse | null;
  gameStateView:  unknown | null;          // GameStateView JSON — null for bot turns in non-admin context
  agentTrace:     AgentInteractionTrace | null;  // null for bot turns
  memoriaInicial: Record<string, unknown> | null;
  memoriaFinal:   Record<string, unknown> | null;
  durationMs:     number | null;
  createdAt:      string;
}

export interface CreateTrainingGameBody {
  numBots: number;
  seed?:   string;
}
