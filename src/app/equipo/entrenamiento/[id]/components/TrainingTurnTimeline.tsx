'use client';

import type { AgentAction, TrainingTurnResponse, RefutacionRecord } from '@/types/api';
import { TrainingGameStateDebug } from './TrainingGameStateDebug';
import { TrainingAgentInteractionLog } from './TrainingAgentInteractionLog';

interface TrainingTurnTimelineProps {
  turns: TrainingTurnResponse[];
  equipoId: string;
}

function getActorLabel(turn: TrainingTurnResponse, equipoId: string): string {
  if (!turn.esBot && turn.equipoId === equipoId) return 'Tu equipo';
  return turn.equipoId.startsWith('bot-') ? `Bot ${turn.equipoId.replace('bot-', '')}` : turn.equipoId;
}

function getAction(turn: TrainingTurnResponse): AgentAction | undefined {
  return turn.accion?.action as AgentAction | undefined;
}

function getActionLabel(turn: TrainingTurnResponse): string {
  const action = getAction(turn);
  if (!action) return 'Sin acción';
  if (action.type === 'suggestion') return 'Sugerencia';
  if (action.type === 'accusation') return 'Acusación';
  if (action.type === 'pass') return 'Pase';
  if (action.type === 'show_card') return 'Mostrar carta';
  if (action.type === 'cannot_refute') return 'Sin refutación';
  return 'Sin acción';
}

function getActionTone(turn: TrainingTurnResponse): string {
  const action = getAction(turn);
  if (!action) return 'border-slate-500/20 bg-slate-500/10 text-slate-300';
  if (action.type === 'suggestion') return 'border-sky-500/20 bg-sky-500/10 text-sky-300';
  if (action.type === 'accusation') return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
  if (action.type === 'show_card') return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  if (action.type === 'cannot_refute') return 'border-slate-500/20 bg-slate-500/10 text-slate-300';
  if (action.type === 'pass') return 'border-orange-500/20 bg-orange-500/10 text-orange-300';
  return 'border-slate-500/20 bg-slate-500/10 text-slate-300';
}

function getSummary(turn: TrainingTurnResponse, equipoId: string): string {
  const actor = getActorLabel(turn, equipoId);
  const action = getAction(turn);

  if (!action) return `${actor} terminó el turno sin una acción estructurada.`;

  if (action.type === 'suggestion') {
    if (turn.refutacion?.refutadaPor == null) {
      return `${actor} sugirió ${action.suspect} con ${action.weapon} en ${action.room}. Nadie pudo refutar.`;
    }
    const refutador =
      turn.refutacion.refutadaPor === equipoId
        ? 'tu equipo'
        : turn.refutacion.refutadaPor.startsWith('bot-')
        ? `Bot ${turn.refutacion.refutadaPor.replace('bot-', '')}`
        : turn.refutacion.refutadaPor;
    return `${actor} sugirió ${action.suspect} con ${action.weapon} en ${action.room}. Refutó ${refutador}.`;
  }

  if (action.type === 'accusation') {
    return `${actor} acusó ${action.suspect} con ${action.weapon} en ${action.room}.`;
  }

  if (action.type === 'show_card') {
    return `${actor} mostró una carta para responder a la sugerencia activa.`;
  }

  if (action.type === 'cannot_refute') {
    return `${actor} no pudo refutar la combinación sugerida.`;
  }

  if (action.type === 'pass') {
    return `${actor} pasó turno.`;
  }

  return `${actor} actuó en la partida.`;
}

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function RefutacionInline({
  refutacion,
  equipoId,
}: {
  refutacion: RefutacionRecord;
  equipoId: string;
}) {
  if (refutacion.refutadaPor === null) {
    return (
      <div className="rounded-2xl border border-slate-500/20 bg-slate-500/5 px-3 py-2 text-sm text-slate-300">
        Ningún jugador tenía cartas para refutar esta combinación.
      </div>
    );
  }

  const refutador =
    refutacion.refutadaPor === equipoId
      ? 'Tu equipo'
      : refutacion.refutadaPor.startsWith('bot-')
      ? `Bot ${refutacion.refutadaPor.replace('bot-', '')}`
      : refutacion.refutadaPor;

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
      <span className="font-semibold text-amber-300">{refutador}</span> refutó la sugerencia
      {refutacion.cartaMostrada && (
        <>
          {' '}mostrando{' '}
          <span className="rounded-full border border-amber-400/20 bg-black/20 px-2 py-0.5 font-medium text-amber-200">
            {refutacion.cartaMostrada}
          </span>
        </>
      )}
      .
    </div>
  );
}

function TurnCard({ turn, equipoId }: { turn: TrainingTurnResponse; equipoId: string }) {
  const action = getAction(turn);
  const isOwn = !turn.esBot && turn.equipoId === equipoId;

  return (
    <article className="relative rounded-[1.5rem] border border-white/10 bg-black/20 p-4 sm:p-5">
      <div className="absolute left-6 top-0 h-full w-px bg-gradient-to-b from-cyan-400/30 via-white/10 to-transparent" />

      <div className="relative flex flex-col gap-4 pl-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold ${
              isOwn
                ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
                : 'border-white/10 bg-white/5 text-slate-200'
            }`}>
              T{turn.numero}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-white">{getActorLabel(turn, equipoId)}</p>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getActionTone(turn)}`}>
                  {getActionLabel(turn)}
                </span>
                {isOwn && (
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                    Tu agente
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{getSummary(turn, equipoId)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-white/10 px-2.5 py-1">
              {formatCreatedAt(turn.createdAt)}
            </span>
            {turn.durationMs != null && (
              <span className="rounded-full border border-white/10 px-2.5 py-1">
                {turn.durationMs} ms
              </span>
            )}
          </div>
        </div>

        {action && (action.type === 'suggestion' || action.type === 'accusation') && (
          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Sospechoso</p>
              <p className="mt-1 text-white">{action.suspect}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Arma</p>
              <p className="mt-1 text-white">{action.weapon}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Habitación</p>
              <p className="mt-1 text-white">{action.room}</p>
            </div>
          </div>
        )}

        {action?.type === 'suggestion' && turn.refutacion && (
          <RefutacionInline refutacion={turn.refutacion} equipoId={equipoId} />
        )}

        {action?.type === 'show_card' && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Carta mostrada:{' '}
            <span className="font-semibold text-amber-200">{action.card}</span>
          </div>
        )}

        {action?.type === 'cannot_refute' && (
          <div className="rounded-2xl border border-slate-500/20 bg-slate-500/5 px-3 py-2 text-sm text-slate-300">
            El agente confirmó que no tenía cartas para refutar.
          </div>
        )}

        {isOwn && turn.gameStateView != null && (
          <TrainingGameStateDebug gameStateView={turn.gameStateView} turno={turn.numero} />
        )}

        {isOwn && turn.agentTrace != null && (
          <TrainingAgentInteractionLog
            trace={turn.agentTrace}
            memoriaInicial={turn.memoriaInicial}
            memoriaFinal={turn.memoriaFinal}
            turno={turn.numero}
          />
        )}
      </div>
    </article>
  );
}

export function TrainingTurnTimeline({ turns, equipoId }: TrainingTurnTimelineProps) {
  if (turns.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-8 text-center text-slate-400">
        Aún no se han registrado turnos en esta partida de entrenamiento.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {turns.map((turn) => (
        <TurnCard key={turn.id} turn={turn} equipoId={equipoId} />
      ))}
    </div>
  );
}
