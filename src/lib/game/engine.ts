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
  ScoreEvent,
  ApplyActionResult,
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
    turnosJugados: 0,
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

// --- Scoring constants ---
const EVT_WIN_POINTS = 1_000;
const EVT_SURVIVE_POINTS = 200;
const EVT_SUGGESTION_POINTS = 10;
const EVT_SUGGESTION_CAP = 5;
const EVT_REFUTATION_POINTS = 15;
const EVT_WRONG_ACCUSATION_POINTS = -150;
const EVT_PASS_POINTS = -5;

/** Returns the efficiency bonus for a winning team based on own turns played. */
export function calcEfficiencyBonus(turnosJugados: number): number {
  const T_MIN = 2;
  const BONUS_BASE = 500;
  const DECAY = 25;
  return Math.max(0, BONUS_BASE - (turnosJugados - T_MIN) * DECAY);
}

/**
 * Validates a suggestion and returns penalty events (if any).
 * - EVT_INVALID_CARD: early return; caller must skip suggestion processing.
 * - EVT_REDUNDANT_SUGGESTION: suggestion proceeds but no EVT_SUGGESTION.
 * - Empty array: suggestion is fully valid.
 */
export function validateSuggestion(
  action: SuggestionAction,
  historial: ActionRecord[],
): ScoreEvent[] {
  const turno = historial.length; // proxy for current turn number

  // 1. Invalid card check
  const hasInvalidCard =
    !SOSPECHOSOS.includes(action.sospechoso) ||
    !ARMAS.includes(action.arma) ||
    !HABITACIONES.includes(action.habitacion);

  if (hasInvalidCard) {
    return [
      {
        equipoId: action.equipoId,
        type: 'EVT_INVALID_CARD',
        points: -30,
        turno,
        meta: {
          sospechoso: action.sospechoso,
          arma: action.arma,
          habitacion: action.habitacion,
        },
      },
    ];
  }

  // 2. Redundant suggestion check
  const isRedundant = historial.some(
    (r) =>
      r.equipoId === action.equipoId &&
      r.action.type === 'suggestion' &&
      (r.action as SuggestionAction).sospechoso === action.sospechoso &&
      (r.action as SuggestionAction).arma === action.arma &&
      (r.action as SuggestionAction).habitacion === action.habitacion,
  );

  if (isRedundant) {
    return [
      {
        equipoId: action.equipoId,
        type: 'EVT_REDUNDANT_SUGGESTION',
        points: -20,
        turno,
        meta: {
          sospechoso: action.sospechoso,
          arma: action.arma,
          habitacion: action.habitacion,
        },
      },
    ];
  }

  return [];
}

/** Counts the number of EVT_SUGGESTION events already earned by a team in the historial. */
function countValidSuggestionsInHistory(historial: ActionRecord[], equipoId: string): number {
  let count = 0;
  for (const record of historial) {
    if (record.equipoId !== equipoId || record.action.type !== 'suggestion') continue;
    // A suggestion with a non-null result that is not a redundant one counts as valid.
    // (Invalid-card suggestions have result === null and no refutation.)
    if (record.result === null) continue; // was an invalid-card action
    // Check if this history entry itself was redundant vs all prior entries
    const isRedundant = historial
      .filter((r) => r !== record)
      .some(
        (r) =>
          r.equipoId === equipoId &&
          r.action.type === 'suggestion' &&
          r.timestamp < record.timestamp &&
          (r.action as SuggestionAction).sospechoso === (record.action as SuggestionAction).sospechoso &&
          (r.action as SuggestionAction).arma === (record.action as SuggestionAction).arma &&
          (r.action as SuggestionAction).habitacion === (record.action as SuggestionAction).habitacion,
      );
    if (!isRedundant) count++;
  }
  return count;
}

