'use client';

import { useMemo } from 'react';
import { buildDeductionBoard, ALL_CARDS } from '@/lib/utils/deduction-board';
import type { TurnResponse, TrainingTurnResponse } from '@/types/api';

interface TrainingDeductionBoardProps {
  turns: TrainingTurnResponse[];
  equipoIds: string[];
  realEquipoId: string;
}

/**
 * Adapts TrainingTurnResponse to the TurnResponse shape expected by buildDeductionBoard.
 * Only includes suggestion turns from the real team perspective.
 */
function adaptTurns(turns: TrainingTurnResponse[]): TurnResponse[] {
  return turns
    .filter((t) => {
      const action = t.accion?.action;
      return action?.type === 'suggestion' || action?.type === 'accusation' || action?.type === 'pass';
    })
    .map((t) => {
      const action = t.accion?.action;
      const isSuggestion = action?.type === 'suggestion';
      return {
        id: t.id,
        equipoId: t.equipoId,
        equipoNombre: t.esBot ? `Bot ${t.equipoId.replace('bot-', '')}` : 'Tu equipo',
        numero: t.numero,
        estado: 'completado',
        sugerencias: isSuggestion
          ? [
              {
                id: t.id,
                equipoId: t.equipoId,
                sospechoso: (action as { suspect: string }).suspect,
                arma: (action as { weapon: string }).weapon,
                habitacion: (action as { room: string }).room,
                refutadaPor: null,
                cartaMostrada: null,
                createdAt: t.createdAt,
              },
            ]
          : [],
        acusacion: undefined,
        pase: action?.type === 'pass' ? { id: t.id, equipoId: t.equipoId, origen: 'voluntario' as const, createdAt: t.createdAt } : undefined,
      };
    });
}

export function TrainingDeductionBoard({ turns, equipoIds, realEquipoId }: TrainingDeductionBoardProps) {
  const board = useMemo(() => {
    const adapted = adaptTurns(turns);
    return buildDeductionBoard(adapted, equipoIds);
  }, [turns, equipoIds]);

  const teamCols = [realEquipoId, ...equipoIds.filter((id) => id !== realEquipoId)];

  if (turns.length === 0) {
    return (
      <div className="text-center text-slate-500 text-sm py-4">
        El tablero se actualiza con cada sugerencia jugada.
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-700">
            <th className="px-2 py-1 text-left text-slate-300 border border-slate-600">Carta</th>
            {teamCols.map((tid) => (
              <th key={tid} className="px-2 py-1 text-center text-slate-300 border border-slate-600">
                {tid === realEquipoId ? 'Tu equipo' : `Bot ${tid.replace('bot-', '')}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_CARDS.map(({ card, category }) => (
            <tr key={card} className="odd:bg-slate-800 even:bg-slate-800/50">
              <td className="px-2 py-1 border border-slate-700">
                <span className="text-slate-400 mr-1 text-xs">[{category.charAt(0).toUpperCase()}]</span>
                <span className="text-white">{card}</span>
              </td>
              {teamCols.map((tid) => {
                const cell = board.get(`${tid}::${card}`);
                const mentioned = cell?.turnos.length ?? 0;
                const refuted = cell?.turnosRefutados.length ?? 0;
                return (
                  <td key={tid} className="px-2 py-1 text-center border border-slate-700">
                    {mentioned > 0 ? (
                      <span className={refuted > 0 ? 'text-yellow-400' : 'text-green-400'}>
                        {mentioned} {refuted > 0 ? `(↯${refuted})` : ''}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-slate-500">
        Número de sugerencias que incluyen esa carta. ↯ = refutada por esa tripla.
      </p>
    </div>
  );
}
