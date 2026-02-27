'use client';

import { cn } from '@/lib/utils/cn';
import type { GameTeamResponse } from '@/types/api';

interface ArenaTeamCardProps {
  equipo: GameTeamResponse;
  position: number;
  isActiveTurn: boolean;
}

const POSITION_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function ArenaTeamCard({ equipo, position, isActiveTurn }: ArenaTeamCardProps) {
  const medal = POSITION_MEDALS[position] ?? `#${position}`;

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
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{medal}</span>
            <span className="font-semibold text-sm text-white break-words leading-snug">{equipo.equipoNombre}</span>
          </div>
          {isActiveTurn && !equipo.eliminado && (
            <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-cyan-400 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              TURNO ACTIVO
            </span>
          )}
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
    </div>
  );
}
