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

// ── Cluedo game constants — nombres corporativos canónicos del evento ─────────
// Fuente de verdad única para motor, MCP, datos y UI.
// NO usar nombres del Cluedo clásico en ninguna capa.

export const SOSPECHOSOS = [
  'Directora Scarlett',
  'Coronel Mustard',
  'Sra. White',
  'Sr. Green',
  'Dra. Peacock',
  'Profesor Plum',
] as const;

export const ARMAS = [
  'Cable de red',
  'Teclado mecánico',
  'Cafetera rota',
  'Certificado SSL caducado',
  'Grapadora industrial',
  'Termo de acero',
] as const;

export const HABITACIONES = [
  'El Despacho del CEO',
  'El Laboratorio',
  'El Open Space',
  'La Cafetería',
  'La Sala de Juntas',
  'La Sala de Servidores',
  'La Zona de Descanso',
  'Recursos Humanos',
  'El Almacén de IT',
] as const;

export type Sospechoso = (typeof SOSPECHOSOS)[number];
export type Arma = (typeof ARMAS)[number];
export type Habitacion = (typeof HABITACIONES)[number];
export type Carta = Sospechoso | Arma | Habitacion;

// ── Metadatos de UI — solo para capa de presentación ─────────────────────────
// NO importar en engine.ts, MCP tools ni route handlers.

export interface PersonajeMeta {
  color: string;        // HEX para dot y borde de ficha
  departamento: string; // Departamento corporativo del personaje
  descripcion: string;
  imagen: string;       // Ruta relativa a /public/game/personajes/
}

export const PERSONAJE_META: Record<Sospechoso, PersonajeMeta> = {
  'Directora Scarlett': { color: '#ef4444', departamento: 'Marketing',      descripcion: 'Directora de Marketing con acceso a todos los sistemas de comunicación internos.', imagen: '/game/personajes/personaje-scarlett.webp' },
  'Coronel Mustard':    { color: '#eab308', departamento: 'Seguridad',      descripcion: 'Responsable de seguridad corporativa. Nadie entra sin que él lo sepa.',             imagen: '/game/personajes/personaje-coronel-mustard.webp' },
  'Sra. White':         { color: '#e2e8f0', departamento: 'Administración', descripcion: 'Administra la empresa desde las sombras. Sabe más de lo que dice.',                  imagen: '/game/personajes/personaje-sra-white.webp' },
  'Sr. Green':          { color: '#22c55e', departamento: 'Finanzas',       descripcion: 'Controla los presupuestos de IT. Tiene motivos económicos para actuar.',             imagen: '/game/personajes/personaje-sr-green.webp' },
  'Dra. Peacock':       { color: '#3b82f6', departamento: 'Legal',          descripcion: 'Asesora jurídica que conoce cada contrato y cada cláusula del sistema.',             imagen: '/game/personajes/personaje-dra-peacock.webp' },
  'Profesor Plum':      { color: '#a855f7', departamento: 'Innovación',     descripcion: 'Creador del algoritmo asesinado. El primero en saber que algo ha ido terriblemente mal.', imagen: '/game/personajes/personaje-prof-plunk.webp' },
};

export interface ArmaMeta {
  emoji: string;
  imagen: string;  // Ruta relativa a /public/game/arma/
}

export const ARMA_META: Record<Arma, ArmaMeta> = {
  'Cable de red':                { emoji: '🔌', imagen: '/game/arma/arma-cable.webp' },
  'Teclado mecánico':            { emoji: '⌨️', imagen: '/game/arma/arma-teclado.webp' },
  'Cafetera rota':               { emoji: '🫖', imagen: '/game/arma/arma-cafetera.webp' },
  'Certificado SSL caducado':    { emoji: '🔒', imagen: '/game/arma/arma-certificado.webp' },
  'Grapadora industrial':        { emoji: '📎', imagen: '/game/arma/arma-grapadora.webp' },
  'Termo de acero':              { emoji: '🥤', imagen: '/game/arma/arma-termo.webp' },
};

export interface EscenarioMeta {
  imagen: string;   // Ruta relativa a /public/game/escenarios/
  emoji: string;
}

export const ESCENARIO_META: Record<Habitacion, EscenarioMeta> = {
  'El Despacho del CEO':    { imagen: '/game/escenarios/escenario-despacho-ceo.webp',      emoji: '💼' },
  'El Laboratorio':         { imagen: '/game/escenarios/escenario-laboratorio.webp',       emoji: '🔬' },
  'El Open Space':          { imagen: '/game/escenarios/escenario-open-space.webp',        emoji: '💻' },
  'La Cafetería':           { imagen: '/game/escenarios/escenario-cafeteria.webp',         emoji: '☕' },
  'La Sala de Juntas':      { imagen: '/game/escenarios/escenario-sala-juntas.webp',       emoji: '📊' },
  'La Sala de Servidores':  { imagen: '/game/escenarios/escenario-sala-servidores.webp',   emoji: '🖥️' },
  'La Zona de Descanso':    { imagen: '/game/escenarios/escenario-zona-descanso.webp',     emoji: '🛋️' },
  'Recursos Humanos':       { imagen: '/game/escenarios/escenario-recursos-humanos.webp',  emoji: '👥' },
  'El Almacén de IT':       { imagen: '/game/escenarios/escenario-almacen-it.webp',        emoji: '📦' },
};
