'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  buildDeductionBoard,
  boardKey,
  ALL_CARDS,
  SOSPECHOSOS,
  ARMAS,
  HABITACIONES,
  type CardCategory,
} from '@/lib/utils/deduction-board';
import type { GameDetailResponse } from '@/types/api';

interface ArenaDeductionBoardProps {
  partida: GameDetailResponse;
}

const CATEGORY_LABELS: Record<CardCategory, string> = {
  sospechoso: 'SOSPECHOSOS',
  arma: 'ARMAS',
  habitacion: 'HABITACIONES',
};

const SECTIONS: { category: CardCategory; cards: readonly string[] }[] = [
  { category: 'sospechoso', cards: SOSPECHOSOS },
  { category: 'arma', cards: ARMAS },
  { category: 'habitacion', cards: HABITACIONES },
];

interface TooltipProps { text: string; children: React.ReactNode }
function Tooltip({ text, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      className="relative"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-xs text-slate-200 whitespace-nowrap pointer-events-none shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

export function ArenaDeductionBoard({ partida }: ArenaDeductionBoardProps) {
  const equipoIds = partida.equipos.map((e) => e.equipoId);

  const board = useMemo(
    () => buildDeductionBoard(partida.turnos ?? [], partida.equipos.map((e) => e.equipoId)),
    // Track suggestion IDs and their cartaMostrada so the board recomputes when
    // live data arrives with refuted-card info (same turn IDs, updated suggestions).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      JSON.stringify(partida.turnos?.flatMap((t) => t.sugerencias.map((s) => `${s.id}:${s.cartaMostrada ?? ''}`))),
      JSON.stringify(equipoIds),
    ]
  );

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 overflow-x-auto">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Tablero de deducción
      </h2>

      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr>
            {/* Card name column */}
            <th className="text-left text-slate-500 font-medium pb-2 pr-4 w-36">Carta</th>
            {partida.equipos.map((e) => (
              <th key={e.equipoId} className="pb-2 px-2 text-center min-w-[5rem]">
                <span
                  className={cn(
                    'block font-medium text-center break-words leading-tight',
                    e.eliminado ? 'text-slate-600 line-through' : 'text-slate-300'
                  )}
                >
                  {e.equipoNombre}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map(({ category, cards }) => (
            <>
              {/* Section header row */}
              <tr key={`header-${category}`}>
                <td
                  colSpan={partida.equipos.length + 1}
                  className="pt-3 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-widest"
                >
                  {CATEGORY_LABELS[category]}
                </td>
              </tr>

              {cards.map((card) => (
                <tr key={card} className="border-t border-slate-700/40">
                  <td className="py-1 pr-4 text-slate-400 whitespace-nowrap">{card}</td>
                  {partida.equipos.map((e) => {
                    const cell = board.get(boardKey(e.equipoId, card));
                    const seen = cell && cell.turnos.length > 0;
                    const refuted = seen && cell!.turnosRefutados.length > 0;
                    const tooltipText = seen
                      ? cell!.turnos
                          .map((t) =>
                            cell!.turnosRefutados.includes(t) ? `T${t}↩` : `T${t}`
                          )
                          .join(', ')
                      : '';
                    return (
                      <td key={e.equipoId} className="py-1 px-1 text-center">
                        {seen ? (
                          <Tooltip text={tooltipText}>
                            <span
                              className={cn(
                                'inline-block w-5 h-5 rounded leading-5 cursor-default select-none',
                                refuted
                                  ? 'bg-orange-500/20 text-orange-300'
                                  : 'bg-cyan-500/20 text-cyan-300'
                              )}
                            >
                              ✦
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="inline-block w-5 h-5 rounded bg-slate-700/50 text-slate-600 leading-5 select-none text-center">
                            ·
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-slate-700/40 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 rounded bg-slate-700/50 text-slate-600 leading-4 text-center">·</span>
          No propuesta
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 rounded bg-cyan-500/20 text-cyan-300 leading-4 text-center">✦</span>
          Sugerida (sin refutar)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 rounded bg-orange-500/20 text-orange-300 leading-4 text-center">✦</span>
          Refutada
        </span>
      </div>

      {(partida.turnos ?? []).length === 0 && (
        <p className="text-slate-600 text-xs mt-3">La partida no ha comenzado todavía.</p>
      )}
    </div>
  );
}
