'use client';

import { useGame } from '@/contexts/GameContext';
import type { GameDetailResponse } from '@/types/api';
import { ArenaTeamCard } from './ArenaTeamCard';

interface ArenaTeamPanelProps {
  partida: GameDetailResponse;
}

export function ArenaTeamPanel({ partida }: ArenaTeamPanelProps) {
  const { activeEquipoId } = useGame();

  // Sort by match order (orden) to keep position stable across turns
  const sorted = [...partida.equipos].sort((a, b) => a.orden - b.orden);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Equipos</h2>
      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:flex lg:flex-col">
        {sorted.map((equipo) => (
          <ArenaTeamCard
            key={equipo.equipoId}
            equipo={equipo}
            isActiveTurn={equipo.equipoId === activeEquipoId}
          />
        ))}
      </div>
    </div>
  );
}
