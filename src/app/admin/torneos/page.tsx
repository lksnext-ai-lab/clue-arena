import Link from 'next/link';
import { ArrowRight, CalendarDays, Crown, Plus, Radar, Sparkles, Swords, Trophy, Users } from 'lucide-react';
import { asc, desc, eq } from 'drizzle-orm';
import { getLocale, getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { tournaments, tournamentRoundGames, tournamentRounds, tournamentTeams, partidaEquipos, equipos, partidas } from '@/lib/db/schema';
import { FormatBadge, TournamentStatusBadge } from '@/components/admin/TournamentStatusBadge';
import { computeTournamentStandings } from '@/lib/tournament';
import type { GameId, GameResult, TeamId } from '@/lib/tournament/types';

function formatDate(value: string | null, locale: string, fallback: string) {
  if (!value) return fallback;
  const languageTag = locale === 'eu' ? 'eu-ES' : 'es-ES';
  return new Intl.DateTimeFormat(languageTag, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

type TournamentCardSummary = {
  currentRound: number | null;
  activeGames: number;
  totalGamesInRound: number;
  leaderName: string | null;
  leaderScore: number | null;
  podium: Array<{ rank: number; teamName: string; totalScore: number }>;
};

async function buildTournamentSummary(tournamentId: string): Promise<TournamentCardSummary> {
  const enrolled = await db
    .select({ tt: tournamentTeams, e: equipos })
    .from(tournamentTeams)
    .innerJoin(equipos, eq(tournamentTeams.teamId, equipos.id))
    .where(eq(tournamentTeams.tournamentId, tournamentId))
    .all();

  const rounds = await db
    .select()
    .from(tournamentRounds)
    .where(eq(tournamentRounds.tournamentId, tournamentId))
    .orderBy(asc(tournamentRounds.roundNumber))
    .all();

  const activeRound = rounds.find((round) => round.status === 'active') ?? null;
  const currentRound = activeRound?.roundNumber ?? rounds.at(-1)?.roundNumber ?? null;

  const roundGames = await Promise.all(
    rounds.map((round) =>
      db.select().from(tournamentRoundGames).where(eq(tournamentRoundGames.roundId, round.id)).all()
    )
  );
  const flatRoundGames = roundGames.flat();

  const gameRoundMap = new Map<GameId, number>();
  const gameResults: GameResult[] = [];

  for (const round of rounds) {
    const games = flatRoundGames.filter((game) => game.roundId === round.id && !game.isBye && game.gameId);
    for (const game of games) {
      const gameId = game.gameId as GameId;
      gameRoundMap.set(gameId, round.roundNumber);

      const teamScores = await db
        .select({ equipoId: partidaEquipos.equipoId, puntos: partidaEquipos.puntos })
        .from(partidaEquipos)
        .where(eq(partidaEquipos.partidaId, gameId))
        .all();

      const maxScore = teamScores.length > 0 ? Math.max(...teamScores.map((score) => score.puntos)) : 0;

      for (const score of teamScores) {
        gameResults.push({
          gameId,
          teamId: score.equipoId as TeamId,
          score: score.puntos,
          won: score.puntos === maxScore && maxScore > 0,
          elims: 0,
        });
      }
    }
  }

  const standings = computeTournamentStandings(
    enrolled.map(({ tt }) => ({
      teamId: tt.teamId as TeamId,
      seed: tt.seed ?? null,
      groupIndex: tt.groupIndex ?? null,
      eliminated: tt.eliminated,
    })),
    rounds.map((round) => ({
      id: round.id,
      roundNumber: round.roundNumber,
      phase: round.phase,
      status: round.status,
    })),
    gameResults,
    gameRoundMap
  );

  const metaByTeamId = new Map(enrolled.map(({ tt, e }) => [tt.teamId, e.nombre]));
  const leader = standings[0] ?? null;

  const podium = standings.slice(0, 3).map((entry, index) => ({
    rank: index + 1,
    teamName: metaByTeamId.get(entry.teamId) ?? entry.teamId,
    totalScore: entry.totalScore,
  }));

  const currentRoundGames = currentRound
    ? flatRoundGames.filter((game) => {
        const round = rounds.find((item) => item.id === game.roundId);
        return round?.roundNumber === currentRound && !game.isBye;
      })
    : [];

  const currentRoundGameStates = await Promise.all(
    currentRoundGames
      .filter((game) => game.gameId)
      .map((game) =>
        db
          .select({ estado: partidas.estado })
          .from(partidas)
          .where(eq(partidas.id, game.gameId!))
          .get()
      )
  );
  const startedOrFinishedGameCount = currentRoundGameStates.filter((game) => game?.estado === 'en_curso').length;

  return {
    currentRound,
    activeGames: startedOrFinishedGameCount,
    totalGamesInRound: currentRoundGames.length,
    leaderName: leader ? (metaByTeamId.get(leader.teamId) ?? leader.teamId) : null,
    leaderScore: leader?.totalScore ?? null,
    podium,
  };
}

export default async function AdminTorneosPage() {
  const t = await getTranslations('admin');
  const locale = await getLocale();

  const allTournaments = await db
    .select()
    .from(tournaments)
    .orderBy(desc(tournaments.createdAt))
    .all();

  const allEnrolled = await db.select().from(tournamentTeams).all();
  const teamCounts = allEnrolled.reduce<Record<string, number>>((acc, tt) => {
    acc[tt.tournamentId] = (acc[tt.tournamentId] ?? 0) + 1;
    return acc;
  }, {});

  const metrics = {
    total: allTournaments.length,
    active: allTournaments.filter((torneo) => torneo.status === 'active').length,
    draft: allTournaments.filter((torneo) => torneo.status === 'draft').length,
    teams: Object.values(teamCounts).reduce((acc, count) => acc + count, 0),
  };

  const spotlight = allTournaments.find((torneo) => torneo.status === 'active') ?? allTournaments[0] ?? null;
  const summaries = new Map(
    await Promise.all(
      allTournaments.map(async (torneo) => [torneo.id, await buildTournamentSummary(torneo.id)] as const)
    )
  );

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-30 bg-[url('/fondo-torneo.png')] bg-cover bg-center bg-no-repeat" />
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,rgba(3,7,18,0.84)_0%,rgba(2,6,23,0.92)_45%,rgba(2,6,23,0.97)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.16),transparent_28%)]" />

      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.94),rgba(9,14,28,0.98))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.55)] sm:p-8">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,_rgba(250,204,21,0.18),_transparent_58%)]" />
          <div className="absolute -left-10 top-10 h-36 w-36 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_0.9fr] lg:items-end">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-200">
                <Radar size={14} />
                {t('torneosPageEyebrow')}
              </div>

              <div className="max-w-2xl space-y-3">
                <h1 className="font-serif text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  {t('gestionTorneos')}
                </h1>
                <p className="max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                  {t('torneosPageHeroDesc')}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t('torneosMetricTotalLabel')}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{metrics.total}</p>
                  <p className="mt-1 text-sm text-slate-400">{t('torneosMetricTotalHint')}</p>
                </div>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-emerald-200">{t('torneosMetricActiveLabel')}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{metrics.active}</p>
                  <p className="mt-1 text-sm text-emerald-100/80">{t('torneosMetricActiveHint')}</p>
                </div>
                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-100">{t('torneosMetricDraftLabel')}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{metrics.draft}</p>
                  <p className="mt-1 text-sm text-amber-100/80">{t('torneosMetricDraftHint')}</p>
                </div>
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-100">{t('torneosMetricTeamsLabel')}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{metrics.teams}</p>
                  <p className="mt-1 text-sm text-cyan-100/80">{t('torneosMetricTeamsHint')}</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-[28px] border border-white/10 bg-slate-950/50 p-5 backdrop-blur">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t('torneosSpotlightLabel')}</p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {spotlight?.name ?? t('torneosSpotlightEmpty')}
                    </p>
                  </div>
                  <Sparkles className="text-amber-300" size={18} />
                </div>

                {spotlight ? (
                  <div className="mt-5 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <FormatBadge format={spotlight.format} />
                      <TournamentStatusBadge status={spotlight.status as 'draft' | 'active' | 'finished'} />
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
                        {t('torneosSpotlightTeamCount', { count: teamCounts[spotlight.id] ?? 0 })}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Users size={14} />
                          <span className="text-xs uppercase tracking-[0.2em]">{t('torneosSpotlightRosterLabel')}</span>
                        </div>
                        <p className="mt-2 text-lg font-semibold text-white">{teamCounts[spotlight.id] ?? 0}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Swords size={14} />
                          <span className="text-xs uppercase tracking-[0.2em]">{t('torneosSpotlightStatusLabel')}</span>
                        </div>
                        <div className="mt-2">
                          <TournamentStatusBadge status={spotlight.status as 'draft' | 'active' | 'finished'} />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <div className="flex items-center gap-2 text-slate-400">
                          <CalendarDays size={14} />
                          <span className="text-xs uppercase tracking-[0.2em]">{t('torneosSpotlightCreatedLabel')}</span>
                        </div>
                        <p className="mt-2 text-lg font-semibold text-white">{formatDate(spotlight.createdAt?.toISOString() ?? null, locale, t('tournamentDateUnknown'))}</p>
                      </div>
                    </div>

                    <Link
                      href={`/admin/torneos/${spotlight.id}`}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
                    >
                      {t('torneosSpotlightOpen')}
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    {t('torneosSpotlightEmptyDesc')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('torneosInventoryEyebrow')}</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{t('torneosInventoryTitle')}</h2>
          </div>
          <Link
            href="/admin/torneos/nueva"
            className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-emerald-200"
          >
            <Plus size={16} />
            {t('crearTorneo').replace('+ ', '')}
          </Link>
        </div>

        {allTournaments.length === 0 ? (
          <section className="rounded-[28px] border border-dashed border-white/12 bg-slate-900/70 p-10 text-center">
            <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
              <div className="rounded-full border border-amber-300/20 bg-amber-300/10 p-4 text-amber-200">
                <Trophy size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-white">{t('sinTorneos')}</h3>
                <p className="text-sm leading-6 text-slate-400">
                  {t('torneosEmptyDesc')}
                </p>
              </div>
              <Link
                href="/admin/torneos/nueva"
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950"
              >
                <Plus size={16} />
                {t('torneosEmptyCta')}
              </Link>
            </div>
          </section>
        ) : (
          <section className="grid gap-4 xl:grid-cols-2">
            {allTournaments.map((torneo, index) => {
              const teamCount = teamCounts[torneo.id] ?? 0;
              const isSpotlight = index === 0;
              const summary = summaries.get(torneo.id);

              return (
                <article
                  key={torneo.id}
                  className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(15,23,42,0.94),rgba(6,10,20,0.94))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.34)]"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  <div className="absolute -right-10 top-6 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />

                  <div className="relative flex h-full flex-col gap-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <FormatBadge format={torneo.format} />
                          <TournamentStatusBadge status={torneo.status as 'draft' | 'active' | 'finished'} />
                          {isSpotlight && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">
                              <Crown size={12} />
                              Reciente
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="text-2xl font-semibold text-white">{torneo.name}</h3>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('torneosCardTeamsLabel')}</p>
                        <p className="mt-2 text-3xl font-semibold text-white">{teamCount}</p>
                      </div>
                    </div>

                    {torneo.status === 'active' && summary ? (
                      <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/5 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">{t('torneosCardCompetitionLabel')}</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <div>
                            <p className="text-xs text-slate-400">{t('torneosCardCurrentRoundLabel')}</p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {summary.currentRound ? t('torneoRonda', { n: summary.currentRound }) : t('torneosCardNoRounds')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">{t('torneosCardLiveGamesLabel')}</p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {t('torneosCardLiveGamesValue', {
                                active: summary.activeGames,
                                total: summary.totalGamesInRound,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">{t('torneosCardLeaderLabel')}</p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {summary.leaderName
                                ? t('torneosCardLeaderValue', {
                                    name: summary.leaderName,
                                    points: summary.leaderScore ?? 0,
                                  })
                                : t('torneosCardNoLeader')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {torneo.status === 'finished' && summary && summary.podium.length > 0 ? (
                      <div className="rounded-2xl border border-amber-300/15 bg-amber-300/5 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-amber-200">{t('torneosCardPodiumLabel')}</p>
                        <div className="mt-3 space-y-2">
                          {summary.podium.map((entry) => (
                            <div key={`${torneo.id}-${entry.rank}`} className="flex items-center justify-between gap-3 text-sm">
                              <span className="font-medium text-white">
                                {t('torneosCardPodiumEntry', { rank: entry.rank, name: entry.teamName })}
                              </span>
                              <span className="font-mono text-amber-100">{entry.totalScore}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-auto flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('torneosCardCreatedLabel')}</p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {formatDate(torneo.createdAt?.toISOString() ?? null, locale, t('tournamentDateUnknown'))}
                        </p>
                      </div>
                      <Link
                        href={`/admin/torneos/${torneo.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-white/[0.09]"
                      >
                        {t('gestionar')}
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
