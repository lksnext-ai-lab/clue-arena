import { db } from '@/lib/db';
import { partidas } from '@/lib/db/schema';
import { getTranslations } from 'next-intl/server';
import { desc } from 'drizzle-orm';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

/**
 * Admin Partidas Management Page
 */
export default async function AdminPartidasPage() {
  const t = await getTranslations('admin');
  const allGames = await db.select().from(partidas).orderBy(desc(partidas.createdAt)).all();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 text-slate-200">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400">
            {t('gestionPartidas')}
          </h1>
          <p className="text-sm mt-1 text-slate-500">
            {t('gestionPartidasDesc')}
          </p>
        </div>
        <Link
          href="/admin/partidas/nueva"
          className="px-5 py-2 rounded-md font-semibold text-sm bg-cyan-500 text-slate-900 hover:bg-cyan-400 transition-colors"
        >
          {t('crearPartida')}
        </Link>
      </header>

      {/* Games section */}
      <section>
        {allGames.length === 0 ? (
          <p className="text-sm text-slate-500">{t('sinPartidas')}</p>
        ) : (
          <ul className="space-y-3">
            {allGames.map((game) => (
              <li
                key={game.id}
                className="rounded-xl p-4 flex items-center justify-between bg-slate-800 border border-slate-700"
              >
                <div>
                  <p className="font-medium">{game.nombre}</p>
                  <p className="text-xs mt-1 text-slate-500">
                    {t('turno', { n: game.turnoActual })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <GameStatusBadge estado={game.estado as 'pendiente' | 'en_curso' | 'finalizada'} />
                  {game.estado === 'en_curso' && (
                    <Badge variant="secondary">{game.modoEjecucion}</Badge>
                  )}
                  <Link
                    href={`/admin/partidas/${game.id}`}
                    className="text-xs px-3 py-1 rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
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
