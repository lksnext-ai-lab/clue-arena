'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { GameTeamResponse } from '@/types/api';
import type { PendingRequest } from './ArenaTeamPanel';

interface ArenaTeamCardProps {
  equipo: GameTeamResponse;
  isActiveTurn: boolean;
  pendingRequest?: PendingRequest;
}

/** Live elapsed counter — updates every 100 ms while active. */
function useElapsed(fromTs: number | undefined): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (fromTs === undefined) { setElapsed(0); return; }
    setElapsed(Date.now() - fromTs);
    const id = setInterval(() => setElapsed(Date.now() - fromTs), 100);
    return () => clearInterval(id);
  }, [fromTs]);
  return elapsed;
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

export function ArenaTeamCard({ equipo, isActiveTurn, pendingRequest }: ArenaTeamCardProps) {
  const elapsed = useElapsed(pendingRequest?.fromTs);

  const requestLabel = pendingRequest?.type === 'turno'
    ? 'Coordinador solicitando turno'
    : 'Coordinador solicitando refutación';

  return (
    <div
      className={cn(
        'rounded-xl border bg-slate-800/60 p-4 transition-all duration-500',
        equipo.eliminado
          ? 'border-slate-700/50 opacity-40 grayscale'
          : isActiveTurn
            ? 'border-transparent ring-2 ring-cyan-400'
            : 'border-slate-700'
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div
            className={cn(
              'shrink-0 w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center text-xl',
              isActiveTurn && !equipo.eliminado
                ? 'ring-2 ring-cyan-400'
                : 'ring-1 ring-slate-600'
            )}
            style={{ background: '#1e293b' }}
          >
            {equipo.avatarUrl
              ? <img src={equipo.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span>🛡️</span>
            }
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">

              <span className="font-semibold text-sm text-white break-words leading-snug">{equipo.equipoNombre}</span>
            </div>
            {isActiveTurn && !equipo.eliminado && (
              <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-cyan-400 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                TURNO ACTIVO
              </span>
            )}
          </div>
        </div>

        {equipo.eliminado ? (
          <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-400/10 text-red-400">
            ELIMINADO
          </span>
        ) : (
          <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-400/10 text-emerald-400">
            ACTIVO
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-cyan-400 font-bold">
          ♦ {equipo.puntos} pts
        </span>
        <span className="text-slate-400 text-xs">
          🃏 {equipo.numCartas} cartas
        </span>
      </div>

      {/* F016: coordinator pending-request indicator (no result shown) */}
      {pendingRequest && !equipo.eliminado && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-amber-400/5 border border-amber-400/20 px-2.5 py-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs text-amber-300 leading-tight flex-1">{requestLabel}</span>
          <span className="shrink-0 font-mono text-xs text-amber-400/80">{formatMs(elapsed)}</span>
        </div>
      )}
    </div>
  );
}
