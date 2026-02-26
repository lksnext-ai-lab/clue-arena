'use client';

import { useState, useRef, useEffect } from 'react';
import type { GameDetailResponse } from '@/types/api';
import { ArenaActionItem } from './ArenaActionItem';

const PAGE_SIZE = 50;

interface ArenaActionFeedProps {
  partida: GameDetailResponse;
}

export function ArenaActionFeed({ partida }: ArenaActionFeedProps) {
  const turnos = partida.turnos ?? [];

  // Build a quick lookup: equipoId → equipoNombre
  const teamsMap: Record<string, string> = {};
  for (const e of partida.equipos) {
    teamsMap[e.equipoId] = e.equipoNombre;
  }

  // Reverse-chronological order
  const reversed = [...turnos].reverse();

  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? reversed : reversed.slice(0, PAGE_SIZE);

  // Track new items for animation
  const prevLengthRef = useRef(reversed.length);
  const newCount = Math.max(0, reversed.length - prevLengthRef.current);
  useEffect(() => {
    prevLengthRef.current = reversed.length;
  });

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
        Feed de acciones
      </h2>

      {visible.length === 0 ? (
        <p className="text-slate-600 text-sm">La partida no ha comenzado todavía.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((turno, idx) => (
            <ArenaActionItem
              key={turno.id}
              turno={turno}
              teams={teamsMap}
              isNew={idx < newCount}
            />
          ))}
        </div>
      )}

      {reversed.length > PAGE_SIZE && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors self-start"
        >
          Ver más turnos anteriores ({reversed.length - PAGE_SIZE} más)
        </button>
      )}
    </div>
  );
}
