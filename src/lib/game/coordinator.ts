/**
 * Game coordinator (F007) — orchestrates a full game turn:
 *
 * 1. Load game state from DB
 * 2. Determine whose turn it is
 * 3. Invoke the team agent (play_turn)
 * 4. Validate the AgentResponse
 * 5. Apply: persist suggestion or accusation
 * 6. Handle refutation sub-flow if needed (invoke refute agent)
 * 7. Mark turn as completed, advance to next team or finalize
 *
 * Pure orchestration — no HTTP. Called by the advance-turn route AND the auto-run loop.
 */

import { db } from '@/lib/db';
import {
  partidas,
  partidaEquipos,
  turnos,
  sugerencias,
  acusaciones,
  sobres,
  pases,
  scoreEvents,
  equipos,
  warningEliminaciones,
} from '@/lib/db/schema';
import { SOSPECHOSOS, ARMAS, HABITACIONES } from '@/types/domain';
import { eq, and, count, sql, inArray } from 'drizzle-orm';
import type { ScoreEventType } from '@/lib/game/types';
import {
  EVT_WIN_POINTS,
  EVT_SURVIVE_POINTS,
  EVT_SUGGESTION_POINTS,
  EVT_SUGGESTION_CAP,
  EVT_REFUTATION_POINTS,
  EVT_FALSE_CANNOT_REFUTE_POINTS,
  EVT_WRONG_ACCUSATION_POINTS,
  EVT_PASS_POINTS,
  EVT_INVALID_CARD_POINTS,
  EVT_REDUNDANT_SUGGESTION_POINTS,
  EVT_INVALID_FORMAT_POINTS,
  EVT_TIMEOUT_POINTS,
  EVT_COMM_ERROR_POINTS,
  EVT_WRONG_REFUTATION_POINTS,
  EVT_WARNING_POINTS,
  EVT_WARNING_ELIMINATION_POINTS,
  calcEfficiencyBonus,
} from '@/lib/game/engine';
import type { InferSelectModel } from 'drizzle-orm';
import { gameEventEmitter } from '@/lib/ws/GameEventEmitter';
import { notificationEmitter } from '@/lib/ws/NotificationEmitter';

/** Row type for partidaEquipos table */
type TeamRow = InferSelectModel<typeof partidaEquipos>;

// ---------------------------------------------------------------------------
// Score event helpers
// ---------------------------------------------------------------------------

interface ScoreEventInput {
  equipoId: string;
  type: ScoreEventType;
  points: number;
  turno: number;
  meta?: Record<string, unknown>;
}

/**
 * Persists score events to the score_events table and updates the running
 * `puntos` total in `partida_equipos` for each affected team.
 */
async function insertScoreEvents(
  gameId: string,
  events: ScoreEventInput[],
): Promise<void> {
  if (events.length === 0) return;

  await db.insert(scoreEvents).values(
    events.map((evt) => ({
      gameId,
      equipoId:  evt.equipoId,
      turno:     evt.turno,
      type:      evt.type,
      points:    evt.points,
      meta:      evt.meta ? JSON.stringify(evt.meta) : null,
      createdAt: new Date(),
    })),
  );

  // Accumulate point deltas per team and bulk-update
  const deltas = new Map<string, number>();
  for (const evt of events) {
    deltas.set(evt.equipoId, (deltas.get(evt.equipoId) ?? 0) + evt.points);
  }
  await Promise.all(
    [...deltas.entries()].map(([equipoId, delta]) =>
      db
        .update(partidaEquipos)
        .set({ puntos: sql`${partidaEquipos.puntos} + ${delta}` })
        .where(
          and(
            eq(partidaEquipos.partidaId, gameId),
            eq(partidaEquipos.equipoId, equipoId),
          ),
        ),
    ),
  );
}

/** Returns the number of EVT_SUGGESTION events already awarded to a team in a game. */
async function countSuggestionEvents(gameId: string, equipoId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(scoreEvents)
    .where(
      and(
        eq(scoreEvents.gameId, gameId),
        eq(scoreEvents.equipoId, equipoId),
        eq(scoreEvents.type, 'EVT_SUGGESTION'),
      ),
    );
  return total;
}

/**
 * Counts own turns played by a team in a game (completed turns in turnos table).
 * Used to compute EVT_WIN_EFFICIENCY.
 */
async function countOwnTurns(gameId: string, teamId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(turnos)
    .where(
      and(
        eq(turnos.partidaId, gameId),
        eq(turnos.equipoId, teamId),
      ),
    );
  return total;
}

/** Calculates EVT_WIN_EFFICIENCY bonus based on own turns played. */
// Note: imported from engine.ts — local definition removed to avoid duplication.

// ---------------------------------------------------------------------------
// G006 — Warning system helpers
// ---------------------------------------------------------------------------

/**
 * Score event types that count as a protocol infraction and generate a warning.
 * Priority order: EVT_INVALID_FORMAT > EVT_INVALID_CARD > EVT_WRONG_REFUTATION > EVT_TIMEOUT
 */
const WARNING_THRESHOLD = 3;

/**
 * Increments the warning counter for a team, emits the WebSocket warning event,
 * and — when the threshold (3) is reached — performs elimination + card redistribution.
 *
 * Must be called BEFORE _advanceTurnoIndex so elimination is reflected in the
 * active-team count when the next turn index is computed.
 *
 * Returns `{ newWarnings, eliminated, gameOver }`.
 */
