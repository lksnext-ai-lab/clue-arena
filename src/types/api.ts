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
  agentId: string;
  usuarioId: string;
  estado: TeamStatus;
  createdAt: string;
}

export interface CreateTeamRequest {
  nombre: string;
  agentId: string;
}

export interface UpdateTeamRequest {
  nombre?: string;
  agentId?: string;
  estado?: TeamStatus;
}

// --- Games ---
export interface GameResponse {
  id: string;
  nombre: string;
  estado: GameStatus;
  turnoActual: number;
  equipos: GameTeamResponse[];
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface GameTeamResponse {
  id: string;
  equipoId: string;
  equipoNombre: string;
  orden: number;
  eliminado: boolean;
  puntos: number;
  cartas?: string[]; // Solo para el equipo propietario
}

export interface GameDetailResponse extends GameResponse {
  turnos: TurnResponse[];
  sobre?: EnvelopeResponse; // Solo cuando finalizada
}

export interface TurnResponse {
  id: string;
  equipoId: string;
  equipoNombre: string;
  numero: number;
  estado: string;
  sugerencias: SuggestionResponse[];
  acusacion?: AccusationResponse;
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
