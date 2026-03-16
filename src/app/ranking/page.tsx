"use client";

import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useInterval } from '@/lib/utils/useInterval';
import { apiFetch } from '@/lib/api/client';
import { formatPosicion } from '@/lib/utils/formatting';
import { useTranslations, useFormatter } from 'next-intl';
import type { RankingEntry } from '@/types/domain';
import type { RankingResponse, TournamentListResponse, TournamentResponse } from '@/types/api';

const MEDAL_ICONS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const PODIUM_ORDER: Array<1 | 2 | 3> = [2, 1, 3];

type RankingTranslator = ReturnType<typeof useTranslations>;
type RankingFormatter = ReturnType<typeof useFormatter>;

function buildRankingPath(pathname: string, tournamentId: string) {
  if (!tournamentId) return pathname;

  const params = new URLSearchParams();
  params.set('tournamentId', tournamentId);
  return `${pathname}?${params.toString()}`;
}

function getTopThree(entries: RankingEntry[]) {
  return PODIUM_ORDER.map((position) => entries.find((entry) => entry.posicion === position) ?? null);
}

function Avatar({ name, avatarUrl, size = 48 }: { name: string; avatarUrl: string | null | undefined; size?: number }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_20px_40px_rgba(15,23,42,0.35)]"
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={`Avatar de ${name}`}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-500/20 via-rose-500/10 to-slate-900 text-lg font-semibold text-amber-100">
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function PodiumCard({ entry, format, t }: { entry: RankingEntry; format: RankingFormatter; t: RankingTranslator }) {
  const isLeader = entry.posicion === 1;
  const shell = isLeader
    ? 'border-amber-300/40 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.24),rgba(15,23,42,0.92)_68%)] shadow-[0_24px_60px_rgba(251,191,36,0.18)]'
    : 'border-white/10 bg-[linear-gradient(180deg,rgba(30,41,59,0.9),rgba(15,23,42,0.9))]';

  return (
    <article
      className={`relative flex min-h-[18rem] flex-col rounded-[2rem] border p-5 text-white ${shell} ${isLeader ? 'lg:-translate-y-4' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.15] bg-black/20 text-xl shadow-inner shadow-white/10">
          {MEDAL_ICONS[entry.posicion]}
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-200">
          {t('placeLabel', { position: entry.posicion })}
        </span>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <Avatar name={entry.equipoNombre} avatarUrl={entry.avatarUrl} size={isLeader ? 72 : 60} />
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight text-white sm:text-xl">{entry.equipoNombre}</h3>
          <p className="mt-1 text-sm text-slate-300">{t('winsSummary', { count: entry.aciertos, games: entry.partidasJugadas })}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl bg-black/20 px-3 py-3">
          <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">{t('puntos')}</p>
          <p className="mt-2 text-xl font-semibold text-amber-200">{format.number(entry.puntos, { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-2xl bg-black/20 px-3 py-3">
          <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">{t('partidas')}</p>
          <p className="mt-2 text-xl font-semibold text-slate-100">{entry.partidasJugadas}</p>
        </div>
        <div className="rounded-2xl bg-black/20 px-3 py-3">
          <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">{t('aciertos')}</p>
          <p className="mt-2 text-xl font-semibold text-cyan-200">{entry.aciertos}</p>
        </div>
      </div>

      <div className="mt-auto pt-5">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${isLeader ? 'bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-500' : 'bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500'}`}
            style={{ width: `${Math.min(100, entry.partidasJugadas === 0 ? 0 : Math.round((entry.aciertos / entry.partidasJugadas) * 100))}%` }}
          />
        </div>
      </div>
    </article>
  );
}

