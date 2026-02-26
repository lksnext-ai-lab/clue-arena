'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api/client';
import { useInterval } from '@/lib/utils/useInterval';
import { useTranslations } from 'next-intl';
import { RingChart } from './RingChart';
import { StageBarChart } from './StageBarChart';

interface TeamStats {
  equipoId: string;
  nombre: string;
  progressoPct: number;
  precisionPct: number;
  avgResolutionMin: number;
  puntosPorEtapa: Array<{
    etapa: 'Pistas' | 'Interrogatorios' | 'Descarte';
    puntos: number;
  }>;
}

interface TeamStatsSectionProps {
  equipoId: string;
}

// Default stats to show when no data yet (gives visual context)
const DEFAULT_STATS: TeamStats = {
  equipoId: '',
  nombre: '—',
  progressoPct: 0,
  precisionPct: 0,
  avgResolutionMin: 0,
  puntosPorEtapa: [
    { etapa: 'Pistas', puntos: 0 },
    { etapa: 'Interrogatorios', puntos: 0 },
    { etapa: 'Descarte', puntos: 0 },
  ],
};

export function TeamStatsSection({ equipoId }: TeamStatsSectionProps) {
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useTranslations('dashboard');

  useEffect(() => {
    apiFetch<TeamStats>(`/teams/${equipoId}/stats`)
      .then(setStats)
      .catch(() => setStats(DEFAULT_STATS))
      .finally(() => setLoading(false));
  }, [equipoId]);

  useInterval(() => {
    apiFetch<TeamStats>(`/teams/${equipoId}/stats`)
      .then(setStats)
      .catch(() => {});
  }, 30_000);

  const data = stats ?? DEFAULT_STATS;

  return (
    <section
      style={{
        background: 'linear-gradient(160deg,#1e293b 0%,#0f172a 100%)',
        border: '1px solid #334155', borderRadius: 16, padding: 24,
        opacity: loading ? 0.7 : 1, transition: 'opacity 0.3s',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#22d3ee', textTransform: 'uppercase' }}>
          {t('estadisticasTitulo')}
        </h2>
        {data.nombre !== '—' && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
            background: 'rgba(34,211,238,0.08)', color: '#67e8f9', border: '1px solid rgba(34,211,238,0.15)',
          }}>
            {data.nombre}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 28 }}>
        {/* Three ring charts */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-end' }}>
          <RingChart value={data.progressoPct} label={t('progresoInvestigacion')} unit="%" />
          <RingChart value={data.precisionPct} label={t('precisionHipotesis')} unit="%" />
          <RingChart value={data.avgResolutionMin} max={data.avgResolutionMin > 0 ? data.avgResolutionMin + 30 : 90} label={t('tiempoResolucion')} unit=" min" />
        </div>

        {/* Bar chart */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <StageBarChart data={data.puntosPorEtapa} />
        </div>
      </div>
    </section>
  );
}
