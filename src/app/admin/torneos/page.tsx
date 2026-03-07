// GET /admin/torneos — list all tournaments
import { db } from '@/lib/db';
import { tournaments, tournamentTeams } from '@/lib/db/schema';
import { getTranslations } from 'next-intl/server';
import { desc } from 'drizzle-orm';
import { TournamentStatusBadge, FormatBadge } from '@/components/admin/TournamentStatusBadge';
import Link from 'next/link';

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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 text-slate-200">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400">
            {t('gestionTorneos')}
          </h1>
          <p className="text-sm mt-1 text-slate-500">
            {t('gestionTorneosDesc')}
          </p>
        </div>
        <Link
          href="/admin/torneos/nueva"
          className="px-5 py-2 rounded-md font-semibold text-sm bg-cyan-500 text-slate-900 hover:bg-cyan-400 transition-colors"
        >
          {t('crearTorneo')}
        </Link>
      </header>

      <section>
        {allTournaments.length === 0 ? (
          <p className="text-sm text-slate-500">{t('sinTorneos')}</p>
        ) : (
          <ul className="space-y-3">
            {allTournaments.map((torneo) => (
              <li
                key={torneo.id}
                className="rounded-xl p-4 flex items-center justify-between bg-slate-800 border border-slate-700 gap-4"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{torneo.name}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <FormatBadge format={torneo.format} />
                    <span className="text-xs text-slate-500">
                      {teamCounts[torneo.id] ?? 0} equipos
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <TournamentStatusBadge status={torneo.status as 'draft' | 'active' | 'finished'} />
                  <Link
                    href={`/admin/torneos/${torneo.id}`}
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
