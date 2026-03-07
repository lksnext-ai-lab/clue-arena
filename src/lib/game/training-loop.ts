/**
 * Training game loop (F015).
 *
 * Orchestrates a full training game: initialises a GameState, runs turns
 * for the real team (with full agent trace capture) and bot teams (local
 * Genkit agent, no trace), persists each turn, and finishes the game.
 *
 * Pure orchestration — called only from the POST /api/training/games handler.
 * No HTTP. No queue. Synchronous within the Route Handler lifecycle.
 *
 * Bot IDs use the format `bot-{n}` (1-based) so they don't collide with
 * real equipo UUIDs.
 */

import { db } from '@/lib/db';
import {
  partidasEntrenamiento,
  turnosEntrenamiento,
} from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  initGame,
  applyAction,
  isGameOver,
  getGameStateView,
} from '@/lib/game/engine';
import type { GameState, GameAction } from '@/lib/game/types';
import type { AgentResponse } from '@/types/api';
import { SOSPECHOSOS, ARMAS, HABITACIONES } from '@/types/domain';
import type { Sospechoso, Arma, Habitacion } from '@/types/domain';
import {
  invokeAgentWithTrace,
  TrainingAgentError,
  type InvokeAgentWithTraceResult,
} from '@/lib/api/training-agent';
import { ai, DEFAULT_MODEL } from '@/lib/ai/genkit';
import { PLAY_TURN_SYSTEM_PROMPT } from '@/lib/ai/prompts/play-turn';
import { REFUTE_SYSTEM_PROMPT } from '@/lib/ai/prompts/refute';
import { z } from 'zod';
import { getAgentMemory, saveAgentMemory } from '@/lib/ai/agent-memory';
import { notificationEmitter } from '@/lib/ws/NotificationEmitter';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_TRAINING_TURNS = 100;

// ---------------------------------------------------------------------------
// Zod schemas for bot agent response
// ---------------------------------------------------------------------------

const BotPlayTurnSchema = z.object({
  action: z.union([
    z.object({ type: z.literal('suggestion'), suspect: z.string(), weapon: z.string(), room: z.string() }),
    z.object({ type: z.literal('accusation'), suspect: z.string(), weapon: z.string(), room: z.string() }),
    z.object({ type: z.literal('pass') }),
  ]),
  memory: z.record(z.unknown()).optional(),
});

const BotRefuteSchema = z.union([
  z.object({ action: z.object({ type: z.literal('show_card'), card: z.string() }) }),
  z.object({ action: z.object({ type: z.literal('cannot_refute') }) }),
]);

// ---------------------------------------------------------------------------
// Options + Result
// ---------------------------------------------------------------------------

export interface TrainingLoopOptions {
  /** ID in partidas_entrenamiento */
  gameId:    string;
  /** Real team's equipo ID */
  equipoId:  string;
  numBots:   number;
  /** Maximum turns before the game is aborted (default: MAX_TRAINING_TURNS) */
  maxTurnos?: number;
  seed?:     string;
}

export interface TrainingLoopResult {
  estado:      'finalizada' | 'abortada';
  ganadorId:   string | null;
  numTurnos:   number;
  puntosSimulados: number;
  motivoAbort?: string;
}

// ---------------------------------------------------------------------------
// Bot ID helpers
// ---------------------------------------------------------------------------

function botId(index: number): string {
  return `bot-${index + 1}`;
}

// ---------------------------------------------------------------------------
// Bot agent invocation (no trace, local Genkit)
// ---------------------------------------------------------------------------

