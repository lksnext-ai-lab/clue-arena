// Domain types shared across the application

export type UserRole = 'admin' | 'equipo' | 'espectador';

export type GameStatus = 'pendiente' | 'en_curso' | 'finalizada';

export type TeamStatus = 'registrado' | 'activo' | 'finalizado';

export interface User {
  id: string;
  email: string;
  nombre: string;
  rol: UserRole;
  createdAt: Date;
}

export interface Team {
  id: string;
  nombre: string;
  agentId: string;
  usuarioId: string;
  estado: TeamStatus;
  createdAt: Date;
}

export interface Game {
  id: string;
  nombre: string;
  estado: GameStatus;
  turnoActual: number;
  sobresId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface GameTeam {
  id: string;
  partidaId: string;
  equipoId: string;
  orden: number;
  eliminado: boolean;
  puntos: number;
  cartas: string; // JSON array de cartas
}

export interface Envelope {
  id: string;
  partidaId: string;
  sospechoso: string;
  arma: string;
  habitacion: string;
}

export interface Turn {
  id: string;
  partidaId: string;
  equipoId: string;
  numero: number;
  estado: 'pendiente' | 'en_curso' | 'completado';
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface Suggestion {
  id: string;
  turnoId: string;
  partidaId: string;
  equipoId: string;
  sospechoso: string;
  arma: string;
  habitacion: string;
  refutadaPor: string | null;
  cartaMostrada: string | null; // Solo visible al equipo que hizo la sugerencia
  createdAt: Date;
}

export interface Accusation {
  id: string;
  turnoId: string;
  partidaId: string;
  equipoId: string;
  sospechoso: string;
  arma: string;
  habitacion: string;
  correcta: boolean;
  createdAt: Date;
}

export interface RankingEntry {
  id: string;
  equipoId: string;
  equipoNombre: string;
  puntos: number;
  posicion: number;
  partidasJugadas: number;
  aciertos: number;
}

// Cluedo game constants
export const SOSPECHOSOS = [
  'Coronel Mostaza',
  'Señora Pavo Real',
  'Reverendo Verde',
  'Señora Escarlata',
  'Profesor Ciruela',
  'Señorita Amapola',
] as const;

export const ARMAS = [
  'Candelabro',
  'Cuchillo',
  'Tubo de plomo',
  'Revólver',
  'Cuerda',
  'Llave inglesa',
] as const;

export const HABITACIONES = [
  'Cocina',
  'Salón de baile',
  'Conservatorio',
  'Comedor',
  'Sala de billar',
  'Biblioteca',
  'Sala de estar',
  'Estudio',
  'Vestíbulo',
] as const;

export type Sospechoso = (typeof SOSPECHOSOS)[number];
export type Arma = (typeof ARMAS)[number];
export type Habitacion = (typeof HABITACIONES)[number];
export type Carta = Sospechoso | Arma | Habitacion;