async function processWarning(
  gameId: string,
  equipoId: string,
  turnoActual: number,
  reason: ScoreEventType,
): Promise<{ newWarnings: number; eliminated: boolean; gameOver: boolean }> {
  // 1. Atomically increment warnings
  await db
    .update(partidaEquipos)
    .set({ warnings: sql`${partidaEquipos.warnings} + 1` })
    .where(
      and(
        eq(partidaEquipos.partidaId, gameId),
        eq(partidaEquipos.equipoId, equipoId),
      ),
    );

  const row = await db
    .select({ warnings: partidaEquipos.warnings })
    .from(partidaEquipos)
    .where(
      and(
        eq(partidaEquipos.partidaId, gameId),
        eq(partidaEquipos.equipoId, equipoId),
      ),
    )
    .get();
  const newWarnings = row?.warnings ?? 0;

  // 2. Insert informational EVT_WARNING score event (0 pts, for traceability)
  await insertScoreEvents(gameId, [
    {
      equipoId,
      type: 'EVT_WARNING',
      points: EVT_WARNING_POINTS,
      turno: turnoActual,
      meta: { reason, count: newWarnings },
    },
  ]);

  // 3. Emit warning:issued WebSocket event
  gameEventEmitter.emitTurnMicroEvent({
    type: 'warning:issued',
    gameId,
    equipoId,
    warnings: newWarnings,
    reason,
    ts: Date.now(),
  });

  if (newWarnings < WARNING_THRESHOLD) {
    return { newWarnings, eliminated: false, gameOver: false };
  }

  // 4. Threshold reached — load current state and compute redistribution
  const allTeams = await db
    .select()
    .from(partidaEquipos)
    .where(eq(partidaEquipos.partidaId, gameId))
    .all();

  const eliminatedRow = allTeams.find((t) => t.equipoId === equipoId)!;
  const cartasEliminado: import('@/types/domain').Carta[] = JSON.parse(
    eliminatedRow.cartas as string,
  );

  // Active teams sorted by order; redistribute starting from the one after eliminated
  const allActive = allTeams
    .filter((t) => !t.eliminado)
    .sort((a, b) => a.orden - b.orden);
  const elimIdx = allActive.findIndex((t) => t.equipoId === equipoId);
  const equiposActivos = [
    ...allActive.slice(elimIdx + 1),
    ...allActive.slice(0, elimIdx),
  ];

  const redistribucion: { equipoId: string; cartas: import('@/types/domain').Carta[] }[] =
    equiposActivos.map((e) => ({ equipoId: e.equipoId, cartas: [] }));

  cartasEliminado.forEach((carta, i) => {
    if (redistribucion.length > 0) {
      redistribucion[i % redistribucion.length].cartas.push(carta);
    }
  });

  // 5. Persist card redistribution
  for (const recv of redistribucion) {
    if (recv.cartas.length === 0) continue;
    const recvRow = allTeams.find((t) => t.equipoId === recv.equipoId)!;
    const currentCartas: import('@/types/domain').Carta[] = JSON.parse(recvRow.cartas as string);
    await db
      .update(partidaEquipos)
      .set({ cartas: JSON.stringify([...currentCartas, ...recv.cartas]) })
      .where(
        and(
          eq(partidaEquipos.partidaId, gameId),
          eq(partidaEquipos.equipoId, recv.equipoId),
        ),
      );
  }

  // 6. Mark team as eliminated by warnings
  await db
    .update(partidaEquipos)
    .set({ eliminado: true, eliminacionRazon: 'warnings', cartas: '[]' })
    .where(
      and(
        eq(partidaEquipos.partidaId, gameId),
        eq(partidaEquipos.equipoId, equipoId),
      ),
    );

  // 7. Persist to warning_eliminaciones log
  await db.insert(warningEliminaciones).values({
    id: uuidv4(),
    gameId,
    equipoEliminadoId: equipoId,
    turno: turnoActual,
    cartasCount: cartasEliminado.length,
    redistribucionJson: JSON.stringify(redistribucion),
    creadoEn: new Date(),
  });

  // 8. Insert EVT_WARNING_ELIMINATION score event
  await insertScoreEvents(gameId, [
    {
      equipoId,
      type: 'EVT_WARNING_ELIMINATION',
      points: EVT_WARNING_ELIMINATION_POINTS,
      turno: turnoActual,
      meta: { cartasRepartidas: cartasEliminado.length },
    },
  ]);

  // 9. Emit WebSocket event
  const equiposConCartasNuevas = redistribucion
    .filter((r) => r.cartas.length > 0)
    .map((r) => r.equipoId);
  gameEventEmitter.emitTurnMicroEvent({
    type: 'warning:agent_eliminated',
    gameId,
    equipoId,
    equiposConCartasNuevas,
    ts: Date.now(),
  });

  // 10. Check if game is now over (no active teams remain)
  const remaining = allTeams.filter(
    (t) => !t.eliminado && t.equipoId !== equipoId,
  );
  const gameOver = remaining.length === 0;
  if (gameOver) {
    await db
      .update(partidas)
      .set({ estado: 'finalizada', finishedAt: new Date() })
      .where(eq(partidas.id, gameId));
  }

  return { newWarnings, eliminated: true, gameOver };
}



/**
 * Sanitizes a raw spectatorComment from the agent:
 * - Trims whitespace; returns undefined for empty strings.
 * - Truncates to 160 characters (appends "…" if truncated).
 * - Collapses newlines to a single space so the comment stays one line.
 */
function sanitizeSpectatorComment(raw: string | undefined, maxLen = 160): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  const truncated = trimmed.length > maxLen ? trimmed.slice(0, maxLen - 1) + '…' : trimmed;
  return truncated.replace(/[\r\n]+/g, ' ');
}
import { v4 as uuidv4 } from 'uuid';
import { invokeAgent } from '@/lib/api/agent';
import { AgentResponseError } from '@/lib/api/local-agent';
import { logInvocacionValidity } from '@/lib/utils/log';
import type { Carta } from '@/types/domain';

type ForcedPassOrigin = 'timeout' | 'invalid_format' | 'comm_error';

function errorMessageIncludes(err: Error, pattern: RegExp): boolean {
  if (pattern.test(err.message)) return true;

  const cause =
    typeof err === 'object' &&
    err !== null &&
    'cause' in err &&
    typeof (err as { cause?: unknown }).cause === 'object' &&
    (err as { cause?: unknown }).cause !== null
      ? (err as { cause: { message?: unknown; code?: unknown } }).cause
      : null;

  if (cause?.message && typeof cause.message === 'string' && pattern.test(cause.message)) {
    return true;
  }
  if (cause?.code && typeof cause.code === 'string' && pattern.test(cause.code)) {
    return true;
  }

  return false;
}

function classifyAgentFailure(err: unknown): ForcedPassOrigin {
  if (
    err instanceof Error &&
    (
      err.name === 'AbortError' ||
      err.name === 'TimeoutError' ||
      errorMessageIncludes(err, /timeout|timed out/i)
    )
  ) {
    return 'timeout';
  }

  if (
    err instanceof Error &&
    errorMessageIncludes(
      err,
      /fetch|failed to fetch|network|socket|econn|ecoff|eai_again|enotfound|unreachable|500|502|503|504|service unavailable|bad gateway|gateway timeout|internal server error/i,
    )
  ) {
    return 'comm_error';
  }

  return 'invalid_format';
}

