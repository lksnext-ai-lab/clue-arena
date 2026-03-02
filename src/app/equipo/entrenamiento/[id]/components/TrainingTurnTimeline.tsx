'use client';

import type { AgentAction, TrainingTurnResponse } from '@/types/api';
import { TrainingGameStateDebug } from './TrainingGameStateDebug';
import { TrainingAgentInteractionLog } from './TrainingAgentInteractionLog';

interface TrainingTurnTimelineProps {
  turns: TrainingTurnResponse[];
  equipoId: string;
}

function isRefutationTurn(turn: TrainingTurnResponse): boolean {
  const t = (turn.accion?.action as AgentAction | undefined)?.type;
  return t === 'show_card' || t === 'cannot_refute';
}

function getTurnLabel(turn: TrainingTurnResponse): string {
  if (turn.esBot) return `Bot ${turn.equipoId.replace('bot-', '')}`;
  return 'Tu equipo';
}

function getActionLabel(turn: TrainingTurnResponse): string {
  const action = turn.accion?.action as AgentAction | undefined;
  if (!action) return 'Sin acción';
  if (action.type === 'suggestion') return 'Sugerencia';
  if (action.type === 'accusation') return 'Acusación';
  if (action.type === 'pass') return 'Pase';
  if (action.type === 'show_card') return 'Mostrar carta';
  if (action.type === 'cannot_refute') return 'Sin refutación';
  return (action as { type: string }).type;
}

function TurnCard({ turn, equipoId }: { turn: TrainingTurnResponse; equipoId: string }) {
  const isOwn = !turn.esBot && turn.equipoId === equipoId;
  const isRefute = isRefutationTurn(turn);
  const action = turn.accion?.action as AgentAction | undefined;

  const borderClass = isOwn
    ? isRefute
      ? 'border-amber-700/60 bg-slate-800'
      : 'border-indigo-700/60 bg-slate-800'
    : 'border-slate-700 bg-slate-800/40';

  return (
    <div className={`rounded-lg border p-3 ${borderClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-sm font-semibold text-white">
            Turno {turn.numero}
          </span>
          <span className="ml-2 text-sm text-slate-400">
            — {getTurnLabel(turn)}
          </span>
          <span className={`ml-2 text-xs rounded px-1.5 py-0.5 ${
            isRefute && isOwn
              ? 'bg-amber-900/60 text-amber-300'
              : 'bg-slate-700 text-slate-300'
          }`}>
            {isRefute && isOwn ? '🃏 ' : ''}{getActionLabel(turn)}
          </span>
        </div>
        {turn.durationMs != null && (
          <span className="text-xs text-slate-500 flex-shrink-0">⏱ {turn.durationMs}ms</span>
        )}
      </div>

      {/* Action details — suggestion / accusation */}
      {action && (action.type === 'suggestion' || action.type === 'accusation') && (
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded bg-slate-700 px-2 py-1">
            <span className="text-slate-400">Sospechoso:</span>{' '}
            <span className="text-white">{(action as { suspect: string }).suspect}</span>
          </div>
          <div className="rounded bg-slate-700 px-2 py-1">
            <span className="text-slate-400">Arma:</span>{' '}
            <span className="text-white">{(action as { weapon: string }).weapon}</span>
          </div>
          <div className="rounded bg-slate-700 px-2 py-1">
            <span className="text-slate-400">Habitación:</span>{' '}
            <span className="text-white">{(action as { room: string }).room}</span>
          </div>
        </div>
      )}

      {/* Action details — refutation (show_card) */}
      {action && action.type === 'show_card' && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="text-slate-400">Carta mostrada:</span>
          <span className="rounded bg-amber-900/40 px-2 py-0.5 font-medium text-amber-200">
            {(action as { card: string }).card}
          </span>
        </div>
      )}

      {/* Action details — cannot refute */}
      {action && action.type === 'cannot_refute' && (
        <p className="mt-2 text-xs text-slate-400 italic">El agente no pudo refutar la combinación.</p>
      )}

      {/* GameStateView debug (only for own turns) */}
      {isOwn && turn.gameStateView != null && (
        <TrainingGameStateDebug gameStateView={turn.gameStateView} turno={turn.numero} />
      )}

      {/* Agent interaction log (only for own turns with trace) */}
      {isOwn && turn.agentTrace != null && (
        <TrainingAgentInteractionLog
          trace={turn.agentTrace}
          memoriaInicial={turn.memoriaInicial}
          memoriaFinal={turn.memoriaFinal}
          turno={turn.numero}
        />
      )}
    </div>
  );
}

export function TrainingTurnTimeline({ turns, equipoId }: TrainingTurnTimelineProps) {
  if (turns.length === 0) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-6 text-center text-slate-400">
        Aún no se han jugado turnos
      </div>
    );
  }

  // Most recent first
  const sorted = [...turns].sort((a, b) => b.numero - a.numero);

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((t) => (
        <TurnCard key={t.id} turn={t} equipoId={equipoId} />
      ))}
    </div>
  );
}
