'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crown, Medal, ShieldCheck, Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api/client';
import type { TournamentStandingEntry, TournamentStandingsResponse } from '@/types/api';

interface Props {
  tournamentId: string;
  refreshKey: number;
}

function PodiumCard({
  entry,
  position,
  t,
}: {
  entry: TournamentStandingEntry;
  position: number;
  t: ReturnType<typeof useTranslations<'admin'>>;
}) {
  const accent =
    position === 1
      ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
      : position === 2
        ? 'border-slate-300/20 bg-slate-300/10 text-slate-100'
        : 'border-orange-300/20 bg-orange-300/10 text-orange-100';

  const Icon = position === 1 ? Crown : Medal;

  return (
    <article className={`rounded-[28px] border p-5 ${accent}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em]">{t('torneoPodiumTop', { position })}</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">{entry.teamName}</h3>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-3 text-white">
          <Icon size={18} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-current/80">{t('torneoPuntos')}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{entry.totalScore}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-current/80">{t('torneoVictorias')}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{entry.wins}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-current/80">{t('torneoPartidas')}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{entry.gamesPlayed}</p>
        </div>
      </div>

      <p className="mt-4 text-sm text-current/80">
        {entry.isEliminated
          ? t('torneoPodiumEliminated')
          : entry.advancedToPlayoffs
            ? t('torneoPodiumPlayoffs')
            : t('torneoPodiumActive')}
      </p>
    </article>
  );
}

export function TournamentStandingsSection({ tournamentId, refreshKey }: Props) {
  const t = useTranslations('admin');
  const [data, setData] = useState<TournamentStandingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<TournamentStandingsResponse>(`/tournaments/${tournamentId}/standings`)
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch(() => setError(t('torneoErrorCargar')))
      .finally(() => setLoading(false));
  }, [tournamentId, refreshKey, t]);

  const podium = useMemo(() => data?.standings.slice(0, 3) ?? [], [data]);
  const leader = podium[0] ?? null;

  return (
    <section className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,17,29,0.92),rgba(15,23,42,0.9))] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('torneoStandingsEyebrow')}</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{t('torneoClasificacion')}</h2>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-amber-100">
              <Trophy size={18} />
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
            {t('torneoStandingsDesc')}
          </p>

          {leader ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">{t('torneoLeaderLabel')}</p>
                <p className="mt-3 text-lg font-semibold text-white">{leader.teamName}</p>
              </div>
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-100">{t('torneoLeadPointsLabel')}</p>
                <p className="mt-3 text-3xl font-semibold text-white">{leader.totalScore}</p>
              </div>
              <div className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-100">{t('torneoLeadGapLabel')}</p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {data && data.standings[1] ? leader.totalScore - data.standings[1].totalScore : leader.totalScore}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('torneoRankingStatusLabel')}</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {data?.currentRound ? t('torneoRankingStatusAfterRound', { round: data.currentRound }) : t('torneoRankingStatusWaiting')}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-slate-300">
              <ShieldCheck size={18} />
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('torneoQualifiedTeamsLabel')}</p>
              <p className="mt-2 text-white">{data?.standings.length ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('torneoPlayoffTeamsLabel')}</p>
              <p className="mt-2 text-white">{data?.standings.filter((entry) => entry.advancedToPlayoffs).length ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('torneoEliminatedTeamsLabel')}</p>
              <p className="mt-2 text-white">{data?.standings.filter((entry) => entry.isEliminated).length ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 text-sm text-slate-400">
          {t('torneoCargando')}
        </div>
      ) : null}

      {error && !loading ? (
        <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {data && !loading ? (
        data.standings.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-white/12 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
            {t('torneoNoClasificacion')}
          </div>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-3">
              {podium.map((entry, index) => (
                <PodiumCard key={entry.teamId} entry={entry} position={index + 1} t={t} />
              ))}
            </div>

            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(7,11,22,0.96))]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-white/[0.04]">
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="px-5 py-3 text-center font-medium">{t('torneoRank')}</th>
                      <th className="px-5 py-3 text-left font-medium">{t('torneoTableTeamLabel')}</th>
                      <th className="px-5 py-3 text-right font-medium">{t('torneoPuntos')}</th>
                      <th className="px-5 py-3 text-right font-medium">{t('torneoPartidas')}</th>
                      <th className="px-5 py-3 text-right font-medium">{t('torneoVictorias')}</th>
                      <th className="px-5 py-3 text-right font-medium">{t('torneoEliminaciones')}</th>
                      <th className="px-5 py-3 text-center font-medium">{t('torneoTableStatusLabel')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {data.standings.map((entry, index) => (
                      <tr
                        key={entry.teamId}
                        className={`transition-colors hover:bg-white/[0.03] ${
                          index === 0 ? 'bg-amber-300/5' : ''
                        } ${entry.isEliminated ? 'opacity-60' : ''}`}
                      >
                        <td className={`px-5 py-4 text-center font-semibold ${index === 0 ? 'text-amber-200' : 'text-slate-300'}`}>
                          {entry.rank}
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-semibold text-white">{entry.teamName}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                              {entry.groupIndex !== null ? t('torneoGrupo', { n: entry.groupIndex + 1 }) : t('torneoTableGeneralLabel')}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right font-mono font-semibold text-cyan-100">{entry.totalScore}</td>
                        <td className="px-5 py-4 text-right font-mono text-slate-300">{entry.gamesPlayed}</td>
                        <td className="px-5 py-4 text-right font-mono text-slate-300">{entry.wins}</td>
                        <td className="px-5 py-4 text-right font-mono text-slate-300">{entry.eliminations}</td>
                        <td className="px-5 py-4 text-center">
                          {entry.isEliminated ? (
                            <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-semibold text-red-200">
                              {t('torneoEliminado')}
                            </span>
                          ) : entry.advancedToPlayoffs ? (
                            <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-1 text-xs font-semibold text-fuchsia-100">
                              {t('torneoPlayoffsLabel')}
                            </span>
                          ) : (
                            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                              {t('torneoActivo')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      ) : null}
    </section>
  );
}
