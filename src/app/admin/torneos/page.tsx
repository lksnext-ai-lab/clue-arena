import Link from 'next/link';
import { ArrowRight, CalendarDays, Crown, Plus, Radar, Sparkles, Swords, Trophy, Users } from 'lucide-react';
import { desc } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { tournaments, tournamentTeams } from '@/lib/db/schema';
import { FormatBadge, TournamentStatusBadge } from '@/components/admin/TournamentStatusBadge';

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatStatusLabel(status: 'draft' | 'active' | 'finished') {
  if (status === 'draft') return 'En preparación';
  if (status === 'active') return 'En juego';
  return 'Archivado';
}

export default async function AdminTorneosPage() {
  const t = await getTranslations('admin');

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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_28%),linear-gradient(180deg,_#08111d_0%,_#050914_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.94),rgba(9,14,28,0.98))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.55)] sm:p-8">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,_rgba(250,204,21,0.18),_transparent_58%)]" />
          <div className="absolute -left-10 top-10 h-36 w-36 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_0.9fr] lg:items-end">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-200">
                <Radar size={14} />
                Operación torneo
              </div>

              <div className="max-w-2xl space-y-3">
                <h1 className="font-serif text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  {t('gestionTorneos')}
                </h1>
                <p className="max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                  Centro de control para preparar brackets, lanzar rondas y seguir la salud competitiva del evento sin perder contexto.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Torneos</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{metrics.total}</p>
                  <p className="mt-1 text-sm text-slate-400">Configurados para el evento</p>
                </div>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-emerald-200">Activos</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{metrics.active}</p>
                  <p className="mt-1 text-sm text-emerald-100/80">En seguimiento ahora mismo</p>
                </div>
                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-100">Borradores</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{metrics.draft}</p>
                  <p className="mt-1 text-sm text-amber-100/80">Pendientes de completar</p>
                </div>
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-100">Inscripciones</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{metrics.teams}</p>
                  <p className="mt-1 text-sm text-cyan-100/80">Equipos repartidos en torneos</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-[28px] border border-white/10 bg-slate-950/50 p-5 backdrop-blur">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Torneo destacado</p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {spotlight?.name ?? 'Todavía no hay torneos'}
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
                        {teamCounts[spotlight.id] ?? 0} equipos
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Users size={14} />
                          <span className="text-xs uppercase tracking-[0.2em]">Roster</span>
                        </div>
                        <p className="mt-2 text-lg font-semibold text-white">{teamCounts[spotlight.id] ?? 0}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Swords size={14} />
                          <span className="text-xs uppercase tracking-[0.2em]">Estado</span>
                        </div>
                        <p className="mt-2 text-lg font-semibold text-white">{formatStatusLabel(spotlight.status as 'draft' | 'active' | 'finished')}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <div className="flex items-center gap-2 text-slate-400">
                          <CalendarDays size={14} />
                          <span className="text-xs uppercase tracking-[0.2em]">Creado</span>
                        </div>
                        <p className="mt-2 text-lg font-semibold text-white">{formatDate(spotlight.createdAt?.toISOString() ?? null)}</p>
                      </div>
                    </div>

                    <Link
                      href={`/admin/torneos/${spotlight.id}`}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
                    >
                      Abrir centro de mando
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    Crea el primer torneo para empezar a orquestar inscripciones, rondas y clasificación desde un único sitio.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Inventario operativo</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Todos los torneos del evento</h2>
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
                  Empieza por definir un formato y una narrativa clara para que las inscripciones y las rondas nazcan ya con estructura.
                </p>
              </div>
              <Link
                href="/admin/torneos/nueva"
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950"
              >
                <Plus size={16} />
                Crear el primero
              </Link>
            </div>
          </section>
        ) : (
          <section className="grid gap-4 xl:grid-cols-2">
            {allTournaments.map((torneo, index) => {
              const teamCount = teamCounts[torneo.id] ?? 0;
              const isSpotlight = index === 0;

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
                          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                            Gestiona inscripciones, despliegue de rondas y evolución de la clasificación desde una vista enfocada en operación.
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Equipos</p>
                        <p className="mt-2 text-3xl font-semibold text-white">{teamCount}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Estado</p>
                        <p className="mt-3 text-base font-semibold text-white">{formatStatusLabel(torneo.status as 'draft' | 'active' | 'finished')}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Formato</p>
                        <p className="mt-3 text-base font-semibold text-white">{torneo.format.replace(/_/g, ' ')}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Creación</p>
                        <p className="mt-3 text-base font-semibold text-white">{formatDate(torneo.createdAt?.toISOString() ?? null)}</p>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                      <p className="text-sm text-slate-400">
                        {teamCount >= 2
                          ? 'Listo para convertirse en un flujo operativo completo.'
                          : 'Todavía necesita más equipos para arrancar con seguridad.'}
                      </p>
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
