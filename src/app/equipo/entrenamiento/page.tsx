/**
 * Server Component — Lists training games for the authenticated equipo.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import {
  ArrowRight,
  Bot,
  Clock3,
  Orbit,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react';
import { db } from '@/lib/db';
import { partidasEntrenamiento, turnosEntrenamiento } from '@/lib/db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { auth } from '@/lib/auth/config';
import { isAuthDisabled, DEV_COOKIE, DEV_USERS } from '@/lib/auth/dev';
import { Badge } from '@/components/ui/badge';
import { TrainingHistoryActions } from './TrainingHistoryActions';
import { TrainingGameDeleteButton } from './TrainingGameDeleteButton';

function getActionType(raw: string | null): string | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { action?: { type?: string } };
    return parsed.action?.type ?? null;
  } catch {
    return null;
  }
}

async function getEquipoId(): Promise<string | null> {
  if (isAuthDisabled()) {
    const cookieStore = await cookies();
    const devRole = cookieStore.get(DEV_COOKIE)?.value as keyof typeof DEV_USERS | undefined;
    const user = devRole ? DEV_USERS[devRole] : undefined;
    if (!user || user.rol !== 'equipo') return null;
    return user.equipo?.id ?? null;
  }
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as { rol?: string; equipo?: { id: string } };
  if (u.rol !== 'equipo') return null;
  return u.equipo?.id ?? null;
}

const BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  en_curso: 'default',
  finalizada: 'secondary',
  abortada: 'destructive',
};

const BADGE_LABEL: Record<string, string> = {
  en_curso: 'En curso',
  finalizada: 'Finalizada',
  abortada: 'Abortada',
};

function formatDate(value: Date | number | null | undefined): string {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSeed(seed: string | null): string {
  if (!seed) return 'Aleatoria';
  return seed.length > 14 ? `${seed.slice(0, 14)}…` : seed;
}

function getOutcomeLabel(
  ganadorId: string | null | undefined,
  estado: string,
  equipoId: string,
): string {
  if (ganadorId === equipoId) return 'Victoria de tu equipo';
  if (ganadorId) return `Ganó Bot ${ganadorId.replace('bot-', '')}`;
  if (estado === 'abortada') return 'Sesión abortada';
  return 'Sin resultado';
}

function getCardTone(estado: string): string {
  if (estado === 'en_curso') {
    return 'border-emerald-400/30 bg-[linear-gradient(160deg,rgba(6,78,59,0.34),rgba(2,6,23,0.9))]';
  }
  if (estado === 'abortada') {
    return 'border-rose-400/20 bg-[linear-gradient(160deg,rgba(127,29,29,0.26),rgba(2,6,23,0.92))]';
  }
  return 'border-white/10 bg-[linear-gradient(160deg,rgba(15,23,42,0.94),rgba(2,6,23,0.92))]';
}

export default async function EntrenamientoPage() {
  const equipoId = await getEquipoId();
  if (!equipoId) redirect('/login');

  const rows = await db
    .select()
    .from(partidasEntrenamiento)
    .where(eq(partidasEntrenamiento.equipoId, equipoId))
    .orderBy(desc(partidasEntrenamiento.createdAt))
    .limit(20)
    .all();

  const enriched = await Promise.all(
    rows.map(async (row) => {
      const [{ total: numTurnos }] = await db
        .select({ total: count() })
        .from(turnosEntrenamiento)
        .where(eq(turnosEntrenamiento.partidaId, row.id));
      const turns = await db
        .select({ accion: turnosEntrenamiento.accion })
        .from(turnosEntrenamiento)
        .where(eq(turnosEntrenamiento.partidaId, row.id))
        .all();
      const resultado = row.resultadoJson
        ? (JSON.parse(row.resultadoJson) as { ganadorId: string | null; puntosSimulados: number })
        : null;
      const isPassOnly =
        row.estado === 'finalizada' &&
        turns.length > 0 &&
        turns.every((turn) => getActionType(turn.accion) === 'pass');
      return { ...row, numTurnos, resultado, isPassOnly };
    }),
  );

  const activeGame = enriched.find((g) => g.estado === 'en_curso');
  const cleanableCount = enriched.filter((g) => g.estado !== 'en_curso').length;
  const completedGames = enriched.filter((g) => g.estado === 'finalizada');
  const victories = completedGames.filter((g) => g.resultado?.ganadorId === equipoId).length;
  const averageTurns =
    enriched.length > 0
      ? Math.round(enriched.reduce((sum, row) => sum + row.numTurnos, 0) / enriched.length)
      : 0;
  const totalSimulatedPoints = completedGames.reduce(
    (sum, row) => sum + (row.resultado?.puntosSimulados ?? 0),
    0,
  );

  return (
    <div className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[url('/fondo-train.webp')] bg-cover bg-center bg-no-repeat opacity-30" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(2,6,23,0.72),rgba(2,6,23,0.88))]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_24%)]" />

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <section className="relative overflow-hidden rounded-[28px] border border-cyan-400/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),linear-gradient(145deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)] sm:p-8">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-10 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
              <Sparkles size={14} />
              Laboratorio de entrenamiento
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Perfecciona tu agente antes de salir a la arena
              </h1>
              <p className="max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                Revisa sesiones recientes, retoma la partida activa y detecta patrones rápidos
                entre bots, turnos y resultados sin perderte en tablas.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/equipo/entrenamiento/nueva"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              <Zap size={16} />
              Iniciar entrenamiento
            </Link>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 backdrop-blur">
              <span className="block text-xs uppercase tracking-[0.2em] text-slate-500">
                Últimas sesiones
              </span>
              <span className="mt-1 block text-lg font-semibold text-white">{enriched.length}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-emerald-400/15 bg-emerald-400/10 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
              Activas ahora
            </span>
            <Orbit className="text-emerald-300" size={18} />
          </div>
          <p className="mt-4 text-3xl font-semibold text-white">{activeGame ? '1' : '0'}</p>
          <p className="mt-2 text-sm text-emerald-100/75">
            {activeGame ? 'Hay una simulación corriendo en segundo plano.' : 'No hay sesiones en curso.'}
          </p>
        </div>

        <div className="rounded-3xl border border-cyan-400/15 bg-cyan-400/10 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
              Victorias
            </span>
            <Trophy className="text-cyan-200" size={18} />
          </div>
          <p className="mt-4 text-3xl font-semibold text-white">{victories}</p>
          <p className="mt-2 text-sm text-cyan-100/75">
            {completedGames.length > 0
              ? `${Math.round((victories / completedGames.length) * 100)}% de cierre ganador`
              : 'Todavía no hay partidas finalizadas.'}
          </p>
        </div>

        <div className="rounded-3xl border border-amber-400/15 bg-amber-400/10 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/80">
              Turnos medios
            </span>
            <Clock3 className="text-amber-200" size={18} />
          </div>
          <p className="mt-4 text-3xl font-semibold text-white">{averageTurns}</p>
          <p className="mt-2 text-sm text-amber-100/75">
            Promedio de duración por sesión registrada.
          </p>
        </div>

        <div className="rounded-3xl border border-fuchsia-400/15 bg-fuchsia-400/10 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-200/80">
              Puntos simulados
            </span>
            <Swords className="text-fuchsia-200" size={18} />
          </div>
          <p className="mt-4 text-3xl font-semibold text-white">{totalSimulatedPoints}</p>
          <p className="mt-2 text-sm text-fuchsia-100/75">
            Suma de puntuación conseguida en partidas cerradas.
          </p>
        </div>
      </section>

      <TrainingHistoryActions
        cleanableCount={cleanableCount}
      />

      {activeGame && (
        <section className="rounded-[26px] border border-emerald-400/25 bg-[linear-gradient(140deg,rgba(6,95,70,0.26),rgba(2,6,23,0.96))] p-5 shadow-[0_20px_60px_rgba(16,185,129,0.12)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                <Orbit size={14} />
                Partida activa
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Sigue la simulación en vivo</h2>
                <p className="mt-1 text-sm text-emerald-50/80">
                  {activeGame.numBots} bots, {activeGame.numTurnos} turnos registrados y semilla{' '}
                  <span className="font-mono text-emerald-200">{formatSeed(activeGame.seed)}</span>.
                </p>
              </div>
            </div>

            <Link
              href={`/equipo/entrenamiento/${activeGame.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-300/12 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/18"
            >
              Ver partida activa
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Historial reciente</h2>
          <p className="mt-1 text-sm text-slate-400">
            Las 20 últimas sesiones para comparar configuraciones y resultados.
          </p>
        </div>
      </div>

      {enriched.length === 0 ? (
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.94),rgba(2,6,23,0.98))] px-6 py-14 text-center shadow-[0_24px_70px_rgba(2,6,23,0.35)]">
          <div className="mx-auto flex max-w-md flex-col items-center space-y-4">
            <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 p-4 text-cyan-200">
              <Bot size={28} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white">Tu laboratorio está listo</h3>
              <p className="text-sm leading-6 text-slate-400">
                Aún no has ejecutado entrenamientos. Lanza una partida con bots para empezar a
                iterar prompts, estrategias y semillas reproducibles.
              </p>
            </div>
            <Link
              href="/equipo/entrenamiento/nueva"
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Crear primera sesión
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {enriched.map((row) => {
            const outcomeLabel = getOutcomeLabel(row.resultado?.ganadorId, row.estado, equipoId);
            const isWinner = row.resultado?.ganadorId === equipoId;
            const resultTone =
              row.estado === 'abortada'
                ? 'text-rose-200'
                : isWinner
                ? 'text-emerald-200'
                : row.resultado?.ganadorId
                ? 'text-amber-200'
                : 'text-slate-300';

            return (
              <article
                key={row.id}
                className={`group relative overflow-hidden rounded-[26px] border p-5 shadow-[0_18px_55px_rgba(2,6,23,0.28)] transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30 ${getCardTone(row.estado)}`}
              >
                <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-white/5 blur-2xl transition group-hover:bg-cyan-300/10" />

                <div className="relative space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        {formatDate(row.createdAt)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={BADGE_VARIANT[row.estado] ?? 'outline'}>
                          {BADGE_LABEL[row.estado] ?? row.estado}
                        </Badge>
                        {row.isPassOnly && (
                          <span className="inline-flex items-center rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                            Solo pass
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Link
                        href={`/equipo/entrenamiento/${row.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-100"
                      >
                        Ver detalle
                        <ArrowRight size={14} />
                      </Link>
                      {row.estado !== 'en_curso' && (
                        <TrainingGameDeleteButton gameId={row.id} />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Bots</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{row.numBots}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Turnos</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{row.numTurnos}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Semilla</p>
                      <p className="mt-2 truncate font-mono text-sm text-slate-200">{formatSeed(row.seed)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          Resultado
                        </p>
                        <p className={`mt-2 text-lg font-semibold ${resultTone}`}>{outcomeLabel}</p>
                      </div>
                      {typeof row.resultado?.puntosSimulados === 'number' && (
                        <div className="text-right">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                            Puntos
                          </p>
                          <p className="mt-2 text-xl font-semibold text-white">
                            {row.resultado.puntosSimulados}
                          </p>
                        </div>
                      )}
                    </div>
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
