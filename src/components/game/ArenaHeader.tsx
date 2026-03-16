'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Activity, Gauge, RefreshCw, Sparkles, Square, TimerReset, Waves } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { apiFetch } from '@/lib/api/client';
import { useGame } from '@/contexts/GameContext';
import type { GameDetailResponse } from '@/types/api';
import type { LatestSpectatorComment } from '@/contexts/GameContext';

interface ArenaHeaderProps {
  partida: GameDetailResponse;
  isAdmin: boolean;
  isSyncing: boolean;
  onRefresh: () => void;
}

function statusBadge(estado: string, t: ReturnType<typeof useTranslations>) {
  switch (estado) {
    case 'en_curso':
      return (
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          {t('header.status.live')}
        </span>
      );
    case 'finalizada':
      return (
        <span className="rounded-full border border-slate-500/30 bg-slate-600/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
          {t('header.status.finished')}
        </span>
      );
    default:
      return (
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300">
          {t('header.status.pending')}
        </span>
      );
  }
}

export function ArenaHeader({ partida, isAdmin, isSyncing, onRefresh }: ArenaHeaderProps) {
  const t = useTranslations('arena.detail');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { activeEquipoId, latestSpectatorComment } = useGame();
  const [activeComment, setActiveComment] = useState<LatestSpectatorComment | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!latestSpectatorComment) {
      setActiveComment(null);
      return;
    }
    setActiveComment(latestSpectatorComment);
    const displayMs = Math.max(8_000, Math.min(20_000, latestSpectatorComment.text.length * 50));
    const timer = setTimeout(() => setActiveComment(null), displayMs);
    return () => clearTimeout(timer);
  }, [latestSpectatorComment]);

  async function callAction(action: string) {
    setBusy(action);
    setActionError(null);
    try {
      await apiFetch(`/games/${partida.id}/${action}`, { method: 'POST' });
      onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('header.errors.unknown');
      setActionError(msg);
      setTimeout(() => setActionError(null), 6_000);
    } finally {
      setBusy(null);
    }
  }

  async function handleStop() {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }
    setShowConfirm(false);
    await callAction('stop');
  }

  const teamName = activeEquipoId
    ? partida.equipos.find((e) => e.equipoId === activeEquipoId)?.equipoNombre ?? null
    : null;
  const isRunning = partida.estado === 'en_curso';
  const isAuto = partida.modoEjecucion === 'auto';
  const isPaused = partida.modoEjecucion === 'pausado';
  const configuredMax = partida.maxTurnos ?? null;
  const completedTurns = partida.turnos.length;
  const progressPercent = configuredMax
    ? Math.min(100, Math.round((completedTurns / configuredMax) * 100))
    : null;
  const aliveTeams = partida.equipos.filter((equipo) => !equipo.eliminado).length;
  const modeLabel = isAuto
    ? t('header.mode.auto')
    : isPaused
      ? t('header.mode.paused')
      : t('header.mode.manual');
  const isCompactAuto = isRunning && isAuto;
  const turnLabel = configuredMax !== null
    ? t('header.turnWithMax', { completedTurns, configuredMax })
    : t('header.turnOnly', { completedTurns });

  return (
    <div className="space-y-2.5">
      <div
        className={cn(
          'arena-panel arena-grid-glow arena-header-shell overflow-hidden p-3.5 sm:p-4',
          isCompactAuto && 'arena-header-shell-compact'
        )}
      >
        <div
          className={cn(
            'flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between',
            isCompactAuto && 'xl:items-center'
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200">
                {t('header.badge')}
              </span>
              {statusBadge(partida.estado, t)}
              {isSyncing && (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                  {t('header.syncing')}
                </span>
              )}
            </div>

            <div
              className={cn(
                'mt-2.5 flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between',
                isCompactAuto && 'arena-header-main-compact'
              )}
            >
              <div className="min-w-0">
                <h1
                  className={cn(
                    'truncate text-xl font-semibold tracking-tight text-white transition-all duration-500 sm:text-2xl',
                    isCompactAuto && 'text-lg sm:text-xl'
                  )}
                >
                  {partida.nombre}
                </h1>
                <p
                  className={cn(
                    'mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 transition-all duration-500 sm:text-sm',
                    isCompactAuto && 'mt-0.5 gap-x-2 text-[11px] sm:text-xs'
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    <TimerReset className="h-3.5 w-3.5 text-cyan-300" />
                    {turnLabel}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Gauge className="h-3.5 w-3.5 text-fuchsia-300" />
                    {modeLabel}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5 text-emerald-300" />
                    {t('header.teamsAlive', { count: aliveTeams })}
                  </span>
                  {teamName && (
                    <span className="inline-flex items-center gap-1 text-cyan-200">
                      <Sparkles className="h-3.5 w-3.5" />
                      {t('header.activeTurn', { teamName })}
                    </span>
                  )}
                </p>
              </div>

            </div>
          </div>

          {isAdmin && partida.estado !== 'finalizada' && (
            <div className="flex flex-wrap items-center justify-end gap-1.5 xl:max-w-sm">
              {!isAuto && !isPaused && (
                <button
                  onClick={() => callAction('run')}
                  disabled={busy === 'run'}
                  className={cn(
                    'arena-cta border-emerald-400/30 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25',
                    'disabled:opacity-50'
                  )}
                >
                  <Waves className="h-3 w-3" />
                  {t('header.actions.auto')}
                </button>
              )}
              {isAuto && (
                <button
                  onClick={() => callAction('pause')}
                  disabled={busy === 'pause'}
                  className={cn(
                    'arena-cta border-amber-400/30 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25',
                    'disabled:opacity-50'
                  )}
                >
                  ⏸ {t('header.actions.pause')}
                </button>
              )}
              {isPaused && (
                <button
                  onClick={() => callAction('resume')}
                  disabled={busy === 'resume'}
                  className={cn(
                    'arena-cta border-cyan-400/30 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/25',
                    'disabled:opacity-50'
                  )}
                >
                  ▶ {t('header.actions.resume')}
                </button>
              )}
              {(isPaused || partida.modoEjecucion === 'manual') && isRunning && (
                <button
                  onClick={() => callAction('advance-turn')}
                  disabled={busy === 'advance-turn'}
                  className={cn(
                    'arena-cta border-slate-400/20 bg-slate-400/10 text-slate-100 hover:bg-slate-400/20',
                    'disabled:opacity-50'
                  )}
                >
                  ⏭ {t('header.actions.advance')}
                </button>
              )}
              <button
                onClick={handleStop}
                disabled={busy === 'stop'}
                className={cn(
                  'arena-cta',
                  showConfirm
                    ? 'border-red-300/50 bg-red-400/25 text-red-100 shadow-[0_0_22px_rgba(248,113,113,0.25)]'
                    : 'border-red-400/30 bg-red-400/12 text-red-200 hover:bg-red-400/22',
                  'disabled:opacity-50'
                )}
              >
                <Square className="h-3 w-3 fill-current" />
                {showConfirm ? t('header.actions.confirmStop') : t('header.actions.stop')}
              </button>
              {showConfirm && (
                <button
                  onClick={() => setShowConfirm(false)}
                  className="arena-cta border-slate-400/15 bg-slate-400/8 text-slate-300 hover:bg-slate-400/16"
                >
                  {t('header.actions.cancel')}
                </button>
              )}
            </div>
          )}
        </div>

        <div
          className={cn(
            'arena-header-progress mt-3',
            isCompactAuto && 'arena-header-progress-collapsed'
          )}
        >
          <div className="rounded-2xl border border-white/8 bg-slate-950/50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              <span>{t('header.progress')}</span>
              <span>{progressPercent !== null ? `${progressPercent}%` : t('header.openEnded')}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.85),rgba(244,114,182,0.85),rgba(251,191,36,0.8))] transition-all duration-700"
                style={{ width: `${progressPercent ?? Math.min(100, 20 + completedTurns * 8)}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
              <span>{t('header.participants', { count: partida.equipos.length })}</span>
              <span>{t('header.active', { count: aliveTeams })}</span>
              <span>{t('header.broadcastTurns', { count: completedTurns })}</span>
            </div>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11px] text-red-200">
          {actionError}
        </div>
      )}

      {activeComment && (
        <div className="arena-panel flex items-start gap-2.5 rounded-2xl px-3 py-2 text-xs text-slate-200 sm:text-sm">
          <span className="shrink-0 text-cyan-400">💬</span>
          <span>
            <span className="font-semibold text-cyan-300">{activeComment.equipoNombre}: </span>
            <span className="italic">&ldquo;{activeComment.text}&rdquo;</span>
          </span>
        </div>
      )}
    </div>
  );
}
