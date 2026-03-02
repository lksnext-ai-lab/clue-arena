import { z } from 'zod';
import { db } from '@/lib/db';
import { partidas, partidaEquipos, turnos, sugerencias, acusaciones, pases } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getGameStateView } from '@/lib/game/engine';
import type { GameState, ActionRecord, SuggestionResult, AccusationResult } from '@/lib/game/types';
import type { Sospechoso, Arma, Habitacion, Carta } from '@/types/domain';

export const getGameStateTool = {
  schema: {
    game_id: z.string().describe('ID de la partida'),
    team_id: z.string().describe('ID del equipo solicitante'),
  },

  handler: async ({ game_id, team_id }: { game_id: string; team_id: string }) => {
    const partida = await db
      .select()
      .from(partidas)
      .where(eq(partidas.id, game_id))
      .get();

    if (!partida) throw new Error(`Partida ${game_id} no encontrada`);

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

    // ── Build complete GameState ───────────────────────────────────────────
    const state: GameState = {
      gameId: game_id,
      estado: partida.estado as GameState['estado'],
      turnoActual: partida.turnoActual,
      sobre: { sospechoso: '' as Sospechoso, arma: '' as Arma, habitacion: '' as Habitacion }, // secret — never exposed
      equipos: equipoRows.map((e) => ({
        equipoId: e.equipoId,
        orden: e.orden,
        cartas: JSON.parse(e.cartas as string) as Carta[],
        eliminado: e.eliminado,
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
