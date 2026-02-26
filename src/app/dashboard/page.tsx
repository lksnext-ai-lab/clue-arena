import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { isAuthDisabled, DEV_COOKIE, DEV_USERS } from '@/lib/auth/dev';
import { db } from '@/lib/db';
import {
  equipos,
  partidas,
  partidaEquipos,
  sugerencias,
  acusaciones,
} from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { RankingPodium, type RankingEntry } from '@/components/dashboard/RankingPodium';
import { TeamStatsSection } from '@/components/dashboard/TeamStatsSection';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import type { ActivityEvent } from '@/components/dashboard/ActivityItem';

// ---------------------------------------------------------------------------
// Server-side data helpers
// ---------------------------------------------------------------------------

async function fetchRankingFromDb(): Promise<RankingEntry[]> {
  const allTeams = await db.select().from(equipos).all();

  const finishedGames = await db
    .select()
    .from(partidas)
    .where(eq(partidas.estado, 'finalizada'))
    .all();
  const finishedIds = new Set(finishedGames.map((g) => g.id));

  const rankingData = await Promise.all(
    allTeams.map(async (team) => {
      const gameRows = await db
        .select()
        .from(partidaEquipos)
        .where(eq(partidaEquipos.equipoId, team.id))
        .all();

      const finishedRows = gameRows.filter((r) => finishedIds.has(r.partidaId));
      const totalPuntos = finishedRows.reduce((sum, r) => sum + r.puntos, 0);
      const aciertos = finishedRows.filter((r) => r.puntos > 0 && !r.eliminado).length;

      return {
        equipoId: team.id,
        equipoNombre: team.nombre,
        puntos: totalPuntos,
        partidasJugadas: finishedRows.length,
        aciertos,
      };
    })
  );

  rankingData.sort((a, b) => b.puntos - a.puntos);
  return rankingData.map((entry, idx) => ({ ...entry, posicion: idx + 1 }));
}

async function fetchRecentActivityFromDb(limit = 10): Promise<ActivityEvent[]> {
  const allEquipos = await db.select().from(equipos).all();
  const equipoMap = new Map(allEquipos.map((e) => [e.id, e.nombre]));

  const recentSugs = await db
    .select()
    .from(sugerencias)
    .orderBy(desc(sugerencias.createdAt))
    .limit(limit)
    .all();

  const recentAcus = await db
    .select()
    .from(acusaciones)
    .orderBy(desc(acusaciones.createdAt))
    .limit(limit)
    .all();

  type EventType = ActivityEvent['tipo'];
  const events: ActivityEvent[] = [];

  for (const s of recentSugs) {
    const nombre = equipoMap.get(s.equipoId) ?? 'Equipo desconocido';
    const tsMs =
      s.createdAt instanceof Date
        ? s.createdAt.getTime()
        : (s.createdAt as unknown as number) * 1000;

    const tipo: EventType = s.refutadaPor ? 'descarte' : 'sugerencia';
    const descripcion = s.refutadaPor
      ? `${nombre} descartó la hipótesis con '${s.sospechoso}' usando el '${s.arma}'.`
      : `${nombre} interrogó sobre '${s.sospechoso}' con '${s.arma}' en '${s.habitacion}'.`;

    events.push({
      id: `sug-${s.id}`,
      timestampMs: tsMs,
      tipo,
      actorNombre: nombre,
      actorEquipoId: s.equipoId,
      descripcion,
    });
  }

  for (const a of recentAcus) {
    const nombre = equipoMap.get(a.equipoId) ?? 'Equipo desconocido';
    const tsMs =
      a.createdAt instanceof Date
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

  events.sort((a, b) => b.timestampMs - a.timestampMs);
  return events.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  // Resolve equipo ID for current user
  let miEquipoId: string | null = null;

  if (isAuthDisabled()) {
    const cookieStore = await cookies();
    const devRole = cookieStore.get(DEV_COOKIE)?.value as keyof typeof DEV_USERS | undefined;
    if (!devRole || !DEV_USERS[devRole]) redirect('/login');
    miEquipoId = DEV_USERS[devRole].equipo?.id ?? null;
  } else {
    const session = await auth();
    if (!session?.user) redirect('/login');
    miEquipoId = (session.user as { equipo?: { id: string } }).equipo?.id ?? null;
  }

  const [ranking, activity] = await Promise.all([
    fetchRankingFromDb(),
    fetchRecentActivityFromDb(10),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <RankingPodium initialRanking={ranking} miEquipoId={miEquipoId} />

      {miEquipoId && <TeamStatsSection equipoId={miEquipoId} />}

      <ActivityFeed initialEvents={activity} miEquipoId={miEquipoId} />
    </div>
  );
}