// --- Apply action ---
export function applyAction(state: GameState, action: GameAction): ApplyActionResult {
  if (state.estado === 'finalizada') return { state, scoreEvents: [] };

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

function incrementTurnosJugados(equipos: EquipoState[], equipoId: string): EquipoState[] {
  return equipos.map((e) =>
    e.equipoId === equipoId ? { ...e, turnosJugados: e.turnosJugados + 1 } : e,
  );
}

function applySuggestion(state: GameState, action: SuggestionAction): ApplyActionResult {
  const turno = state.turnoActual;
  const scoreEvents: ScoreEvent[] = [];

  // Increment own turn counter
  const equiposWithTurno = incrementTurnosJugados(state.equipos, action.equipoId);

  // Validate suggestion
  const penalties = validateSuggestion(action, state.historial);
  const isInvalidCard = penalties.some((e) => e.type === 'EVT_INVALID_CARD');

  if (isInvalidCard) {
    // Turn consumed; suggestion not processed (no refutation, no suggestionResult)
    scoreEvents.push(...penalties);
    const penaltySum = penalties.reduce((s, e) => s + e.points, 0);
    const equiposUpdated = equiposWithTurno.map((e) =>
      e.equipoId === action.equipoId ? { ...e, puntos: e.puntos + penaltySum } : e,
    );
    const record: ActionRecord = {
      turno,
      equipoId: action.equipoId,
      action,
      result: null, // marks this as invalid-card (no refutation)
      timestamp: Date.now(),
    };
    return {
      state: {
        ...state,
        turnoActual: nextTurnoIndex(equiposUpdated, turno),
        equipos: equiposUpdated,
        historial: [...state.historial, record],
      },
      scoreEvents,
    };
  }

  // Process suggestion normally (find refutador)
  const refutador = findRefutador(state, action);
  let cartaMostrada: Carta | null = null;

  if (refutador) {
    const equipoRef = equiposWithTurno.find((e) => e.equipoId === refutador)!;
    const matchingCards = equipoRef.cartas.filter(
      (c) => c === action.sospechoso || c === action.arma || c === action.habitacion,
    );
    cartaMostrada = matchingCards[0] ?? null;
  }

  const suggestionResult: SuggestionResult = { refutadaPor: refutador, cartaMostrada };
  const record: ActionRecord = {
    turno,
    equipoId: action.equipoId,
    action,
    result: suggestionResult,
    timestamp: Date.now(),
  };
  const newHistorial = [...state.historial, record];

  // Scoring
  if (penalties.length > 0) {
    // Redundant suggestion
    scoreEvents.push(...penalties);
  } else {
    // Valid suggestion — check cap
    const validSuggCount = countValidSuggestionsInHistory(state.historial, action.equipoId);
    if (validSuggCount < EVT_SUGGESTION_CAP) {
      scoreEvents.push({
        equipoId: action.equipoId,
        type: 'EVT_SUGGESTION',
        points: EVT_SUGGESTION_POINTS,
        turno,
      });
    }
  }

  if (refutador) {
    scoreEvents.push({
      equipoId: refutador,
      type: 'EVT_REFUTATION',
      points: EVT_REFUTATION_POINTS,
      turno,
    });
  }

  // Apply point deltas
  const pointsByEquipo = new Map<string, number>();
  for (const evt of scoreEvents) {
    pointsByEquipo.set(evt.equipoId, (pointsByEquipo.get(evt.equipoId) ?? 0) + evt.points);
  }
  const equiposUpdated = equiposWithTurno.map((e) => ({
    ...e,
    puntos: e.puntos + (pointsByEquipo.get(e.equipoId) ?? 0),
  }));

  return {
    state: {
      ...state,
      turnoActual: nextTurnoIndex(equiposUpdated, turno),
      equipos: equiposUpdated,
      historial: newHistorial,
    },
    scoreEvents,
    suggestionResult,
  };
}

function applyAccusation(state: GameState, action: AccusationAction): ApplyActionResult {
  const turno = state.turnoActual;
  const scoreEvents: ScoreEvent[] = [];

  const correcta =
    action.sospechoso === state.sobre.sospechoso &&
    action.arma === state.sobre.arma &&
    action.habitacion === state.sobre.habitacion;

  const result: AccusationResult = {
    correcta,
    ganador: correcta ? action.equipoId : null,
  };

  const record: ActionRecord = {
    turno,
    equipoId: action.equipoId,
    action,
    result,
    timestamp: Date.now(),
  };

  // Increment own turn counter for winner
  const equiposWithTurno = incrementTurnosJugados(state.equipos, action.equipoId);

  let equiposActualizados: EquipoState[];
  let nuevoEstado = state.estado;
  let ganadorId = state.ganadorId;

  if (correcta) {
    const winnerState = equiposWithTurno.find((e) => e.equipoId === action.equipoId)!;
    const T = winnerState.turnosJugados;
    const effBonus = calcEfficiencyBonus(T);

    // EVT_WIN
    scoreEvents.push({
      equipoId: action.equipoId,
      type: 'EVT_WIN',
      points: EVT_WIN_POINTS,
      turno,
    });
    // EVT_WIN_EFFICIENCY
    if (effBonus > 0) {
      scoreEvents.push({
        equipoId: action.equipoId,
        type: 'EVT_WIN_EFFICIENCY',
        points: effBonus,
        turno,
        meta: { T, T_min: 2, bonus: effBonus },
      });
    }
    // EVT_SURVIVE for all non-eliminated, non-winner teams
    for (const e of equiposWithTurno) {
      if (!e.eliminado && e.equipoId !== action.equipoId) {
        scoreEvents.push({
          equipoId: e.equipoId,
          type: 'EVT_SURVIVE',
          points: EVT_SURVIVE_POINTS,
          turno,
        });
      }
    }

    nuevoEstado = 'finalizada';
    ganadorId = action.equipoId;
  } else {
    // Wrong accusation
    scoreEvents.push({
      equipoId: action.equipoId,
      type: 'EVT_WRONG_ACCUSATION',
      points: EVT_WRONG_ACCUSATION_POINTS,
      turno,
    });
  }

  // Apply point deltas
  const pointsByEquipo = new Map<string, number>();
  for (const evt of scoreEvents) {
    pointsByEquipo.set(evt.equipoId, (pointsByEquipo.get(evt.equipoId) ?? 0) + evt.points);
  }
  equiposActualizados = equiposWithTurno.map((e) => {
    const delta = pointsByEquipo.get(e.equipoId) ?? 0;
    if (!correcta && e.equipoId === action.equipoId) {
      return { ...e, eliminado: true, puntos: e.puntos + delta };
    }
    return { ...e, puntos: e.puntos + delta };
  });

  const activeEquipos = equiposActualizados.filter((e) => !e.eliminado);

  if (!correcta && activeEquipos.length === 0) {
    nuevoEstado = 'finalizada';
  }

  const nextTurno =
    nuevoEstado === 'finalizada'
      ? state.turnoActual
      : nextTurnoIndex(equiposActualizados, turno);

  return {
    state: {
      ...state,
      estado: nuevoEstado,
      turnoActual: nextTurno,
      equipos: equiposActualizados,
      historial: [...state.historial, record],
      ganadorId,
    },
    scoreEvents,
    accusationResult: result,
  };
}

function applyPass(state: GameState, equipoId: string): ApplyActionResult {
  const turno = state.turnoActual;
  const scoreEvents: ScoreEvent[] = [
    {
      equipoId,
      type: 'EVT_PASS',
      points: EVT_PASS_POINTS,
      turno,
    },
  ];

  const equiposWithTurno = incrementTurnosJugados(state.equipos, equipoId);
  const equiposUpdated = equiposWithTurno.map((e) =>
    e.equipoId === equipoId ? { ...e, puntos: e.puntos + EVT_PASS_POINTS } : e,
  );

  const record: ActionRecord = {
    turno,
    equipoId,
    action: { type: 'pass', equipoId },
    result: null,
    timestamp: Date.now(),
  };

  return {
    state: {
      ...state,
      turnoActual: nextTurnoIndex(equiposUpdated, turno),
      equipos: equiposUpdated,
      historial: [...state.historial, record],
    },
    scoreEvents,
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
