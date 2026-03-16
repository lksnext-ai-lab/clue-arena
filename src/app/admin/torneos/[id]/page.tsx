'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, CalendarDays, Play, ShieldAlert, Sparkles, Swords, Trash2, Trophy, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api/client';
import type { TournamentDetailResponse } from '@/types/api';
import { FormatBadge, TournamentStatusBadge } from '@/components/admin/TournamentStatusBadge';
import { TournamentRoundsSection } from '@/components/admin/TournamentRoundsSection';
import { TournamentStandingsSection } from '@/components/admin/TournamentStandingsSection';
import { TournamentTeamsSection } from '@/components/admin/TournamentTeamsSection';

type Tab = 'teams' | 'rounds' | 'standings';

function formatDate(value: string | null, locale: string, fallback: string) {
  if (!value) return fallback;
  const languageTag = locale === 'eu' ? 'eu-ES' : 'es-ES';
  return new Intl.DateTimeFormat(languageTag, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function AdminTorneoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations('admin');
  const locale = useLocale();

  const [tournament, setTournament] = useState<TournamentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('teams');
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<TournamentDetailResponse>(`/tournaments/${id}`);
      setTournament(data);
      setPageError(null);
    } catch {
      setPageError(t('torneoErrorCargar'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
    void load();
  }, [load]);

  const handleAction = async (action: 'start' | 'finish', confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;

    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/tournaments/${id}/${action}`, { method: 'POST' });
      handleRefresh();
      if (action === 'start') setActiveTab('rounds');
      if (action === 'finish') setActiveTab('standings');
    } catch {
      setActionError(action === 'start' ? t('torneoErrorIniciar') : t('torneoErrorFinalizar'));
    } finally {
      setActing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('torneoDeleteConfirm'))) return;

    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/tournaments/${id}`, { method: 'DELETE' });
      window.location.href = '/admin/torneos';
    } catch {
      setActionError(t('torneoErrorCargar'));
      setActing(false);
    }
  };

  const tabLabels: Record<Tab, string> = useMemo(
    () => ({
      teams: t('torneoEquipos'),
      rounds: t('torneoRondas'),
      standings: t('torneoClasificacion'),
    }),
    [t]
  );

  if (loading && !tournament) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#08111d_0%,#050914_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-8">
            <p className="text-sm text-slate-400">{t('torneoCargando')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (pageError && !tournament) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#08111d_0%,#050914_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {pageError}
          </p>
          <Link href="/admin/torneos" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <ArrowLeft size={16} />
            {t('gestionTorneos')}
          </Link>
        </div>
      </div>
    );
  }

  if (!tournament) return null;

  const getTournamentPulse = (value: TournamentDetailResponse) => {
    if (value.status === 'active') return t('torneoPulseActive');
    if (value.status === 'finished') return t('torneoPulseFinished');
    return t('torneoPulseDraft');
  };

  const activeRound = tournament.rounds.find((round) => round.status === 'active') ?? null;
  const completedRounds = tournament.rounds.filter((round) => round.status === 'finished').length;
  const totalGames = tournament.rounds.reduce((acc, round) => acc + round.games.filter((game) => !game.isBye).length, 0);
  const eliminatedTeams = tournament.teams.filter((team) => team.eliminated).length;

  const statCards = [
    {
      label: t('torneoStatTeamsLabel'),
      value: tournament.teams.length,
      detail: eliminatedTeams > 0
        ? t('torneoStatTeamsDetailEliminated', { count: eliminatedTeams })
        : t('torneoStatTeamsDetailIntact'),
      icon: Users,
      tone: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
    },
    {
      label: t('torneoStatRoundsLabel'),
      value: tournament.rounds.length,
      detail: t('torneoStatRoundsDetail', { count: completedRounds }),
      icon: Swords,
      tone: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    },
    {
      label: t('torneoStatGamesLabel'),
      value: totalGames,
      detail: activeRound
        ? t('torneoStatGamesDetailActive', { round: activeRound.roundNumber })
        : t('torneoStatGamesDetailNone'),
      icon: BarChart3,
      tone: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    },
    {
      label: t('torneoStatStatusLabel'),
      value: getTournamentPulse(tournament),
      detail: tournament.finishedAt
        ? t('torneoStatStatusDetailFinished', {
            date: formatDate(tournament.finishedAt, locale, t('tournamentDateUnknown')),
          })
        : t('torneoStatStatusDetailCreated', {
            date: formatDate(tournament.createdAt, locale, t('tournamentDateUnknown')),
          }),
      icon: Trophy,
      tone: 'border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-100',
    },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_24%),linear-gradient(180deg,_#08111d_0%,_#050914_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link href="/admin/torneos" className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
            <ArrowLeft size={16} />
            {t('gestionTorneos')}
          </Link>
        </div>

        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(7,11,22,0.98))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.48)] sm:p-8">
          <div className="absolute -left-12 top-8 h-40 w-40 rounded-full bg-emerald-300/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-56 w-56 bg-[radial-gradient(circle,_rgba(250,204,21,0.16),_transparent_68%)]" />

          <div className="relative grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-200">
                  <Sparkles size={14} />
                  {t('torneoCommandCenterEyebrow')}
                </span>
                <FormatBadge format={tournament.format} />
                <TournamentStatusBadge status={tournament.status} />
              </div>

              <div className="space-y-3">
                <h1 className="font-serif text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  {tournament.name}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  {t('torneoHeroDesc')}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {statCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className={`rounded-[24px] border p-4 ${card.tone}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.22em]">{card.label}</p>
                        <Icon size={16} />
                      </div>
                      <p className="mt-4 text-2xl font-semibold text-white">{card.value}</p>
                      <p className="mt-2 text-sm text-current/80">{card.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="rounded-[28px] border border-white/10 bg-slate-950/45 p-5 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('torneoPulseLabel')}</p>
                  <p className="mt-2 text-xl font-semibold text-white">{getTournamentPulse(tournament)}</p>
                </div>
                <CalendarDays size={18} className="text-slate-500" />
              </div>

              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('torneoPulseCreatedLabel')}</p>
                  <p className="mt-2 text-white">{formatDate(tournament.createdAt, locale, t('tournamentDateUnknown'))}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('torneoPulseStartLabel')}</p>
                  <p className="mt-2 text-white">{formatDate(tournament.startedAt, locale, t('tournamentDateUnknown'))}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('torneoPulseActiveRoundLabel')}</p>
                  <p className="mt-2 text-white">
                    {activeRound ? t('torneoRonda', { n: activeRound.roundNumber }) : t('torneoPulseNoActiveRound')}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3">
                {tournament.status === 'draft' ? (
                  <>
                    <button
                      onClick={() => handleAction('start')}
                      disabled={acting || tournament.teams.length < 2}
                      title={tournament.teams.length < 2 ? t('torneoMinTeamsHint') : undefined}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Play size={16} />
                      {acting ? '…' : t('torneoIniciar')}
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={acting}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-100 transition-colors hover:bg-red-400/20 disabled:opacity-60"
                    >
                      <Trash2 size={16} />
                      {t('torneoEliminar')}
                    </button>
                  </>
                ) : null}

                {tournament.status === 'active' ? (
                  <button
                    onClick={() => handleAction('finish', t('torneoFinishConfirm'))}
                    disabled={acting}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-amber-200 disabled:opacity-60"
                  >
                    <ShieldAlert size={16} />
                    {acting ? '…' : t('torneoFinalizar')}
                  </button>
                ) : null}
              </div>

              {actionError ? (
                <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {actionError}
                </p>
              ) : null}
            </aside>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(7,11,22,0.98))] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('torneoWorkspaceEyebrow')}</p>
              <p className="mt-2 text-lg font-semibold text-white">{t('torneoWorkspaceTitle')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(tabLabels) as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-white text-slate-950 shadow-[0_10px_30px_rgba(255,255,255,0.16)]'
                      : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                  }`}
                >
                  {tabLabels[tab]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            {activeTab === 'teams' ? (
              <TournamentTeamsSection
                tournamentId={id}
                status={tournament.status}
                teams={tournament.teams}
                onRefresh={handleRefresh}
              />
            ) : null}

            {activeTab === 'rounds' ? (
              <TournamentRoundsSection
                tournamentId={id}
                tournamentStatus={tournament.status}
                rounds={tournament.rounds}
                refreshKey={refreshKey}
                onRefresh={handleRefresh}
              />
            ) : null}

            {activeTab === 'standings' ? (
              <TournamentStandingsSection tournamentId={id} refreshKey={refreshKey} />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
