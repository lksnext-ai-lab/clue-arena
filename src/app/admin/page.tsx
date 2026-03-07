import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { sugerencias, acusaciones, equipos } from '@/lib/db/schema';
import { getTranslations } from 'next-intl/server';
import { desc } from 'drizzle-orm';

/**
 * UI-006 — Panel de administración
 */
export default async function AdminPage() {
  const session = await auth();
  const t = await getTranslations('admin');

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

  const tipoIcon: Record<string, string> = {
    sugerencia: '💬',
    descarte: '📊',
    acusacion: '🛑',
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 text-slate-200">
      <header>
        <div>
          <h1 className="text-3xl font-bold text-cyan-400">
            {t('titulo')}
          </h1>
          <p className="text-sm mt-1 text-slate-500">
            {session?.user?.email}
          </p>
        </div>
      </header>

      {/* Activity feed — API-019 */}
      <section>
        <h2 className="text-xl font-semibold mb-4 text-cyan-400">
          Actividad reciente
        </h2>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-slate-500">Sin actividad aún.</p>
        ) : (
          <ul className="space-y-2">
            {recentActivity.map((ev, i) => (
              <li
                key={i}
                className="rounded-lg px-4 py-2 flex items-start gap-3 text-sm bg-slate-800 border border-slate-700"
              >
                <span className="mt-0.5 shrink-0">{tipoIcon[ev.tipo]}</span>
                <span className="text-slate-300">{ev.descripcion}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
