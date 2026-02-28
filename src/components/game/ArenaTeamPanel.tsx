'use client';

import type { GameDetailResponse } from '@/types/api';
import { ArenaTeamCard } from './ArenaTeamCard';

interface ArenaTeamPanelProps {
  partida: GameDetailResponse;
}

function activeTeamEquipoId(partida: GameDetailResponse): string | null {
  if (partida.estado !== 'en_curso') return null;
  const active = partida.equipos.filter((e) => !e.eliminado);
  if (active.length === 0) return null;
  return active[partida.turnoActual % active.length]?.equipoId ?? null;
}

export function ArenaTeamPanel({ partida }: ArenaTeamPanelProps) {
  const activeEquipoId = activeTeamEquipoId(partida);

  // Sort by points descending for ranking display
  const sorted = [...partida.equipos].sort((a, b) => b.puntos - a.puntos);

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
