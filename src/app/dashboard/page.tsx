import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { isAuthDisabled, DEV_COOKIE, DEV_USERS } from '@/lib/auth/dev';
import { db } from '@/lib/db';
import {
  equipos,
  partidas,
  partidaEquipos,
} from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { RankingPodium, type RankingEntry } from '@/components/dashboard/RankingPodium';
import { TeamStatsSection } from '@/components/dashboard/TeamStatsSection';
import { RecentFinishedGames, type FinishedGameEntry } from '@/components/dashboard/RecentFinishedGames';
import { LastGameCard, type LastGameData } from '@/components/dashboard/LastGameCard';

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
        avatarUrl: team.avatarUrl ?? null,
        puntos: totalPuntos,
        partidasJugadas: finishedRows.length,
        aciertos,
      };
    })
  );

  rankingData.sort((a, b) => b.puntos - a.puntos);
  return rankingData.map((entry, idx) => ({ ...entry, posicion: idx + 1 }));
}

async function fetchRecentFinishedGamesFromDb(limit = 5): Promise<FinishedGameEntry[]> {
  const finishedPartidas = await db
    .select()
    .from(partidas)
    .where(eq(partidas.estado, 'finalizada'))
    .orderBy(desc(partidas.finishedAt))
    .limit(limit)
    .all();

  if (finishedPartidas.length === 0) return [];

  const toMs = (v: Date | number | null | undefined): number | null => {
    if (v == null) return null;
    if (v instanceof Date) return v.getTime();
    return (v as number) * 1000;
  };

  return Promise.all(
    finishedPartidas.map(async (p) => {
      const gameTeams = await db
        .select({ pe: partidaEquipos, e: equipos })
        .from(partidaEquipos)
        .innerJoin(equipos, eq(partidaEquipos.equipoId, equipos.id))
        .where(eq(partidaEquipos.partidaId, p.id))
        .all();

      return {
        id: p.id,
        nombre: p.nombre,
        finishedAtMs: toMs(p.finishedAt),
        startedAtMs: toMs(p.startedAt),
        turnoActual: p.turnoActual,
        maxTurnos: p.maxTurnos ?? null,
        equipos: gameTeams.map(({ pe, e }) => ({
          equipoId: pe.equipoId,
          equipoNombre: e.nombre,
          puntos: pe.puntos,
          eliminado: pe.eliminado,
        })),
      };
    })
  );
}

async function fetchLastGameFromDb(): Promise<LastGameData | null> {
  // Prefer en_curso, then finalizada, then any — newest first
  const allPartidas = await db
    .select()
    .from(partidas)
    .orderBy(desc(partidas.createdAt))
    .all();

  if (allPartidas.length === 0) return null;

  const pick =
    allPartidas.find((p) => p.estado === 'en_curso') ??
    allPartidas.find((p) => p.estado === 'finalizada') ??
    allPartidas[0];

  const gameTeams = await db
    .select({ pe: partidaEquipos, e: equipos })
    .from(partidaEquipos)
    .innerJoin(equipos, eq(partidaEquipos.equipoId, equipos.id))
    .where(eq(partidaEquipos.partidaId, pick.id))
    .all();

  const toMs = (v: Date | number | null | undefined): number | null => {
    if (v == null) return null;
    if (v instanceof Date) return v.getTime();
    return (v as number) * 1000;
  };

  return {
    id: pick.id,
    nombre: pick.nombre,
    estado: pick.estado as LastGameData['estado'],
    turnoActual: pick.turnoActual,
    maxTurnos: pick.maxTurnos ?? null,
    startedAtMs: toMs(pick.startedAt),
    finishedAtMs: toMs(pick.finishedAt),
    equipos: gameTeams.map(({ pe, e }) => ({
      equipoId: pe.equipoId,
      equipoNombre: e.nombre,
      puntos: pe.puntos,
      eliminado: pe.eliminado,
    })),
  };
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

  const [ranking, recentFinishedGames, lastGame] = await Promise.all([
    fetchRankingFromDb(),
    fetchRecentFinishedGamesFromDb(5),
    fetchLastGameFromDb(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <RankingPodium initialRanking={ranking} miEquipoId={miEquipoId} />

      <LastGameCard game={lastGame} miEquipoId={miEquipoId} />

      {miEquipoId && <TeamStatsSection equipoId={miEquipoId} />}

      <RecentFinishedGames games={recentFinishedGames} miEquipoId={miEquipoId} />
    </div>
  );
}
