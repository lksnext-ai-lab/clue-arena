/**
 * Pure Cluedo game engine — no I/O, fully deterministic given seed.
 * All functions are pure: they take state and return new state.
 */

import {
  SOSPECHOSOS,
  ARMAS,
  HABITACIONES,
  type Carta,
  type Sospechoso,
  type Arma,
  type Habitacion,
} from '@/types/domain';

import type {
  GameState,
  EquipoState,
  GameAction,
  SuggestionAction,
  AccusationAction,
  SuggestionResult,
  AccusationResult,
  ActionRecord,
  GameStateView,
} from './types';

// --- Seeded RNG (mulberry32) ---
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Init ---
export function initGame(equipoIds: string[], seed?: number): GameState {
  const resolvedSeed = seed ?? Date.now();
  const rand = mulberry32(resolvedSeed);

  const allCards: Carta[] = [
    ...SOSPECHOSOS,
    ...ARMAS,
    ...HABITACIONES,
  ];

  // Pick envelope
  const randomSospechoso = SOSPECHOSOS[Math.floor(rand() * SOSPECHOSOS.length)] as Sospechoso;
  const randomArma = ARMAS[Math.floor(rand() * ARMAS.length)] as Arma;
  const randomHabitacion = HABITACIONES[Math.floor(rand() * HABITACIONES.length)] as Habitacion;

  const sobre = { sospechoso: randomSospechoso, arma: randomArma, habitacion: randomHabitacion };

  // Remaining cards to deal
  const remaining = allCards.filter(
    (c) => c !== sobre.sospechoso && c !== sobre.arma && c !== sobre.habitacion
  );
  const shuffled = shuffle(remaining, rand);

  // Deal cards round-robin
  const equipoStates: EquipoState[] = equipoIds.map((id, i) => ({
    equipoId: id,
    orden: i,
    cartas: [],
    eliminado: false,
    puntos: 0,
  }));

  shuffled.forEach((carta, idx) => {
    equipoStates[idx % equipoStates.length].cartas.push(carta);
  });

  return {
    gameId: '',
    estado: 'pendiente',
    turnoActual: 0,
    sobre,
    equipos: equipoStates,
    historial: [],
    ganadorId: null,
    seed: resolvedSeed,
  };
}

// --- Apply action ---
export function applyAction(state: GameState, action: GameAction): GameState {
  if (state.estado === 'finalizada') return state;

  const currentEquipo = getEquipoEnTurno(state);
  if (!currentEquipo || currentEquipo.equipoId !== action.equipoId) {
    throw new Error('No es el turno de este equipo');
  }

  switch (action.type) {
    case 'suggestion':
      return applySuggestion(state, action);
    case 'accusation':
      return applyAccusation(state, action);
    case 'pass':
      return applyPass(state, action.equipoId);
    default:
      throw new Error('Acción desconocida');
  }
}

function applySuggestion(state: GameState, action: SuggestionAction): GameState {
  const refutador = findRefutador(state, action);
  let cartaMostrada: Carta | null = null;

  if (refutador) {
    const equipoRef = state.equipos.find((e) => e.equipoId === refutador)!;
    const matchingCards = equipoRef.cartas.filter(
      (c) => c === action.sospechoso || c === action.arma || c === action.habitacion
    );
    cartaMostrada = matchingCards[0] ?? null;
  }

  const result: SuggestionResult = { refutadaPor: refutador, cartaMostrada };

  const record: ActionRecord = {
    turno: state.turnoActual,
    equipoId: action.equipoId,
    action,
    result,
    timestamp: Date.now(),
  };

  return {
    ...state,
    historial: [...state.historial, record],
  };
}