async function invokeBotAgent(
  type: 'play_turn' | 'refute',
  gameId: string,
  teamId: string,
  gameStateJson: string,
  refuteContext?: { suspect: string; weapon: string; room: string },
): Promise<AgentResponse> {
  const systemPrompt = type === 'play_turn' ? PLAY_TURN_SYSTEM_PROMPT : REFUTE_SYSTEM_PROMPT;
  const memoryJson = JSON.stringify(await getAgentMemory(gameId, teamId));

  const baseContext =
    `gameId="${gameId}" teamId="${teamId}"\n\n` +
    `## Estado actual de la partida\n${gameStateJson}\n\n` +
    `## Tu memoria de turnos anteriores\n${memoryJson}\n\n`;

  const userPrompt = type === 'play_turn'
    ? `${baseContext}Razona a partir del contexto y decide tu acción. Devuelve ÚNICAMENTE el JSON solicitado.`
    : `${baseContext}` +
      `Refuta la combinación: sospechoso="${refuteContext!.suspect}", ` +
      `arma="${refuteContext!.weapon}", ` +
      `habitación="${refuteContext!.room}".\n\nDevuelve ÚNICAMENTE el JSON solicitado.`;

  const llmResponse = await ai.generate({
    model: DEFAULT_MODEL,
    system: systemPrompt,
    prompt: userPrompt,
    output: { format: 'json' },
  });

  const schema = type === 'play_turn' ? BotPlayTurnSchema : BotRefuteSchema;
  const parsed = schema.safeParse(llmResponse.output);

  const reasoning = llmResponse.messages
    .filter((m) => m.role === 'model')
    .flatMap((m) => m.content)
    .filter((p) => p.text)
    .map((p) => p.text!)
    .join('\n');

  if (!parsed.success) {
    // Fallback: bot passes if it can't parse
    return { action: { type: 'pass' }, reasoning: 'parse_error', done: true };
  }

  // Persist memory if bot included one (play_turn)
  if (type === 'play_turn') {
    const rawOutput = llmResponse.output as Record<string, unknown> | null;
    const updatedMemory = rawOutput?.memory;
    if (updatedMemory && typeof updatedMemory === 'object') {
      await saveAgentMemory(gameId, teamId, updatedMemory as Record<string, unknown>);
    }
  }

  return { action: parsed.data.action as AgentResponse['action'], reasoning, done: true };
}

// ---------------------------------------------------------------------------
// Helper: parse AgentResponse action to GameAction
// ---------------------------------------------------------------------------

function toGameAction(
  agentResponse: AgentResponse,
  equipoId: string,
): GameAction | null {
  const { action } = agentResponse;
  if (action.type === 'suggestion') {
    if (
      !SOSPECHOSOS.includes(action.suspect as Sospechoso) ||
      !ARMAS.includes(action.weapon as Arma) ||
      !HABITACIONES.includes(action.room as Habitacion)
    ) {
      return { type: 'pass', equipoId }; // Invalid card → auto-pass
    }
    return {
      type: 'suggestion',
      equipoId,
      sospechoso: action.suspect as Sospechoso,
      arma: action.weapon as Arma,
      habitacion: action.room as Habitacion,
    };
  }
  if (action.type === 'accusation') {
    if (
      !SOSPECHOSOS.includes(action.suspect as Sospechoso) ||
      !ARMAS.includes(action.weapon as Arma) ||
      !HABITACIONES.includes(action.room as Habitacion)
    ) {
      return { type: 'pass', equipoId };
    }
    return {
      type: 'accusation',
      equipoId,
      sospechoso: action.suspect as Sospechoso,
      arma: action.weapon as Arma,
      habitacion: action.room as Habitacion,
    };
  }
  return { type: 'pass', equipoId };
}

// ---------------------------------------------------------------------------
// Helper: resolve refutation sub-flow in-engine
// ---------------------------------------------------------------------------

interface RefutationResult {
  refutadorId: string | null;
  card: string | null;
  /** Full trace when the real team was the one who refuted */
  realTeamRefuteResult?: InvokeAgentWithTraceResult;
  /** Reasoning text from a bot refutation (populated when a bot was the refutador) */
  botRefutacionRazonamiento?: string;
}

/**
 * Handles the refute request for a suggestion.
 * Iterates through teams in order trying to refute.
 * Returns the refutation card (and trace if the real team refuted).
 */