function forcedPassAction(origin: ForcedPassOrigin): 'timeout' | 'formato_invalido' | 'error_comunicacion' {
  if (origin === 'timeout') return 'timeout';
  if (origin === 'comm_error') return 'error_comunicacion';
  return 'formato_invalido';
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class CoordinatorError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'CoordinatorError';
  }
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface AdvanceTurnResult {
  /** True if the game just reached "finalizada" state. */
  gameOver: boolean;
  /** Free-text reason for debugging / response bodies. */
  reason: string;
  /** The team whose turn was processed. */
  teamId: string;
  /** The action type that was applied: 'suggestion' | 'accusation' | 'pass'. */
  actionType: 'suggestion' | 'accusation' | 'pass';
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Advance the game by one full turn.
 * Throws `CoordinatorError` with an HTTP-suitable status code on failure.
 */
export async function advanceTurn(gameId: string): Promise<AdvanceTurnResult> {
  // ── 1. Load and validate game state ──────────────────────────────────────
  const partida = await db
    .select()
    .from(partidas)
    .where(eq(partidas.id, gameId))
    .get();

  if (!partida) {
    throw new CoordinatorError(404, 'Partida no encontrada');
  }
  if (partida.estado !== 'en_curso') {
    throw new CoordinatorError(400, `La partida no está en curso (estado: ${partida.estado})`);
  }

  // ── 2. Get teams and determine current team ───────────────────────────────
  const allTeams = await db
    .select()
    .from(partidaEquipos)
    .where(eq(partidaEquipos.partidaId, gameId))
    .all();
  allTeams.sort((a, b) => a.orden - b.orden);

  // Load human-readable team names for micro-event messages (F016)
  const equipoRows = await db
    .select({ id: equipos.id, nombre: equipos.nombre, agentId: equipos.agentId, agentBackend: equipos.agentBackend, appId: equipos.appId, mattinApiKey: equipos.mattinApiKey })
    .from(equipos)
    .where(inArray(equipos.id, allTeams.map((t) => t.equipoId)))
    .all();
  const teamNombres = new Map(equipoRows.map((e) => [e.id, e.nombre]));
  /** Per-team MattinAI credentials keyed by equipoId */
  const teamCredentials = new Map(
    equipoRows.map((e) => [e.id, { agentId: e.agentId, agentBackend: e.agentBackend as 'mattin' | 'local', appId: e.appId ?? undefined, mattinApiKey: e.mattinApiKey ?? undefined }]),
  );

  const activeTeams = allTeams.filter((t) => !t.eliminado);
  if (activeTeams.length === 0) {
    await db
      .update(partidas)
      .set({ estado: 'finalizada', finishedAt: new Date() })
      .where(eq(partidas.id, gameId));
    throw new CoordinatorError(409, 'No quedan equipos activos; partida finalizada');
  }

  const currentTeam = activeTeams[partida.turnoActual % activeTeams.length];

  // ── 3. Ensure an active turn record exists for the current team ───────────
  let turno = await db
    .select()
    .from(turnos)
    .where(
      and(
        eq(turnos.partidaId, gameId),
        eq(turnos.equipoId, currentTeam.equipoId),
        eq(turnos.estado, 'en_curso'),
      ),
    )
    .get();

  if (!turno) {
    // Create the turn record on demand (e.g. first call after game start)
    const [{ total }] = await db
      .select({ total: count() })
      .from(turnos)
      .where(eq(turnos.partidaId, gameId));

    const newId = uuidv4();
    await db.insert(turnos).values({
      id: newId,
      partidaId: gameId,
      equipoId: currentTeam.equipoId,
      numero: total + 1,
      estado: 'en_curso',
      startedAt: new Date(),
    });
    turno = await db.select().from(turnos).where(eq(turnos.id, newId)).get()!;
  }

  // ── 4. Invoke the agent for the current team ──────────────────────────────
  let agentAction!: import('@/types/api').AgentAction;
  let agentRawSpectatorComment: string | undefined;
  let agentRawReasoning: string | undefined;
  let invocacionId!: string;
  let passOrigen: ForcedPassOrigin | null = null;
  let agentDurationMs = 0;

  // F016: emit turn:agent_invoked before calling the agent
  gameEventEmitter.emitTurnMicroEvent({
    type: 'turn:agent_invoked',
    gameId,
    turnoId: turno.id,
    turnoNumero: turno.numero,
    equipoId: currentTeam.equipoId,
    equipoNombre: teamNombres.get(currentTeam.equipoId) ?? currentTeam.equipoId,
    ts: Date.now(),
  });
  const tsAgentInvoke = Date.now();

  try {
    const { response: agentResponse, invocacionId: invId } = await invokeAgent(
      { type: 'play_turn', gameId, teamId: currentTeam.equipoId },
      {
        turnoId: turno.id,
        mattinAgentId: teamCredentials.get(currentTeam.equipoId)?.agentId,
        mattinAppId: teamCredentials.get(currentTeam.equipoId)?.appId,
        mattinApiKey: teamCredentials.get(currentTeam.equipoId)?.mattinApiKey,
        agentBackend: teamCredentials.get(currentTeam.equipoId)?.agentBackend,
      },
    );
    agentAction = agentResponse.action;
    agentRawSpectatorComment = agentResponse.spectatorComment;
    agentRawReasoning = agentResponse.reasoning || undefined;
    invocacionId = invId;
  } catch (err) {
    // Determine pass origin from error type. ALL errors become a pass with warning.
    passOrigen = classifyAgentFailure(err);

    // Keep agent raw reasoning for debugging
    agentRawReasoning = err instanceof Error ? err.message : String(err);

    // F016: emit turn:agent_responded for forced-pass cases
    agentDurationMs = Date.now() - tsAgentInvoke;
    gameEventEmitter.emitTurnMicroEvent({
      type: 'turn:agent_responded',
      gameId,
      turnoId: turno.id,
      turnoNumero: turno.numero,
      equipoId: currentTeam.equipoId,
      equipoNombre: teamNombres.get(currentTeam.equipoId) ?? currentTeam.equipoId,
      accion: forcedPassAction(passOrigen),
      durationMs: agentDurationMs,
      ts: Date.now(),
    });

    // G006: Insert forced penalty score event BEFORE advancing turn so
    // processWarning can eliminate the team and use the updated active count.
    const forcedEvtType: ScoreEventType =
      passOrigen === 'timeout'
        ? 'EVT_TIMEOUT'
        : passOrigen === 'comm_error'
          ? 'EVT_COMM_ERROR'
          : 'EVT_INVALID_FORMAT';
    const forcedEvtPoints =
      passOrigen === 'timeout'
        ? EVT_TIMEOUT_POINTS
        : passOrigen === 'comm_error'
          ? EVT_COMM_ERROR_POINTS
          : EVT_INVALID_FORMAT_POINTS;

    // Persist pass record and mark turn completed (no turn advance yet)
    await db.insert(pases).values({
      id: uuidv4(),
      turnoId: turno.id,
      partidaId: gameId,
      equipoId: currentTeam.equipoId,
      origen: passOrigen!,
      createdAt: new Date(),
    });
    await db
      .update(turnos)
      .set({ estado: 'completado', finishedAt: new Date(), agentDurationMs })
      .where(eq(turnos.id, turno.id));

    await insertScoreEvents(gameId, [
      {
        equipoId: currentTeam.equipoId,
        type: forcedEvtType,
        points: forcedEvtPoints,
        turno: turno.numero,
      },
    ]);
    gameEventEmitter.emitTurnCompleted(gameId, {
      type: 'score_event',
      gameId,
      payload: {
        equipoId: currentTeam.equipoId,
        scoreEventType: forcedEvtType,
        points: forcedEvtPoints,
      },
    });

    // G006: process warning — may eliminate the team before we advance the turn
    const warningResult = await processWarning(
      gameId,
      currentTeam.equipoId,
      partida.turnoActual,
      forcedEvtType,
    );

    if (warningResult.gameOver) {
      gameEventEmitter.emitTurnCompleted(gameId, {
        type: 'turn_completed',
        gameId,
        payload: {
          turnoNumero: turno.numero,
          equipoId: currentTeam.equipoId,
          resultadoTipo: 'pase',
          nextEquipoId: null,
        },
      });
      gameEventEmitter.emitTurnCompleted(gameId, {
        type: 'status_changed',
        gameId,
        payload: { nuevoEstado: 'finalizada' },
      });
      notificationEmitter.emitGlobal({ type: 'notification:game_finished', gameId, nombre: partida.nombre, ganadorId: null, ganadorNombre: null, ts: Date.now() });
      notificationEmitter.emitGlobal({ type: 'notification:ranking_updated', ts: Date.now() });
      return {
        gameOver: true,
        reason: 'warning_elimination',
        teamId: currentTeam.equipoId,
        actionType: 'pass',
      };
    }

    // Advance turn (using updated team list if eliminated, or original if not)
    const teamsAfterWarning = await db
      .select()
      .from(partidaEquipos)
      .where(eq(partidaEquipos.partidaId, gameId))
      .all();
    const activeAfterWarning = teamsAfterWarning.filter((t) => !t.eliminado);

    const { maxTurnsReached, nextEquipoId: nextTeamId } = await _advanceTurnoIndex(
      gameId,
      partida.turnoActual,
      activeAfterWarning.length,
      teamsAfterWarning,
      partida.maxTurnos,
    );

    gameEventEmitter.emitTurnCompleted(gameId, {
      type: 'turn_completed',
      gameId,
      payload: {
        turnoNumero: turno.numero,
        equipoId: currentTeam.equipoId,
        resultadoTipo: 'pase',
        nextEquipoId: maxTurnsReached ? null : nextTeamId,
      },
    });

    if (maxTurnsReached) {
      gameEventEmitter.emitTurnCompleted(gameId, {
        type: 'status_changed',
        gameId,
        payload: { nuevoEstado: 'finalizada' },
      });
      notificationEmitter.emitGlobal({ type: 'notification:game_finished', gameId, nombre: partida.nombre, ganadorId: null, ganadorNombre: null, ts: Date.now() });
      notificationEmitter.emitGlobal({ type: 'notification:ranking_updated', ts: Date.now() });
    }

    return {
      gameOver: maxTurnsReached,
      reason: maxTurnsReached ? 'max_turns_reached' : (`${passOrigen}_pass` as string),
      teamId: currentTeam.equipoId,
      actionType: 'pass',
    };
  }

  const action = agentAction;

  // F016: emit turn:agent_responded for the successful agent response
  agentDurationMs = Date.now() - tsAgentInvoke;
  const agentSpectatorComment = sanitizeSpectatorComment(
    agentRawSpectatorComment,
    action.type === 'accusation' ? 400 : 160,
  );
  // Truncate reasoning to 2000 chars to keep DB rows reasonable
  const agentReasoning = agentRawReasoning ? agentRawReasoning.slice(0, 2000) : undefined;
  gameEventEmitter.emitTurnMicroEvent({
    type: 'turn:agent_responded',
    gameId,
    turnoId: turno.id,
    turnoNumero: turno.numero,
    equipoId: currentTeam.equipoId,
    equipoNombre: teamNombres.get(currentTeam.equipoId) ?? currentTeam.equipoId,
    accion:
      action.type === 'suggestion' ? 'sugerencia' :
      action.type === 'accusation' ? 'acusacion' : 'pasar',
    sugerencia:
      action.type === 'suggestion'
        ? { sospechoso: action.suspect, arma: action.weapon, habitacion: action.room }
        : undefined,
    durationMs: agentDurationMs,
    spectatorComment: agentSpectatorComment,
    ts: Date.now(),
  });
  const isValidAction =
    action.type === 'suggestion' ||
    action.type === 'accusation' ||
    action.type === 'pass';
  logInvocacionValidity(
    invocacionId,
    gameId,
    currentTeam.equipoId,
    turno.id,
    isValidAction,
    isValidAction ? null : `Tipo de acción inválido para play_turn: "${action.type}"`,
  );

  if (!isValidAction) {
    throw new CoordinatorError(
      422,
      `Tipo de acción inválido para play_turn: "${action.type}". ` +
        'Se esperaba "suggestion", "accusation" o "pass".',
    );
  }

  // ── 5. Apply the action ───────────────────────────────────────────────────
  if (action.type === 'suggestion') {
    const { maxTurnsReached, nextEquipoId: nextTeamId } = await handleSuggestion({
      gameId,
      teamId: currentTeam.equipoId,
      turnoId: turno.id,
      turnoNumero: turno.numero,
      suspect: action.suspect,
      weapon: action.weapon,
      room: action.room,
      allTeams,
      turnoActual: partida.turnoActual,
      activeTeamCount: activeTeams.length,
      maxTurnos: partida.maxTurnos,
      agentDurationMs,
      teamNombres,
      teamCredentials,
      agentSpectatorComment,
      agentReasoning,
    });

    gameEventEmitter.emitTurnCompleted(gameId, {
      type: 'turn_completed',
      gameId,
      payload: {
        turnoNumero: turno.numero,
        equipoId: currentTeam.equipoId,
        resultadoTipo: 'sugerencia',
        nextEquipoId: maxTurnsReached ? null : nextTeamId,
      },
    });

    if (maxTurnsReached) {
      gameEventEmitter.emitTurnCompleted(gameId, {
        type: 'status_changed',
        gameId,
        payload: { nuevoEstado: 'finalizada' },
      });
      notificationEmitter.emitGlobal({ type: 'notification:game_finished', gameId, nombre: partida.nombre, ganadorId: null, ganadorNombre: null, ts: Date.now() });
      notificationEmitter.emitGlobal({ type: 'notification:ranking_updated', ts: Date.now() });
    }

    return {
      gameOver: maxTurnsReached,
      reason: maxTurnsReached ? 'max_turns_reached' : 'suggestion_applied',
      teamId: currentTeam.equipoId,
      actionType: 'suggestion',
    };
  } else if (action.type === 'accusation') {
    const { gameOver, nextEquipoId: nextTeamId } = await handleAccusation({
      gameId,
      teamId: currentTeam.equipoId,
      turnoId: turno.id,
      turnoNumero: turno.numero,
      suspect: action.suspect,
      weapon: action.weapon,
      room: action.room,
      turnoActual: partida.turnoActual,
      allTeams,
      maxTurnos: partida.maxTurnos,
      agentDurationMs,
      agentSpectatorComment,
      agentReasoning,
    });

    gameEventEmitter.emitTurnCompleted(gameId, {
      type: 'turn_completed',
      gameId,
      payload: {
        turnoNumero: turno.numero,
        equipoId: currentTeam.equipoId,
        resultadoTipo: gameOver ? 'acusacion_correcta' : 'acusacion_incorrecta',
        nextEquipoId: gameOver ? null : nextTeamId,
      },
    });

    if (gameOver) {
      gameEventEmitter.emitTurnCompleted(gameId, {
        type: 'status_changed',
        gameId,
        payload: { nuevoEstado: 'finalizada' },
      });
      // F018: winner is the team that made the correct accusation
      notificationEmitter.emitGlobal({ type: 'notification:game_finished', gameId, nombre: partida.nombre, ganadorId: currentTeam.equipoId, ganadorNombre: teamNombres.get(currentTeam.equipoId) ?? null, ts: Date.now() });
      notificationEmitter.emitGlobal({ type: 'notification:ranking_updated', ts: Date.now() });
    }

    return {
      gameOver,
      reason: gameOver ? 'accusation_correct' : 'accusation_incorrect',
      teamId: currentTeam.equipoId,
      actionType: 'accusation',
    };
  } else {
    // action.type === 'pass' — pase voluntario del agente
    const { maxTurnsReached, nextEquipoId: nextTeamId } = await handlePass({
      gameId,
      teamId: currentTeam.equipoId,
      turnoId: turno.id,
      turnoNumero: turno.numero,
      turnoActual: partida.turnoActual,
      activeTeamCount: activeTeams.length,
      allTeams,
      maxTurnos: partida.maxTurnos,
      origen: 'voluntario',
      agentDurationMs,
      agentSpectatorComment,
      agentReasoning,
    });

    gameEventEmitter.emitTurnCompleted(gameId, {
      type: 'turn_completed',
      gameId,
      payload: {
        turnoNumero: turno.numero,
        equipoId: currentTeam.equipoId,
        resultadoTipo: 'pase',
        nextEquipoId: maxTurnsReached ? null : nextTeamId,
      },
    });

    if (maxTurnsReached) {
      gameEventEmitter.emitTurnCompleted(gameId, {
        type: 'status_changed',
        gameId,
        payload: { nuevoEstado: 'finalizada' },
      });
      notificationEmitter.emitGlobal({ type: 'notification:game_finished', gameId, nombre: partida.nombre, ganadorId: null, ganadorNombre: null, ts: Date.now() });
      notificationEmitter.emitGlobal({ type: 'notification:ranking_updated', ts: Date.now() });
    }

    return {
      gameOver: maxTurnsReached,
      reason: maxTurnsReached ? 'max_turns_reached' : 'pass_applied',
      teamId: currentTeam.equipoId,
      actionType: 'pass',
    };
  }
}

// ---------------------------------------------------------------------------
// Suggestion handler
// ---------------------------------------------------------------------------

interface SuggestionParams {
  gameId: string;
  teamId: string;
  turnoId: string;
  turnoNumero: number;
  suspect: string;
  weapon: string;
  room: string;
  allTeams: TeamRow[];
  turnoActual: number;
  activeTeamCount: number;
  maxTurnos: number | null;
  agentDurationMs: number;
  teamNombres: Map<string, string>;
  teamCredentials: Map<string, { agentId: string; agentBackend?: 'mattin' | 'local'; appId?: string; mattinApiKey?: string }>;
  /** G004: sanitized spectator comment from the active agent */
  agentSpectatorComment?: string;
  /** Agent LLM reasoning (truncated to 2000 chars) */
  agentReasoning?: string;
}

async function handleSuggestion(p: SuggestionParams): Promise<{ maxTurnsReached: boolean; nextEquipoId: string | null }> {
  const { gameId, teamId, turnoId, turnoNumero, suspect, weapon, room, allTeams, turnoActual, maxTurnos, agentDurationMs, teamNombres, teamCredentials, agentSpectatorComment, agentReasoning } = p;

  // ── Validate suggestion (invalid card + redundant checks) ─────────────
  const isInvalidCard =
    !SOSPECHOSOS.includes(suspect as typeof SOSPECHOSOS[number]) ||
    !ARMAS.includes(weapon as typeof ARMAS[number]) ||
    !HABITACIONES.includes(room as typeof HABITACIONES[number]);

  if (isInvalidCard) {
    // G006: Penalise — turn is consumed; no suggestion record, no refutation
    await insertScoreEvents(gameId, [
      { equipoId: teamId, type: 'EVT_INVALID_CARD', points: EVT_INVALID_CARD_POINTS, turno: turnoActual,
        meta: { sospechoso: suspect, arma: weapon, habitacion: room } },
    ]);
    gameEventEmitter.emitTurnCompleted(gameId, {
      type: 'score_event',
      gameId,
      payload: { equipoId: teamId, scoreEventType: 'EVT_INVALID_CARD', points: EVT_INVALID_CARD_POINTS },
    });
    await db
      .update(turnos)
      .set({ estado: 'completado', finishedAt: new Date(), agentDurationMs, agentSpectatorComment: agentSpectatorComment ?? null, agentReasoning: agentReasoning ?? null })
      .where(eq(turnos.id, turnoId));

    // G006: process warning before advancing so active count is correct
    const invalidCardWarning = await processWarning(gameId, teamId, turnoActual, 'EVT_INVALID_CARD');
    if (invalidCardWarning.gameOver) {
      return { maxTurnsReached: false, nextEquipoId: null };
    }

    // Reload teams after possible elimination
    const teamsAfterInvalidCard = await db
      .select()
      .from(partidaEquipos)
      .where(eq(partidaEquipos.partidaId, gameId))
      .all();
    const activeAfterInvalidCard = teamsAfterInvalidCard.filter((t) => !t.eliminado);
    return _advanceTurnoIndex(gameId, turnoActual, activeAfterInvalidCard.length, teamsAfterInvalidCard, maxTurnos);
  }

  // Check for redundant suggestion (same combo already suggested by this team)
  const priorSuggestions = await db
    .select()
    .from(sugerencias)
    .where(and(eq(sugerencias.partidaId, gameId), eq(sugerencias.equipoId, teamId)))
    .all();
  const isRedundant = priorSuggestions.some(
    (s) => s.sospechoso === suspect && s.arma === weapon && s.habitacion === room,
  );

  // ── Determine refutador ────────────────────────────────────────────────
  const suggesterIdx = allTeams.findIndex((t) => t.equipoId === teamId);
  let refutadaPor: string | null = null;

  for (let i = 1; i < allTeams.length; i++) {
    const candidate = allTeams[(suggesterIdx + i) % allTeams.length];
    if (candidate.eliminado) continue;
    const cartas: Carta[] = JSON.parse(candidate.cartas as string);
    const hasCard = cartas.some((c) => c === suspect || c === weapon || c === room);
    if (hasCard) {
      refutadaPor = candidate.equipoId;
      break;
    }
  }

  // Persist suggestion — cartaMostrada is null until refute agent responds
  const suggestionId = uuidv4();
  await db.insert(sugerencias).values({
    id: suggestionId,
    turnoId,
    partidaId: gameId,
    equipoId: teamId,
    sospechoso: suspect,
    arma: weapon,
    habitacion: room,
    refutadaPor,
    cartaMostrada: null,
    createdAt: new Date(),
  });

  // ── Scoring for suggestion ─────────────────────────────────────────────
  const suggestionScoreEvents: ScoreEventInput[] = [];
  if (isRedundant) {
    suggestionScoreEvents.push({
      equipoId: teamId,
      type: 'EVT_REDUNDANT_SUGGESTION',
      points: EVT_REDUNDANT_SUGGESTION_POINTS,
      turno: turnoActual,
      meta: { sospechoso: suspect, arma: weapon, habitacion: room },
    });
  } else {
    const alreadyEarned = await countSuggestionEvents(gameId, teamId);
    if (alreadyEarned < EVT_SUGGESTION_CAP) {
      suggestionScoreEvents.push({
        equipoId: teamId,
        type: 'EVT_SUGGESTION',
        points: EVT_SUGGESTION_POINTS,
        turno: turnoActual,
      });
    }
  }
  // Note: EVT_REFUTATION / EVT_FALSE_CANNOT_REFUTE are scored after the refutation
  // sub-flow below, conditional on whether the agent actually shows a valid card.
  await insertScoreEvents(gameId, suggestionScoreEvents);
  // Emit WebSocket for any penalty events
  for (const evt of suggestionScoreEvents) {
    if (evt.points < 0) {
      gameEventEmitter.emitTurnCompleted(gameId, {
        type: 'score_event',
        gameId,
        payload: { equipoId: evt.equipoId, scoreEventType: evt.type, points: evt.points },
      });
    }
  }

  // ── Refutation sub-flow ────────────────────────────────────────────────
  let refutacionDurationMs: number | null = null;
  // G004: spectator comment from the refutador (captured inside the if block)
  let refutadorSpectatorComment: string | undefined;
  if (refutadaPor) {
    // F016: notify that refutation is being requested
    const refutadorNombre = teamNombres.get(refutadaPor) ?? refutadaPor;
    gameEventEmitter.emitTurnMicroEvent({
      type: 'turn:refutation_requested',
      gameId,
      turnoId,
      turnoNumero,
      equipoSugeridor: teamNombres.get(teamId) ?? teamId,
      refutadoresIds: [refutadaPor],
      ts: Date.now(),
    });
    const tsRef = Date.now();

    try {
      const { response: refuteResponse, invocacionId: refuteInvocacionId } = await invokeAgent(
        { type: 'refute', gameId, teamId: refutadaPor, suspect, weapon, room },
        {
          turnoId,
          mattinAgentId: teamCredentials.get(refutadaPor)?.agentId,
          mattinAppId: teamCredentials.get(refutadaPor)?.appId,
          mattinApiKey: teamCredentials.get(refutadaPor)?.mattinApiKey,
          agentBackend: teamCredentials.get(refutadaPor)?.agentBackend,
        },
      );
      refutacionDurationMs = Date.now() - tsRef;
      refutadorSpectatorComment = sanitizeSpectatorComment(refuteResponse.spectatorComment);

      const refAction = refuteResponse.action;
      const isValidRefute = refAction.type === 'show_card' || refAction.type === 'cannot_refute';
      logInvocacionValidity(
        refuteInvocacionId,
        gameId,
        refutadaPor,
        turnoId,
        isValidRefute,
        isValidRefute ? null : `Tipo de acción inválido para refute: "${refAction.type}"`,
      );

      let cartaMostradaValue: string | undefined;
      // G006: true = agent said show_card with an invalid card → EVT_WRONG_REFUTATION
      let wrongRefutation = false;
      if (refAction.type === 'show_card') {
        // Validate the card belongs to the refutador and matches the suggestion
        const refTeam = allTeams.find((t) => t.equipoId === refutadaPor)!;
        const cartas: Carta[] = JSON.parse(refTeam.cartas as string);
        const isValid =
          (cartas as string[]).includes(refAction.card) &&
          (refAction.card === suspect || refAction.card === weapon || refAction.card === room);

        if (isValid) {
          cartaMostradaValue = refAction.card;
          await db
            .update(sugerencias)
            .set({ cartaMostrada: refAction.card })
            .where(eq(sugerencias.id, suggestionId));
        } else {
          // G006: invalid show_card → EVT_WRONG_REFUTATION (protocol violation + warning)
          wrongRefutation = true;
        }
      }
      // cannot_refute (or unknown action): cartaMostrada remains null, wrongRefutation stays false

      // F016: emit result of refutation (cartaMostrada visible to spectators)
      gameEventEmitter.emitTurnMicroEvent({
        type: 'turn:refutation_received',
        gameId,
        turnoId,
        turnoNumero,
        equipoId: refutadaPor,
        equipoNombre: refutadorNombre,
        resultado: cartaMostradaValue ? 'refutada' : 'no_puede_refutar',
        cartaMostrada: cartaMostradaValue,
        durationMs: refutacionDurationMs,
        spectatorComment: refutadorSpectatorComment,
        ts: Date.now(),
      });

      // ── Score the refutation outcome ──────────────────────────────────────────────────
      // EVT_REFUTATION:          correctly showed a matching card.
      // EVT_WRONG_REFUTATION:    showed a card not in hand or not in suggestion (G006 warning).
      // EVT_FALSE_CANNOT_REFUTE: claimed cannot_refute when coordinator knows they have a card.
      const refutationEvt: ScoreEventInput = cartaMostradaValue !== undefined
        ? { equipoId: refutadaPor, type: 'EVT_REFUTATION',            points: EVT_REFUTATION_POINTS,           turno: turnoActual }
        : wrongRefutation
          ? { equipoId: refutadaPor, type: 'EVT_WRONG_REFUTATION',   points: EVT_WRONG_REFUTATION_POINTS,    turno: turnoActual }
          : { equipoId: refutadaPor, type: 'EVT_FALSE_CANNOT_REFUTE', points: EVT_FALSE_CANNOT_REFUTE_POINTS, turno: turnoActual };
      await insertScoreEvents(gameId, [refutationEvt]);
      gameEventEmitter.emitTurnCompleted(gameId, {
        type: 'score_event',
        gameId,
        payload: {
          equipoId: refutadaPor,
          scoreEventType: refutationEvt.type,
          points: refutationEvt.points,
        },
      });

      // G006: EVT_WRONG_REFUTATION generates a warning for the refutador
      if (wrongRefutation) {
        await processWarning(gameId, refutadaPor, turnoActual, 'EVT_WRONG_REFUTATION');
        // Note: even if the refutador is eliminated here, we do NOT abort the suggestion
        // turn — the suggestor's turn completes normally. The refutador's elimination
        // is recorded; the turn advance at end of handleSuggestion uses the updated teams.
      }
    } catch (err) {
      // Refute agent unreachable or returned an unrecoverable error.
      // Treat as cannot_refute (no card shown) and issue a comm/timeout/format penalty
      // against the refutador. The suggestor's turn continues and advances normally.
      refutacionDurationMs = Date.now() - tsRef;

      const refutePassOrigin = classifyAgentFailure(err);

      // F016: emit refutation_received with no card (unreachable agent ≡ cannot_refute)
      gameEventEmitter.emitTurnMicroEvent({
        type: 'turn:refutation_received',
        gameId,
        turnoId,
        turnoNumero,
        equipoId: refutadaPor,
        equipoNombre: refutadorNombre,
        resultado: 'no_puede_refutar',
        cartaMostrada: undefined,
        durationMs: refutacionDurationMs,
        ts: Date.now(),
      });

      // Issue penalty score event against the refutador
      const refuteErrEvtType: ScoreEventType =
        refutePassOrigin === 'timeout'
          ? 'EVT_TIMEOUT'
          : refutePassOrigin === 'comm_error'
            ? 'EVT_COMM_ERROR'
            : 'EVT_INVALID_FORMAT';
      const refuteErrEvtPoints =
        refutePassOrigin === 'timeout'
          ? EVT_TIMEOUT_POINTS
          : refutePassOrigin === 'comm_error'
            ? EVT_COMM_ERROR_POINTS
            : EVT_INVALID_FORMAT_POINTS;

      await insertScoreEvents(gameId, [
        { equipoId: refutadaPor, type: refuteErrEvtType, points: refuteErrEvtPoints, turno: turnoActual },
      ]);
      gameEventEmitter.emitTurnCompleted(gameId, {
        type: 'score_event',
        gameId,
        payload: { equipoId: refutadaPor, scoreEventType: refuteErrEvtType, points: refuteErrEvtPoints },
      });

      // Warning + potential elimination of the refutador (same pattern as play_turn errors).
      // The suggestor's turn continues normally; _advanceTurnoIndex runs below.
      await processWarning(gameId, refutadaPor, turnoActual, refuteErrEvtType);
    }
  }

  // ── Mark turn as completed and advance ──────────────────────────────
  await db
    .update(turnos)
    .set({
      estado: 'completado',
      finishedAt: new Date(),
      agentDurationMs,
      refutacionDurationMs,
      agentSpectatorComment: agentSpectatorComment ?? null,
      refutadorSpectatorComment: refutadaPor ? (refutadorSpectatorComment ?? null) : null,
      agentReasoning: agentReasoning ?? null,
    })
    .where(eq(turnos.id, turnoId));

  // G006: reload teams in case refutador was eliminated by warning
  const teamsAfterSuggestion = await db
    .select()
    .from(partidaEquipos)
    .where(eq(partidaEquipos.partidaId, gameId))
    .all();
  const activeAfterSuggestion = teamsAfterSuggestion.filter((t) => !t.eliminado);

  if (activeAfterSuggestion.length === 0) {
    return { maxTurnsReached: false, nextEquipoId: null };
  }

  return _advanceTurnoIndex(gameId, turnoActual, activeAfterSuggestion.length, teamsAfterSuggestion, maxTurnos);
}

// ---------------------------------------------------------------------------
// Accusation handler
// ---------------------------------------------------------------------------

interface AccusationParams {
  gameId: string;
  teamId: string;
  turnoId: string;
  turnoNumero: number;
  suspect: string;
  weapon: string;
  room: string;
  turnoActual: number;
  allTeams: TeamRow[];
  maxTurnos: number | null;
  agentDurationMs: number;
  /** G004: sanitized spectator comment from the active agent */
  agentSpectatorComment?: string;
  /** Agent LLM reasoning (truncated to 2000 chars) */
  agentReasoning?: string;
}

/**
 * Returns gameOver flag and the next team's equipoId (null when the game ends).
 */
async function handleAccusation(p: AccusationParams): Promise<{ gameOver: boolean; nextEquipoId: string | null }> {
  const { gameId, teamId, turnoId, suspect, weapon, room, turnoActual, allTeams, maxTurnos, agentDurationMs, agentSpectatorComment, agentReasoning } = p;

  // Load the envelope
  const sobre = await db.select().from(sobres).where(eq(sobres.partidaId, gameId)).get();
  if (!sobre) throw new CoordinatorError(500, 'Sobre secreto no encontrado');

  const correcta =
    suspect === sobre.sospechoso && weapon === sobre.arma && room === sobre.habitacion;

  // Persist accusation
  await db.insert(acusaciones).values({
    id: uuidv4(),
    turnoId,
    partidaId: gameId,
    equipoId: teamId,
    sospechoso: suspect,
    arma: weapon,
    habitacion: room,
    correcta,
    createdAt: new Date(),
  });

  // Mark turn as completed
  await db
    .update(turnos)
    .set({ estado: 'completado', finishedAt: new Date(), agentDurationMs, agentSpectatorComment: agentSpectatorComment ?? null, agentReasoning: agentReasoning ?? null })
    .where(eq(turnos.id, turnoId));

  if (correcta) {
    // Winner: close game, award EVT_WIN + EVT_WIN_EFFICIENCY + EVT_SURVIVE
    await db
      .update(partidas)
      .set({ estado: 'finalizada', finishedAt: new Date() })
      .where(eq(partidas.id, gameId));

    const T = await countOwnTurns(gameId, teamId);
    const effBonus = calcEfficiencyBonus(T);
    const winEvents: ScoreEventInput[] = [
      { equipoId: teamId, type: 'EVT_WIN', points: EVT_WIN_POINTS, turno: turnoActual, meta: { T } },
    ];
    if (effBonus > 0) {
      winEvents.push({
        equipoId: teamId,
        type: 'EVT_WIN_EFFICIENCY',
        points: effBonus,
        turno: turnoActual,
        meta: { T, T_min: 2, bonus: effBonus },
      });
    }
    // EVT_SURVIVE for all non-eliminated, non-winner teams
    for (const t of allTeams) {
      if (!t.eliminado && t.equipoId !== teamId) {
        winEvents.push({
          equipoId: t.equipoId,
          type: 'EVT_SURVIVE',
          points: EVT_SURVIVE_POINTS,
          turno: turnoActual,
        });
      }
    }
    await insertScoreEvents(gameId, winEvents);
    return { gameOver: true, nextEquipoId: null };
  }

  // Incorrect accusation: penalise with EVT_WRONG_ACCUSATION then eliminate
  await insertScoreEvents(gameId, [
    { equipoId: teamId, type: 'EVT_WRONG_ACCUSATION', points: EVT_WRONG_ACCUSATION_POINTS, turno: turnoActual },
  ]);
  gameEventEmitter.emitTurnCompleted(gameId, {
    type: 'score_event',
    gameId,
    payload: { equipoId: teamId, scoreEventType: 'EVT_WRONG_ACCUSATION', points: EVT_WRONG_ACCUSATION_POINTS },
  });
  // Eliminate the team (G006: record eliminacionRazon)
  await db
    .update(partidaEquipos)
    .set({ eliminado: true, eliminacionRazon: 'acusacion_incorrecta' })
    .where(
      and(
        eq(partidaEquipos.partidaId, gameId),
        eq(partidaEquipos.equipoId, teamId),
      ),
    );

  // Re-fetch to check if all remaining teams are eliminated
  const updatedTeams = await db
    .select()
    .from(partidaEquipos)
    .where(eq(partidaEquipos.partidaId, gameId))
    .all();
  const remaining = updatedTeams.filter((t) => !t.eliminado);

  if (remaining.length === 0) {
    await db
      .update(partidas)
      .set({ estado: 'finalizada', finishedAt: new Date() })
      .where(eq(partidas.id, gameId));
    return { gameOver: true, nextEquipoId: null };
  }

  // Game continues: advance turn (may finalize if maxTurnos reached)
  const activeAfter = updatedTeams.filter((t) => !t.eliminado);
  const { maxTurnsReached, nextEquipoId } = await _advanceTurnoIndex(gameId, turnoActual, activeAfter.length, updatedTeams, maxTurnos);
  return { gameOver: maxTurnsReached, nextEquipoId };
}

// ---------------------------------------------------------------------------
// Pass handler
// ---------------------------------------------------------------------------

interface PassParams {
  gameId: string;
  teamId: string;
  turnoId: string;
  turnoNumero: number;
  turnoActual: number;
  activeTeamCount: number;
  allTeams: TeamRow[];
  maxTurnos: number | null;
  origen: 'voluntario' | 'timeout' | 'invalid_format' | 'comm_error';
  agentDurationMs: number;
  /** G004: sanitized spectator comment from the active agent (undefined for forced passes) */
  agentSpectatorComment?: string;
  /** Agent LLM reasoning (undefined for forced/error passes) */
  agentReasoning?: string;
}

/**
 * Persists a pass record, optionally applies EVT_PASS penalty (−5 for voluntario),
 * marks the turn as completed, and advances the turn index.
 * Returns true if maxTurnos was reached (game ended).
 */
async function handlePass(p: PassParams): Promise<{ maxTurnsReached: boolean; nextEquipoId: string | null }> {
  const { gameId, teamId, turnoId, turnoActual, activeTeamCount, allTeams, maxTurnos, origen, agentDurationMs, agentSpectatorComment, agentReasoning } = p;

  // Persist pass in `pases` table
  await db.insert(pases).values({
    id: uuidv4(),
    turnoId,
    partidaId: gameId,
    equipoId: teamId,
    origen,
    createdAt: new Date(),
  });

  // Apply EVT_PASS penalty (−5) only for voluntary passes.
  // Forced passes (timeout / invalid_format) are scored in the caller before handlePass.
  if (origen === 'voluntario') {
    await insertScoreEvents(gameId, [
      { equipoId: teamId, type: 'EVT_PASS', points: EVT_PASS_POINTS, turno: turnoActual },
    ]);
  }

  // Mark turn as completed
  await db
    .update(turnos)
    .set({ estado: 'completado', finishedAt: new Date(), agentDurationMs, agentSpectatorComment: agentSpectatorComment ?? null, agentReasoning: agentReasoning ?? null })
    .where(eq(turnos.id, turnoId));

  return _advanceTurnoIndex(gameId, turnoActual, activeTeamCount, allTeams, maxTurnos);
}

// ---------------------------------------------------------------------------
// Helper: advance turnoActual + create next turn record
// ---------------------------------------------------------------------------

async function _advanceTurnoIndex(
  gameId: string,
  turnoActual: number,
  activeCount: number,
  teamsSnapshot: TeamRow[],
  maxTurnos: number | null,
): Promise<{ maxTurnsReached: boolean; nextEquipoId: string | null }> {
  const newTurnoActual = (turnoActual + 1) % activeCount;

  await db
    .update(partidas)
    .set({ turnoActual: newTurnoActual })
    .where(eq(partidas.id, gameId));

  const [{ total }] = await db
    .select({ total: count() })
    .from(turnos)
    .where(eq(turnos.partidaId, gameId));

  // Check if the max-turns limit has been reached
  if (maxTurnos !== null && total >= maxTurnos) {
    await db
      .update(partidas)
      .set({ estado: 'finalizada', finishedAt: new Date() })
      .where(eq(partidas.id, gameId));
    return { maxTurnsReached: true, nextEquipoId: null };
  }

  // Sort snapshot by orden, filter active; create the next team's turn record
  const sorted = teamsSnapshot
    .filter((t) => !t.eliminado)
    .sort((a, b) => a.orden - b.orden);
  const nextTeam = sorted[newTurnoActual % sorted.length];

  await db.insert(turnos).values({
    id: uuidv4(),
    partidaId: gameId,
    equipoId: nextTeam.equipoId,
    numero: total + 1,
    estado: 'en_curso',
    startedAt: new Date(),
  });

  return { maxTurnsReached: false, nextEquipoId: nextTeam.equipoId };
}