function RankingTableCard({ entries, format, t }: { entries: RankingEntry[]; format: RankingFormatter; t: RankingTranslator }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.85))] shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.26em] text-cyan-300">{t('tableEyebrow')}</p>
        <h2 className="mt-2 text-xl font-semibold text-white">{t('tableTitle')}</h2>
      </div>

      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-slate-400">
            <tr>
              <th className="px-6 py-4 text-left font-medium">{t('posicion')}</th>
              <th className="px-6 py-4 text-left font-medium">{t('equipo')}</th>
              <th className="px-6 py-4 text-right font-medium">{t('puntos')}</th>
              <th className="px-6 py-4 text-right font-medium">{t('partidas')}</th>
              <th className="px-6 py-4 text-right font-medium">{t('aciertos')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.08]">
            {entries.map((entry) => {
              const isLeader = entry.posicion === 1;
              return (
                <tr
                  key={entry.equipoId}
                  className={isLeader ? 'bg-amber-400/[0.06]' : 'transition-colors hover:bg-white/[0.03]'}
                >
                  <td className={`px-6 py-4 font-semibold ${isLeader ? 'text-amber-200' : 'text-slate-300'}`}>
                    {MEDAL_ICONS[entry.posicion] ?? formatPosicion(entry.posicion)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={entry.equipoNombre} avatarUrl={entry.avatarUrl} size={42} />
                      <span className="font-medium text-white">{entry.equipoNombre}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-base font-semibold text-cyan-200">
                    {format.number(entry.puntos, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-slate-300">{entry.partidasJugadas}</td>
                  <td className="px-6 py-4 text-right font-mono text-slate-300">{entry.aciertos}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-4 md:hidden">
        {entries.map((entry) => {
          const isLeader = entry.posicion === 1;
          return (
            <article
              key={entry.equipoId}
              className={`rounded-[1.5rem] border p-4 ${isLeader ? 'border-amber-300/30 bg-amber-300/[0.08]' : 'border-white/[0.08] bg-white/[0.03]'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={entry.equipoNombre} avatarUrl={entry.avatarUrl} size={44} />
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${isLeader ? 'text-amber-100' : 'text-slate-100'}`}>
                      {MEDAL_ICONS[entry.posicion] ?? formatPosicion(entry.posicion)}
                    </p>
                    <h3 className="truncate text-base font-semibold text-white">{entry.equipoNombre}</h3>
                  </div>
                </div>
                <p className="text-right text-xl font-semibold text-cyan-200">{format.number(entry.puntos, { maximumFractionDigits: 0 })}</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-black/20 px-3 py-3">
                  <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">{t('partidas')}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-100">{entry.partidasJugadas}</p>
                </div>
                <div className="rounded-2xl bg-black/20 px-3 py-3">
                  <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">{t('aciertos')}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-100">{entry.aciertos}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RankingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="h-3 w-32 rounded-full bg-white/10" />
        <div className="mt-4 h-10 w-72 rounded-full bg-white/10" />
        <div className="mt-4 h-4 w-full max-w-2xl rounded-full bg-white/10" />
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 rounded-[1.5rem] bg-white/[0.08]" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-72 rounded-[2rem] border border-white/10 bg-white/[0.04]" />
        ))}
      </div>
      <div className="h-96 rounded-[2rem] border border-white/10 bg-white/[0.04]" />
    </div>
  );
}

export default function RankingPage() {
  const [ranking, setRanking] = useState<RankingResponse | null>(null);
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tournamentsError, setTournamentsError] = useState<string | null>(null);
  const t = useTranslations('ranking');
  const format = useFormatter();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deferredTournamentId = useDeferredValue(selectedTournamentId);

  useEffect(() => {
    setSelectedTournamentId(searchParams.get('tournamentId') ?? '');
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function fetchTournaments() {
      try {
        const data = await apiFetch<TournamentListResponse>('/tournaments');
        if (cancelled) return;
        setTournaments(data.tournaments);
        setTournamentsError(null);
      } catch {
        if (cancelled) return;
        setTournamentsError(t('errorTorneos'));
      } finally {
        if (!cancelled) {
          setIsLoadingTournaments(false);
        }
      }
    }

    void fetchTournaments();

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;

    async function fetchRanking() {
      setIsLoading(true);
      setRanking(null);

      try {
        const query = deferredTournamentId
          ? `/ranking?tournamentId=${encodeURIComponent(deferredTournamentId)}`
          : '/ranking';
        const data = await apiFetch<RankingResponse>(query);
        if (cancelled) return;
        setRanking(data);
        setError(null);
      } catch {
        if (cancelled) return;
        setError(t('errorCarga'));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchRanking();

    return () => {
      cancelled = true;
    };
  }, [deferredTournamentId, t]);

  useInterval(() => {
    const query = deferredTournamentId
      ? `/ranking?tournamentId=${encodeURIComponent(deferredTournamentId)}`
      : '/ranking';

    void apiFetch<RankingResponse>(query)
      .then((data) => {
        setRanking(data);
        setError(null);
      })
      .catch(() => {
        setError(t('errorCarga'));
      });
  }, 30_000);

  const selectedTournament = tournaments.find((tournament) => tournament.id === selectedTournamentId) ?? null;
  const leader = ranking?.ranking[0] ?? null;
  const podium = ranking ? getTopThree(ranking.ranking).filter((entry): entry is RankingEntry => entry !== null) : [];
  function handleTournamentChange(nextTournamentId: string) {
    setSelectedTournamentId(nextTournamentId);
    startTransition(() => {
      router.replace(buildRankingPath(pathname, nextTournamentId), { scroll: false });
    });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07111f] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
          style={{ backgroundImage: "url('/fondo-ranking.webp')" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_26%),linear-gradient(180deg,rgba(8,17,30,0.4)_0%,rgba(8,17,30,0.72)_36%,rgba(8,17,30,0.92)_100%)]" />
      </div>
      <div className="absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent)] opacity-30" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(15,23,42,0.72))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.55)] backdrop-blur-md sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-amber-300">{t('eyebrow')}</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">{t('titulo')}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                {selectedTournament ? t('alcanceTorneoHero', { name: selectedTournament.name }) : t('alcanceGlobalHero')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[28rem] xl:grid-cols-1">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <label htmlFor="ranking-tournament" className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  {t('filtroTorneo')}
                </label>
                <select
                  id="ranking-tournament"
                  value={selectedTournamentId}
                  onChange={(event) => handleTournamentChange(event.target.value)}
                  disabled={isLoadingTournaments}
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400 disabled:cursor-wait disabled:opacity-60"
                >
                  <option value="">{t('globalOption')}</option>
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.name}
                    </option>
                  ))}
                </select>
                {tournamentsError && <p className="mt-3 text-xs text-amber-200">{tournamentsError}</p>}
              </div>

            </div>
          </div>

          {!isLoading && ranking && ranking.ranking.length > 0 && (
            <div className="mt-8 grid gap-3 lg:grid-cols-3">
              <StatCard label={t('statTeams')} value={format.number(ranking.ranking.length, { maximumFractionDigits: 0 })} accent="text-white" />
              <StatCard label={t('statLeader')} value={leader?.equipoNombre ?? t('sinEquipos')} accent="text-amber-200" />
              <StatCard label={t('statLeaderPoints')} value={format.number(leader?.puntos ?? 0, { maximumFractionDigits: 0 })} accent="text-cyan-200" />
            </div>
          )}
        </section>

        {isLoading && <RankingSkeleton />}

        {error && (
          <div className="rounded-[1.5rem] border border-red-400/25 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            {error}
          </div>
        )}

        {ranking && !isLoading && (
          ranking.ranking.length === 0 ? (
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] px-6 py-14 text-center shadow-[0_30px_80px_rgba(2,6,23,0.35)]">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-slate-400">{t('emptyEyebrow')}</p>
              <h2 className="mt-4 text-2xl font-semibold text-white">{t('emptyTitle')}</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{t('sinEquipos')}</p>
            </section>
          ) : (
            <>
              <section className="grid gap-4 lg:grid-cols-3">
                {podium.map((entry) => (
                  <PodiumCard key={entry.equipoId} entry={entry} format={format} t={t} />
                ))}
              </section>

              <RankingTableCard entries={ranking.ranking} format={format} t={t} />
            </>
          )
        )}
      </div>
    </div>
  );
}
