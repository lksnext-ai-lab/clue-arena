import { z } from 'zod';
import { db } from '@/lib/db';
import { partidas, partidaEquipos, turnos, sugerencias, acusaciones, pases, partidasEntrenamiento, turnosEntrenamiento } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getGameStateView, initGame, applyAction } from '@/lib/game/engine';
import type { GameState, ActionRecord, SuggestionResult, AccusationResult } from '@/lib/game/types';
import type { Sospechoso, Arma, Habitacion, Carta } from '@/types/domain';
import { SOSPECHOSOS, ARMAS, HABITACIONES } from '@/types/domain';

export const getGameStateTool = {
  schema: {
    game_id: z.string().describe('ID de la partida'),
    team_id: z.string().describe('ID del equipo solicitante'),
  },

  handler: async ({ game_id, team_id }: { game_id: string; team_id: string }) => {
    // ── Try tournament partida first ──────────────────────────────────────
    const partida = await db
      .select()
      .from(partidas)
      .where(eq(partidas.id, game_id))
      .get();

    // ── If not found, attempt training game fallback ──────────────────────
    if (!partida) {
      return getTrainingGameStateView(game_id, team_id);
    }

    const equipoRows = await db
      .select()
      .from(partidaEquipos)
      .where(eq(partidaEquipos.partidaId, game_id))
      .all();

    // Check team is part of the game
    const teamInGame = equipoRows.find((e) => e.equipoId === team_id);
    if (!teamInGame) throw new Error('El equipo no participa en esta partida');

    // ── Reconstruct historial from DB ──────────────────────────────────────
    const turnoRows = await db
      .select()
      .from(turnos)
      .where(eq(turnos.partidaId, game_id))
      .orderBy(asc(turnos.numero))
      .all();

    const [sugerenciaRows, acusacionRows, paseRows] = await Promise.all([
      db.select().from(sugerencias).where(eq(sugerencias.partidaId, game_id)).all(),
      db.select().from(acusaciones).where(eq(acusaciones.partidaId, game_id)).all(),
      db.select().from(pases).where(eq(pases.partidaId, game_id)).all(),
    ]);

    // Build O(1) lookup maps keyed by turnoId
    const sugerenciaByTurno = new Map(sugerenciaRows.map((s) => [s.turnoId, s]));
    const acusacionByTurno = new Map(acusacionRows.map((a) => [a.turnoId, a]));
    const paseByTurno = new Map(paseRows.map((p) => [p.turnoId, p]));

    const historial: ActionRecord[] = [];
    const turnosJugadosByEquipo = new Map<string, number>();

    for (const turno of turnoRows) {
      if (turno.estado !== 'completado') continue;

      const { equipoId, numero: turnoNum, id: turnoId } = turno;
      const ts = turno.finishedAt?.getTime() ?? turno.startedAt?.getTime() ?? 0;

      turnosJugadosByEquipo.set(equipoId, (turnosJugadosByEquipo.get(equipoId) ?? 0) + 1);

      const sug = sugerenciaByTurno.get(turnoId);
      if (sug) {
        const suggestionResult: SuggestionResult = {
          refutadaPor: sug.refutadaPor ?? null,
          cartaMostrada: (sug.cartaMostrada as Carta | null) ?? null,
        };
        historial.push({
          turno: turnoNum,
          equipoId,
          action: {
            type: 'suggestion',
            equipoId,
            sospechoso: sug.sospechoso as Sospechoso,
            arma: sug.arma as Arma,
            habitacion: sug.habitacion as Habitacion,
          },
          result: suggestionResult,
          timestamp: ts,
        });
        continue;
      }

      const acu = acusacionByTurno.get(turnoId);
      if (acu) {
        const accusationResult: AccusationResult = {
          correcta: acu.correcta,
          ganador: acu.correcta ? equipoId : null,
        };
        historial.push({
          turno: turnoNum,
          equipoId,
          action: {
            type: 'accusation',
            equipoId,
            sospechoso: acu.sospechoso as Sospechoso,
            arma: acu.arma as Arma,
            habitacion: acu.habitacion as Habitacion,
          },
          result: accusationResult,
          timestamp: ts,
        });
        continue;
      }

      if (paseByTurno.has(turnoId)) {
        historial.push({
          turno: turnoNum,
          equipoId,
          action: { type: 'pass', equipoId },
          result: null,
          timestamp: ts,
        });
      }
    }

    const currentTurnoNumero =
      turnoRows.find((turno) => turno.estado === 'en_curso')?.numero ??
      turnoRows.at(-1)?.numero ??
      0;

    // ── Build complete GameState ───────────────────────────────────────────
    const state: GameState = {
      gameId: game_id,
      estado: partida.estado as GameState['estado'],
      turnoActual: currentTurnoNumero,
      maxTurnos: partida.maxTurnos,
      sobre: { sospechoso: '' as Sospechoso, arma: '' as Arma, habitacion: '' as Habitacion }, // secret — never exposed
      equipos: equipoRows.map((e) => ({
        equipoId: e.equipoId,
        orden: e.orden,
        cartas: JSON.parse(e.cartas as string) as Carta[],
        eliminado: e.eliminado,
        eliminacionRazon: (e.eliminacionRazon as 'acusacion_incorrecta' | 'warnings' | null) ?? null,
        warnings: e.warnings ?? 0,
        puntos: e.puntos,
        turnosJugados: turnosJugadosByEquipo.get(e.equipoId) ?? 0,
      })),
      historial,
      ganadorId: null,
      seed: 0,
    };

    const view = getGameStateView(state, team_id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(view) }] };
  },
};

