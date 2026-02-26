import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { partidas, equipos, sugerencias, acusaciones } from '@/lib/db/schema';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AdminTeamsSection } from '@/components/admin/AdminTeamsSection';
import { desc } from 'drizzle-orm';

/**
 * UI-006 — Panel de administración
 */
export default async function AdminPage() {
  const session = await auth();
  const t = await getTranslations('admin');

  const allGames = await db.select().from(partidas).all();

  // Activity feed: last 10 events (sugerencias + acusaciones)
  const [recentSugerencias, recentAcusaciones, allEquipos] = await Promise.all([
    db.select().from(sugerencias).orderBy(desc(sugerencias.createdAt)).limit(10).all(),
    db.select().from(acusaciones).orderBy(desc(acusaciones.createdAt)).limit(10).all(),
    db.select().from(equipos).all(),
  ]);

  const equipoMap = new Map(allEquipos.map((e) => [e.id, e.nombre]));

  type ActivityEvent = {
    timestampMs: number;
    tipo: 'sugerencia' | 'descarte' | 'acusacion';
    actor: string;
    descripcion: string;
  };

  const activity: ActivityEvent[] = [];

  for (const s of recentSugerencias) {
    const nombre = equipoMap.get(s.equipoId) ?? 'Equipo desconocido';
    const tsMs =
      s.createdAt instanceof Date
        ? s.createdAt.getTime()
        : (s.createdAt as unknown as number) * 1000;
    activity.push({
      timestampMs: tsMs,
      tipo: s.refutadaPor ? 'descarte' : 'sugerencia',
      actor: nombre,
      descripcion: s.refutadaPor
        ? `${nombre} descartó hipótesis: ${s.sospechoso} · ${s.arma} · ${s.habitacion}`
        : `${nombre} investigó: ${s.sospechoso} · ${s.arma} · ${s.habitacion}`,
    });
  }

  for (const a of recentAcusaciones) {
    const nombre = equipoMap.get(a.equipoId) ?? 'Equipo desconocido';
    const tsMs =
      a.createdAt instanceof Date
        ? a.createdAt.getTime()
        : (a.createdAt as unknown as number) * 1000;
    activity.push({
      timestampMs: tsMs,
      tipo: 'acusacion',
      actor: nombre,
      descripcion: a.correcta
        ? `✅ ${nombre} resolvió el caso: ${a.sospechoso} · ${a.arma} · ${a.habitacion}`
        : `❌ ${nombre} acusó incorrectamente: ${a.sospechoso}`,
    });
  }

  activity.sort((a, b) => b.timestampMs - a.timestampMs);
  const recentActivity = activity.slice(0, 10);

  const statusColor: Record<string, string> = {
    pendiente: '#64748b',
    en_curso: '#22c55e',
    finalizada: '#f59e0b',
  };

  const tipoIcon: Record<string, string> = {
    sugerencia: '💬',
    descarte: '📊',
    acusacion: '🛑',
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8" style={{ color: '#f1f5f9' }}>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#f59e0b' }}>
            {t('titulo')}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            {session?.user?.email}
          </p>
        </div>
        <Link
          href="/admin/partidas/nueva"
          className="px-5 py-2 rounded-md font-semibold text-sm"
          style={{ background: '#f59e0b', color: '#0a0a0f' }}
        >
          {t('crearPartida')}
        </Link>
      </header>

      {/* Teams section — UI-006 */}
      <AdminTeamsSection />

      {/* Games section */}
      <section>
        <h2 className="text-xl font-semibold mb-4" style={{ color: '#f59e0b' }}>
          {t('partidas', { n: allGames.length })}
        </h2>
        {allGames.length === 0 ? (
          <p className="text-sm" style={{ color: '#64748b' }}>{t('sinPartidas')}</p>
        ) : (
          <ul className="space-y-3">
            {allGames.map((game) => (
              <li
                key={game.id}
                className="rounded-xl p-4 flex items-center justify-between"
                style={{ background: '#1a1a2e' }}
              >
                <div>
                  <p className="font-medium">{game.nombre}</p>
                  <p className="text-xs mt-1" style={{ color: '#64748b' }}>
                    {t('turno', { n: game.turnoActual })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs"
                    style={{
                      background: statusColor[game.estado] + '22',
                      color: statusColor[game.estado],
                    }}
                  >
                    {game.estado}
                  </span>
                  {game.estado === 'en_curso' && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs"
                      style={{ background: '#33415533', color: '#94a3b8' }}
                    >
                      {game.modoEjecucion}
                    </span>
                  )}
                  <Link
                    href={`/admin/partidas/${game.id}`}
                    className="text-xs px-3 py-1 rounded-md"
                    style={{ background: '#334155', color: '#f1f5f9' }}
                  >
                    {t('gestionar')}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Activity feed — API-019 */}
      <section>
        <h2 className="text-xl font-semibold mb-4" style={{ color: '#f59e0b' }}>
          Actividad reciente
        </h2>
        {recentActivity.length === 0 ? (
          <p className="text-sm" style={{ color: '#64748b' }}>Sin actividad aún.</p>
        ) : (
          <ul className="space-y-2">
            {recentActivity.map((ev, i) => (
              <li
                key={i}
                className="rounded-lg px-4 py-2 flex items-start gap-3 text-sm"
                style={{ background: '#1a1a2e' }}
              >
                <span className="mt-0.5 shrink-0">{tipoIcon[ev.tipo]}</span>
                <span style={{ color: '#cbd5e1' }}>{ev.descripcion}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
