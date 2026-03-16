'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Crosshair,
  Search,
  ShieldAlert,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CreateGameSchema, type CreateGameInput } from '@/lib/schemas/game';
import { apiFetch } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import type { TeamResponse, GameResponse } from '@/types/api';

type TeamFilter = 'all' | 'ready' | 'missing-agent';

const TURN_PRESETS = [24, 40, 60];

/**
 * UI-007 — Crear partida (Admin)
 *
 * Rediseñada para priorizar:
 *  1. Lectura rápida del estado de la convocatoria.
 *  2. Selección de equipos con feedback inmediato.
 *  3. Prevención visual de errores antes de crear la partida.
 */
export default function NuevaPartidaPage() {
  const t = useTranslations('admin');
  const router = useRouter();
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateGameInput>({
    resolver: zodResolver(CreateGameSchema),
    defaultValues: { nombre: '', equipoIds: [], maxTurnos: null },
  });

  useEffect(() => {
    apiFetch<{ teams: TeamResponse[] }>('/teams')
      .then((data) => setTeams(data.teams))
      .catch(() => setServerError(t('newGameLoadTeamsError')))
      .finally(() => setLoadingTeams(false));
  }, [t]);

  const toggleTeam = (id: string) => {
    setServerError(null);
    setSelectedTeams((prev) => {
      let next: string[];

      if (prev.includes(id)) {
        next = prev.filter((teamId) => teamId !== id);
      } else if (prev.length >= 6) {
        next = prev;
      } else {
        next = [...prev, id];
      }

      setValue('equipoIds', next, { shouldValidate: true, shouldDirty: true });
      return next;
    });
  };

  const onSubmit = async (data: CreateGameInput) => {
    if (selectedTeams.length < 2) {
      setServerError(t('newGameMinTeamsError'));
      return;
    }

    setServerError(null);
    const normalizedMaxTurnos =
      typeof data.maxTurnos === 'number' && Number.isFinite(data.maxTurnos) ? data.maxTurnos : null;

    try {
      const game = await apiFetch<GameResponse>('/games', {
        method: 'POST',
        body: JSON.stringify({ ...data, equipoIds: selectedTeams, maxTurnos: normalizedMaxTurnos }),
      });

      router.push(`/admin/partidas/${game.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('newGameCreateError');
      setServerError(message);
    }
  };

  const nombre = watch('nombre');
  const maxTurnos = watch('maxTurnos');
  const activeTeams = teams.filter((team) => team.estado === 'activo');
  const inactiveTeams = teams.filter((team) => team.estado !== 'activo');
  const readyTeams = activeTeams.filter((team) => Boolean(team.agentId?.trim()));
  const filteredTeams = activeTeams.filter((team) => {
    const matchesQuery =
      query.trim().length === 0 ||
      team.nombre.toLowerCase().includes(query.toLowerCase()) ||
      team.id.toLowerCase().includes(query.toLowerCase()) ||
      team.agentId.toLowerCase().includes(query.toLowerCase());

    if (!matchesQuery) return false;
    if (teamFilter === 'ready') return Boolean(team.agentId?.trim());
    if (teamFilter === 'missing-agent') return !team.agentId?.trim();
    return true;
  });

  const selectedTeamDetails = selectedTeams
    .map((id) => teams.find((team) => team.id === id))
    .filter((team): team is TeamResponse => Boolean(team));

  const teamsWithoutAgent = selectedTeamDetails.filter((team) => !team.agentId?.trim());
  const missingToMinimum = Math.max(0, 2 - selectedTeams.length);
  const remainingSlots = Math.max(0, 6 - selectedTeams.length);
  const canSubmit = !isSubmitting && selectedTeams.length >= 2;

  const selectionMessage =
    selectedTeams.length === 0
      ? t('newGameSelectionEmpty')
      : missingToMinimum > 0
        ? t('newGameSelectionMissingMinimum', { count: missingToMinimum })
        : remainingSlots === 0
          ? t('newGameSelectionMax')
          : t('newGameSelectionValid', { count: remainingSlots });

  return (
    <div
      className="min-h-screen px-4 py-8 text-slate-100 sm:px-6 lg:px-8"
      style={{ background: 'radial-gradient(circle at top, #17324c 0%, #08111d 46%, #05080d 100%)' }}
    >
      <div className="mx-auto max-w-7xl space-y-8">
        <section
          className="relative overflow-hidden rounded-[2rem] border px-6 py-7 shadow-[0_30px_90px_rgba(2,6,23,0.48)] sm:px-8"
          style={{
            borderColor: 'rgba(148, 163, 184, 0.16)',
            background:
              'linear-gradient(145deg, rgba(8,17,29,0.96), rgba(15,23,42,0.92) 52%, rgba(30,41,59,0.88) 100%)',
          }}
        >
          <div
            className="absolute -right-10 top-0 h-52 w-52 rounded-full blur-3xl"
            style={{ background: 'rgba(34, 211, 238, 0.14)' }}
          />
          <div
            className="absolute bottom-0 left-10 h-40 w-40 rounded-full blur-3xl"
            style={{ background: 'rgba(250, 204, 21, 0.1)' }}
          />

          <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <button
                type="button"
                onClick={() => router.push('/admin/partidas')}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300 transition-colors hover:bg-white/[0.08]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t('newGameBack')}
              </button>

              <div className="mt-5 space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('newGameEyebrow')}
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {t('newGameTitle')}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  {t('newGameDesc')}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[34rem]">
              <MetricCard
                icon={<Users className="h-4 w-4" />}
                label={t('newGameMetricActive')}
                value={activeTeams.length}
                hint={t('newGameMetricActiveHint')}
              />
              <MetricCard
                icon={<Check className="h-4 w-4" />}
                label={t('newGameMetricReady')}
                value={readyTeams.length}
                hint={t('newGameMetricReadyHint')}
                accent="cyan"
              />
              <MetricCard
                icon={<ShieldAlert className="h-4 w-4" />}
                label={t('newGameMetricInactive')}
                value={inactiveTeams.length}
                hint={t('newGameMetricInactiveHint')}
                accent="amber"
              />
            </div>
          </div>
        </section>

        {serverError && (
          <div className="rounded-[1.5rem] border border-red-400/25 bg-red-500/10 px-5 py-4 text-sm text-red-100 shadow-[0_18px_50px_rgba(127,29,29,0.2)]">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_24rem]">
          <section
            className="rounded-[2rem] border p-6 shadow-[0_24px_70px_rgba(2,6,23,0.38)] sm:p-7"
            style={{
              borderColor: 'rgba(148, 163, 184, 0.14)',
              background: 'linear-gradient(145deg, rgba(8,17,29,0.94), rgba(15,23,42,0.9))',
            }}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-100">{t('newGameNameLabel')}</label>
                <input
                  {...register('nombre')}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                  placeholder={t('newGameNamePlaceholder')}
                  autoFocus
                />
                {errors.nombre && <p className="text-xs text-red-300">{errors.nombre.message}</p>}
                <p className="text-xs text-slate-400">
                  {t('newGameNameHint')}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('newGamePreviewLabel')}</p>
                <p className="mt-3 text-xl font-semibold text-white">{nombre?.trim() || t('newGamePreviewUntitled')}</p>
                <p className="mt-2 text-sm text-slate-400">
                  {selectedTeams.length > 0
                    ? t('newGamePreviewTeamsSelected', { count: selectedTeams.length })
                    : t('newGamePreviewTeamsEmpty')}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <label className="text-sm font-semibold text-slate-100">{t('newGameTurnLimitLabel')}</label>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    {t('newGameTurnLimitDesc')}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setValue('maxTurnos', null, { shouldDirty: true, shouldValidate: true })}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors',
                      maxTurnos == null
                        ? 'border-cyan-300/40 bg-cyan-400/12 text-cyan-200'
                        : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
                    )}
                  >
                    {t('newGameNoLimit')}
                  </button>
                  {TURN_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setValue('maxTurnos', preset, { shouldDirty: true, shouldValidate: true })}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors',
                        maxTurnos === preset
                          ? 'border-cyan-300/40 bg-cyan-400/12 text-cyan-200'
                          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
                      )}
                    >
                      {t('newGameTurnsPreset', { count: preset })}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 max-w-sm">
                <input
                  type="number"
                  min={1}
                  value={maxTurnos ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    setValue('maxTurnos', value === '' ? null : parseInt(value, 10), {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                  placeholder={t('newGameNoLimit')}
                />
                {errors.maxTurnos && <p className="mt-2 text-xs text-red-300">{errors.maxTurnos.message}</p>}
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {t('newGameTurnLimitHint')}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">{t('newGameSelectTeamsTitle')}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {t('newGameSelectTeamsDesc')}
                  </p>
                </div>

                <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300">
                  {t('newGameSelectedCount', { count: selectedTeams.length })}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 py-3 pl-11 pr-4 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                    placeholder={t('newGameSearchPlaceholder')}
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <FilterChip
                    active={teamFilter === 'all'}
                    onClick={() => setTeamFilter('all')}
                    label={t('newGameFilterAll', { count: activeTeams.length })}
                  />
                  <FilterChip
                    active={teamFilter === 'ready'}
                    onClick={() => setTeamFilter('ready')}
                    label={t('newGameFilterReady', { count: readyTeams.length })}
                  />
                  <FilterChip
                    active={teamFilter === 'missing-agent'}
                    onClick={() => setTeamFilter('missing-agent')}
                    label={t('newGameFilterMissingAgent', { count: activeTeams.length - readyTeams.length })}
                  />
                </div>
              </div>

              {inactiveTeams.length > 0 ? (
                <p className="text-xs text-amber-200/80">
                  {t('newGameInactiveHint', { count: inactiveTeams.length })}
                </p>
              ) : null}

              {errors.equipoIds && <p className="text-xs text-red-300">{errors.equipoIds.message}</p>}

              {loadingTeams ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-32 animate-pulse rounded-[1.5rem] bg-white/[0.05]" />
                  ))}
                </div>
              ) : activeTeams.length === 0 ? (
                <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center">
                  <p className="text-lg font-semibold text-white">{t('newGameEmptyNoActiveTitle')}</p>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
                    {t('newGameEmptyNoActiveDesc')}
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/admin/equipos')}
                    className="mt-5 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300"
                  >
                    {t('newGameGoTeams')}
                  </button>
                </div>
              ) : filteredTeams.length === 0 ? (
                <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center text-sm text-slate-400">
                  {t('newGameNoResults')}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {filteredTeams.map((team) => {
                    const selected = selectedTeams.includes(team.id);
                    const disabledByMax = !selected && selectedTeams.length >= 6;
                    const noAgent = !team.agentId?.trim();
                    const selectionOrder = selectedTeams.indexOf(team.id);

                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => toggleTeam(team.id)}
                        disabled={disabledByMax}
                        className={cn(
                          'group rounded-[1.5rem] border p-4 text-left transition-all duration-200',
                          'disabled:cursor-not-allowed disabled:opacity-45',
                          selected
                            ? 'border-cyan-300/35 bg-cyan-400/10 shadow-[0_20px_50px_rgba(8,145,178,0.15)]'
                            : noAgent
                              ? 'border-amber-400/20 bg-amber-400/5 hover:bg-amber-400/10'
                              : 'border-white/10 bg-white/[0.03] hover:border-cyan-300/20 hover:bg-white/[0.05]'
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'flex h-11 w-11 items-center justify-center rounded-2xl border text-sm font-semibold',
                                selected
                                  ? 'border-cyan-300/30 bg-cyan-400/14 text-cyan-100'
                                  : 'border-white/10 bg-slate-950/60 text-slate-200'
                              )}
                            >
                              {team.nombre.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-base font-semibold text-white">{team.nombre}</p>
                              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{team.id}</p>
                            </div>
                          </div>

                          {selected ? (
                            <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-400/14 px-2 text-xs font-semibold text-cyan-100">
                              {selectionOrder + 1}
                            </span>
                          ) : (
                            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {noAgent ? t('newGameCardNeedsReview') : t('newGameCardAvailable')}
                            </span>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                          <StatusPill
                            icon={noAgent ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                            label={noAgent ? t('newGameStatusNoAgent') : t('newGameStatusReady')}
                            tone={noAgent ? 'amber' : 'emerald'}
                          />
                          <StatusPill
                            icon={<Swords className="h-3.5 w-3.5" />}
                            label={selected ? t('newGameStatusOnTable') : t('newGameStatusOffTable')}
                            tone={selected ? 'cyan' : 'slate'}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <section
              className="rounded-[2rem] border p-6 shadow-[0_24px_70px_rgba(2,6,23,0.38)]"
              style={{
                borderColor: 'rgba(148, 163, 184, 0.14)',
                background: 'linear-gradient(145deg, rgba(8,17,29,0.94), rgba(15,23,42,0.9))',
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">{t('newGameSummaryEyebrow')}</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">{t('newGameSummaryTitle')}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{selectionMessage}</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <SummaryStat label={t('newGameSummaryParticipants')} value={`${selectedTeams.length}/6`} />
                <SummaryStat label={t('newGameSummaryLimit')} value={maxTurnos ? t('newGameTurnsPreset', { count: maxTurnos }) : t('newGameNoLimit')} />
                <SummaryStat label={t('newGameSummaryRisk')} value={teamsWithoutAgent.length > 0 ? t('newGameSummaryRiskReview') : t('newGameSummaryRiskReady')} />
              </div>

              {teamsWithoutAgent.length > 0 && (
                <div className="mt-5 rounded-[1.5rem] border border-amber-300/20 bg-amber-400/8 p-4 text-sm text-amber-100">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{t('newGameWarningMissingAgent', { count: teamsWithoutAgent.length })}</p>
                  </div>
                </div>
              )}

              <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-100">{t('newGameSelectionOrder')}</p>
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('newGameSelectionOrderHint')}</span>
                </div>

                {selectedTeamDetails.length === 0 ? (
                  <div className="mt-3 rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-500">
                    {t('newGameSelectionOrderEmpty')}
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {selectedTeamDetails.map((team, index) => (
                      <div key={team.id} className="flex items-center gap-3 rounded-[1.4rem] border border-white/10 bg-white/[0.03] px-4 py-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400/12 text-sm font-semibold text-cyan-100">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{team.nombre}</p>
                          <p className="truncate text-xs text-slate-500">{team.id}</p>
                        </div>
                        <StatusPill
                          label={team.agentId?.trim() ? t('newGameSelectedTeamOk') : t('newGameSelectedTeamPending')}
                          tone={team.agentId?.trim() ? 'emerald' : 'amber'}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-cyan-300 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Crosshair className="h-4 w-4" />
                  {isSubmitting ? t('newGameSubmitCreating') : t('newGameSubmit')}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/admin/partidas')}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.07]"
                >
                  {t('cancelarCrear')}
                </button>
              </div>
            </section>
          </aside>
        </form>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  accent = 'slate',
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hint: string;
  accent?: 'slate' | 'cyan' | 'amber';
}) {
  return (
    <article
      className={cn(
        'rounded-[1.5rem] border p-4 backdrop-blur-sm',
        accent === 'cyan' && 'border-cyan-300/20 bg-cyan-300/[0.08]',
        accent === 'amber' && 'border-amber-300/20 bg-amber-300/[0.08]',
        accent === 'slate' && 'border-white/10 bg-white/[0.05]'
      )}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/15 text-cyan-200">
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{hint}</p>
    </article>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors',
        active
          ? 'border-cyan-300/35 bg-cyan-400/12 text-cyan-200'
          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
      )}
    >
      {label}
    </button>
  );
}

function StatusPill({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: 'emerald' | 'amber' | 'cyan' | 'slate';
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
        tone === 'emerald' && 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
        tone === 'amber' && 'border-amber-300/20 bg-amber-400/10 text-amber-100',
        tone === 'cyan' && 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100',
        tone === 'slate' && 'border-white/10 bg-white/[0.04] text-slate-400'
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function SummaryStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