// ---------------------------------------------------------------------------
// Training game fallback — reconstruct GameStateView from partidas_entrenamiento
// ---------------------------------------------------------------------------

async function getTrainingGameStateView(
  game_id: string,
  team_id: string,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const trainingGame = await db
    .select()
    .from(partidasEntrenamiento)
    .where(eq(partidasEntrenamiento.id, game_id))
    .get();

  if (!trainingGame) throw new Error(`Partida ${game_id} no encontrada`);

  // Fetch all turns ordered by numero to replay state
  const trainingTurns = await db
    .select()
    .from(turnosEntrenamiento)
    .where(eq(turnosEntrenamiento.partidaId, game_id))
    .orderBy(asc(turnosEntrenamiento.numero))
    .all();

  // The last persisted turn for the requesting team gives us its current gameStateView
  // directly (more efficient than a full replay). We fall back to replaying only if
  // no turn exists yet (first turn of the game).
  const teamTurns = trainingTurns.filter((t) => t.equipoId === team_id && t.gameStateView);
  if (teamTurns.length > 0) {
    const lastView = teamTurns[teamTurns.length - 1].gameStateView as string;
    return { content: [{ type: 'text' as const, text: lastView }] };
  }

  // First-turn fallback: reconstruct initial state from the seed and return the view.
  // The over (sobre) in the live engine is never visible to agents — same as production.
  const seedStr = trainingGame.seed ?? game_id;
  const seedNum = seedStr.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  // Derive full team list from turns (real team + bots).
  // When no turns have been played yet, reconstruct from stored metadata:
  // the real team is trainingGame.equipoId, bots follow the `bot-N` (1-based) pattern
  // used by training-loop.ts so the seed distribution matches exactly.
  let teamIds: string[];
  if (trainingTurns.length > 0) {
    teamIds = [...new Set(trainingTurns.map((t) => t.equipoId))];
  } else {
    const botIds = Array.from({ length: trainingGame.numBots }, (_, i) => `bot-${i + 1}`);
    teamIds = [trainingGame.equipoId, ...botIds];
  }

  // Ensure requesting team is in the list
  if (!teamIds.includes(team_id)) {
    throw new Error('El equipo no participa en esta partida de entrenamiento');
  }

  let state = initGame(teamIds, seedNum);
  state = { ...state, gameId: game_id, estado: 'en_curso', maxTurnos: trainingGame.maxTurnos };

  // Replay completed turns from persisted accion records
  for (const turn of trainingTurns) {
    if (!turn.accion) continue;
    const agentResponse = JSON.parse(turn.accion as string) as { action: { type: string; suspect?: string; weapon?: string; room?: string; card?: string } };
    const a = agentResponse.action;
    if (a.type === 'suggestion' &&
        SOSPECHOSOS.includes(a.suspect as Sospechoso) &&
        ARMAS.includes(a.weapon as Arma) &&
        HABITACIONES.includes(a.room as Habitacion)) {
      const result = applyAction(state, {
        type: 'suggestion',
        equipoId: turn.equipoId,
        sospechoso: a.suspect as Sospechoso,
        arma: a.weapon as Arma,
        habitacion: a.room as Habitacion,
      });
      state = result.state;
    } else if (a.type === 'accusation' &&
        SOSPECHOSOS.includes(a.suspect as Sospechoso) &&
        ARMAS.includes(a.weapon as Arma) &&
        HABITACIONES.includes(a.room as Habitacion)) {
      const result = applyAction(state, {
        type: 'accusation',
        equipoId: turn.equipoId,
        sospechoso: a.suspect as Sospechoso,
        arma: a.weapon as Arma,
        habitacion: a.room as Habitacion,
      });
      state = result.state;
    } else {
      const result = applyAction(state, { type: 'pass', equipoId: turn.equipoId });
      state = result.state;
    }
  }

  const view = getGameStateView(state, team_id);
  return { content: [{ type: 'text' as const, text: JSON.stringify(view) }] };
}
