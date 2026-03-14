'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Play, Square } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import type { GameResponse, TeamResponse } from '@/types/api';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { Badge } from '@/components/ui/badge';
import { AdminTeamsSection } from '@/components/admin/AdminTeamsSection';
import { TournamentStatusBadge, FormatBadge } from '@/components/admin/TournamentStatusBadge';
import { cn } from '@/lib/utils/cn';
import type { TournamentFormat, TournamentStatus } from '@/types/domain';

type ActivityKind = 'descarte' | 'interrogatorio' | 'pista' | 'acusacion' | 'sugerencia';

interface ActivityEvent {
  id: string;
  partidaId: string | null;
  timestampMs: number;
  tipo: ActivityKind;
  actorNombre: string;
  actorEquipoId: string;
  descripcion: string;
}

interface AdminDashboardProps {
  initialEmail: string | null;
  initialGames: GameResponse[];
  initialTeams: TeamResponse[];
  initialActivity: ActivityEvent[];
  initialTournaments: TournamentSummary[];
}

interface TournamentSummary {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  createdAt: string | null;
  teamCount: number;
}

const MODE_LABELS: Record<'manual' | 'auto' | 'pausado', string> = {
  manual: 'Manual',
  auto: 'Auto-run',
  pausado: 'Pausado',
};

const GAMES_PER_PAGE = 8;

