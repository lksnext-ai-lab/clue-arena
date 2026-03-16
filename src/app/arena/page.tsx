import Link from 'next/link';
import type { ReactNode } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  ArrowRight,
  Clock3,
  Radar,
  Sparkles,
  Swords,
  Trophy,
  Users2,
} from 'lucide-react';
import { desc, eq } from 'drizzle-orm';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { db } from '@/lib/db';
import { equipos, partidaEquipos, partidas } from '@/lib/db/schema';
import type { GameStatus } from '@/types/domain';
import type { Locale } from '@/i18n/request';

type ArenaGame = {
  id: string;
  nombre: string;
  estado: GameStatus;
  turnoActual: number;
  maxTurnos: number | null;
  createdAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  equipoNombres: string[];
};

type ArenaTranslations = Awaited<ReturnType<typeof getTranslations>>;

/**
 * /arena — Gateway hacia las vistas de espectador.
 * Lista las partidas en curso y las últimas finalizadas.
 * Página pública accesible sin autenticación.
 */
export default async function ArenaGatewayPage() {
  const t = await getTranslations('arena');
  const locale = await getLocale() as Locale;
  const allGames = await db
    .select()
    .from(partidas)
    .orderBy(desc(partidas.createdAt))
    .all();

  const enriched: ArenaGame[] = await Promise.all(
    allGames.map(async (game) => {
      const teamRows = await db
        .select({ nombre: equipos.nombre })
        .from(partidaEquipos)
        .innerJoin(equipos, eq(partidaEquipos.equipoId, equipos.id))
        .where(eq(partidaEquipos.partidaId, game.id))
        .all();

      return {
        id: game.id,
        nombre: game.nombre,
        estado: game.estado as GameStatus,
        turnoActual: game.turnoActual,
        maxTurnos: game.maxTurnos ?? null,
        createdAt: toDate(game.createdAt),
        startedAt: toDate(game.startedAt),
        finishedAt: toDate(game.finishedAt),
        equipoNombres: teamRows.map((team) => team.nombre),
      };
    })
  );

  const enCurso = enriched.filter((game) => game.estado === 'en_curso');
  const pendientes = enriched.filter((game) => game.estado === 'pendiente');
  const finalizadas = enriched
    .filter((game) => game.estado === 'finalizada')
    .sort((a, b) => (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0))
    .slice(0, 6);

  const sectionMeta: Record<GameStatus, { eyebrow: string; title: string; description: string }> = {
    en_curso: {
      eyebrow: t('sections.live.eyebrow'),
      title: t('sections.live.title'),
      description: t('sections.live.description'),
    },
    pendiente: {
      eyebrow: t('sections.pending.eyebrow'),
      title: t('sections.pending.title'),
      description: t('sections.pending.description'),
    },
    finalizada: {
      eyebrow: t('sections.finished.eyebrow'),
      title: t('sections.finished.title'),
      description: t('sections.finished.description'),
    },
  };

  const uniqueTeams = new Set(enriched.flatMap((game) => game.equipoNombres));
  const featuredGame = enCurso[0] ?? pendientes[0] ?? finalizadas[0] ?? null;

  return (
    <div
      className="min-h-screen px-4 py-6 sm:px-6 lg:px-8"
      style={{
        background:
          'radial-gradient(circle at top, rgba(34,197,94,0.12) 0%, rgba(8,15,28,0.96) 32%, #04070d 72%)',
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section
          className="relative overflow-hidden rounded-[32px] border px-6 py-6 sm:px-8 sm:py-8"
          style={{
            borderColor: 'rgba(148,163,184,0.16)',
            background:
              'linear-gradient(145deg, rgba(5,10,20,0.96), rgba(10,18,32,0.92) 58%, rgba(8,30,29,0.86))',
            boxShadow: '0 28px 90px rgba(2, 6, 23, 0.48)',
          }}
        >
          <div
            className="absolute -left-20 top-0 h-52 w-52 rounded-full blur-3xl"
            style={{ background: 'rgba(34,197,94,0.14)' }}
          />
          <div
            className="absolute right-0 top-10 h-44 w-44 rounded-full blur-3xl"
            style={{ background: 'rgba(56,189,248,0.12)' }}
          />

          <div className="relative grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-5">
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]"
                style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc' }}
              >
                <Radar size={14} />
                {t('hero.kicker')}
              </div>

              <div className="space-y-3">
                <h1 className="max-w-4xl text-3xl font-semibold leading-tight text-white sm:text-5xl">
                  {t('hero.title')}
                </h1>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard
                  icon={<Sparkles size={16} />}
                  label={t('stats.live')}
                  value={String(enCurso.length)}
                  accent="#4ade80"
                  backgroundImage="/home/electro.png"
                />
                <StatCard
                  icon={<Clock3 size={16} />}
                  label={t('stats.pending')}
                  value={String(pendientes.length)}
                  accent="#fbbf24"
                  backgroundImage="/home/scene.png"
                  backgroundPosition="50% 72%"
                  backgroundSize="132%"
                />
                <StatCard
                  icon={<Users2 size={16} />}
                  label={t('stats.teams')}
                  value={String(uniqueTeams.size)}
                  accent="#38bdf8"
                  backgroundImage="/home/lupa.png"
                  backgroundPosition="60% 38%"
                  backgroundSize="165%"
                />
              </div>
            </div>

            <aside
              className="relative flex h-full flex-col justify-between overflow-hidden rounded-[28px] border p-5"
              style={{
                borderColor: 'rgba(148,163,184,0.12)',
                background: 'linear-gradient(180deg, rgba(10,18,32,0.9), rgba(4,8,15,0.88))',
              }}
            >
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/home/partida.png')" }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,8,18,0.38),rgba(3,8,18,0.82))]" />

              <div className="relative space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  {t('featured.eyebrow')}
                </p>
                {featuredGame ? (
                  <>
                    <p className="text-xl font-semibold text-white">{featuredGame.nombre}</p>
                    <p className="text-sm leading-6 text-slate-300">
                      {buildSummary(featuredGame, t)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-semibold text-white">{t('featured.emptyTitle')}</p>
                    <p className="text-sm leading-6 text-slate-400">
                      {t('featured.emptyDescription')}
                    </p>
                  </>
                )}
              </div>

              {featuredGame ? (
                <Link
                  href={`/partidas/${featuredGame.id}`}
                  className="relative mt-5 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #22c55e, #06b6d4)', color: '#03121f' }}
                >
                  {t('featured.cta')}
                  <ArrowRight size={16} />
                </Link>
              ) : null}
            </aside>
          </div>
        </section>

        {allGames.length === 0 ? (
          <EmptyArenaState t={t} />
        ) : (
          <div className="grid gap-6">
            <GameSection
              locale={locale}
              t={t}
              status="en_curso"
              meta={sectionMeta.en_curso}
              games={enCurso}
              emptyMessage={t('empty.live')}
            />
            <GameSection
              locale={locale}
              t={t}
              status="pendiente"
              meta={sectionMeta.pendiente}
              games={pendientes}
              emptyMessage={t('empty.pending')}
            />
            <GameSection
              locale={locale}
              t={t}
              status="finalizada"
              meta={sectionMeta.finalizada}
              games={finalizadas}
              emptyMessage={t('empty.finished')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function GameSection({
  locale,
  t,
  meta,
  status,
  games,
  emptyMessage,
}: {
  locale: Locale;
  t: ArenaTranslations;
  meta: { eyebrow: string; title: string; description: string };
  status: GameStatus;
  games: ArenaGame[];
  emptyMessage: string;
}) {
  const isActiveSection = status === 'en_curso';

  return (
    <section
      className="relative overflow-hidden rounded-[28px] border px-5 py-5 sm:px-6"
      style={{
        borderColor: 'rgba(148,163,184,0.14)',
        background: isActiveSection
          ? 'linear-gradient(180deg, rgba(8,12,24,0.56), rgba(4,8,15,0.8))'
          : 'linear-gradient(180deg, rgba(8,12,24,0.9), rgba(4,8,15,0.82))',
      }}
    >
      {isActiveSection ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-35"
            style={{ backgroundImage: "url('/fondo-inicio.webp')" }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,10,18,0.32),rgba(4,8,15,0.78))]" />
        </>
      ) : null}

      <div className="relative">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {meta.eyebrow}
            </p>
            <h2 className="text-2xl font-semibold text-white">{meta.title}</h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-400">{meta.description}</p>
          </div>
          <p className="text-sm font-medium text-slate-500">
            {t('gamesCount', { count: games.length })}
          </p>
        </div>

        {games.length === 0 ? (
          <div
            className="rounded-[24px] border px-5 py-8 text-sm leading-6 text-slate-400"
            style={{ borderColor: 'rgba(71,85,105,0.4)', background: 'rgba(9,15,28,0.62)' }}
          >
            {emptyMessage}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {games.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                highlight={status === 'en_curso'}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function GameCard({
  game,
  highlight,
  locale,
  t,
}: {
  game: ArenaGame;
  highlight?: boolean;
  locale: Locale;
  t: ArenaTranslations;
}) {
  const accent = highlight
    ? {
        border: 'rgba(74,222,128,0.3)',
        glow: '0 18px 50px rgba(34,197,94,0.12)',
        tag: 'rgba(34,197,94,0.14)',
        tagText: '#86efac',
      }
    : game.estado === 'pendiente'
      ? {
          border: 'rgba(251,191,36,0.24)',
          glow: '0 18px 50px rgba(251,191,36,0.08)',
          tag: 'rgba(251,191,36,0.12)',
          tagText: '#fcd34d',
        }
      : {
          border: 'rgba(56,189,248,0.2)',
          glow: '0 18px 50px rgba(56,189,248,0.08)',
          tag: 'rgba(56,189,248,0.12)',
          tagText: '#7dd3fc',
        };

  const contextLabel = game.estado === 'finalizada'
    ? formatDate(game.finishedAt, locale, t)
    : game.estado === 'en_curso'
      ? formatDate(game.startedAt, locale, t)
      : formatDate(game.createdAt, locale, t);

  const contextPrefix = game.estado === 'finalizada'
    ? t('card.context.finished')
    : game.estado === 'en_curso'
      ? t('card.context.started')
      : t('card.context.created');

  return (
    <Link
      href={`/partidas/${game.id}`}
      className="group relative overflow-hidden rounded-[26px] border p-5 transition-all duration-200 hover:-translate-y-1"
      style={{
        borderColor: accent.border,
        background: 'linear-gradient(180deg, rgba(10,17,30,0.94), rgba(6,11,21,0.9))',
        boxShadow: accent.glow,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${accent.tagText}, transparent)` }}
      />

      <div className="relative flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ background: accent.tag, color: accent.tagText }}
            >
              <Swords size={13} />
              {game.estado === 'en_curso'
                ? t('card.status.live')
                : game.estado === 'pendiente'
                  ? t('card.status.pending')
                  : t('card.status.finished')}
            </div>

            <div>
              <h3 className="text-xl font-semibold text-white transition-colors group-hover:text-cyan-200">
                {game.nombre}
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {contextPrefix} {contextLabel}
              </p>
            </div>
          </div>

          <GameStatusBadge estado={game.estado} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <InfoPill
            icon={<Clock3 size={15} />}
            label={t('card.labels.turn')}
            value={game.maxTurnos ? `${game.turnoActual} / ${game.maxTurnos}` : String(game.turnoActual)}
          />
          <InfoPill
            icon={<Users2 size={15} />}
            label={t('card.labels.teams')}
            value={String(game.equipoNombres.length)}
          />
          <InfoPill
            icon={<Trophy size={15} />}
            label={t('card.labels.mode')}
            value={game.estado === 'finalizada' ? t('card.mode.summary') : t('card.mode.follow')}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            {t('card.participants')}
          </p>
          <div className="flex flex-wrap gap-2">
            {game.equipoNombres.length > 0 ? (
              game.equipoNombres.map((team) => (
                <span
                  key={team}
                  className="rounded-full border px-3 py-1 text-sm text-slate-200"
                  style={{ borderColor: 'rgba(100,116,139,0.35)', background: 'rgba(15,23,42,0.72)' }}
                >
                  {team}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-500">{t('card.noTeams')}</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-800/80 pt-4">
          <p className="text-sm text-slate-400">
            {buildSummary(game, t)}
          </p>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300">
            {t('card.cta')}
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function EmptyArenaState({ t }: { t: ArenaTranslations }) {
  return (
    <section
      className="rounded-[28px] border px-6 py-10 text-center"
      style={{
        borderColor: 'rgba(148,163,184,0.14)',
        background: 'linear-gradient(180deg, rgba(8,12,24,0.9), rgba(4,8,15,0.82))',
      }}
    >
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc' }}
      >
        <Radar size={24} />
      </div>
      <h2 className="text-2xl font-semibold text-white">{t('emptyState.title')}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">
        {t('emptyState.description')}
      </p>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  backgroundImage,
  backgroundPosition = '72% 36%',
  backgroundSize = '180%',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent: string;
  backgroundImage?: string;
  backgroundPosition?: string;
  backgroundSize?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[22px] border px-4 py-4"
      style={{ borderColor: `${accent}33`, background: 'rgba(8, 17, 29, 0.46)' }}
    >
      {backgroundImage ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-no-repeat opacity-45"
            style={{
              backgroundImage: `url('${backgroundImage}')`,
              backgroundPosition,
              backgroundSize,
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(5,12,20,0.58),rgba(5,12,20,0.84))]" />
        </>
      ) : null}

      <div className="relative">
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: accent }}>
          {icon}
          {label}
        </div>
        <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

function InfoPill({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      className="rounded-[18px] border px-3 py-3"
      style={{ borderColor: 'rgba(51,65,85,0.72)', background: 'rgba(15,23,42,0.58)' }}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function buildSummary(
  game: ArenaGame,
  t: ArenaTranslations,
) {
  if (game.estado === 'en_curso') {
    return game.maxTurnos
      ? t('summary.liveWithMax', {
          turn: game.turnoActual,
          maxTurnos: game.maxTurnos,
          teams: game.equipoNombres.length,
        })
      : t('summary.live', {
          turn: game.turnoActual,
          teams: game.equipoNombres.length,
        });
  }

  if (game.estado === 'pendiente') {
    return t('summary.pending', { teams: game.equipoNombres.length });
  }

  return game.equipoNombres.length > 0
    ? t('summary.finishedWithTeams', {
        turn: game.turnoActual,
        teams: game.equipoNombres.length,
      })
    : t('summary.finished', { turn: game.turnoActual });
}

function formatDate(
  value: Date | null,
  locale: Locale,
  t: ArenaTranslations,
) {
  if (!value) return t('card.noDate');

  const languageTag = locale === 'eu' ? 'eu-ES' : 'es-ES';
  return new Intl.DateTimeFormat(languageTag, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function toDate(value: Date | number | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}
