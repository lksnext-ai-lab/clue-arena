'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Play,
  Radar,
  ShieldAlert,
  Sparkles,
  Square,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import type { GameResponse, TeamResponse } from '@/types/api';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { Badge } from '@/components/ui/badge';
import { AdminTeamsSection } from '@/components/admin/AdminTeamsSection';
import { TournamentStatusBadge, FormatBadge } from '@/components/admin/TournamentStatusBadge';
import { cn } from '@/lib/utils/cn';
import type { TournamentFormat, TournamentStatus } from '@/types/domain';

type ActivityKind = 'descarte' | 'interrogatorio' | 'pista' | 'acusacion' | 'sugerencia';
type MetricTone = 'slate' | 'cyan' | 'emerald' | 'amber' | 'rose';

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

interface DashboardMetric {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  tone: MetricTone;
}

const MODE_LABELS: Record<'manual' | 'auto' | 'pausado', string> = {
  manual: 'Manual',
  auto: 'Auto-run',
  pausado: 'Pausado',
};

const GAMES_PER_PAGE = 8;

const METRIC_TONE_CLASSES: Record<
  MetricTone,
  { card: string; icon: string; hint: string }
> = {
  slate: {
    card: 'border-white/10 bg-white/[0.04]',
    icon: 'border-white/10 bg-white/[0.04] text-slate-200',
    hint: 'text-slate-400',
  },
  cyan: {
    card: 'border-cyan-300/20 bg-cyan-300/[0.08]',
    icon: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
    hint: 'text-cyan-100/80',
  },
  emerald: {
    card: 'border-emerald-300/20 bg-emerald-300/[0.08]',
    icon: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    hint: 'text-emerald-100/80',
  },
  amber: {
    card: 'border-amber-300/20 bg-amber-300/[0.08]',
    icon: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    hint: 'text-amber-100/80',
  },
  rose: {
    card: 'border-rose-300/20 bg-rose-300/[0.08]',
    icon: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
    hint: 'text-rose-100/80',
  },
};

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

