'use client';

import { useTranslations } from 'next-intl';
import { useGame } from '@/contexts/GameContext';
import {
  EVT_REFUTATION_POINTS,
  EVT_SUGGESTION_CAP,
  EVT_SUGGESTION_POINTS,
  EVT_TURN_SPEED_POINTS_MAX,
  EVT_WIN_POINTS,
  calcEfficiencyBonus,
} from '@/lib/game/engine';
import type { GameDetailResponse } from '@/types/api';
import { ArenaTeamCard } from './ArenaTeamCard';

interface ArenaTeamPanelProps {
  partida: GameDetailResponse;
}

export interface PendingRequest {
  type: 'turno' | 'refutacion';
  fromTs: number;
}

function usePendingRequests(): Map<string, PendingRequest> {
  const { currentTurnActivity } = useGame();
  const events = currentTurnActivity.active?.events ?? [];

  const map = new Map<string, PendingRequest>();
  for (const ev of events) {
    if (ev.type === 'turn:agent_invoked' && ev.equipoId) {
      map.set(ev.equipoId, { type: 'turno', fromTs: ev.ts });
    } else if (ev.type === 'turn:agent_responded' && ev.equipoId) {
      map.delete(ev.equipoId);
    } else if (ev.type === 'turn:refutation_requested' && ev.refutadoresIds?.length) {
      map.set(ev.refutadoresIds[0], { type: 'refutacion', fromTs: ev.ts });
    } else if (ev.type === 'turn:refutation_received' && ev.equipoId) {
      map.delete(ev.equipoId);
    }
  }
  return map;
}

function getConfiguredScoreMax(partida: GameDetailResponse): number {
  const teamCount = Math.max(1, partida.equipos.length);
  const configuredTurns = partida.maxTurnos ?? Math.max(partida.turnos.length, teamCount);
  const ownTurns = Math.ceil(configuredTurns / teamCount);
  const otherTurns = Math.max(0, configuredTurns - ownTurns);
  const suggestionPoints = Math.min(ownTurns, EVT_SUGGESTION_CAP) * EVT_SUGGESTION_POINTS;
  const speedPoints = ownTurns * EVT_TURN_SPEED_POINTS_MAX;
  const refutationPoints = otherTurns * EVT_REFUTATION_POINTS;
  const winPoints = EVT_WIN_POINTS + calcEfficiencyBonus(2);

  return Math.max(100, suggestionPoints + speedPoints + refutationPoints + winPoints);
}

export function ArenaTeamPanel({ partida }: ArenaTeamPanelProps) {
  const t = useTranslations('arena.detail.teamPanel');
  const { activeEquipoId } = useGame();
  const pending = usePendingRequests();

  const sorted = [...partida.equipos].sort((a, b) => a.orden - b.orden);
  const leader = [...sorted].sort((a, b) => b.puntos - a.puntos)[0] ?? null;
  const alive = sorted.filter((equipo) => !equipo.eliminado).length;
  const pendingCount = Array.from(pending.values()).length;
  const scoreMax = getConfiguredScoreMax(partida);
  const liveOrder = activeEquipoId
    ? sorted.findIndex((equipo) => equipo.equipoId === activeEquipoId) + 1
    : null;

  return (
    <aside className="arena-panel flex flex-col gap-3 overflow-hidden p-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
          {t('title')}
        </p>
      </div>

      {partida.estado !== 'finalizada' && (
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="arena-stat-card">
            <span className="arena-stat-label">{t('stats.active')}</span>
            <span className="arena-stat-value">{alive}</span>
          </div>
          <div className="arena-stat-card">
            <span className="arena-stat-label">{t('stats.queued')}</span>
            <span className="arena-stat-value">{pendingCount}</span>
          </div>
          <div className="arena-stat-card">
            <span className="arena-stat-label">{t('stats.order')}</span>
            <span className="arena-stat-value">{liveOrder ?? '--'}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 xl:flex xl:flex-col">
        {sorted.map((equipo) => (
          <ArenaTeamCard
            key={equipo.equipoId}
            gameId={partida.id}
            equipo={equipo}
            isActiveTurn={equipo.equipoId === activeEquipoId}
            isLeader={equipo.equipoId === leader?.equipoId}
            scoreMax={scoreMax}
            pendingRequest={pending.get(equipo.equipoId)}
          />
        ))}
      </div>
    </aside>
  );
}
