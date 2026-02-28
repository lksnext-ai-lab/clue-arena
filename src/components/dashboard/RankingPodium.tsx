'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import { useInterval } from '@/lib/utils/useInterval';
import { useTranslations, useFormatter } from 'next-intl';
import { PodiumCard } from './PodiumCard';

export interface RankingEntry {
  equipoId: string;
  equipoNombre: string;
  avatarUrl?: string | null;
  puntos: number;
  posicion: number;
  aciertos: number;
  partidasJugadas: number;
}

interface RankingResponse {
  ranking: RankingEntry[];
  updatedAt: string;
}

interface RankingPodiumProps {
  initialRanking: RankingEntry[];
  miEquipoId: string | null;
}

function calcPorcentaje(entry: RankingEntry): number {
  if (entry.partidasJugadas === 0) return 0;
  return Math.min(100, Math.round((entry.aciertos / entry.partidasJugadas) * 100));
}

// Classic podium order: 2nd left, 1st center, 3rd right
const PODIUM_ORDER: Array<1 | 2 | 3> = [2, 1, 3];

export function RankingPodium({ initialRanking, miEquipoId }: RankingPodiumProps) {
  const [ranking, setRanking] = useState<RankingEntry[]>(initialRanking);
  const t = useTranslations('dashboard');
  const format = useFormatter();

  useInterval(async () => {
    try {
      const data = await apiFetch<RankingResponse>('/ranking');
      setRanking(data.ranking);
    } catch { /* keep stale */ }
  }, 30_000);

  const byPos = Object.fromEntries(
    ranking.filter((r) => r.posicion <= 3).map((r) => [r.posicion, r])
  ) as Record<number, RankingEntry | undefined>;
  const rest = ranking.filter((r) => r.posicion > 3);
  const hasTop3 = Object.keys(byPos).length > 0;

  return (
    <section
      aria-label="Clasificación del evento"
      style={{
        background: 'linear-gradient(160deg,#1e293b 0%,#0f172a 100%)',
        border: '1px solid #334155', borderRadius: 16, padding: 24,
      }}
    >
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#22d3ee', textTransform: 'uppercase', margin: 0 }}>
          {t('rankingTitulo')}
        </h2>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
          background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)',
        }}>
          {t('enDirecto')}
        </span>
      </div>

      {/* Top 3 podium — classic order: 2nd | 1st | 3rd */}
      {hasTop3 ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 28 }}>
          {PODIUM_ORDER.map((pos) => {
            const entry = byPos[pos];
            if (!entry) return null;
            return (
              <PodiumCard
                key={entry.equipoId}
                posicion={pos}
                nombre={entry.equipoNombre}
                avatarUrl={entry.avatarUrl ?? null}
                puntos={entry.puntos}
                porcentajeInvestigacion={calcPorcentaje(entry)}
              />
            );
          })}
        </div>
      ) : (
        <EmptyPodium />
      )}

      {/* Positions 4+ */}
      {rest.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rest.map((entry) => {
            const isOwn = entry.equipoId === miEquipoId;
            return (
              <div
                key={entry.equipoId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 8,
                  background: isOwn ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.03)',
                  border: isOwn ? '1px solid rgba(34,211,238,0.2)' : '1px solid transparent',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, width: 22, textAlign: 'right', color: isOwn ? '#22d3ee' : '#64748b' }}>
                  {entry.posicion}.
                </span>
                {/* Avatar thumbnail for 4+ rows */}
                <div style={{
                  width: 24, height: 24, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
                  background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12,
                }}>
                  {entry.avatarUrl
                    ? <img src={entry.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : '🛡️'}
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: isOwn ? 700 : 400, color: isOwn ? '#22d3ee' : '#e2e8f0' }}>
                  {entry.equipoNombre}
                  {isOwn && (
                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: '#67e8f9', background: 'rgba(34,211,238,0.12)', padding: '1px 6px', borderRadius: 9 }}>
                      {t('tu')}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>
                  {format.number(entry.puntos, { maximumFractionDigits: 0 })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function EmptyPodium() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 28, opacity: 0.35 }}>
      {([2, 1, 3] as const).map((pos) => (
        <div key={pos} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          padding: '20px 12px', borderRadius: 14, width: 148,
          background: '#1e293b', border: '1px solid #334155',
          alignSelf: 'flex-end', marginBottom: pos === 1 ? 0 : pos === 2 ? 28 : 44,
        }}>
          <span style={{ fontSize: 26 }}>{pos === 1 ? '🥇' : pos === 2 ? '🥈' : '🥉'}</span>
          <div style={{ width: 80, height: 10, borderRadius: 5, background: '#334155' }} />
          <div style={{ width: 50, height: 8, borderRadius: 5, background: '#334155' }} />
        </div>
      ))}
    </div>
  );
}