function formatShortDate(value: string | null) {
  if (!value) return 'Fecha pendiente';

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
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
      const message = error instanceof Error ? error.message : 'No se pudo completar la accion';
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

  const readyTeamsCount = useMemo(
    () => teams.filter((team) => Boolean(team.agentId?.trim())).length,
    [teams]
  );

  const gameTotals = useMemo(() => {
    const pending = games.filter((game) => game.estado === 'pendiente').length;
    const inProgress = games.filter((game) => game.estado === 'en_curso').length;
    const finished = games.filter((game) => game.estado === 'finalizada').length;

    return { pending, inProgress, finished };
  }, [games]);

  const incidentCount = useMemo(
    () => activity.filter((event) => event.tipo === 'acusacion').length,
    [activity]
  );

  const kpis = useMemo<DashboardMetric[]>(
    () => [
      {
        label: 'Equipos registrados',
        value: teams.length,
        hint: `${readyTeamsCount} listos para jugar`,
        icon: Users,
        tone: 'cyan',
      },
      {
        label: 'Partidas pendientes',
        value: gameTotals.pending,
        hint: gameTotals.pending > 0 ? 'Requieren inicio manual' : 'Sin cola operativa',
        icon: Clock3,
        tone: 'slate',
      },
      {
        label: 'Partidas en curso',
        value: gameTotals.inProgress,
        hint: gameTotals.inProgress > 0 ? 'Seguimiento activo ahora' : 'Sin partidas activas',
        icon: Radar,
        tone: 'emerald',
      },
      {
        label: 'Partidas finalizadas',
        value: gameTotals.finished,
        hint: gameTotals.finished > 0 ? 'Historico disponible' : 'Aun sin cierre',
        icon: Trophy,
        tone: 'amber',
      },
      {
        label: 'Alertas recientes',
        value: incidentCount,
        hint: incidentCount > 0 ? 'Revisar acusaciones y bloqueos' : 'Sin alertas visibles',
        icon: ShieldAlert,
        tone: incidentCount > 0 ? 'rose' : 'slate',
      },
    ],
    [gameTotals.finished, gameTotals.inProgress, gameTotals.pending, incidentCount, readyTeamsCount, teams.length]
  );

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

  const spotlightGame = activeGames[0] ?? sortedGames[0] ?? null;
  const spotlightTournament = activeTournaments[0] ?? tournaments[0] ?? null;

  const activityByGame = useMemo(() => {
    const next = new Map<string, ActivityEvent>();

    for (const event of activity) {
      if (!event.partidaId || next.has(event.partidaId)) continue;
      next.set(event.partidaId, event);
    }

    return next;
  }, [activity]);

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_30%),radial-gradient(circle_at_82%_0%,_rgba(251,191,36,0.12),_transparent_22%),linear-gradient(180deg,_#08111d_0%,_#050914_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="relative overflow-hidden px-1 py-4">
          <div className="absolute -left-16 top-0 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute right-10 top-4 h-36 w-36 rounded-full bg-amber-300/10 blur-3xl" />

          <div className="relative max-w-4xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" />
              Centro de mando admin
            </div>

            <div className="space-y-3">
              <h1 className="font-serif text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Panel de control del evento
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base lg:text-lg lg:leading-8">
                Supervisa partidas, torneos y equipos desde un mismo tablero con lectura rapida,
                prioridad operativa y accesos directos a las acciones clave.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/partidas/nueva"
                className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-cyan-200"
              >
                Nueva partida
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/admin/torneos/nueva"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-emerald-200"
              >
                Nuevo torneo
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/ranking"
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.09]"
              >
                Ver ranking
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {kpis.map((kpi) => (
                <DashboardMetricCard key={kpi.label} metric={kpi} />
              ))}
            </div>
          </div>
        </header>

        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(7,11,22,0.98))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.38)] sm:p-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-500">
                <CalendarDays className="h-4 w-4" />
                <p className="text-xs uppercase tracking-[0.24em]">Pulso operativo</p>
              </div>
              <p className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                {gameTotals.inProgress > 0
                  ? `${gameTotals.inProgress} partidas en seguimiento`
                  : 'Sin partidas en curso'}
              </p>
            </div>

            <div className="text-sm text-slate-400">
              <p className="font-medium text-white">{initialEmail ?? 'Admin'}</p>
              <p className="mt-1">{formatRelativeUpdate(lastUpdatedMs, clockMs)}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PulseCard label="Ultima sincronizacion" value={formatRelativeUpdate(lastUpdatedMs, clockMs)} tone="cyan" />
            <PulseCard label="Torneos activos" value={`${tournamentKpis.active}`} tone="emerald" />
            <PulseCard label="Equipos listos" value={`${readyTeamsCount}`} tone="slate" />
            <PulseCard
              label="Alertas"
              value={incidentCount > 0 ? `${incidentCount} recientes` : 'Sin bloqueos'}
              tone={incidentCount > 0 ? 'amber' : 'slate'}
            />
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <article className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Partida destacada</p>
                {spotlightGame ? <GameStatusBadge estado={spotlightGame.estado} /> : null}
              </div>

              {spotlightGame ? (
                <>
                  <p className="mt-4 text-2xl font-semibold text-white">{spotlightGame.nombre}</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Turno {spotlightGame.turnoActual} · {spotlightGame.equipos.length} equipos
                  </p>
                  <Link
                    href={`/admin/partidas/${spotlightGame.id}`}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 transition-colors hover:text-cyan-200"
                  >
                    Abrir detalle
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </>
              ) : (
                <p className="mt-4 text-sm leading-6 text-slate-400">
                  El tablero mostrara aqui la partida que requiera atencion inmediata.
                </p>
              )}
            </article>

            <article className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Torneo foco</p>
                {spotlightTournament ? <TournamentStatusBadge status={spotlightTournament.status} /> : null}
              </div>

              {spotlightTournament ? (
                <>
                  <p className="mt-4 text-2xl font-semibold text-white">{spotlightTournament.name}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <FormatBadge format={spotlightTournament.format} />
                    <span className="text-xs text-slate-500">
                      {spotlightTournament.teamCount} equipos · {formatShortDate(spotlightTournament.createdAt)}
                    </span>
                  </div>
                  <Link
                    href={`/admin/torneos/${spotlightTournament.id}`}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 transition-colors hover:text-emerald-200"
                  >
                    Ir al torneo
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </>
              ) : (
                <p className="mt-4 text-sm leading-6 text-slate-400">
                  Crea un torneo cuando quieras abrir una competicion con seguimiento propio.
                </p>
              )}
            </article>
          </div>
        </section>

        {loadError ? (
          <div className="rounded-[24px] border border-red-400/25 bg-red-500/10 px-5 py-4 text-sm text-red-100 shadow-[0_18px_50px_rgba(127,29,29,0.2)]">
            {loadError}
          </div>
        ) : null}

        {actionError ? (
          <div className="rounded-[24px] border border-red-400/25 bg-red-500/10 px-5 py-4 text-sm text-red-100 shadow-[0_18px_50px_rgba(127,29,29,0.2)]">
            {actionError}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(7,11,22,0.98))] shadow-[0_24px_70px_rgba(2,6,23,0.38)]">
          <div className="border-b border-white/10 px-6 py-5">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">Seguimiento en vivo</p>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">Operacion en curso</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Vista rapida de las partidas y competiciones que requieren seguimiento inmediato.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/admin/partidas"
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/[0.09]"
                >
                  Ver partidas
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/admin/torneos"
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/[0.09]"
                >
                  Ver torneos
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">Partidas activas</h3>
                  <p className="text-sm text-slate-400">Lo que esta pasando ahora mismo.</p>
                </div>
                <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-slate-300">
                  {activeGames.length} activas
                </Badge>
              </div>

              {activeGames.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-white/10 bg-slate-950/30 px-4 py-6 text-sm text-slate-500">
                  No hay partidas activas en este momento.
                </div>
              ) : (
                <ul className="space-y-3">
                  {activeGames.map((game) => (
                    <li
                      key={game.id}
                      className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(8,13,24,0.9))] px-4 py-4 transition-transform hover:-translate-y-0.5"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{game.nombre}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Turno {game.turnoActual} · {game.equipos.length} equipos
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <GameStatusBadge estado={game.estado} />
                          <Badge variant="secondary" className="border-white/10 bg-white/[0.05] text-slate-200">
                            {MODE_LABELS[game.modoEjecucion]}
                          </Badge>
                          <Link
                            href={`/admin/partidas/${game.id}`}
                            aria-label={`Gestionar partida ${game.nombre}`}
                            title={`Gestionar partida ${game.nombre}`}
                            className="rounded-full border border-white/12 bg-white/[0.05] p-2 text-slate-200 transition-colors hover:bg-white/[0.09]"
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">Torneos activos</h3>
                  <p className="text-sm text-slate-400">Competiciones abiertas y en seguimiento.</p>
                </div>
                <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-slate-300">
                  {activeTournaments.length} activos
                </Badge>
              </div>

              {activeTournaments.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-white/10 bg-slate-950/30 px-4 py-6 text-sm text-slate-500">
                  No hay torneos activos por ahora.
                </div>
              ) : (
                <ul className="space-y-3">
                  {activeTournaments.map((torneo) => (
                    <li
                      key={torneo.id}
                      className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(8,13,24,0.9))] px-4 py-4 transition-transform hover:-translate-y-0.5"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                            className="rounded-full border border-white/12 bg-white/[0.05] p-2 text-slate-200 transition-colors hover:bg-white/[0.09]"
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(7,11,22,0.98))] shadow-[0_24px_70px_rgba(2,6,23,0.38)]">
          <div className="border-b border-white/10 px-6 py-5">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Mesa de operaciones</p>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">Partidas activas y pendientes</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Prioridad operativa: en curso, pendientes y despues finalizadas.
                </p>
              </div>
              <Link
                href="/admin/partidas"
                aria-label="Gestion de partidas"
                title="Gestion de partidas"
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/[0.09]"
              >
                Gestion completa
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {sortedGames.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-400">No hay partidas creadas.</div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-white/10 text-slate-500">
                    <tr>
                      <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.22em]">Partida</th>
                      <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.22em]">Equipos</th>
                      <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.22em]">Estado</th>
                      <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.22em]">Turno</th>
                      <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.22em]">Ultimo evento</th>
                      <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.22em]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedGames.map((game) => {
                      const isActing = actingGameId === game.id;
                      const teamNames = game.equipos.map((team) => team.equipoNombre).join(', ');
                      const lastEvent = activityByGame.get(game.id);

                      return (
                        <tr key={game.id} className="border-b border-white/8 align-top transition-colors hover:bg-white/[0.03]">
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <p className="font-semibold text-white">{game.nombre}</p>
                              <p className="text-xs text-slate-500">{game.id.slice(0, 8)}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-300">
                            <div className="max-w-sm">
                              <p className="line-clamp-2">{teamNames}</p>
                              <p className="mt-1 text-xs text-slate-500">{game.equipos.length} equipos</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <GameStatusBadge estado={game.estado} />
                              {game.estado === 'en_curso' ? (
                                <Badge variant="secondary" className="border-white/10 bg-white/[0.05] text-slate-200">
                                  {MODE_LABELS[game.modoEjecucion]}
                                </Badge>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-300">
                            <p>{game.turnoActual}</p>
                            {game.maxTurnos ? <p className="mt-1 text-xs text-slate-500">de {game.maxTurnos}</p> : null}
                          </td>
                          <td className="px-6 py-4 text-slate-300">
                            {lastEvent ? (
                              <div className="max-w-sm">
                                <p className="line-clamp-2">{lastEvent.descripcion}</p>
                                <p className="mt-1 text-xs text-slate-500">{formatEventTime(lastEvent.timestampMs, clockMs)}</p>
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
                                className="rounded-full border border-white/12 bg-white/[0.05] p-2 text-slate-200 transition-colors hover:bg-white/[0.09]"
                              >
                                <ArrowUpRight className="h-4 w-4" />
                              </Link>
                              {game.estado === 'pendiente' ? (
                                <button
                                  onClick={() => {
                                    void doGameAction(game.id, 'start', { modo: 'manual' });
                                  }}
                                  aria-label={`Iniciar partida ${game.nombre}`}
                                  title={`Iniciar partida ${game.nombre}`}
                                  disabled={isActing}
                                  className="rounded-full bg-emerald-300 p-2 text-slate-950 transition-colors hover:bg-emerald-200 disabled:opacity-50"
                                >
                                  {isActing ? '...' : <Play className="h-4 w-4" />}
                                </button>
                              ) : null}
                              {game.estado === 'en_curso' ? (
                                <button
                                  onClick={() => {
                                    if (window.confirm('Finalizar manualmente esta partida?')) {
                                      void doGameAction(game.id, 'stop');
                                    }
                                  }}
                                  aria-label={`Finalizar partida ${game.nombre}`}
                                  title={`Finalizar partida ${game.nombre}`}
                                  disabled={isActing}
                                  className="rounded-full bg-rose-400 p-2 text-white transition-colors hover:bg-rose-300 disabled:opacity-50"
                                >
                                  {isActing ? '...' : <Square className="h-4 w-4" />}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
                <p>
                  Mostrando {Math.min((safeGamesPage - 1) * GAMES_PER_PAGE + 1, sortedGames.length)}-
                  {Math.min(safeGamesPage * GAMES_PER_PAGE, sortedGames.length)} de {sortedGames.length} partidas
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setGamesPage((page) => Math.max(1, page - 1))}
                    disabled={safeGamesPage === 1}
                    className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.09] disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="min-w-24 text-center text-xs text-slate-500">
                    Pagina {safeGamesPage} de {totalGamesPages}
                  </span>
                  <button
                    onClick={() => setGamesPage((page) => Math.min(totalGamesPages, page + 1))}
                    disabled={safeGamesPage === totalGamesPages}
                    className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.09] disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Roster del evento</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Equipos y agentes</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Gestiona disponibilidad, ownership y configuracion de agentes sin salir del panel principal.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/users"
                className="inline-flex items-center gap-2 self-start rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/[0.09]"
              >
                Gestion de usuarios
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                href="/admin/equipos"
                className="inline-flex items-center gap-2 self-start rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/[0.09]"
              >
                Abrir modulo
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <AdminTeamsSection initialTeams={teams} />
        </section>

        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(7,11,22,0.98))] shadow-[0_24px_70px_rgba(2,6,23,0.38)]">
          <div className="border-b border-white/10 px-6 py-5">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">Mapa de torneos</p>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">Torneos</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Estado de los torneos configurados y acceso directo a su gestion.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/admin/torneos"
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/[0.09]"
                >
                  Gestion de torneos
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/admin/torneos/nueva"
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-emerald-200"
                >
                  Nuevo torneo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-b border-white/10 px-6 py-5 md:grid-cols-3">
            <article className="rounded-[24px] border border-emerald-300/15 bg-emerald-300/[0.06] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-100">Activos</p>
              <p className="mt-3 text-3xl font-semibold text-white">{tournamentKpis.active}</p>
              <p className="mt-1 text-sm text-emerald-100/75">Torneos en ejecucion</p>
            </article>
            <article className="rounded-[24px] border border-amber-300/15 bg-amber-300/[0.06] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-amber-100">Borradores</p>
              <p className="mt-3 text-3xl font-semibold text-white">{tournamentKpis.draft}</p>
              <p className="mt-1 text-sm text-amber-100/75">Configurados pero sin iniciar</p>
            </article>
            <article className="rounded-[24px] border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-100">Finalizados</p>
              <p className="mt-3 text-3xl font-semibold text-white">{tournamentKpis.finished}</p>
              <p className="mt-1 text-sm text-cyan-100/75">Historico cerrado</p>
            </article>
          </div>

          {tournaments.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-400">No hay torneos creados.</div>
          ) : (
            <ul className="space-y-3 px-6 py-5">
              {tournaments.slice(0, 5).map((torneo) => (
                <li
                  key={torneo.id}
                  className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-white">{torneo.name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <FormatBadge format={torneo.format} />
                      <TournamentStatusBadge status={torneo.status} />
                      <span className="text-xs text-slate-500">
                        {torneo.teamCount} equipos · {formatShortDate(torneo.createdAt)}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/admin/torneos/${torneo.id}`}
                    aria-label={`Gestionar torneo ${torneo.name}`}
                    title={`Gestionar torneo ${torneo.name}`}
                    className="shrink-0 rounded-full border border-white/12 bg-white/[0.05] p-2 text-slate-200 transition-colors hover:bg-white/[0.09]"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function DashboardMetricCard({ metric }: { metric: DashboardMetric }) {
  const { icon: Icon, label, value, hint, tone } = metric;
  const toneClasses = METRIC_TONE_CLASSES[tone];

  return (
    <article className={cn('rounded-[24px] border p-4 backdrop-blur-sm', toneClasses.card)}>
      <div className="flex items-center gap-3">
        <span className={cn('inline-flex h-11 w-11 items-center justify-center rounded-2xl border', toneClasses.icon)}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
        </div>
      </div>
      <p className={cn('mt-3 text-sm', toneClasses.hint)}>{hint}</p>
    </article>
  );
}

function PulseCard({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: string;
  tone?: Exclude<MetricTone, 'rose'>;
}) {
  const toneClass =
    tone === 'cyan'
      ? 'border-cyan-300/16 bg-cyan-300/[0.06] text-cyan-100'
      : tone === 'emerald'
        ? 'border-emerald-300/16 bg-emerald-300/[0.06] text-emerald-100'
        : tone === 'amber'
          ? 'border-amber-300/16 bg-amber-300/[0.06] text-amber-100'
          : 'border-white/8 bg-white/[0.03] text-white';

  const valueClass =
    tone === 'slate'
      ? 'text-white'
      : tone === 'amber'
        ? 'text-amber-100'
        : tone === 'emerald'
          ? 'text-emerald-100'
          : 'text-cyan-100';

  return (
    <div className={cn('rounded-2xl border px-4 py-3', toneClass)}>
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className={cn('mt-2 text-sm font-semibold', valueClass)}>{value}</p>
    </div>
  );
}
