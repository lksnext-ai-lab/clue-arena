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
} from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

/** Row type for partidaEquipos table */
type TeamRow = InferSelectModel<typeof partidaEquipos>;
import { v4 as uuidv4 } from 'uuid';
import { invokeAgent } from '@/lib/api/agent';
import type { Carta } from '@/types/domain';

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
  /** The action type that was applied: 'suggestion' | 'accusation'. */
  actionType: 'suggestion' | 'accusation';
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
  const agentResponse = await invokeAgent({
    type: 'play_turn',
    gameId,
    teamId: currentTeam.equipoId,
  });

  const { action } = agentResponse;

  if (action.type !== 'suggestion' && action.type !== 'accusation') {
    throw new CoordinatorError(
      422,
      `Tipo de acción inválido para play_turn: "${action.type}". ` +
        'Se esperaba "suggestion" o "accusation".',
    );
  }

  // ── 5. Apply the action ───────────────────────────────────────────────────
  if (action.type === 'suggestion') {
    await handleSuggestion({
      gameId,
      teamId: currentTeam.equipoId,
      turnoId: turno.id,
      suspect: action.suspect,
      weapon: action.weapon,
      room: action.room,
      allTeams,
      turnoActual: partida.turnoActual,
      activeTeamCount: activeTeams.length,
    });

    return {
      gameOver: false,
      reason: 'suggestion_applied',
      teamId: currentTeam.equipoId,
      actionType: 'suggestion',
    };
  } else {
    const gameOver = await handleAccusation({
      gameId,
      teamId: currentTeam.equipoId,
      turnoId: turno.id,
      suspect: action.suspect,
      weapon: action.weapon,
      room: action.room,
      turnoActual: partida.turnoActual,
      allTeams,
    });

    return {
      gameOver,
      reason: gameOver ? 'accusation_correct' : 'accusation_incorrect',
      teamId: currentTeam.equipoId,
      actionType: 'accusation',
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
  suspect: string;
  weapon: string;
  room: string;
  allTeams: TeamRow[];
  turnoActual: number;
  activeTeamCount: number;
}

async function handleSuggestion(p: SuggestionParams): Promise<void> {
  const { gameId, teamId, turnoId, suspect, weapon, room, allTeams, turnoActual, activeTeamCount } = p;

  // Determine refutador (first team after suggester in rotation with a matching card)
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

  // ── Refutation sub-flow ────────────────────────────────────────────────
  if (refutadaPor) {
    const refuteResponse = await invokeAgent({
      type: 'refute',
      gameId,
      teamId: refutadaPor,
      suspect,
      weapon,
      room,
    });

    const refAction = refuteResponse.action;

    if (refAction.type === 'show_card') {
      // Validate the card belongs to the refutador and matches the suggestion
      const refTeam = allTeams.find((t) => t.equipoId === refutadaPor)!;
      const cartas: Carta[] = JSON.parse(refTeam.cartas as string);
      const isValid =
        (cartas as string[]).includes(refAction.card) &&
        (refAction.card === suspect || refAction.card === weapon || refAction.card === room);

      if (isValid) {
        await db
          .update(sugerencias)
          .set({ cartaMostrada: refAction.card })
          .where(eq(sugerencias.id, suggestionId));
      }
      // If invalid card claimed: treat as cannot_refute; cartaMostrada stays null
    }
    // cannot_refute: cartaMostrada remains null
  }

  // ── Mark turn as completed and advance ────────────────────────────────
  await db
    .update(turnos)
    .set({ estado: 'completado', finishedAt: new Date() })
    .where(eq(turnos.id, turnoId));

  await _advanceTurnoIndex(gameId, turnoActual, activeTeamCount, allTeams);
}

// ---------------------------------------------------------------------------
// Accusation handler
// ---------------------------------------------------------------------------

interface AccusationParams {
  gameId: string;
  teamId: string;
  turnoId: string;
  suspect: string;
  weapon: string;
  room: string;
  turnoActual: number;
  allTeams: TeamRow[];
}

/**
 * Returns true if the accusation ended the game (correct or all eliminated).
 */
async function handleAccusation(p: AccusationParams): Promise<boolean> {
  const { gameId, teamId, turnoId, suspect, weapon, room, turnoActual, allTeams } = p;

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
    .set({ estado: 'completado', finishedAt: new Date() })
    .where(eq(turnos.id, turnoId));

  if (correcta) {
    // Winner: close game, award points
    await db
      .update(partidas)
      .set({ estado: 'finalizada', finishedAt: new Date() })
      .where(eq(partidas.id, gameId));
    await db
      .update(partidaEquipos)
      .set({ puntos: 100 })
      .where(
        and(
          eq(partidaEquipos.partidaId, gameId),
          eq(partidaEquipos.equipoId, teamId),
        ),
      );
    return true;
  }

  // Incorrect: eliminate the team
  await db
    .update(partidaEquipos)
    .set({ eliminado: true })
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
    return true;
  }

  // Game continues: advance turn
  const activeAfter = updatedTeams.filter((t) => !t.eliminado);
  await _advanceTurnoIndex(gameId, turnoActual, activeAfter.length, updatedTeams);
  return false;
}

// ---------------------------------------------------------------------------
// Helper: advance turnoActual + create next turn record
// ---------------------------------------------------------------------------

async function _advanceTurnoIndex(
  gameId: string,
  turnoActual: number,
  activeCount: number,
  teamsSnapshot: TeamRow[],
): Promise<void> {
  const newTurnoActual = (turnoActual + 1) % activeCount;

  await db
    .update(partidas)
    .set({ turnoActual: newTurnoActual })
    .where(eq(partidas.id, gameId));

  // Sort snapshot by orden, filter active
  const sorted = teamsSnapshot
    .filter((t) => !t.eliminado)
    .sort((a, b) => a.orden - b.orden);
  const nextTeam = sorted[newTurnoActual % sorted.length];

  const [{ total }] = await db
    .select({ total: count() })
    .from(turnos)
    .where(eq(turnos.partidaId, gameId));

  await db.insert(turnos).values({
    id: uuidv4(),
    partidaId: gameId,
    equipoId: nextTeam.equipoId,
    numero: total + 1,
    estado: 'en_curso',
    startedAt: new Date(),
  });
}