function applyAccusation(state: GameState, action: AccusationAction): GameState {
  const correcta =
    action.sospechoso === state.sobre.sospechoso &&
    action.arma === state.sobre.arma &&
    action.habitacion === state.sobre.habitacion;

  const result: AccusationResult = {
    correcta,
    ganador: correcta ? action.equipoId : null,
  };

  const record: ActionRecord = {
    turno: state.turnoActual,
    equipoId: action.equipoId,
    action,
    result,
    timestamp: Date.now(),
  };

  const equiposActualizados = state.equipos.map((e) => {
    if (e.equipoId !== action.equipoId) return e;
    if (correcta) return { ...e, puntos: e.puntos + 100 };
    return { ...e, eliminado: true }; // Wrong accusation = eliminated
  });

  const activeEquipos = equiposActualizados.filter((e) => !e.eliminado);

  let nuevoEstado = state.estado;
  let ganadorId = state.ganadorId;

  if (correcta) {
    nuevoEstado = 'finalizada';
    ganadorId = action.equipoId;
  } else if (activeEquipos.length === 0) {
    nuevoEstado = 'finalizada';
  }

  const nextTurno = nuevoEstado === 'finalizada' ? state.turnoActual : nextTurnoIndex(equiposActualizados, state.turnoActual);

  return {
    ...state,
    estado: nuevoEstado,
    turnoActual: nextTurno,
    equipos: equiposActualizados,
    historial: [...state.historial, record],
    ganadorId,
  };
}

function applyPass(state: GameState, equipoId: string): GameState {
  const record: ActionRecord = {
    turno: state.turnoActual,
    equipoId,
    action: { type: 'pass', equipoId },
    result: null,
    timestamp: Date.now(),
  };

  return {
    ...state,
    turnoActual: nextTurnoIndex(state.equipos, state.turnoActual),
    historial: [...state.historial, record],
  };
}

// --- Helpers ---
function findRefutador(
  state: GameState,
  action: SuggestionAction
): string | null {
  const { sospechoso, arma, habitacion, equipoId } = action;
  const startIdx = state.equipos.findIndex((e) => e.equipoId === equipoId);

  for (let i = 1; i < state.equipos.length; i++) {
    const equipoIdx = (startIdx + i) % state.equipos.length;
    const equipo = state.equipos[equipoIdx];
    if (equipo.eliminado) continue;

    const hasCard = equipo.cartas.some(
      (c) => c === sospechoso || c === arma || c === habitacion
    );
    if (hasCard) return equipo.equipoId;
  }

  return null;
}

function getEquipoEnTurno(state: GameState): EquipoState | null {
  const activeEquipos = state.equipos.filter((e) => !e.eliminado);
  if (activeEquipos.length === 0) return null;
  return activeEquipos[state.turnoActual % activeEquipos.length] ?? null;
}

function nextTurnoIndex(equipos: EquipoState[], current: number): number {
  const activeEquipos = equipos.filter((e) => !e.eliminado);
  if (activeEquipos.length === 0) return current;
  return (current + 1) % activeEquipos.length;
}

// --- Queries ---
export function isGameOver(state: GameState): boolean {
  return state.estado === 'finalizada';
}

export function getWinner(state: GameState): string | null {
  return state.ganadorId;
}

export function getGameStateView(state: GameState, requestingTeamId: string): GameStateView {
  const currentEquipo = getEquipoEnTurno(state);

  return {
    gameId: state.gameId,
    estado: state.estado,
    turnoActual: state.turnoActual,
    equipos: state.equipos.map((e) => ({
      equipoId: e.equipoId,
      orden: e.orden,
      cartas: e.equipoId === requestingTeamId ? e.cartas : [],
      esPropio: e.equipoId === requestingTeamId,
      eliminado: e.eliminado,
      puntos: e.puntos,
    })),
    historial: state.historial.map((r) => {
      const base = {
        turno: r.turno,
        equipoId: r.equipoId,
        tipo: r.action.type as 'suggestion' | 'accusation' | 'pass',
        timestamp: r.timestamp,
      };

      if (r.action.type === 'suggestion') {
        const res = r.result as SuggestionResult | null;
        return {
          ...base,
          sospechoso: r.action.sospechoso,
          arma: r.action.arma,
          habitacion: r.action.habitacion,
          refutadaPor: res?.refutadaPor ?? null,
          // Only reveal cartaMostrada to the team that made the suggestion
          cartaMostrada:
            r.equipoId === requestingTeamId ? res?.cartaMostrada ?? null : undefined,
        };
      }

      if (r.action.type === 'accusation') {
        const res = r.result as AccusationResult | null;
        return {
          ...base,
          sospechoso: r.action.sospechoso,
          arma: r.action.arma,
          habitacion: r.action.habitacion,
          correcta: res?.correcta ?? false,
        };
      }

      return base;
    }),
    esElTurnoDeEquipo: currentEquipo?.equipoId === requestingTeamId,
  };
}
