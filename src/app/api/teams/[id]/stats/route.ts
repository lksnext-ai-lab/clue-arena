import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { isAuthDisabled } from '@/lib/auth/dev';
import { db } from '@/lib/db';
import { equipos, turnos, sugerencias, acusaciones } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/teams/[id]/stats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: equipoId } = await params;

  // Auth check
  if (!isAuthDisabled()) {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const user = session.user as { rol?: string; equipo?: { id: string } };
    // Equipo role can only view their own stats
    if (user.rol === 'equipo' && user.equipo?.id !== equipoId) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
  }

  // Verify team exists
  const equipo = await db.select().from(equipos).where(eq(equipos.id, equipoId)).get();
  if (!equipo) {
    return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
  }

  // Fetch all turns for this team
  const teamTurnos = await db
    .select()
    .from(turnos)
    .where(eq(turnos.equipoId, equipoId))
    .all();

  const completedTurnos = teamTurnos.filter((t) => t.estado === 'completado');

  // progressoPct: completed turns / total turns (min 0, max 100)
  const progressoPct =
    teamTurnos.length > 0
      ? Math.min(100, Math.round((completedTurnos.length / teamTurnos.length) * 100))
      : 0;

  // Fetch acusaciones
  const teamAcusaciones = await db
    .select()
    .from(acusaciones)
    .where(eq(acusaciones.equipoId, equipoId))
    .all();

  // precisionPct: correct / total acusaciones (or based on non-refuted suggestions)
  const precisionPct =
    teamAcusaciones.length > 0
      ? Math.min(100, Math.round((teamAcusaciones.filter((a) => a.correcta).length / teamAcusaciones.length) * 100))
      : 0;

  // avgResolutionMin: average minutes per completed turn
  const tiempos = completedTurnos
    .filter((t) => t.startedAt && t.finishedAt)
    .map((t) => {
      const start = t.startedAt instanceof Date ? t.startedAt.getTime() : (t.startedAt as unknown as number) * 1000;
      const end = t.finishedAt instanceof Date ? t.finishedAt.getTime() : (t.finishedAt as unknown as number) * 1000;
      return (end - start) / 60_000;
    });
  const avgResolutionMin =
    tiempos.length > 0
      ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)
      : 0;

  // Fetch sugerencias for puntosPorEtapa
  const teamSugerencias = await db
    .select()
    .from(sugerencias)
    .where(eq(sugerencias.equipoId, equipoId))
    .all();

  const notRefuted = teamSugerencias.filter((s) => !s.refutadaPor).length;
  const refuted = teamSugerencias.filter((s) => !!s.refutadaPor).length;
  const correctAcusaciones = teamAcusaciones.filter((a) => a.correcta).length;

  const puntosPorEtapa = [
    { etapa: 'Pistas' as const, puntos: Math.min(100, notRefuted * 10 + correctAcusaciones * 20) },
    { etapa: 'Interrogatorios' as const, puntos: Math.min(100, teamSugerencias.length * 5) },
    { etapa: 'Descarte' as const, puntos: Math.min(100, refuted * 8) },
  ];

  return NextResponse.json({
    equipoId: equipo.id,
    nombre: equipo.nombre,
    progressoPct,
    precisionPct,
    avgResolutionMin,
    puntosPorEtapa,
  });
}
