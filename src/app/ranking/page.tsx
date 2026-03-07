'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useInterval } from '@/lib/utils/useInterval';
import { apiFetch } from '@/lib/api/client';
import { formatPosicion } from '@/lib/utils/formatting';
import { useTranslations, useFormatter } from 'next-intl';
import type { RankingResponse, RankingEntry } from '@/types/api';

const MEDAL_ICONS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/**
 * UI-004 — Ranking del evento
 * Public page. Polls every 30s.
 */
export default function RankingPage() {
  const [ranking, setRanking] = useState<RankingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('ranking');
  const format = useFormatter();

  const fetchRanking = async () => {
    try {
      const data = await apiFetch<RankingResponse>('/ranking');
      setRanking(data);
      setError(null);
    } catch {
      setError(t('errorCarga'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useInterval(fetchRanking, 30_000);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">{t('titulo')}</h1>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-slate-600 border-t-cyan-400 animate-spin" />
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-md text-sm mb-4 bg-red-900/40 text-red-300 border border-red-500/30">
          {error}
        </div>
      )}

      {ranking && (
        <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="px-4 py-3 text-center font-medium text-slate-400 w-16">
                  {t('posicion')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">
                  {t('equipo')}
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">
                  {t('puntos')}
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-400 hidden sm:table-cell">
                  {t('partidas')}
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-400 hidden sm:table-cell">
                  {t('aciertos')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/70">
              {ranking.ranking.map((entry, idx) => {
                const medal = MEDAL_ICONS[entry.posicion];
                return (
                  <tr
                    key={entry.equipoId}
                    className={
                      idx === 0
                        ? 'bg-cyan-500/5'
                        : 'hover:bg-slate-700/30 transition-colors'
                    }
                  >
                    <td
                      className={`px-4 py-3 font-bold text-center ${
                        idx === 0
                          ? 'text-cyan-400'
                          : idx < 3
                            ? 'text-slate-300'
                            : 'text-slate-500'
                      }`}
                    >
                      {medal ?? formatPosicion(entry.posicion)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-200 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-slate-700 flex-shrink-0 overflow-hidden">
                        {entry.avatarUrl && (
                          <Image
                            src={entry.avatarUrl}
                            alt={`Avatar de ${entry.equipoNombre}`}
                            width={32}
                            height={32}
                            className="object-cover w-full h-full"
                            unoptimized
                          />
                        )}
                      </div>
                      <span className="truncate">{entry.equipoNombre}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-cyan-300">
                      {format.number(entry.puntos, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400 hidden sm:table-cell">
                      {entry.partidasJugadas}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400 hidden sm:table-cell">
                      {entry.aciertos}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {ranking && (
        <p className="text-xs text-center mt-4 text-slate-600">
          {t('actualizacion')}
        </p>
      )}
    </div>
  );
}
