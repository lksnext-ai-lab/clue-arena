import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { partidas } from '@/lib/db/schema';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AdminTeamsSection } from '@/components/admin/AdminTeamsSection';

/**
 * UI-006 — Panel de administración
 */
export default async function AdminPage() {
  const session = await auth();
  const t = await getTranslations('admin');

  const allGames = await db.select().from(partidas).all();

  const statusColor: Record<string, string> = {
    pendiente: '#64748b',
    en_curso: '#22c55e',
    finalizada: '#f59e0b',
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
    </div>
  );
}
