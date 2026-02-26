'use client';

import { useEffect, useState } from 'react';
import { useInterval } from '@/lib/utils/useInterval';
import { apiFetch } from '@/lib/api/client';
import { formatPosicion } from '@/lib/utils/formatting';
import { useTranslations, useFormatter } from 'next-intl';
import type { RankingResponse } from '@/types/api';

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

  useEffect(() => { fetchRanking(); }, []);
  useInterval(fetchRanking, 30_000);

  return (
    <div className="p-6 max-w-2xl mx-auto" style={{ color: '#f1f5f9' }}>
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold" style={{ color: '#f59e0b', fontFamily: 'Georgia, serif' }}>
          Clue Arena
        </h1>
          <p className="text-lg mt-1" style={{ color: '#94a3b8' }}>{t('titulo')}</p>
      </header>

      {isLoading && (
        <p className="text-center" style={{ color: '#64748b' }}>{t('cargando')}</p>
      )}

      {error && (
        <div className="px-4 py-3 rounded-md text-sm mb-4" style={{ background: '#7f1d1d', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {ranking && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#1a1a2e' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                <th className="px-4 py-3 text-left" style={{ color: '#64748b' }}>{t('posicion')}</th>
                <th className="px-4 py-3 text-left" style={{ color: '#64748b' }}>{t('equipo')}</th>
                <th className="px-4 py-3 text-right" style={{ color: '#64748b' }}>{t('puntos')}</th>
                <th className="px-4 py-3 text-right" style={{ color: '#64748b' }}>{t('partidas')}</th>
                <th className="px-4 py-3 text-right" style={{ color: '#64748b' }}>{t('aciertos')}</th>
              </tr>
            </thead>
            <tbody>
              {ranking.ranking.map((entry, idx) => (
                <tr
                  key={entry.equipoId}
                  style={{
                    borderBottom: '1px solid #1e293b',
                    background: idx === 0 ? 'rgba(245, 158, 11, 0.08)' : undefined,
                  }}
                >
                  <td className="px-4 py-3 font-bold" style={{ color: idx === 0 ? '#f59e0b' : '#64748b' }}>
                    {formatPosicion(entry.posicion)}
                  </td>
                  <td className="px-4 py-3 font-medium">{entry.equipoNombre}</td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: '#f59e0b' }}>
                    {format.number(entry.puntos, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: '#94a3b8' }}>
                    {entry.partidasJugadas}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: '#94a3b8' }}>
                    {entry.aciertos}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ranking && (
        <p className="text-xs text-center mt-4" style={{ color: '#475569' }}>
          {t('actualizacion')}
        </p>
      )}
    </div>
  );
}
