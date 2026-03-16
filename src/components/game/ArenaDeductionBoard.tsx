'use client';

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  buildDeductionBoard,
  boardKey,
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

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

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
        <span className="absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-xs text-slate-200 shadow-lg border border-slate-700">
          {text}
        </span>
      )}
    </span>
  );
}

export function ArenaDeductionBoard({ partida }: ArenaDeductionBoardProps) {
  const equipoIds = partida.equipos.map((e) => e.equipoId);
  const secretCards = new Set(
    partida.sobre
      ? [partida.sobre.sospechoso, partida.sobre.arma, partida.sobre.habitacion]
      : []
  );

  const handCardsByTeam = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const equipo of partida.equipos) {
      if (equipo.cartas && equipo.cartas.length > 0) {
        map.set(equipo.equipoId, new Set(equipo.cartas));
      }
    }
    return map;
  }, [partida.equipos]);

  const hasAnyHandCards = handCardsByTeam.size > 0;

  const shownRefutationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const turno of partida.turnos ?? []) {
      for (const sugerencia of turno.sugerencias) {
        if (!sugerencia.refutadaPor || !sugerencia.cartaMostrada) continue;
        const key = boardKey(sugerencia.refutadaPor, sugerencia.cartaMostrada);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [partida.turnos]);

  const board = useMemo(
    () => buildDeductionBoard(partida.turnos ?? [], equipoIds),
    [equipoIds, partida.turnos]
  );

  const totalMarks = Array.from(board.values()).reduce((count, cell) => count + (cell.turnos.length > 0 ? 1 : 0), 0);
  const refutedMarks = Array.from(board.values()).reduce((count, cell) => count + (cell.turnosRefutados.length > 0 ? 1 : 0), 0);
  const unresolvedMarks = totalMarks - refutedMarks;

  return (
    <section className="arena-panel arena-grid-glow overflow-hidden p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Matriz de deduccion
          </p>
        </div>
        <div className="grid grid-cols-3 gap-0.5 text-center">
          <div className="arena-stat-card arena-stat-card-compact">
            <span className="arena-stat-label">Lecturas</span>
            <span className="arena-stat-value">{totalMarks}</span>
          </div>
          <div className="arena-stat-card arena-stat-card-compact">
            <span className="arena-stat-label">Refutadas</span>
            <span className="arena-stat-value">{refutedMarks}</span>
          </div>
          <div className="arena-stat-card arena-stat-card-compact">
            <span className="arena-stat-label">Abiertas</span>
            <span className="arena-stat-value">{unresolvedMarks}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto pb-1 scrollbar-panel">
        <table className="min-w-full border-separate border-spacing-y-1 text-[11px]">
          <thead>
            <tr>
              <th className="w-32 pb-1.5 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Carta
              </th>
              {partida.equipos.map((e) => (
                <th key={e.equipoId} className="min-w-[4.4rem] px-1.5 pb-1.5 text-center">
                  <span
                    className={cn(
                      'block break-words text-center text-[10px] font-semibold uppercase tracking-[0.14em] leading-tight',
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
              <React.Fragment key={category}>
                <tr>
                  <td
                    colSpan={partida.equipos.length + 1}
                    className="pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500"
                  >
                    {CATEGORY_LABELS[category]}
                  </td>
                </tr>

                {cards.map((card) => (
                  <tr
                    key={card}
                    className={cn(
                      'bg-white/[0.025]',
                      secretCards.has(card) && 'bg-amber-400/[0.06]'
                    )}
                  >
                    <td
                      className={cn(
                        'whitespace-nowrap rounded-l-xl border-y border-l py-1.5 pl-2.5 pr-3 text-slate-300',
                        secretCards.has(card)
                          ? 'border-amber-300/35 text-amber-100 shadow-[inset_3px_0_0_rgba(252,211,77,0.55)]'
                          : 'border-white/6'
                      )}
                    >
                      {card}
                    </td>
                    {partida.equipos.map((e) => {
                      const inHand = handCardsByTeam.get(e.equipoId)?.has(card) ?? false;
                      const cell = board.get(boardKey(e.equipoId, card));
                      const seen = Boolean(cell && cell.turnos.length > 0);
                      const refuted = Boolean(seen && cell && cell.turnosRefutados.length > 0);
                      const shownCount = shownRefutationCounts.get(boardKey(e.equipoId, card)) ?? 0;
                      const tooltipText = inHand
                        ? 'En tu mano'
                        : seen && cell
                          ? cell.turnos
                              .map((turno) => (cell.turnosRefutados.includes(turno) ? `T${turno}↩` : `T${turno}`))
                              .join(', ')
                          : '';

                      return (
                        <td
                          key={e.equipoId}
                          className={cn(
                            'border-y px-1 py-1.5 text-center last:rounded-r-xl last:border-r',
                            secretCards.has(card) ? 'border-amber-300/35' : 'border-white/6'
                          )}
                        >
                          {inHand ? (
                            <Tooltip text={tooltipText}>
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-lg border border-red-400/20 bg-red-500/15 text-red-300 shadow-[0_0_18px_rgba(248,113,113,0.2)]">
                                ♦
                                {shownCount > 0 && (
                                  <span className="absolute -right-2 -top-2 rounded-full bg-amber-300/95 px-1 py-[1px] text-[8px] font-bold leading-none text-slate-950 shadow-[0_4px_12px_rgba(251,191,36,0.35)]">
                                    x{shownCount}
                                  </span>
                                )}
                              </span>
                            </Tooltip>
                          ) : seen ? (
                            <Tooltip text={tooltipText}>
                              <span
                                className={cn(
                                  'relative inline-flex h-5 w-5 items-center justify-center rounded-lg border select-none',
                                  refuted
                                    ? 'border-amber-300/20 bg-amber-400/15 text-amber-200'
                                    : 'border-cyan-300/20 bg-cyan-400/15 text-cyan-200'
                                )}
                              >
                                ✦
                                {shownCount > 0 && (
                                  <span className="absolute -right-2 -top-2 rounded-full bg-amber-300/95 px-1 py-[1px] text-[8px] font-bold leading-none text-slate-950 shadow-[0_4px_12px_rgba(251,191,36,0.35)]">
                                    x{shownCount}
                                  </span>
                                )}
                              </span>
                            </Tooltip>
                          ) : (
                            <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-lg border border-white/6 bg-white/[0.04] text-slate-600">
                              ·
                              {shownCount > 0 && (
                                <span className="absolute -right-2 -top-2 rounded-full bg-amber-300/95 px-1 py-[1px] text-[8px] font-bold leading-none text-slate-950 shadow-[0_4px_12px_rgba(251,191,36,0.35)]">
                                  x{shownCount}
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2.5 border-t border-white/8 pt-2 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-md border border-white/6 bg-white/[0.04] text-slate-600">·</span>
          No propuesta
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-400/15 text-cyan-200">✦</span>
          Sugerida
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-md border border-amber-300/20 bg-amber-400/15 text-amber-200">✦</span>
          Refutada
        </span>
        <span className="flex items-center gap-1">
          <span className="rounded-full bg-amber-300/95 px-1 py-[1px] text-[8px] font-bold leading-none text-slate-950">xN</span>
          Veces mostrada al refutar por ese equipo
        </span>
        {hasAnyHandCards && (
          <span className="flex items-center gap-1">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-md border border-red-400/20 bg-red-500/15 text-red-300">♦</span>
            En tu mano
          </span>
        )}
        {partida.sobre && (
          <span className="flex items-center gap-1">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-md border border-amber-300/35 bg-amber-300/12 text-amber-200">✦</span>
            Carta del sobre
          </span>
        )}
      </div>
    </section>
  );
}
