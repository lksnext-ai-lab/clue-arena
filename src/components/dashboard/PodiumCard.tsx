'use client';

import { useTranslations, useFormatter } from 'next-intl';

interface PodiumCardProps {
  posicion: 1 | 2 | 3;
  nombre: string;
  puntos: number;
  porcentajeInvestigacion: number;
}

const MEDAL = {
  1: { emoji: '🥇', glow: '0 0 20px rgba(234,179,8,0.35)', border: '1px solid rgba(234,179,8,0.45)', nameColor: '#22d3ee', mb: 0 },
  2: { emoji: '🥈', glow: '0 0 14px rgba(148,163,184,0.25)', border: '1px solid rgba(148,163,184,0.35)', nameColor: '#f1f5f9', mb: 28 },
  3: { emoji: '🥉', glow: '0 0 14px rgba(180,83,9,0.25)', border: '1px solid rgba(205,127,50,0.35)', nameColor: '#f1f5f9', mb: 44 },
};

const BADGE_BG: Record<number, string> = {
  1: 'linear-gradient(135deg,#ca8a04,#eab308)',
  2: 'linear-gradient(135deg,#64748b,#94a3b8)',
  3: 'linear-gradient(135deg,#92400e,#b45309)',
};

export function PodiumCard({ posicion, nombre, puntos, porcentajeInvestigacion }: PodiumCardProps) {
  const m = MEDAL[posicion];
  const t = useTranslations('dashboard');
  const format = useFormatter();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      padding: '20px 12px', borderRadius: 14, width: 148,
      background: 'linear-gradient(160deg,#1e293b,#0f172a)',
      border: m.border, boxShadow: m.glow,
      alignSelf: 'flex-end', marginBottom: m.mb,
    }}>
      <span style={{ fontSize: 26, lineHeight: 1 }}>{m.emoji}</span>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: BADGE_BG[posicion], display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800,
        color: posicion === 2 ? '#0f172a' : posicion === 1 ? '#713f12' : '#fef3c7',
      }}>
        {posicion}
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: m.nameColor, textAlign: 'center', lineHeight: 1.3 }}>
        {nombre}
      </span>
      <span style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>
        {format.number(puntos, { maximumFractionDigits: 0 })}
        <span style={{ fontSize: 10, fontWeight: 500, color: '#64748b', marginLeft: 2 }}>{t('pts')}</span>
      </span>
      <span style={{ fontSize: 10, color: '#64748b' }}>{t('investigacion', { pct: porcentajeInvestigacion })}</span>
    </div>
  );
}
