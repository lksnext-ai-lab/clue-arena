import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import {
  sugerencias,
  acusaciones,
  equipos,
  partidas,
  partidaEquipos,
  tournaments,
  tournamentTeams,
} from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { GameResponse, TeamResponse } from '@/types/api';

/**
 * UI-006 — Panel de administración
 */
export default async function AdminPage() {
  const session = await auth();

  const [recentSugerencias, recentAcusaciones, allEquipos, allGames, allTournaments, allTournamentTeams] = await Promise.all([
    db.select().from(sugerencias).orderBy(desc(sugerencias.createdAt)).limit(10).all(),
    db.select().from(acusaciones).orderBy(desc(acusaciones.createdAt)).limit(10).all(),
    db.select().from(equipos).all(),
    db.select().from(partidas).orderBy(desc(partidas.createdAt)).all(),
    db.select().from(tournaments).orderBy(desc(tournaments.createdAt)).all(),
    db.select().from(tournamentTeams).all(),
  ]);

  const equipoMap = new Map(allEquipos.map((e) => [e.id, e.nombre]));

  type ActivityEvent = {
    id: string;
    partidaId: string | null;
    timestampMs: number;
    tipo: 'sugerencia' | 'descarte' | 'acusacion';
    actor: string;
    descripcion: string;
  };

  const activity: ActivityEvent[] = [];

  for (const s of recentSugerencias) {
    const nombre = equipoMap.get(s.equipoId) ?? 'Equipo desconocido';
    const tsMs =
      s.createdAt instanceof Date
        ? s.createdAt.getTime()
        : (s.createdAt as unknown as number) * 1000;
    activity.push({
      id: `sug-${s.id}`,
      partidaId: s.partidaId,
      timestampMs: tsMs,
      tipo: s.refutadaPor ? 'descarte' : 'sugerencia',
      actor: nombre,
      descripcion: s.refutadaPor
        ? `${nombre} descartó hipótesis: ${s.sospechoso} · ${s.arma} · ${s.habitacion}`
        : `${nombre} investigó: ${s.sospechoso} · ${s.arma} · ${s.habitacion}`,
    });
  }

  for (const a of recentAcusaciones) {
    const nombre = equipoMap.get(a.equipoId) ?? 'Equipo desconocido';
    const tsMs =
      a.createdAt instanceof Date
        ? a.createdAt.getTime()
        : (a.createdAt as unknown as number) * 1000;
    activity.push({
      id: `acu-${a.id}`,
      partidaId: a.partidaId,
      timestampMs: tsMs,
      tipo: 'acusacion',
      actor: nombre,
      descripcion: a.correcta
        ? `✅ ${nombre} resolvió el caso: ${a.sospechoso} · ${a.arma} · ${a.habitacion}`
        : `❌ ${nombre} acusó incorrectamente: ${a.sospechoso}`,
    });
  }

  activity.sort((a, b) => b.timestampMs - a.timestampMs);
  const recentActivity = activity.slice(0, 10);

  const initialGames: GameResponse[] = await Promise.all(
    allGames.map(async (game) => {
      const gameTeams = await db
        .select({ pe: partidaEquipos, e: equipos })
        .from(partidaEquipos)
        .innerJoin(equipos, eq(partidaEquipos.equipoId, equipos.id))
        .where(eq(partidaEquipos.partidaId, game.id))
        .all();

      return {
        id: game.id,
        nombre: game.nombre,
        estado: game.estado,
        turnoActual: game.turnoActual,
        maxTurnos: game.maxTurnos ?? null,
        modoEjecucion: game.modoEjecucion,
        autoRunActivoDesde: game.autoRunActivoDesde?.toISOString() ?? null,
        createdAt: game.createdAt.toISOString(),
        startedAt: game.startedAt?.toISOString() ?? null,
        finishedAt: game.finishedAt?.toISOString() ?? null,
        equipos: gameTeams.map(({ pe, e }) => ({
          id: pe.id,
          equipoId: pe.equipoId,
          equipoNombre: e.nombre,
          avatarUrl: e.avatarUrl ?? null,
          orden: pe.orden,
          eliminado: pe.eliminado,
          puntos: pe.puntos,
          numCartas: JSON.parse(pe.cartas ?? '[]').length,
          warnings: pe.warnings,
          eliminadoPorWarnings: pe.eliminacionRazon === 'warnings',
        })),

      };
    })
  );

  const initialTeams: TeamResponse[] = allEquipos.map((team) => ({
    id: team.id,
    nombre: team.nombre,
    descripcion: team.descripcion ?? null,
    agentId: team.agentId,
    agentBackend: (team.agentBackend ?? 'mattin') as 'mattin' | 'local',
    appId: team.appId ?? null,
    hasMattinApiKey: !!team.mattinApiKey,
    avatarUrl: team.avatarUrl ?? null,
    usuarioId: team.usuarioId,
    estado: team.estado,
    miembros: JSON.parse(team.miembros ?? '[]') as string[],
    createdAt: team.createdAt.toISOString(),
  }));

  const tournamentTeamCounts = allTournamentTeams.reduce<Record<string, number>>((acc, team) => {
    acc[team.tournamentId] = (acc[team.tournamentId] ?? 0) + 1;
    return acc;
  }, {});

  const initialTournaments = allTournaments.map((torneo) => ({
    id: torneo.id,
    name: torneo.name,
    format: torneo.format,
    status: torneo.status,
    createdAt: torneo.createdAt?.toISOString() ?? null,
    teamCount: tournamentTeamCounts[torneo.id] ?? 0,
  }));

  return (
    <AdminDashboard
      initialEmail={session?.user?.email ?? null}
      initialGames={initialGames}
      initialTeams={initialTeams}
      initialTournaments={initialTournaments}
      initialActivity={recentActivity.map((event) => ({
        id: event.id,
        partidaId: event.partidaId,
        timestampMs: event.timestampMs,
        tipo: event.tipo,
        actorNombre: event.actor,
        actorEquipoId: '',
        descripcion: event.descripcion,
      }))}
    />
  );
}
