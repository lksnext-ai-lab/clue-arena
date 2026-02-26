import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { isAuthDisabled } from '@/lib/auth/dev';
import { db } from '@/lib/db';
import { sugerencias, acusaciones, equipos } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

// GET /api/games/activity
export async function GET(request: NextRequest) {
  if (!isAuthDisabled()) {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)));

  // Fetch all equipos for name lookup
  const allEquipos = await db.select().from(equipos).all();
  const equipoMap = new Map(allEquipos.map((e) => [e.id, e.nombre]));

  // Fetch recent sugerencias
  const recentSugerencias = await db
    .select()
    .from(sugerencias)
    .orderBy(desc(sugerencias.createdAt))
    .limit(limit)
    .all();

  // Fetch recent acusaciones
  const recentAcusaciones = await db
    .select()
    .from(acusaciones)
    .orderBy(desc(acusaciones.createdAt))
    .limit(limit)
    .all();

  type EventType = 'descarte' | 'interrogatorio' | 'pista' | 'acusacion' | 'sugerencia';

  interface ActivityEvent {
    id: string;
    timestampMs: number;
    tipo: EventType;
    actorNombre: string;
    actorEquipoId: string;
    descripcion: string;
  }

  const events: ActivityEvent[] = [];

  for (const s of recentSugerencias) {
    const nombre = equipoMap.get(s.equipoId) ?? 'Equipo desconocido';
    const tsMs = s.createdAt instanceof Date
      ? s.createdAt.getTime()
      : (s.createdAt as unknown as number) * 1000;

    if (s.refutadaPor) {
      const refutador = equipoMap.get(s.refutadaPor) ?? 'otro equipo';
      events.push({
        id: `sug-${s.id}`,
        timestampMs: tsMs,
        tipo: 'descarte',
        actorNombre: nombre,
        actorEquipoId: s.equipoId,
        descripcion: `${nombre} descartó la hipótesis con '${s.sospechoso}' usando el '${s.arma}' (refutado por ${refutador}).`,
      });
    } else {
      events.push({
        id: `sug-${s.id}`,
        timestampMs: tsMs,
        tipo: 'sugerencia',
        actorNombre: nombre,
        actorEquipoId: s.equipoId,
        descripcion: `${nombre} interrogó sobre '${s.sospechoso}' con '${s.arma}' en '${s.habitacion}'.`,
      });
    }
  }

  for (const a of recentAcusaciones) {
    const nombre = equipoMap.get(a.equipoId) ?? 'Equipo desconocido';
    const tsMs = a.createdAt instanceof Date
      ? a.createdAt.getTime()
      : (a.createdAt as unknown as number) * 1000;

    events.push({
      id: `acu-${a.id}`,
      timestampMs: tsMs,
      tipo: 'acusacion',
      actorNombre: nombre,
      actorEquipoId: a.equipoId,
      descripcion: a.correcta
        ? `${nombre} resolvió el caso: '${a.sospechoso}' con '${a.arma}' en '${a.habitacion}'. ¡Correcto!`
        : `${nombre} hizo una acusación incorrecta sobre '${a.sospechoso}'.`,
    });
  }

  // Sort by timestamp descending, take limit
  events.sort((a, b) => b.timestampMs - a.timestampMs);

  return NextResponse.json({ events: events.slice(0, limit) });
}
