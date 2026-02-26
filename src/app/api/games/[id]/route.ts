import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
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

// GET /api/games/:id
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: gameId } = await params;
  const session = await getAuthSession();

  const partida = await db.select().from(partidas).where(eq(partidas.id, gameId)).get();
  if (!partida) {
    return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
  }

  const gameTeams = await db
    .select({ pe: partidaEquipos, e: equipos })
    .from(partidaEquipos)
    .innerJoin(equipos, eq(partidaEquipos.equipoId, equipos.id))
    .where(eq(partidaEquipos.partidaId, gameId))
    .all();

  const requestingEmail = session?.user?.email;
  const requestingUser = requestingEmail ? { email: requestingEmail, rol: (session?.user as any)?.rol } : null;

  const allTurnos = await db
    .select()
    .from(turnos)
    .where(eq(turnos.partidaId, gameId))
    .all();

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
          // Admin sees cartaMostrada; equipo only sees their own
          cartaMostrada:
            requestingUser?.rol === 'admin' ||
            s.equipoId === (session?.user as any)?.equipo?.id
              ? s.cartaMostrada
              : undefined,
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

  // Only show envelope when game is finished
  let sobre = undefined;
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

  return NextResponse.json({
    id: gameId,
    nombre: partida.nombre,
    estado: partida.estado,
    turnoActual: partida.turnoActual,
    createdAt: partida.createdAt?.toISOString() ?? null,
    startedAt: partida.startedAt?.toISOString() ?? null,
    finishedAt: partida.finishedAt?.toISOString() ?? null,
    equipos: gameTeams.map(({ pe, e }) => ({
      id: pe.id,
      equipoId: pe.equipoId,
      equipoNombre: e.nombre,
      orden: pe.orden,
      eliminado: pe.eliminado,
      puntos: pe.puntos,
    })),
    turnos: enrichedTurnos,
    sobre,
  });
}
