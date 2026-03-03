'use client';

import { useGame } from '@/contexts/GameContext';
import type { GameDetailResponse } from '@/types/api';
import { ArenaTeamCard } from './ArenaTeamCard';

interface ArenaTeamPanelProps {
  partida: GameDetailResponse;
}

/** Shape forwarded to each card: the coordinator is waiting on this team. */
export interface PendingRequest {
  type: 'turno' | 'refutacion';
  fromTs: number;
}

/**
 * Derives a map of { equipoId → PendingRequest } from the live micro-event
 * stream.  We walk the events of the active turn in order, tracking which
 * team the coordinator has requested something from and whether a response
 * has already arrived.
 */
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
      // Only the first candidate is tracked (sequential refutation rule).
      map.set(ev.refutadoresIds[0], { type: 'refutacion', fromTs: ev.ts });
    } else if (ev.type === 'turn:refutation_received' && ev.equipoId) {
      map.delete(ev.equipoId);
    }
  }
  return map;
}

export function ArenaTeamPanel({ partida }: ArenaTeamPanelProps) {
  const { activeEquipoId } = useGame();
  const pending = usePendingRequests();

  // Sort by match order (orden) to keep position stable across turns
  const sorted = [...partida.equipos].sort((a, b) => a.orden - b.orden);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Equipos</h2>
      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:flex lg:flex-col">
        {sorted.map((equipo) => (
          <ArenaTeamCard
            key={equipo.equipoId}
            gameId={partida.id}
            equipo={equipo}
            isActiveTurn={equipo.equipoId === activeEquipoId}
            pendingRequest={pending.get(equipo.equipoId)}
          />
        ))}
      </div>
    </div>
  );
}