function formatRelativeUpdate(timestampMs: number, nowMs: number) {
  const diffSec = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  if (diffSec < 5) return 'Actualizado ahora';
  if (diffSec < 60) return `Actualizado hace ${diffSec} s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Actualizado hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  return `Actualizado hace ${diffHours} h`;
}

function formatEventTime(timestampMs: number, nowMs: number) {
  const diffSec = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  if (diffSec < 60) return `Hace ${Math.max(diffSec, 1)} s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays} d`;
}

export function AdminDashboard({
  initialEmail,
  initialGames,
  initialTeams,
  initialActivity,
  initialTournaments,
}: AdminDashboardProps) {
  const [games, setGames] = useState(initialGames);
  const [teams, setTeams] = useState(initialTeams);
  const [activity, setActivity] = useState(initialActivity);
  const [tournaments] = useState(initialTournaments);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingGameId, setActingGameId] = useState<string | null>(null);
  const [lastUpdatedMs, setLastUpdatedMs] = useState(Date.now());
  const [clockMs, setClockMs] = useState(Date.now());
  const [gamesPage, setGamesPage] = useState(1);

  async function refreshDashboard() {
    try {
      const [gamesRes, teamsRes, activityRes] = await Promise.all([
        apiFetch<{ games: GameResponse[] }>('/games'),
        apiFetch<{ teams: TeamResponse[] }>('/teams'),
        apiFetch<{ events: ActivityEvent[] }>('/games/activity?limit=10'),
      ]);

      setGames(gamesRes.games);
      setTeams(teamsRes.teams);
      setActivity(activityRes.events);
      setLoadError(null);
      setLastUpdatedMs(Date.now());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al actualizar el panel admin';
      setLoadError(message);
    }
  }

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshDashboard();
      }
    }, 10000);

    const clockTimer = window.setInterval(() => {
      setClockMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  async function doGameAction(gameId: string, action: 'start' | 'stop', body?: object) {
    setActingGameId(gameId);
    setActionError(null);

    try {
      await apiFetch(`/games/${gameId}/${action}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      await refreshDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar la acción';
      setActionError(message);
    } finally {
      setActingGameId(null);
    }
  }

  const sortedGames = useMemo(() => {
    const priority = { en_curso: 0, pendiente: 1, finalizada: 2 } as const;

    return [...games].sort((a, b) => {
      const byStatus = priority[a.estado] - priority[b.estado];
      if (byStatus !== 0) return byStatus;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [games]);

  const kpis = useMemo(() => {
    const pending = games.filter((game) => game.estado === 'pendiente').length;
    const inProgress = games.filter((game) => game.estado === 'en_curso').length;
    const finished = games.filter((game) => game.estado === 'finalizada').length;
    const incidents = activity.filter((event) => event.tipo === 'acusacion').length;
    const readyTeams = teams.filter((team) => Boolean(team.agentId)).length;

    return [
      { label: 'Equipos registrados', value: teams.length, hint: `${readyTeams} listos para jugar` },
      { label: 'Partidas pendientes', value: pending, hint: pending > 0 ? 'Requieren inicio' : 'Sin cola' },
      { label: 'Partidas en curso', value: inProgress, hint: inProgress > 0 ? 'Seguimiento activo' : 'Sin partidas activas' },
      { label: 'Partidas finalizadas', value: finished, hint: finished > 0 ? 'Histórico disponible' : 'Aún sin cierre' },
      {
        label: 'Incidencias recientes',
        value: incidents,
        hint: incidents > 0 ? 'Revisar actividad reciente' : 'Sin incidencias visibles',
        tone: incidents > 0 ? 'alert' : 'default',
      },
    ];
  }, [activity, games, teams]);

  const tournamentKpis = useMemo(() => {
    const active = tournaments.filter((torneo) => torneo.status === 'active').length;
    const draft = tournaments.filter((torneo) => torneo.status === 'draft').length;
    const finished = tournaments.filter((torneo) => torneo.status === 'finished').length;

    return { active, draft, finished };
  }, [tournaments]);

  const activeGames = useMemo(
    () => sortedGames.filter((game) => game.estado === 'en_curso').slice(0, 4),
    [sortedGames]
  );

  const activeTournaments = useMemo(
    () => tournaments.filter((torneo) => torneo.status === 'active').slice(0, 4),
    [tournaments]
  );

  const totalGamesPages = Math.max(1, Math.ceil(sortedGames.length / GAMES_PER_PAGE));
  const safeGamesPage = Math.min(gamesPage, totalGamesPages);
  const paginatedGames = useMemo(() => {
    const startIndex = (safeGamesPage - 1) * GAMES_PER_PAGE;
    return sortedGames.slice(startIndex, startIndex + GAMES_PER_PAGE);
  }, [safeGamesPage, sortedGames]);

  useEffect(() => {
    if (gamesPage !== safeGamesPage) {
      setGamesPage(safeGamesPage);
    }
  }, [gamesPage, safeGamesPage]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 text-slate-200">
      <header className="rounded-3xl border border-slate-800 bg-slate-900/70 px-6 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-400/80">UI-006</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Panel de control del evento</h1>
            <p className="mt-2 text-sm text-slate-400">{initialEmail ?? 'Admin'}</p>
            <p className="mt-1 text-xs text-slate-500">{formatRelativeUpdate(lastUpdatedMs, clockMs)}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/partidas/nueva"
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
            >
              + Nueva partida
            </Link>
            <Link
              href="/ranking"
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
            >
              Ver ranking
            </Link>
          </div>
        </div>
      </header>

      {loadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-900/30 px-4 py-3 text-sm text-red-200">
          {loadError}
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-red-500/30 bg-red-900/30 px-4 py-3 text-sm text-red-200">
          {actionError}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className={cn(
              'rounded-2xl border px-4 py-4',
              kpi.tone === 'alert'
                ? 'border-amber-500/30 bg-amber-500/10'
                : 'border-slate-800 bg-slate-900/70'
            )}
          >
            <p className="text-xs uppercase tracking-wide text-slate-400">{kpi.label}</p>
            <p className="mt-3 text-3xl font-bold text-white">{kpi.value}</p>
            <p className="mt-1 text-xs text-slate-500">{kpi.hint}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70">
        <div className="border-b border-slate-800 px-6 py-4">
          <h2 className="text-xl font-semibold text-white">Operación en curso</h2>
          <p className="text-sm text-slate-400">
            Vista rápida de las partidas y torneos que requieren seguimiento inmediato.
          </p>
        </div>

        <div className="grid gap-6 px-6 py-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Partidas activas</h3>
                <p className="text-sm text-slate-400">Partidas en curso ahora mismo.</p>
              </div>
              <Link href="/admin/partidas" className="text-sm font-medium text-cyan-400 hover:text-cyan-300">
                Ver todas
              </Link>
            </div>

            {activeGames.length === 0 ? (
              <p className="text-sm text-slate-500">No hay partidas activas.</p>
            ) : (
              <ul className="space-y-3">
                {activeGames.map((game) => (
                  <li
                    key={game.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{game.nombre}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Turno {game.turnoActual} · {game.equipos.length} equipos
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <GameStatusBadge estado={game.estado} />
                      <Badge variant="secondary">{MODE_LABELS[game.modoEjecucion]}</Badge>
                          <Link
                            href={`/admin/partidas/${game.id}`}
                            aria-label={`Gestionar partida ${game.nombre}`}
                            title={`Gestionar partida ${game.nombre}`}
                            className="rounded-lg border border-slate-700 p-2 text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Torneos activos</h3>
                <p className="text-sm text-slate-400">Competiciones abiertas y en seguimiento.</p>
              </div>
              <Link href="/admin/torneos" className="text-sm font-medium text-cyan-400 hover:text-cyan-300">
                Ver todos
              </Link>
            </div>

            {activeTournaments.length === 0 ? (
              <p className="text-sm text-slate-500">No hay torneos activos.</p>
            ) : (
              <ul className="space-y-3">
                {activeTournaments.map((torneo) => (
                  <li
                    key={torneo.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{torneo.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{torneo.teamCount} equipos inscritos</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <FormatBadge format={torneo.format} />
                      <TournamentStatusBadge status={torneo.status} />
                      <Link
                        href={`/admin/torneos/${torneo.id}`}
                        aria-label={`Gestionar torneo ${torneo.name}`}
                        title={`Gestionar torneo ${torneo.name}`}
                        className="rounded-lg border border-slate-700 p-2 text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Partidas activas y pendientes</h2>
            <p className="text-sm text-slate-400">
              Prioridad operativa: en curso, pendientes y luego finalizadas.
            </p>
          </div>
          <Link
            href="/admin/partidas"
            aria-label="Gestión de partidas"
            title="Gestión de partidas"
            className="rounded-lg border border-slate-700 p-2 text-cyan-400 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-cyan-300"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {sortedGames.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-400">No hay partidas creadas.</div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-800 text-slate-500">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">Partida</th>
                    <th className="px-6 py-3 text-left font-medium">Equipos</th>
                    <th className="px-6 py-3 text-left font-medium">Estado</th>
                    <th className="px-6 py-3 text-left font-medium">Turno</th>
                    <th className="px-6 py-3 text-left font-medium">Último evento</th>
                    <th className="px-6 py-3 text-left font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedGames.map((game) => {
                    const isActing = actingGameId === game.id;
                    const teamNames = game.equipos.map((team) => team.equipoNombre).join(', ');
                    const lastEvent = activity.find((event) => event.partidaId === game.id);

                    return (
                      <tr key={game.id} className="border-b border-slate-800/80 align-top">
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <p className="font-semibold text-white">{game.nombre}</p>
                            <p className="text-xs text-slate-500">{game.id.slice(0, 8)}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          <div className="max-w-sm">
                            <p>{teamNames}</p>
                            <p className="mt-1 text-xs text-slate-500">{game.equipos.length} equipos</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <GameStatusBadge estado={game.estado} />
                            {game.estado === 'en_curso' && (
                              <Badge variant="secondary">{MODE_LABELS[game.modoEjecucion]}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          <p>{game.turnoActual}</p>
                          {game.maxTurnos ? (
                            <p className="mt-1 text-xs text-slate-500">de {game.maxTurnos}</p>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {lastEvent ? (
                            <div className="max-w-sm">
                              <p className="line-clamp-2">{lastEvent.descripcion}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatEventTime(lastEvent.timestampMs, clockMs)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-500">Sin eventos recientes</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/admin/partidas/${game.id}`}
                              aria-label={`Gestionar partida ${game.nombre}`}
                              title={`Gestionar partida ${game.nombre}`}
                              className="rounded-lg border border-slate-700 p-2 text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
                            >
                              <ArrowUpRight className="h-4 w-4" />
                            </Link>
                            {game.estado === 'pendiente' && (
                            <button
                              onClick={() => {
                                void doGameAction(game.id, 'start', { modo: 'manual' });
                              }}
                              aria-label={`Iniciar partida ${game.nombre}`}
                              title={`Iniciar partida ${game.nombre}`}
                              disabled={isActing}
                              className="rounded-lg bg-emerald-500 p-2 text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
                            >
                              {isActing ? '...' : <Play className="h-4 w-4" />}
                            </button>
                          )}
                          {game.estado === 'en_curso' && (
                            <button
                              onClick={() => {
                                if (window.confirm('¿Finalizar manualmente esta partida?')) {
                                  void doGameAction(game.id, 'stop');
                                }
                              }}
                              aria-label={`Finalizar partida ${game.nombre}`}
                              title={`Finalizar partida ${game.nombre}`}
                              disabled={isActing}
                              className="rounded-lg bg-red-500 p-2 text-white transition-colors hover:bg-red-400 disabled:opacity-50"
                            >
                              {isActing ? '...' : <Square className="h-4 w-4" />}
                            </button>
                          )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-800 px-6 py-4 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
              <p>
                Mostrando {Math.min((safeGamesPage - 1) * GAMES_PER_PAGE + 1, sortedGames.length)}-
                {Math.min(safeGamesPage * GAMES_PER_PAGE, sortedGames.length)} de {sortedGames.length} partidas
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGamesPage((page) => Math.max(1, page - 1))}
                  disabled={safeGamesPage === 1}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="min-w-20 text-center text-xs text-slate-500">
                  Página {safeGamesPage} de {totalGamesPages}
                </span>
                <button
                  onClick={() => setGamesPage((page) => Math.min(totalGamesPages, page + 1))}
                  disabled={safeGamesPage === totalGamesPages}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 px-6 py-5">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Equipos</h2>
            <p className="text-sm text-slate-400">
              Registro, disponibilidad y mantenimiento del roster del evento.
            </p>
          </div>
          <Link href="/admin/equipos" className="text-sm font-medium text-cyan-400 hover:text-cyan-300">
            Gestión de equipos
          </Link>
        </div>

        <AdminTeamsSection />
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Torneos</h2>
            <p className="text-sm text-slate-400">
              Estado de los torneos configurados y acceso directo a su gestión.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/torneos"
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
            >
              Gestión de torneos
            </Link>
            <Link
              href="/admin/torneos/nueva"
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
            >
              + Nuevo torneo
            </Link>
          </div>
        </div>

        <div className="grid gap-4 border-b border-slate-800 px-6 py-5 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Activos</p>
            <p className="mt-3 text-3xl font-bold text-white">{tournamentKpis.active}</p>
            <p className="mt-1 text-xs text-slate-500">Torneos en ejecución</p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Borradores</p>
            <p className="mt-3 text-3xl font-bold text-white">{tournamentKpis.draft}</p>
            <p className="mt-1 text-xs text-slate-500">Configurados pero no iniciados</p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Finalizados</p>
            <p className="mt-3 text-3xl font-bold text-white">{tournamentKpis.finished}</p>
            <p className="mt-1 text-xs text-slate-500">Histórico cerrado</p>
          </article>
        </div>

        {tournaments.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-400">No hay torneos creados.</div>
        ) : (
          <ul className="space-y-3 px-6 py-5">
            {tournaments.slice(0, 5).map((torneo) => (
              <li
                key={torneo.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{torneo.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <FormatBadge format={torneo.format} />
                    <TournamentStatusBadge status={torneo.status} />
                    <span className="text-xs text-slate-500">{torneo.teamCount} equipos</span>
                  </div>
                </div>
                <Link
                  href={`/admin/torneos/${torneo.id}`}
                  aria-label={`Gestionar torneo ${torneo.name}`}
                  title={`Gestionar torneo ${torneo.name}`}
                  className="shrink-0 rounded-lg border border-slate-700 p-2 text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}
