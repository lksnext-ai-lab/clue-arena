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

const GAME_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pendiente:  { label: 'Pendiente',  color: '#64748b', bg: '#64748b18' },
  en_curso:   { label: 'En curso',   color: '#22c55e', bg: '#22c55e18' },
  finalizada: { label: 'Finalizada', color: '#f59e0b', bg: '#f59e0b18' },
};

// ── GameCard subcomponent ─────────────────────────────────────────────────────

function GameCard({ game, idx }: { game: TournamentRoundGameDetail; idx: number }) {
  if (game.isBye) {
    return (
      <div className="px-3 py-2.5 rounded-lg bg-slate-700/30 border border-slate-700/60 text-sm text-slate-500 italic">
        Bye — pasa directamente a la siguiente ronda
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
    <div className="rounded-lg bg-slate-900/60 border border-slate-700/60 overflow-hidden">
      {/* Game header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/60 border-b border-slate-700/50">
        <span className="text-xs font-semibold text-slate-400">Partida {idx + 1}</span>
        <div className="flex items-center gap-2">
          <span
            className="px-1.5 py-0.5 rounded text-xs font-semibold"
            style={{ background: statusCfg.bg, color: statusCfg.color }}
          >
            {statusCfg.label}
          </span>
          {gameId && (
            <Link
              href={`/admin/partidas/${gameId}`}
              className="text-xs text-cyan-500 hover:text-cyan-400 transition-colors font-medium"
            >
              Ver →
            </Link>
          )}
        </div>
      </div>

      {/* Teams */}
      {isPending && teams.length > 0 ? (
        // Pending: show team names in a compact list
        <div className="px-3 py-2.5">
          <p className="text-sm text-slate-400">
            {teams.map((t) => t.teamName).join(' · ')}
          </p>
        </div>
      ) : (
        // Active or finished: show teams with scores
        <div className="divide-y divide-slate-700/40">
          {teams
            .slice()
            .sort((a, b) => b.puntos - a.puntos)
            .map((team) => {
              const isWinner = isFinished && team.puntos === maxScore && maxScore > 0;
              return (
                <div
                  key={team.teamId}
                  className={`flex items-center justify-between px-3 py-2 text-sm ${
                    isWinner ? 'bg-amber-500/5' : ''
                  }`}
                >
                  <span
                    className={`font-medium flex items-center gap-1.5 ${
                      team.eliminado
                        ? 'text-slate-500 line-through'
                        : isWinner
                          ? 'text-amber-300'
                          : 'text-slate-200'
                    }`}
                  >
                    {isWinner && <span className="text-amber-400">★</span>}
                    {team.teamName}
                    {team.eliminado && (
                      <span className="text-xs text-red-400 font-normal ml-1">eliminado</span>
                    )}
                  </span>
                  <span
                    className={`font-mono font-bold tabular-nums text-sm ${
                      isWinner ? 'text-amber-300' : 'text-slate-400'
                    }`}
                  >
                    {team.puntos} pts
                  </span>
                </div>
              );
            })}
          {teams.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-500">Sin equipos asignados</p>
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
          displayMsg = `Faltan ${parsed.unfinishedGameIds.length} partido(s) por finalizar`;
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
    <section>
      <h2 className="text-lg font-semibold text-cyan-400 mb-3">{t('torneoRondas')}</h2>

      {actionError && (
        <p className="px-4 py-2 rounded-md text-sm mb-3 bg-red-900/40 text-red-300 border border-red-500/30">
          {actionError}
        </p>
      )}

      {rounds.length === 0 ? (
        <p className="text-sm text-slate-500">{t('torneoNoRondas')}</p>
      ) : (
        <div className="space-y-2">
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
                className="rounded-xl bg-slate-800 border border-slate-700 overflow-hidden"
              >
                {/* ── Round header (clickable) ── */}
                <button
                  onClick={() => toggleRound(round.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-200">
                      {t('torneoRonda', { n: round.roundNumber })}
                    </span>
                    <PhaseBadge phase={round.phase} />
                    <RoundStatusBadge status={round.status} />
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-slate-500">
                      {gamesCount} partidas
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
                  <div className="border-t border-slate-700/60 px-4 pb-4">

                    {/* Games grid */}
                    <div className="mt-3">
                      {detail === 'loading' && (
                        <p className="text-xs text-slate-500 py-2">{t('torneoCargando')}</p>
                      )}
                      {detail === 'error' && (
                        <p className="text-xs text-red-400 py-2">{t('torneoErrorCargar')}</p>
                      )}
                      {detail && detail !== 'loading' && detail !== 'error' && (
                        detail.games.length === 0 ? (
                          <p className="text-xs text-slate-500 py-2">Sin partidas en esta ronda</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {detail.games.map((game, idx) => (
                              <GameCard key={game.id} game={game} idx={idx} />
                            ))}
                          </div>
                        )
                      )}
                    </div>

                    {/* Action buttons */}
                    {canAct && (round.status === 'pending' || round.status === 'active') && (
                      <div className="flex gap-2 flex-wrap mt-4 pt-3 border-t border-slate-700/50">
                        {round.status === 'pending' && (
                          <button
                            onClick={() => handleStart(round.id)}
                            disabled={isActing}
                            className="px-4 py-1.5 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
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
                                className="px-4 py-1.5 rounded-md text-sm font-medium bg-cyan-700 text-white hover:bg-cyan-600 disabled:opacity-50 transition-colors"
                              >
                                {isActing ? '…' : t('torneoLanzarPartidas')}
                              </button>
                            )}
                            <button
                              onClick={() => handleAdvance(round.id)}
                              disabled={isActing}
                              className="px-4 py-1.5 rounded-md text-sm font-medium bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
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
