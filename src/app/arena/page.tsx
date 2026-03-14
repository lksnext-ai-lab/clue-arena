import Link from 'next/link';
import type { ReactNode } from 'react';
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

const SECTION_META: Record<GameStatus, { eyebrow: string; title: string; description: string }> = {
  en_curso: {
    eyebrow: 'Directo',
    title: 'Partidas activas',
    description: 'La arena está viva. Entra en cualquier mesa para seguir turnos, deducciones y cambios de ritmo.',
  },
  pendiente: {
    eyebrow: 'Siguiente ola',
    title: 'A punto de empezar',
    description: 'Mesas preparadas para arrancar. Perfectas para anticipar cruces y equipos protagonistas.',
  },
  finalizada: {
    eyebrow: 'Reciente',
    title: 'Últimos cierres',
    description: 'Consulta las partidas ya resueltas y salta a la vista completa para revisar cómo terminaron.',
  },
};

/**
 * /arena — Gateway hacia las vistas de espectador.
 * Lista las partidas en curso y las últimas finalizadas.
 * Página pública accesible sin autenticación.
 */
export default async function ArenaGatewayPage() {
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
                Arena de competición
              </div>

              <div className="space-y-3">
                <h1 className="max-w-4xl text-3xl font-semibold leading-tight text-white sm:text-5xl">
                  Sigue el pulso del torneo y entra en cualquier partida con un clic.
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                  Esta vista prioriza lo que está ocurriendo ahora, separa claramente lo que viene
                  después y te deja acceder a la arena sin fricción.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard
                  icon={<Sparkles size={16} />}
                  label="En vivo"
                  value={String(enCurso.length)}
                  accent="#4ade80"
                />
                <StatCard
                  icon={<Clock3 size={16} />}
                  label="Pendientes"
                  value={String(pendientes.length)}
                  accent="#fbbf24"
                />
                <StatCard
                  icon={<Users2 size={16} />}
                  label="Equipos visibles"
                  value={String(uniqueTeams.size)}
                  accent="#38bdf8"
                />
              </div>
            </div>

            <aside
              className="flex h-full flex-col justify-between rounded-[28px] border p-5"
              style={{
                borderColor: 'rgba(148,163,184,0.12)',
                background: 'linear-gradient(180deg, rgba(10,18,32,0.9), rgba(4,8,15,0.88))',
              }}
            >
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Partida destacada
                </p>
                {featuredGame ? (
                  <>
                    <p className="text-xl font-semibold text-white">{featuredGame.nombre}</p>
                    <p className="text-sm leading-6 text-slate-300">
                      {buildSummary(featuredGame)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-semibold text-white">Esperando actividad</p>
                    <p className="text-sm leading-6 text-slate-400">
                      Cuando se creen partidas, aparecerán aquí con acceso directo a la arena.
                    </p>
                  </>
                )}
              </div>

              {featuredGame ? (
                <Link
                  href={`/partidas/${featuredGame.id}`}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #22c55e, #06b6d4)', color: '#03121f' }}
                >
                  Entrar en la arena
                  <ArrowRight size={16} />
                </Link>
              ) : null}
            </aside>
          </div>
        </section>

        {allGames.length === 0 ? (
          <EmptyArenaState />
        ) : (
          <div className="grid gap-6">
            <GameSection
              status="en_curso"
              games={enCurso}
              emptyMessage="No hay ninguna partida activa ahora mismo. En cuanto arranque una, aparecerá aquí con prioridad visual."
            />
            <GameSection
              status="pendiente"
              games={pendientes}
              emptyMessage="No hay mesas pendientes de inicio en este momento."
            />
            <GameSection
              status="finalizada"
              games={finalizadas}
              emptyMessage="Aún no hay partidas finalizadas para revisar."
            />
          </div>
        )}
      </div>
    </div>
  );
}

function GameSection({
  status,
  games,
  emptyMessage,
}: {
  status: GameStatus;
  games: ArenaGame[];
  emptyMessage: string;
}) {
  const meta = SECTION_META[status];

  return (
    <section
      className="overflow-hidden rounded-[28px] border px-5 py-5 sm:px-6"
      style={{
        borderColor: 'rgba(148,163,184,0.14)',
        background: 'linear-gradient(180deg, rgba(8,12,24,0.9), rgba(4,8,15,0.82))',
      }}
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            {meta.eyebrow}
          </p>
          <h2 className="text-2xl font-semibold text-white">{meta.title}</h2>
          <p className="max-w-3xl text-sm leading-6 text-slate-400">{meta.description}</p>
        </div>
        <p className="text-sm font-medium text-slate-500">
          {games.length} {games.length === 1 ? 'partida' : 'partidas'}
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
            <GameCard key={game.id} game={game} highlight={status === 'en_curso'} />
          ))}
        </div>
      )}
    </section>
  );
}

function GameCard({ game, highlight }: { game: ArenaGame; highlight?: boolean }) {
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
    ? formatDate(game.finishedAt)
    : game.estado === 'en_curso'
      ? formatDate(game.startedAt)
      : formatDate(game.createdAt);

  const contextPrefix = game.estado === 'finalizada'
    ? 'Cerrada'
    : game.estado === 'en_curso'
      ? 'Empezó'
      : 'Creada';

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
                ? 'Siguiendo en directo'
                : game.estado === 'pendiente'
                  ? 'Lista para arrancar'
                  : 'Revisión disponible'}
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
            label="Turno"
            value={game.maxTurnos ? `${game.turnoActual} / ${game.maxTurnos}` : String(game.turnoActual)}
          />
          <InfoPill
            icon={<Users2 size={15} />}
            label="Equipos"
            value={String(game.equipoNombres.length)}
          />
          <InfoPill
            icon={<Trophy size={15} />}
            label="Modo"
            value={game.estado === 'finalizada' ? 'Resumen' : 'Seguimiento'}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Participantes
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
              <span className="text-sm text-slate-500">Equipos pendientes de asignar</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-800/80 pt-4">
          <p className="text-sm text-slate-400">
            {buildSummary(game)}
          </p>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300">
            Abrir arena
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function EmptyArenaState() {
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
      <h2 className="text-2xl font-semibold text-white">La arena todavía no tiene mesas activas</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">
        En cuanto el evento cree sus primeras partidas, esta pantalla se convertirá en el punto de
        entrada para seguirlas y abrir cada vista de espectador.
      </p>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-[22px] border px-4 py-4"
      style={{ borderColor: `${accent}33`, background: 'rgba(8, 17, 29, 0.46)' }}
    >
      <div className="flex items-center gap-2 text-sm font-medium" style={{ color: accent }}>
        {icon}
        {label}
      </div>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
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

function buildSummary(game: ArenaGame) {
  if (game.estado === 'en_curso') {
    return `Turno ${game.turnoActual}${game.maxTurnos ? ` de ${game.maxTurnos}` : ''} con ${game.equipoNombres.length} equipos en juego.`;
  }

  if (game.estado === 'pendiente') {
    return `${game.equipoNombres.length} equipos listos para entrar en mesa.`;
  }

  return `Partida cerrada tras ${game.turnoActual} turnos${game.equipoNombres.length ? ` y ${game.equipoNombres.length} equipos` : ''}.`;
}

function formatDate(value: Date | null) {
  if (!value) return 'sin fecha';

  return new Intl.DateTimeFormat('es-ES', {
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
