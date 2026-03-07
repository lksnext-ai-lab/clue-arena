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
import type { TrainingTurnResponse, TurnResponse } from '@/types/api';
import type { GameStateView, ActionRecordView } from '@/lib/game/types';

interface TrainingDeductionBoardProps {
  turns: TrainingTurnResponse[];
  /** [realEquipoId, 'bot-1', 'bot-2', …] */
  equipoIds: string[];
  realEquipoId: string;
}

interface EquipoCol {
  id: string;
  label: string;
  cards: Set<string>;
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

// ---------------------------------------------------------------------------
// Tooltip (identical to ArenaDeductionBoard)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function teamLabel(id: string, realEquipoId: string): string {
  return id === realEquipoId ? 'Tu equipo' : `Bot ${id.replace('bot-', '')}`;
}

/**
 * Converts TrainingTurnResponse[] → TurnResponse[] for buildDeductionBoard.
 *
 * Strategy:
 * 1. The most accurate refutation data lives in the latest real-team
 *    gameStateView historial. Use that for all suggestions it covers.
 * 2. Supplement with raw accion data for turns that come after the latest
 *    real-team snapshot (no refutadaPor yet, but cards are tracked).
 */
function adaptTurns(turns: TrainingTurnResponse[], realEquipoId: string): TurnResponse[] {
  const latestViewTurn = [...turns].reverse().find((t) => t.gameStateView != null);
  const historial: ActionRecordView[] = latestViewTurn?.gameStateView
    ? (latestViewTurn.gameStateView as GameStateView).historial
    : [];

  // Part 1: from historial — has refutadaPor + cartaMostrada
  const fromHistorial: TurnResponse[] = historial
    .filter(
      (h): h is ActionRecordView & { sospechoso: string; arma: string; habitacion: string } =>
        h.tipo === 'suggestion' && !!h.sospechoso && !!h.arma && !!h.habitacion,
    )
    .map((h) => ({
      id: `hist-${h.equipoId}-${h.turno}`,
      equipoId: h.equipoId,
      equipoNombre: teamLabel(h.equipoId, realEquipoId),
      numero: h.turno,
      estado: 'completado',
      sugerencias: [
        {
          id: `hist-${h.equipoId}-${h.turno}`,
          equipoId: h.equipoId,
          sospechoso: h.sospechoso,
          arma: h.arma,
          habitacion: h.habitacion,
          refutadaPor: h.refutadaPor ?? null,
          cartaMostrada: h.cartaMostrada ?? null,
          createdAt: new Date(h.timestamp).toISOString(),
        },
      ],
    }));

  // Part 2: turns after the snapshot (not yet in any historial)
  const latestRealNumero = latestViewTurn?.numero ?? 0;
  const recentTurns: TurnResponse[] = turns
    .filter((t) => {
      if (t.numero < latestRealNumero) return false;
      return t.accion?.action?.type === 'suggestion';
    })
    .map((t) => {
      const action = t.accion!.action as {
        type: 'suggestion'; suspect: string; weapon: string; room: string;
      };
      return {
        id: t.id,
        equipoId: t.equipoId,
        equipoNombre: teamLabel(t.equipoId, realEquipoId),
        numero: t.numero,
        estado: 'completado',
        sugerencias: [
          {
            id: t.id,
            equipoId: t.equipoId,
            sospechoso: action.suspect,
            arma: action.weapon,
            habitacion: action.room,
            refutadaPor: null,
            cartaMostrada: null,
            createdAt: t.createdAt,
          },
        ],
      };
    });

  return [...fromHistorial, ...recentTurns];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TrainingDeductionBoard({ turns, equipoIds, realEquipoId }: TrainingDeductionBoardProps) {
  // Real team's hand cards from the latest gameStateView
  const equipoCols = useMemo<EquipoCol[]>(() => {
    const latestViewTurn = [...turns]
      .reverse()
      .find((t) => t.gameStateView != null && t.equipoId === realEquipoId);
    const view = latestViewTurn?.gameStateView as GameStateView | null;
    const ownCards = new Set<string>(view?.equipos.find((e) => e.esPropio)?.cartas ?? []);

    return equipoIds.map((id) => ({
      id,
      label: teamLabel(id, realEquipoId),
      cards: id === realEquipoId ? ownCards : new Set(),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipoIds, realEquipoId, JSON.stringify(turns.map((t) => t.id))]);

  const board = useMemo(
    () => buildDeductionBoard(adaptTurns(turns, realEquipoId), equipoIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      JSON.stringify(
        turns.flatMap((t) =>
          t.accion?.action?.type === 'suggestion'
            ? [`${t.id}:${t.gameStateView ? 'v' : 'n'}`]
            : [],
        ),
      ),
      JSON.stringify(equipoIds),
    ],
  );

  const hasAnyHandCards = equipoCols.some((e) => e.cards.size > 0);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 overflow-x-auto">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Tablero de deducción
      </h2>

      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left text-slate-500 font-medium pb-2 pr-4 w-36">Carta</th>
            {equipoCols.map((e) => (
              <th key={e.id} className="pb-2 px-2 text-center min-w-[5rem]">
                <span className="block font-medium text-center break-words leading-tight text-slate-300">
                  {e.label}
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
                  colSpan={equipoCols.length + 1}
                  className="pt-3 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-widest"
                >
                  {CATEGORY_LABELS[category]}
                </td>
              </tr>
              {cards.map((card) => (
                <tr key={card} className="border-t border-slate-700/40">
                  <td className="py-1 pr-4 text-slate-400 whitespace-nowrap">{card}</td>
                  {equipoCols.map((e) => {
                    const inHand = e.cards.has(card);
                    const cell = board.get(boardKey(e.id, card));
                    const seen = cell && cell.turnos.length > 0;
                    const refuted = seen && cell!.turnosRefutados.length > 0;
                    const tooltipText = inHand
                      ? 'En tu mano'
                      : seen
                      ? cell!.turnos
                          .map((t) => (cell!.turnosRefutados.includes(t) ? `T${t}↩` : `T${t}`))
                          .join(', ')
                      : '';
                    return (
                      <td key={e.id} className="py-1 px-1 text-center">
                        {inHand ? (
                          <Tooltip text={tooltipText}>
                            <span className="inline-block w-5 h-5 rounded leading-5 cursor-default select-none bg-red-500/20 text-red-400">
                              ♦
                            </span>
                          </Tooltip>
                        ) : seen ? (
                          <Tooltip text={tooltipText}>
                            <span
                              className={cn(
                                'inline-block w-5 h-5 rounded leading-5 cursor-default select-none',
                                refuted
                                  ? 'bg-orange-500/20 text-orange-300'
                                  : 'bg-cyan-500/20 text-cyan-300',
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
            </React.Fragment>
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
        {hasAnyHandCards && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-4 rounded bg-red-500/20 text-red-400 leading-4 text-center">♦</span>
            En tu mano
          </span>
        )}
      </div>

      {turns.length === 0 && (
        <p className="text-slate-600 text-xs mt-3">La partida no ha comenzado todavía.</p>
      )}
    </div>
  );
}
