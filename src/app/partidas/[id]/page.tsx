import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import {
  partidas,
  partidaEquipos,
  equipos,
  turnos,
  sugerencias,
  acusaciones,
  sobres,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { GameDetailResponse } from '@/types/api';
import { ArenaView } from '@/components/game/ArenaView';

/**
 * UI-005 — Arena: Vista de espectador de partida (F009)
 * Server Component: loads initial game state for SSR, then WebSocket takes over.
 */
export default async function ArenaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: gameId } = await params;

  // The auth check has been removed to make this page public.
  // The underlying API endpoint /api/games/[id] handles data censoring
  // for unauthenticated users.

  const initialData = await loadArenaData(gameId);
  if (!initialData) redirect('/ranking');

  return <ArenaView gameId={gameId} initialData={initialData} />;
}

async function loadArenaData(gameId: string): Promise<GameDetailResponse | null> {
  const partida = await db.select().from(partidas).where(eq(partidas.id, gameId)).get();
  if (!partida) return null;

  const gameTeams = await db
    .select({ pe: partidaEquipos, e: equipos })
    .from(partidaEquipos)
    .innerJoin(equipos, eq(partidaEquipos.equipoId, equipos.id))
    .where(eq(partidaEquipos.partidaId, gameId))
    .all();

  const allTurnos = await db.select().from(turnos).where(eq(turnos.partidaId, gameId)).all();

  const enrichedTurnos = await Promise.all(
    allTurnos.map(async (t) => {
      const equipo = gameTeams.find((gt) => gt.pe.equipoId === t.equipoId);
      const turnSugerencias = await db
        .select()
        .from(sugerencias)
        .where(eq(sugerencias.turnoId, t.id))
        .all();
      const turnAcusacion = await db
        .select()
        .from(acusaciones)
        .where(eq(acusaciones.turnoId, t.id))
        .get();

      return {
        id: t.id,
        equipoId: t.equipoId,
        equipoNombre: equipo?.e.nombre ?? '',
        numero: t.numero,
        estado: t.estado,
        sugerencias: turnSugerencias.map((s) => ({
          id: s.id,
          equipoId: s.equipoId,
          sospechoso: s.sospechoso,
          arma: s.arma,
          habitacion: s.habitacion,
          refutadaPor: s.refutadaPor,
          cartaMostrada: s.cartaMostrada ?? null,
          createdAt: s.createdAt?.toISOString() ?? null,
        })),
        acusacion: turnAcusacion
          ? {
              id: turnAcusacion.id,
              equipoId: turnAcusacion.equipoId,
              sospechoso: turnAcusacion.sospechoso,
              arma: turnAcusacion.arma,
              habitacion: turnAcusacion.habitacion,
              correcta: turnAcusacion.correcta,
              createdAt: turnAcusacion.createdAt?.toISOString() ?? null,
            }
          : undefined,
      };
    })
  );

  let sobre: GameDetailResponse['sobre'];
  if (partida.estado === 'finalizada') {
    const envelopeRow = await db
      .select()
      .from(sobres)
      .where(eq(sobres.partidaId, gameId))
      .get();
    if (envelopeRow) {
      sobre = {
        sospechoso: envelopeRow.sospechoso,
        arma: envelopeRow.arma,
        habitacion: envelopeRow.habitacion,
      };
    }
  }

  // Authoritative active team: look up the current en_curso turn
  const activeTurno = partida.estado === 'en_curso'
    ? await db.select({ equipoId: turnos.equipoId })
        .from(turnos)
        .where(and(eq(turnos.partidaId, gameId), eq(turnos.estado, 'en_curso')))
        .get()
    : undefined;
  const activeEquipoId = activeTurno?.equipoId ?? null;

  return {
    id: gameId,
    nombre: partida.nombre,
    estado: partida.estado as GameDetailResponse['estado'],
    turnoActual: partida.turnoActual,
    maxTurnos: partida.maxTurnos ?? null,
    modoEjecucion: partida.modoEjecucion as GameDetailResponse['modoEjecucion'],
    autoRunActivoDesde: partida.autoRunActivoDesde?.toISOString() ?? null,
    activeEquipoId,
    createdAt: partida.createdAt?.toISOString() ?? '',
    startedAt: partida.startedAt?.toISOString() ?? null,
    finishedAt: partida.finishedAt?.toISOString() ?? null,
    equipos: [...gameTeams].sort((a, b) => a.pe.orden - b.pe.orden).map(({ pe, e }) => {
      const cartasArray = JSON.parse(pe.cartas ?? '[]') as string[];
      return {
        id: pe.id,
        equipoId: pe.equipoId,
        equipoNombre: e.nombre,
        avatarUrl: e.avatarUrl ?? null,
        orden: pe.orden,
        eliminado: pe.eliminado,
        puntos: pe.puntos,
        numCartas: cartasArray.length,
      };
    }),
    turnos: enrichedTurnos,
    sobre,
  };
}
