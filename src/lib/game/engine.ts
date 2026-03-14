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
    eliminacionRazon: null,
    warnings: 0,
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
    maxTurnos: null, // engine has no default limit
    sobre,
    equipos: equipoStates,
    historial: [],
    ganadorId: null,
    seed: resolvedSeed,
  };
}

// --- Scoring constants ---
export const EVT_WIN_POINTS = 1_000;
export const EVT_SURVIVE_POINTS = 200;
export const EVT_SUGGESTION_POINTS = 10;
export const EVT_SUGGESTION_CAP = 5;
export const EVT_REFUTATION_POINTS = 5;        // half of EVT_SUGGESTION_POINTS
export const EVT_WRONG_ACCUSATION_POINTS = -150;
export const EVT_PASS_POINTS = -5;
export const EVT_INVALID_CARD_POINTS = -30;
export const EVT_REDUNDANT_SUGGESTION_POINTS = -20;
export const EVT_FALSE_CANNOT_REFUTE_POINTS = -20;  // claimed cannot_refute but had a matching card
export const EVT_INVALID_FORMAT_POINTS = -25;  // coordinator-level, not engine action
export const EVT_TIMEOUT_POINTS = -20;         // coordinator-level, not engine action
// G006 — warnings system
export const EVT_WRONG_REFUTATION_POINTS = -30; // coordinator-level: refutador mostró invalid card
export const EVT_COMM_ERROR_POINTS = -20;      // communication error (agent invocation failed)
export const EVT_WARNING_POINTS = 0;            // informational event (0 pts)
export const EVT_WARNING_ELIMINATION_POINTS = -50; // penalty upon elimination by warnings

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
        points: EVT_INVALID_CARD_POINTS,
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
        points: EVT_REDUNDANT_SUGGESTION_POINTS,
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

  // warning_elimination is not a player action — skip turn validity check
  if (action.type === 'warning_elimination') {
    return applyWarningElimination(state, action.equipoId);
  }

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

// --- G006: Warning elimination ---

/**
 * Eliminates a team that has accumulated 3 warnings and redistributes its
 * cards among remaining active teams via round-robin.
 *
 * Pure function — no I/O. Deterministic given the GameState.
 */
export function applyWarningElimination(
  state: GameState,
  equipoId: string,
): ApplyActionResult {
  const equipo = state.equipos.find((e) => e.equipoId === equipoId);
  if (!equipo || equipo.eliminado) {
    throw new Error(
      `applyWarningElimination: equipo ${equipoId} no encontrado o ya eliminado`,
    );
  }

  const cartasEliminado = [...equipo.cartas];
  const turno = state.turnoActual;

  // Active teams sorted by orden; start after the eliminated team
  const allActive = state.equipos
    .filter((e) => !e.eliminado)
    .sort((a, b) => a.orden - b.orden);
  const elimIdx = allActive.findIndex((e) => e.equipoId === equipoId);
  const equiposActivos = [
    ...allActive.slice(elimIdx + 1),
    ...allActive.slice(0, elimIdx),
  ];

  // Round-robin redistribution
  const redistribucion: { equipoId: string; cartas: Carta[] }[] =
    equiposActivos.map((e) => ({ equipoId: e.equipoId, cartas: [] }));

  cartasEliminado.forEach((carta, i) => {
    if (redistribucion.length > 0) {
      redistribucion[i % redistribucion.length].cartas.push(carta);
    }
  });

  // Build updated equipo list
  const newEquipos = state.equipos.map((e) => {
    if (e.equipoId === equipoId) {
      return {
        ...e,
        eliminado: true,
        eliminacionRazon: 'warnings' as const,
        cartas: [],
      };
    }
    const recv = redistribucion.find((r) => r.equipoId === e.equipoId);
    return recv && recv.cartas.length > 0
      ? { ...e, cartas: [...e.cartas, ...recv.cartas] }
      : e;
  });

  const activeAfter = newEquipos.filter((e) => !e.eliminado);
  const nuevoEstado: GameState['estado'] =
    activeAfter.length === 0 ? 'finalizada' : state.estado;

  return {
    state: {
      ...state,
      estado: nuevoEstado,
      equipos: newEquipos,
      historial: [
        ...state.historial,
        {
          turno,
          equipoId,
          action: { type: 'warning_elimination', equipoId },
          result: null,
          timestamp: Date.now(),
        },
      ],
    },
    scoreEvents: [
      {
        equipoId,
        type: 'EVT_WARNING_ELIMINATION' as const,
        points: EVT_WARNING_ELIMINATION_POINTS,
        turno,
        meta: { cartasRepartidas: cartasEliminado.length },
      },
    ],
    warningEliminationResult: { equipoId, redistribucion },
  };
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
  const equiposActualizados = equiposWithTurno.map((e) => {
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
    maxTurnos: state.maxTurnos,
    equipos: state.equipos.map((e) => ({
      equipoId: e.equipoId,
      orden: e.orden,
      cartas: e.equipoId === requestingTeamId ? e.cartas : [],
      numCartas: e.cartas.length, // Public: always exposed
      esPropio: e.equipoId === requestingTeamId,
      eliminado: e.eliminado,
      eliminadoPorWarnings: e.eliminacionRazon === 'warnings', // G006
      warnings: e.warnings,                                    // G006
      puntos: e.puntos,
      turnosJugados: e.turnosJugados, // Public: always exposed
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
          // Only reveal cartaMostradaPorMi to the team that refuted
          cartaMostradaPorMi:
            res?.refutadaPor === requestingTeamId ? res?.cartaMostrada ?? null : undefined,
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
    sospechosos: SOSPECHOSOS,
    armas: ARMAS,
    habitaciones: HABITACIONES,
  };
}