async function resolveRefutation(
  state: GameState,
  gameId: string,
  suggesterEquipoId: string,
  suspect: string,
  weapon: string,
  room: string,
  realEquipoId: string,
): Promise<RefutationResult> {
  const suggesterIdx = state.equipos.findIndex((e) => e.equipoId === suggesterEquipoId);
  const n = state.equipos.length;

  for (let i = 1; i < n; i++) {
    const candidate = state.equipos[(suggesterIdx + i) % n];
    if (candidate.eliminado) continue;

    const matchCards = candidate.cartas.filter(
      (c) => c === suspect || c === weapon || c === room,
    );
    if (matchCards.length === 0) continue;

    // Found refutador — ask them which card to show
    const isRealTeam = candidate.equipoId === realEquipoId;
    const gameStateJson = JSON.stringify(
      getGameStateView(state, candidate.equipoId),
    );

    let refuteResponse: AgentResponse;
    if (isRealTeam) {
      const result = await invokeAgentWithTrace({
        agentRequest: {
          type: 'refute',
          gameId,
          teamId: candidate.equipoId,
          suspect,
          weapon,
          room,
        },
        gameStateJson,
      });
      refuteResponse = result.agentResponse;

      // Validate card and return with full trace
      const shownCard =
        refuteResponse.action.type === 'show_card' &&
        matchCards.includes(refuteResponse.action.card as typeof matchCards[0])
          ? refuteResponse.action.card
          : matchCards[0];
      return {
        refutadorId: candidate.equipoId,
        card: shownCard,
        realTeamRefuteResult: result,
      };
    } else {
      refuteResponse = await invokeBotAgent(
        'refute',
        gameId,
        candidate.equipoId,
        gameStateJson,
        { suspect, weapon, room },
      );
    }

    // Validate the card shown
    if (
      refuteResponse.action.type === 'show_card' &&
      matchCards.includes(refuteResponse.action.card as typeof matchCards[0])
    ) {
      return {
        refutadorId: candidate.equipoId,
        card: refuteResponse.action.card,
        botRefutacionRazonamiento: refuteResponse.reasoning,
      };
    }
    // If invalid or cannot_refute despite having cards → use first matching card
    return {
      refutadorId: candidate.equipoId,
      card: matchCards[0],
      botRefutacionRazonamiento: refuteResponse.reasoning,
    };
  }

  return { refutadorId: null, card: null };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runTrainingGameLoop(
  options: TrainingLoopOptions,
): Promise<TrainingLoopResult> {
  const { gameId, equipoId, numBots } = options;
  const turnLimit = options.maxTurnos ?? MAX_TRAINING_TURNS;

  // Build team ID list: real team first, then bots
  const botIds = Array.from({ length: numBots }, (_, i) => botId(i));
  const allTeamIds = [equipoId, ...botIds];

  // Resolve seed
  const seedStr = options.seed ?? uuidv4();
  const seedNum = seedStr.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  // Initialise pure in-memory state
  let state = initGame(allTeamIds, seedNum);
  // Expose turn limit to agents via state view
  state = { ...state, gameId, estado: 'en_curso', maxTurnos: turnLimit };

  // Persist sobresJson immediately so the UI can show it from the first poll
  await db
    .update(partidasEntrenamiento)
    .set({ sobresJson: JSON.stringify(state.sobre) })
    .where(eq(partidasEntrenamiento.id, gameId));

  // F018: notify team that training has started
  notificationEmitter.emitTeam({
    type: 'notification:training_started',
    trainingGameId: gameId,
    equipoId,
    numBots,
    ts: Date.now(),
  });

  let totalTurns = 0;
  let abortReason: string | undefined;

  try {
    while (totalTurns < turnLimit) {
    if (isGameOver(state)) break;

    const activeEquipos = state.equipos.filter((e) => !e.eliminado);
    if (activeEquipos.length === 0) break;

    const currentEquipo = activeEquipos[state.turnoActual % activeEquipos.length];
    if (!currentEquipo) break;

    const currentTeamId = currentEquipo.equipoId;
    const isRealTeam = currentTeamId === equipoId;
    const gameStateJson = JSON.stringify(getGameStateView(state, currentTeamId));
    const turnId = uuidv4();
    const tsStart = Date.now();

    let agentResponse: AgentResponse | null = null;
    let traceJson: string | null = null;
    let memoriaInicialJson: string | null = null;
    let memoriaFinalJson: string | null = null;
    let durationMs = 0;

    if (isRealTeam) {
      // Real team turn — invoke with trace
      try {
        const result = await invokeAgentWithTrace({
          agentRequest: { type: 'play_turn', gameId, teamId: currentTeamId },
          gameStateJson,
        });
        agentResponse = result.agentResponse;
        traceJson = JSON.stringify(result.trace);
        memoriaInicialJson = JSON.stringify(result.memoriaInicial);
        memoriaFinalJson = JSON.stringify(result.memoriaFinal);
        durationMs = result.durationMs;
      } catch (err) {
        // Capture trace even on error, then auto-pass
        if (err instanceof TrainingAgentError) {
          traceJson = JSON.stringify(err.trace);
        }
        agentResponse = { action: { type: 'pass' }, reasoning: 'agent_error', done: true };
        durationMs = Date.now() - tsStart;
      }
    } else {
      // Bot turn — no trace
      try {
        agentResponse = await invokeBotAgent('play_turn', gameId, currentTeamId, gameStateJson);
        durationMs = Date.now() - tsStart;
      } catch {
        agentResponse = { action: { type: 'pass' }, reasoning: 'bot_error', done: true };
        durationMs = Date.now() - tsStart;
      }
    }

    // Handle suggestion refutation sub-flow before applying to engine
    let gameAction = toGameAction(agentResponse, currentTeamId);
    if (!gameAction) gameAction = { type: 'pass', equipoId: currentTeamId };

    // refutacionJson built here so it can be attached to the suggestion turn below
    let refutacionJsonStr: string | null = null;

    if (gameAction.type === 'suggestion') {
      const refutRes = await resolveRefutation(
        state,
        gameId,
        currentTeamId,
        gameAction.sospechoso,
        gameAction.arma,
        gameAction.habitacion,
        equipoId,
      );
      const { refutadorId, card, realTeamRefuteResult, botRefutacionRazonamiento } = refutRes;

      const applyResult = applyAction(state, gameAction);
      state = applyResult.state;

      // Patch the last historial entry with correct refutation card
      if (refutadorId && card && state.historial.length > 0) {
        const lastRecord = state.historial[state.historial.length - 1];
        if (lastRecord.result && 'refutadaPor' in lastRecord.result) {
          (lastRecord.result as { refutadaPor: string | null; cartaMostrada: string | null }).cartaMostrada = card;
        }
      }

      // Build refutation summary attached to this suggestion turn (all cases)
      refutacionJsonStr = JSON.stringify({
        refutadaPor:   refutadorId,
        cartaMostrada: card,
        razonamiento:
          refutadorId === null
            ? undefined
            : realTeamRefuteResult
            ? realTeamRefuteResult.agentResponse.reasoning
            : botRefutacionRazonamiento,
      });

      // Persist refutation sub-turn for the real team when they were the refutador
      // (another team made the suggestion that triggered it)
      if (realTeamRefuteResult && !isRealTeam) {
        const refuteTurnId = uuidv4();
        const refuteGameStateJson = JSON.stringify(getGameStateView(state, equipoId));
        await db.insert(turnosEntrenamiento).values({
          id:             refuteTurnId,
          partidaId:      gameId,
          equipoId:       equipoId,
          esBot:          false,
          numero:         totalTurns + 1,
          accion:         JSON.stringify(realTeamRefuteResult.agentResponse),
          gameStateView:  refuteGameStateJson,
          agentTrace:     JSON.stringify(realTeamRefuteResult.trace),
          memoriaInicial: JSON.stringify(realTeamRefuteResult.memoriaInicial),
          memoriaFinal:   JSON.stringify(realTeamRefuteResult.memoriaFinal),
          durationMs:     realTeamRefuteResult.durationMs,
          createdAt:      new Date(),
        });
      }
    } else {
      const applyResult = applyAction(state, gameAction);
      state = applyResult.state;
    }

    // Persist turn
    await db.insert(turnosEntrenamiento).values({
      id: turnId,
      partidaId: gameId,
      equipoId: currentTeamId,
      esBot: !isRealTeam,
      numero: totalTurns + 1,
      accion: agentResponse ? JSON.stringify(agentResponse) : null,
      gameStateView: isRealTeam ? gameStateJson : null,
      agentTrace: isRealTeam ? traceJson : null,
      memoriaInicial: isRealTeam ? memoriaInicialJson : null,
      memoriaFinal: isRealTeam ? memoriaFinalJson : null,
      refutacionJson: refutacionJsonStr,
      durationMs,
      createdAt: new Date(),
    });

    totalTurns++;
  }

  // Check abort condition
  if (!isGameOver(state) && totalTurns >= turnLimit) {
    abortReason = 'MAX_TURNS_EXCEEDED';
  }

  const finalEstado = abortReason ? 'abortada' : 'finalizada';
  const ganadorId = state.ganadorId;

  // Compute simulated score using engine scoring
  const realEquipoState = state.equipos.find((e) => e.equipoId === equipoId);
  const puntosSimulados = realEquipoState?.puntos ?? 0;

  // Build resultado JSON
  const resultado = {
    ganadorId,
    puntosSimulados,
    turnosJugados: realEquipoState?.turnosJugados ?? 0,
  };

  // Persist final state
  await db
    .update(partidasEntrenamiento)
    .set({
      estado: finalEstado,
      sobresJson: JSON.stringify(state.sobre),
      resultadoJson: JSON.stringify(resultado),
      motivoAbort: abortReason ?? null,
      finishedAt: new Date(),
    })
    .where(eq(partidasEntrenamiento.id, gameId));

  // F018: notify team that training has finished
  notificationEmitter.emitTeam({
    type: 'notification:training_finished',
    trainingGameId: gameId,
    equipoId,
    estado: finalEstado,
    ganadorId,
    numTurnos: totalTurns,
    puntosSimulados,
    motivoAbort: abortReason,
    ts: Date.now(),
  });

  return {
    estado: finalEstado,
    ganadorId,
    numTurnos: totalTurns,
    puntosSimulados,
    motivoAbort: abortReason,
  };
  } catch (err) {
    // F018: notify team of a catastrophic loop error (unhandled exception)
    notificationEmitter.emitTeam({
      type: 'notification:training_error',
      trainingGameId: gameId,
      equipoId,
      message: err instanceof Error ? err.message : 'Error desconocido',
      ts: Date.now(),
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helper: count active training games for a team
// ---------------------------------------------------------------------------

export async function countActiveTrainingGames(teamId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(partidasEntrenamiento)
    .where(
      and(
        eq(partidasEntrenamiento.equipoId, teamId),
        eq(partidasEntrenamiento.estado, 'en_curso'),
      ),
    );
  return total;
}

export async function countTotalTrainingGames(teamId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(partidasEntrenamiento)
    .where(eq(partidasEntrenamiento.equipoId, teamId));
  return total;
}

export async function getLastTrainingGameCreatedAt(teamId: string): Promise<Date | null> {
  const rows = await db
    .select({ createdAt: partidasEntrenamiento.createdAt })
    .from(partidasEntrenamiento)
    .where(eq(partidasEntrenamiento.equipoId, teamId))
    .orderBy(partidasEntrenamiento.createdAt)
    .limit(1)
    .all();
  const last = rows[rows.length - 1];
  return last?.createdAt ?? null;
}
