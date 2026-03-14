import { db } from '@/lib/db';
import { equipos, partidaEquipos, partidas } from '@/lib/db/schema';
import { getTranslations } from 'next-intl/server';
import { desc } from 'drizzle-orm';
import { ArrowRight, Clock3, Crosshair, PlayCircle, Sparkles, Users } from 'lucide-react';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import type { GameStatus } from '@/types/domain';
import type { ReactNode } from 'react';

type EnrichedGame = {
  id: string;
  nombre: string;
  estado: GameStatus;
  turnoActual: number;
  maxTurnos: number | null;
  modoEjecucion: 'manual' | 'auto' | 'pausado';
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  teamCount: number;
  activeTeams: number;
  eliminatedTeams: number;
  topTeams: Array<{ name: string; eliminated: boolean }>;
};

const MODE_VARIANTS: Record<EnrichedGame['modoEjecucion'], 'default' | 'secondary' | 'outline'> = {
  manual: 'secondary',
  auto: 'default',
  pausado: 'outline',
};

const SECTION_ORDER: GameStatus[] = ['en_curso', 'pendiente', 'finalizada'];

export default async function AdminPartidasPage() {
  const t = await getTranslations('admin');
  const allGames = await db.select().from(partidas).orderBy(desc(partidas.createdAt)).all();
  const allGameTeams = await db.select().from(partidaEquipos).all();
  const allTeams = await db.select().from(equipos).all();
  const teamNames = new Map(allTeams.map((team) => [team.id, team.nombre]));

  const teamsByGame = allGameTeams.reduce<Record<string, typeof allGameTeams>>((acc, gameTeam) => {
    acc[gameTeam.partidaId] ??= [];
    acc[gameTeam.partidaId].push(gameTeam);
    return acc;
  }, {});

  const games: EnrichedGame[] = allGames.map((game) => {
    const gameTeams = (teamsByGame[game.id] ?? []).sort((a, b) => a.orden - b.orden);
    const eliminatedTeams = gameTeams.filter((team) => team.eliminado).length;

    return {
      id: game.id,
      nombre: game.nombre,
      estado: game.estado,
      turnoActual: game.turnoActual,
      maxTurnos: game.maxTurnos ?? null,
      modoEjecucion: game.modoEjecucion,
      createdAt: game.createdAt,
      startedAt: game.startedAt ?? null,
      finishedAt: game.finishedAt ?? null,
      teamCount: gameTeams.length,
      activeTeams: gameTeams.length - eliminatedTeams,
      eliminatedTeams,
      topTeams: gameTeams.slice(0, 4).map((team) => ({
        name: teamNames.get(team.equipoId) ?? team.equipoId,
        eliminated: team.eliminado,
      })),
    };
  });

  const activeGames = games.filter((game) => game.estado === 'en_curso');
  const pendingGames = games.filter((game) => game.estado === 'pendiente');
  const finishedGames = games.filter((game) => game.estado === 'finalizada');
  const totalTeamsInGames = games.reduce((total, game) => total + game.teamCount, 0);

  const sections = SECTION_ORDER.map((status) => ({
    status,
    title:
      status === 'en_curso'
        ? t('partidasSectionActive')
        : status === 'pendiente'
          ? t('partidasSectionPending')
          : t('partidasSectionFinished'),
    description:
      status === 'en_curso'
        ? t('partidasSectionActiveDesc')
        : status === 'pendiente'
          ? t('partidasSectionPendingDesc')
          : t('partidasSectionFinishedDesc'),
    items: games.filter((game) => game.estado === status),
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 text-slate-100">
      <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.2),rgba(15,23,42,0.94)_45%,rgba(2,6,23,0.98)_100%)] px-6 py-7 shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.18),transparent_60%)] lg:block" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
              {t('partidasEyebrow')}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {t('gestionPartidas')}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              {t('partidasHeroDesc')}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/partidas/nueva"
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-cyan-300"
            >
              <Sparkles className="h-4 w-4" />
              {t('crearPartida')}
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/[0.08]"
            >
              {t('partidasBackToPanel')}
            </Link>
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={<Crosshair className="h-4 w-4" />} label={t('partidasMetricTotal')} value={games.length} hint={t('partidasMetricTotalHint')} />
          <MetricCard icon={<PlayCircle className="h-4 w-4" />} label={t('partidasMetricActive')} value={activeGames.length} hint={activeGames.length > 0 ? t('partidasMetricActiveOn') : t('partidasMetricActiveOff')} accent="cyan" />
          <MetricCard icon={<Clock3 className="h-4 w-4" />} label={t('partidasMetricPending')} value={pendingGames.length} hint={pendingGames.length > 0 ? t('partidasMetricPendingOn') : t('partidasMetricPendingOff')} />
          <MetricCard icon={<Sparkles className="h-4 w-4" />} label={t('partidasMetricFinished')} value={finishedGames.length} hint={finishedGames.length > 0 ? t('partidasMetricFinishedOn') : t('partidasMetricFinishedOff')} />
          <MetricCard icon={<Users className="h-4 w-4" />} label={t('partidasMetricTeams')} value={totalTeamsInGames} hint={t('partidasMetricTeamsHint')} />
        </div>
      </header>

      {games.length === 0 ? (
        <section className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-12 text-center shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
            {t('partidasEmptyEyebrow')}
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">{t('sinPartidas')}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            {t('partidasEmptyDesc')}
          </p>
          <Link
            href="/admin/partidas/nueva"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300"
          >
            {t('crearPartida')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <>
          {activeGames.length > 0 && (
            <section className="rounded-[2rem] border border-emerald-400/15 bg-[linear-gradient(135deg,rgba(6,95,70,0.28),rgba(15,23,42,0.92))] p-6 shadow-[0_24px_70px_rgba(4,120,87,0.14)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-200/80">
                    {t('partidasLiveEyebrow')}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {t('partidasLiveTitle')}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-emerald-50/75">
                    {t('partidasLiveDesc', { count: activeGames.length })}
                  </p>
                </div>
                <p className="text-sm text-emerald-100/70">
                  {t('partidasLiveHint')}
                </p>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {activeGames.slice(0, 2).map((game) => (
                  <GameCard key={game.id} game={game} t={t} spotlight />
                ))}
              </div>
            </section>
          )}

          <div className="space-y-8">
            {sections.map((section) => (
              <section key={section.status} className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">{section.title}</h2>
                    <p className="mt-1 text-sm text-slate-400">{section.description}</p>
                  </div>
                  <Badge variant="outline" className="w-fit border-white/10 bg-white/[0.03] px-3 py-1 text-slate-300">
                    {t('partidasCount', { count: section.items.length })}
                  </Badge>
                </div>

                {section.items.length === 0 ? (
                  <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.02] px-5 py-6 text-sm text-slate-500">
                    {section.status === 'en_curso'
                      ? t('partidasSectionActiveEmpty')
                      : section.status === 'pendiente'
                        ? t('partidasSectionPendingEmpty')
                        : t('partidasSectionFinishedEmpty')}
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {section.items.map((game) => (
                      <GameCard key={game.id} game={game} t={t} />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}
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
  accent?: 'slate' | 'cyan';
}) {
  return (
    <article
      className={cn(
        'rounded-[1.5rem] border p-4 backdrop-blur-sm',
        accent === 'cyan'
          ? 'border-cyan-300/20 bg-cyan-300/[0.08]'
          : 'border-white/10 bg-white/[0.05]'
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

function GameCard({
  game,
  t,
  spotlight = false,
}: {
  game: EnrichedGame;
  t: Awaited<ReturnType<typeof getTranslations>>;
  spotlight?: boolean;
}) {
  const progressLabel = game.maxTurnos
    ? `${game.turnoActual} / ${game.maxTurnos}`
    : `${game.turnoActual}`;

  return (
    <article
      className={cn(
        'rounded-[1.75rem] border p-5 shadow-[0_24px_70px_rgba(2,6,23,0.3)]',
        spotlight
          ? 'border-emerald-300/20 bg-black/20'
          : 'border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.88))]'
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <GameStatusBadge estado={game.estado} />
              {game.estado === 'en_curso' && (
                <Badge variant={MODE_VARIANTS[game.modoEjecucion]}>
                  {t(`partidasMode.${game.modoEjecucion}`)}
                </Badge>
              )}
            </div>
            <h3 className="mt-3 text-xl font-semibold text-white">{game.nombre}</h3>
            <p className="mt-2 text-sm text-slate-400">
              {t('partidasTurnSummary', { current: progressLabel })}
            </p>
          </div>

          <Link
            href={`/admin/partidas/${game.id}`}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
          >
            {t('gestionar')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <MiniStat label={t('partidasCardTeams')} value={`${game.teamCount}`} detail={t('partidasCardActiveTeams', { count: game.activeTeams })} />
          <MiniStat label={t('partidasCardEliminated')} value={`${game.eliminatedTeams}`} detail={game.eliminatedTeams > 0 ? t('partidasCardEliminatedOn') : t('partidasCardEliminatedOff')} />
          <MiniStat
            label={game.estado === 'finalizada' ? t('partidasCardClosedAt') : t('partidasCardCreatedAt')}
            value={formatShortDate(game.estado === 'finalizada' ? game.finishedAt ?? game.createdAt : game.createdAt)}
            detail={
              game.estado === 'en_curso'
                ? t('partidasCardStartedAt', { date: formatShortDate(game.startedAt ?? game.createdAt) })
                : game.estado === 'pendiente'
                  ? t('partidasCardReadyHint')
                  : t('partidasCardFinishedHint')
            }
          />
        </div>

        <div className="rounded-[1.5rem] border border-white/8 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              {t('partidasCardTeamsOrder')}
            </p>
            <p className="text-xs text-slate-500">
              {t('partidasCardTeamsVisible', { count: game.topTeams.length })}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {game.topTeams.map((team, index) => (
              <span
                key={`${game.id}-${team.name}-${index}`}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
                  team.eliminated
                    ? 'border-red-400/20 bg-red-400/10 text-red-200'
                    : 'border-cyan-300/15 bg-cyan-300/10 text-cyan-100'
                )}
              >
                <span className="font-mono text-[11px] text-slate-400">{index + 1}</span>
                <span>{team.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function MiniStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] p-4">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
