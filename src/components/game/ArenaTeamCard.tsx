'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import type { GameTeamResponse } from '@/types/api';
import type { PendingRequest } from './ArenaTeamPanel';
import { ScoreHistoryModal } from './ScoreHistoryModal';

interface ArenaTeamCardProps {
  gameId: string;
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

/** Tracks the previous value; returns it on re-render. */
function usePrevValue(value: number): number {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; });
  return ref.current;
}

// Delta flash state
interface DeltaFlash {
  key: number;
  delta: number;
}

export function ArenaTeamCard({ gameId, equipo, isActiveTurn, pendingRequest }: ArenaTeamCardProps) {
  const elapsed = useElapsed(pendingRequest?.fromTs);

  // Track score changes for delta animation
  const prevPoints = usePrevValue(equipo.puntos);
  const [flash, setFlash] = useState<DeltaFlash | null>(null);
  const flashKeyRef = useRef(0);

  useEffect(() => {
    const diff = equipo.puntos - prevPoints;
    if (diff !== 0) {
      flashKeyRef.current += 1;
      setFlash({ key: flashKeyRef.current, delta: diff });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipo.puntos]);

  // Clear flash after animation completes
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 1700);
    return () => clearTimeout(id);
  }, [flash]);

  // Score history modal
  const [showHistory, setShowHistory] = useState(false);
  const openHistory = useCallback(() => setShowHistory(true), []);
  const closeHistory = useCallback(() => setShowHistory(false), []);

  const requestLabel = pendingRequest?.type === 'turno'
    ? 'Coordinador solicitando turno'
    : 'Coordinador solicitando refutación';

  return (
    <>
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
          {/* Clickable score — opens history modal */}
          <button
            type="button"
            onClick={openHistory}
            title="Ver historial de puntuación"
            className={cn(
              'relative flex items-center gap-1 rounded-md px-1.5 py-0.5 -ml-1.5 transition-colors select-none',
              'hover:bg-slate-700/60 active:bg-slate-700 cursor-pointer group',
            )}
          >
            <span className="text-cyan-400 font-bold">♦ {equipo.puntos} pts</span>
            <span className="text-slate-600 text-xs group-hover:text-slate-400 transition-colors">▾</span>

            {/* Floating delta animation */}
            {flash && (
              <span
                key={flash.key}
                className={cn(
                  'animate-score-delta left-1 -top-1',
                  flash.delta > 0 ? 'text-emerald-400' : 'text-red-400',
                )}
              >
                {flash.delta > 0 ? `+${flash.delta}` : flash.delta}
              </span>
            )}
          </button>

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

      {/* Score history modal — rendered outside the card so it stacks over everything */}
      {showHistory && (
        <ScoreHistoryModal
          gameId={gameId}
          equipoId={equipo.equipoId}
          equipoNombre={equipo.equipoNombre}
          currentPoints={equipo.puntos}
          onClose={closeHistory}
        />
      )}
    </>
  );
}

