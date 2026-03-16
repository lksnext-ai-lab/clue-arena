// src/components/admin/TournamentRoundsSection.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import type {
  TournamentRoundResponse,
  TournamentRoundDetailResponse,
  TournamentRoundGameDetail,
} from '@/types/api';
import type { TournamentStatus } from '@/types/domain';
import { RoundStatusBadge, PhaseBadge } from './TournamentStatusBadge';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  tournamentId:     string;
  tournamentStatus: TournamentStatus;
  rounds:           TournamentRoundResponse[];
  refreshKey:       number;
  onRefresh:        () => void;
}

type DetailState = TournamentRoundDetailResponse | 'loading' | 'error';

// ── Game status config ────────────────────────────────────────────────────────

const GAME_STATUS_CONFIG: Record<string, { key: string; color: string; bg: string }> = {
  pendiente:  { key: 'torneoRoundGameStatusPending', color: '#64748b', bg: '#64748b18' },
  en_curso:   { key: 'torneoRoundGameStatusActive', color: '#22c55e', bg: '#22c55e18' },
  finalizada: { key: 'torneoRoundGameStatusFinished', color: '#f59e0b', bg: '#f59e0b18' },
};

// ── GameCard subcomponent ─────────────────────────────────────────────────────

function GameCard({
  game,
  idx,
  t,
}: {
  game: TournamentRoundGameDetail;
  idx: number;
  t: ReturnType<typeof useTranslations<'admin'>>;
}) {
  if (game.isBye) {
    return (
      <div className="rounded-[22px] border border-dashed border-white/12 bg-white/[0.03] px-4 py-4 text-sm italic text-slate-400">
        {t('torneoRoundBye')}
      </div>
    );
  }

  const { estado, teams, gameId } = game;
  const statusCfg = (estado ? GAME_STATUS_CONFIG[estado] : null) ?? GAME_STATUS_CONFIG.pendiente;
  const isPending  = !estado || estado === 'pendiente';
  const isFinished = estado === 'finalizada';

  // Determine winner(s): highest score among non-eliminated teams (finalizada only)
  const maxScore = isFinished && teams.length > 0
    ? Math.max(...teams.map((t) => t.puntos))
    : -Infinity;

  return (
    <div className="overflow-hidden rounded-[22px] border border-white/10 bg-slate-950/45">
      {/* Game header */}
      <div className="flex items-center justify-between border-b border-white/8 bg-white/[0.03] px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          {t('torneoRoundGameLabel', { number: idx + 1 })}
        </span>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: statusCfg.bg, color: statusCfg.color }}
          >
            {t(statusCfg.key)}
          </span>
          {gameId && (
            <Link
              href={`/admin/partidas/${gameId}`}
              className="text-xs font-medium text-cyan-300 transition-colors hover:text-cyan-200"
            >
              {t('torneoRoundView')} →
            </Link>
          )}
        </div>
      </div>

      {/* Teams */}
      {isPending && teams.length > 0 ? (
        // Pending: show team names in a compact list
        <div className="px-4 py-4">
          <p className="text-sm leading-6 text-slate-300">
            {teams.map((t) => t.teamName).join(' · ')}
          </p>
        </div>
      ) : (
        // Active or finished: show teams with scores
        <div className="divide-y divide-white/8">
          {teams
            .slice()
            .sort((a, b) => b.puntos - a.puntos)
            .map((team) => {
              const isWinner = isFinished && team.puntos === maxScore && maxScore > 0;
              return (
                <div
                  key={team.teamId}
                  className={`flex items-center justify-between px-4 py-3 text-sm ${
                    isWinner ? 'bg-amber-300/5' : ''
                  }`}
                >
                  <span
                    className={`font-medium flex items-center gap-1.5 ${
                      team.eliminado
                          ? 'text-slate-500 line-through'
                          : isWinner
                            ? 'text-amber-200'
                          : 'text-slate-200'
                    }`}
                  >
                    {isWinner && <span className="text-amber-300">★</span>}
                    {team.teamName}
                    {team.eliminado && (
                      <span className="ml-1 text-xs font-normal text-red-300">{t('torneoRoundEliminated')}</span>
                    )}
                  </span>
                  <span
                    className={`font-mono font-bold tabular-nums text-sm ${
                      isWinner ? 'text-amber-200' : 'text-slate-300'
                    }`}
                  >
                    {t('torneoRoundPoints', { points: team.puntos })}
                  </span>
                </div>
              );
          })}
          {teams.length === 0 && (
            <p className="px-4 py-3 text-xs text-slate-500">{t('torneoRoundNoTeams')}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TournamentRoundsSection({
  tournamentId,
  tournamentStatus,
  rounds,
  refreshKey,
  onRefresh,
}: Props) {
  const t = useTranslations('admin');

  const [acting,      setActing]      = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());
  const [details,     setDetails]     = useState<Map<string, DetailState>>(new Map());

  const canAct = tournamentStatus === 'active';

  // Keep a stable ref to fetchDetail to use in effects without stale-closure issues
  const fetchDetail = async (roundId: string) => {
    setDetails((prev) => new Map(prev).set(roundId, 'loading'));
    try {
      const data = await apiFetch<TournamentRoundDetailResponse>(
        `/tournaments/${tournamentId}/rounds/${roundId}`,
      );
      setDetails((prev) => new Map(prev).set(roundId, data));
    } catch {
      setDetails((prev) => new Map(prev).set(roundId, 'error'));
    }
  };

  // Ref to access latest fetchDetail and expanded without stale closures in effects
  const fetchDetailRef = useRef(fetchDetail);
  fetchDetailRef.current = fetchDetail;
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  // Auto-expand the most relevant round on first render
  useEffect(() => {
    if (rounds.length === 0) return;
    const active    = rounds.find((r) => r.status === 'active');
    const toExpand  = active ?? rounds[rounds.length - 1];
    setExpanded(new Set([toExpand.id]));
    void fetchDetailRef.current(toExpand.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When parent refreshes (refreshKey increments): clear cache, re-fetch expanded rounds
  useEffect(() => {
    if (refreshKey === 0) return; // skip on initial mount
    setDetails(new Map());
    expandedRef.current.forEach((roundId) => {
      void fetchDetailRef.current(roundId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // ── Toggle round expand/collapse ───────────────────────────────────────────

  const toggleRound = (roundId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(roundId)) {
        next.delete(roundId);
      } else {
        next.add(roundId);
        // Fetch detail if not already cached
        void fetchDetailRef.current(roundId);
      }
      return next;
    });
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleStart = async (roundId: string) => {
    setActing(roundId);
    setActionError(null);
    try {
      await apiFetch(`/tournaments/${tournamentId}/rounds/${roundId}/start`, { method: 'POST' });
      onRefresh();
    } catch {
      setActionError(t('torneoErrorRonda'));
    } finally {
      setActing(null);
    }
  };

  const handleAdvance = async (roundId: string) => {
    setActing(roundId);
    setActionError(null);
    try {
      await apiFetch(`/tournaments/${tournamentId}/rounds/${roundId}/advance`, { method: 'POST' });
      onRefresh();
    } catch (err: unknown) {
      // Parse the JSON error body to show a meaningful message
      const rawMsg = (err as Error).message ?? '';
      let displayMsg = t('torneoErrorRonda');
      try {
        const parsed = JSON.parse(rawMsg) as {
          error?: string;
          unfinishedGameIds?: string[];
        };
        if (parsed.unfinishedGameIds && parsed.unfinishedGameIds.length > 0) {
          displayMsg = t('torneoRoundMissingGames', { count: parsed.unfinishedGameIds.length });
        } else if (parsed.error) {
          displayMsg = parsed.error;
        }
      } catch {
        // rawMsg is not JSON — use it literally if non-empty
        if (rawMsg) displayMsg = rawMsg;
      }
      setActionError(displayMsg);
    } finally {
      setActing(null);
    }
  };

  const handleStartGames = async (roundId: string) => {
    const roundDetail = details.get(roundId);
    if (!roundDetail || roundDetail === 'loading' || roundDetail === 'error') return;

    const gamesToStart = roundDetail.games.filter(
      (g) => !g.isBye && g.gameId && (!g.estado || g.estado === 'pendiente'),
    );
    if (gamesToStart.length === 0) return;

    setActing(roundId);
    setActionError(null);
    try {
      await Promise.all(
        gamesToStart.map((g) =>
          apiFetch(`/games/${g.gameId}/start`, {
            method: 'POST',
            body: JSON.stringify({ modo: 'auto' }),
          }),
        ),
      );
      void fetchDetailRef.current(roundId);
      onRefresh();
    } catch {
      setActionError(t('torneoErrorRonda'));
    } finally {
      setActing(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-5">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,17,29,0.92),rgba(15,23,42,0.9))] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('torneoRoundsEyebrow')}</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{t('torneoRondas')}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              {t('torneoRoundsDesc')}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('torneoRoundsTotalLabel')}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{rounds.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">{t('torneoRoundsActiveLabel')}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{rounds.filter((round) => round.status === 'active').length}</p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-100">{t('torneoRoundsClosedLabel')}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{rounds.filter((round) => round.status === 'finished').length}</p>
            </div>
          </div>
        </div>
      </div>

      {actionError && (
        <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {actionError}
        </p>
      )}

      {rounds.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-white/12 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
          {t('torneoNoRondas')}
        </div>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => {
            const gamesCount = round.games.filter((g) => !g.isBye).length;
            const byesCount  = round.games.filter((g) => g.isBye).length;
            const isActing   = acting === round.id;
            const isExpanded = expanded.has(round.id);
            const detail     = details.get(round.id);
            const hasPendingGames =
              detail && detail !== 'loading' && detail !== 'error' &&
              detail.games.some((g) => !g.isBye && g.gameId && (!g.estado || g.estado === 'pendiente'));

            return (
              <div
                key={round.id}
                className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(7,11,22,0.96))]"
              >
                {/* ── Round header (clickable) ── */}
                <button
                  onClick={() => toggleRound(round.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-semibold text-white">
                      {t('torneoRonda', { n: round.roundNumber })}
                    </span>
                    <PhaseBadge phase={round.phase} />
                    <RoundStatusBadge status={round.status} />
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      {t('torneoRoundCount', { count: gamesCount })}
                      {byesCount > 0 && ` · ${byesCount} ${t('torneoByes')}`}
                    </span>
                    {isExpanded
                      ? <ChevronUp  size={15} className="text-slate-400" />
                      : <ChevronDown size={15} className="text-slate-400" />
                    }
                  </div>
                </button>

                {/* ── Expanded body ── */}
                {isExpanded && (
                  <div className="border-t border-white/10 px-5 pb-5">

                    {/* Games grid */}
                    <div className="mt-4">
                      {detail === 'loading' && (
                        <p className="text-xs text-slate-500 py-2">{t('torneoCargando')}</p>
                      )}
                      {detail === 'error' && (
                        <p className="text-xs text-red-400 py-2">{t('torneoErrorCargar')}</p>
                      )}
                      {detail && detail !== 'loading' && detail !== 'error' && (
                        detail.games.length === 0 ? (
                          <p className="text-xs text-slate-500 py-2">{t('torneoRoundNoGames')}</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {detail.games.map((game, idx) => (
                              <GameCard key={game.id} game={game} idx={idx} t={t} />
                            ))}
                          </div>
                        )
                      )}
                    </div>

                    {/* Action buttons */}
                    {canAct && (round.status === 'pending' || round.status === 'active') && (
                      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                        {round.status === 'pending' && (
                          <button
                            onClick={() => handleStart(round.id)}
                            disabled={isActing}
                            className="rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-emerald-200 disabled:opacity-60"
                          >
                            {isActing ? '…' : t('torneoIniciarRonda')}
                          </button>
                        )}
                        {round.status === 'active' && (
                          <>
                            {hasPendingGames && (
                              <button
                                onClick={() => handleStartGames(round.id)}
                                disabled={isActing}
                                className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-300/20 disabled:opacity-60"
                              >
                                {isActing ? '…' : t('torneoLanzarPartidas')}
                              </button>
                            )}
                              <button
                                onClick={() => handleAdvance(round.id)}
                                disabled={isActing}
                                className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-amber-200 disabled:opacity-60"
                              >
                                {isActing ? '…' : t('torneoAvanzarRonda')}
                              </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
