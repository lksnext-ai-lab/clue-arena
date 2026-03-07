// src/components/admin/TournamentStandingsSection.tsx
'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import type { TournamentStandingsResponse } from '@/types/api';

interface Props {
  tournamentId: string;
  refreshKey:   number;  // increment to trigger refetch
}

export function TournamentStandingsSection({ tournamentId, refreshKey }: Props) {
  const t = useTranslations('admin');
  const [data, setData]       = useState<TournamentStandingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<TournamentStandingsResponse>(`/tournaments/${tournamentId}/standings`)
      .then((d) => { setData(d); setError(null); })
      .catch(() => setError(t('torneoErrorCargar')))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, refreshKey]);

  return (
    <section>
      <h2 className="text-lg font-semibold text-cyan-400 mb-3">{t('torneoClasificacion')}</h2>

      {loading && (
        <p className="text-sm text-slate-500">{t('torneoCargando')}</p>
      )}

      {error && !loading && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {data && !loading && (
        data.standings.length === 0 ? (
          <p className="text-sm text-slate-500">{t('torneoNoClasificacion')}</p>
        ) : (
          <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/50">
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-2.5 text-center text-slate-500 w-12">{t('torneoRank')}</th>
                  <th className="px-4 py-2.5 text-left  text-slate-500">Equipo</th>
                  <th className="px-4 py-2.5 text-right text-slate-500">{t('torneoPuntos')}</th>
                  <th className="px-4 py-2.5 text-right text-slate-500 hidden sm:table-cell">{t('torneoPartidas')}</th>
                  <th className="px-4 py-2.5 text-right text-slate-500 hidden sm:table-cell">{t('torneoVictorias')}</th>
                  <th className="px-4 py-2.5 text-right text-slate-500 hidden md:table-cell">{t('torneoEliminaciones')}</th>
                  <th className="px-4 py-2.5 text-center text-slate-500 hidden sm:table-cell">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/70">
                {data.standings.map((entry, idx) => (
                  <tr
                    key={entry.teamId}
                    className={
                      entry.isEliminated
                        ? 'opacity-50'
                        : idx === 0
                          ? 'bg-cyan-500/5'
                          : 'hover:bg-slate-700/30 transition-colors'
                    }
                  >
                    <td className={`px-4 py-2.5 font-bold text-center ${idx === 0 ? 'text-cyan-400' : 'text-slate-500'}`}>
                      {entry.rank}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-200">
                      {entry.teamName}
                      {entry.groupIndex !== null && (
                        <span className="ml-2 text-xs text-slate-500">
                          {t('torneoGrupo', { n: entry.groupIndex + 1 })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-cyan-300">
                      {entry.totalScore}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-400 hidden sm:table-cell">
                      {entry.gamesPlayed}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-400 hidden sm:table-cell">
                      {entry.wins}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-400 hidden md:table-cell">
                      {entry.eliminations}
                    </td>
                    <td className="px-4 py-2.5 text-center hidden sm:table-cell">
                      {entry.isEliminated ? (
                        <span className="text-xs text-red-400">{t('torneoEliminado')}</span>
                      ) : entry.advancedToPlayoffs ? (
                        <span className="text-xs text-purple-400">Playoffs</span>
                      ) : (
                        <span className="text-xs text-green-400">{t('torneoActivo')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </section>
  );
}
