'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api/client';
import { useAppSession } from '@/contexts/SessionContext';
import type { AgentAction, TrainingGameResponse, TrainingTurnResponse } from '@/types/api';
import { TrainingEnvelopeReveal } from './components/TrainingEnvelopeReveal';
import { TrainingTurnTimeline } from './components/TrainingTurnTimeline';
import { TrainingDeductionBoard } from './components/TrainingDeductionBoard';
import { TrainingReplayPlayer } from './components/TrainingReplayPlayer';

interface Props {
  params: Promise<{ id: string }>;
}

interface ParticipantView {
  id: string;
  label: string;
  shortLabel: string;
  isOwn: boolean;
}

const POLL_INTERVAL = 5_000;

function getParticipants(equipoId: string, numBots: number): ParticipantView[] {
  return [
    { id: equipoId, label: 'Tu equipo', shortLabel: 'TU', isOwn: true },
    ...Array.from({ length: numBots }, (_, index) => ({
      id: `bot-${index + 1}`,
      label: `Bot ${index + 1}`,
      shortLabel: `B${index + 1}`,
      isOwn: false,
    })),
  ];
}

function formatRelativeTime(value: string | null, now: number): string {
  if (!value) return 'sin marca temporal';
  const diffMs = now - new Date(value).getTime();
  const diffSec = Math.max(0, Math.round(diffMs / 1000));
  if (diffSec < 5) return 'ahora mismo';
  if (diffSec < 60) return `hace ${diffSec} s`;
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)} min`;
  return `hace ${Math.floor(diffSec / 3600)} h`;
}

function formatClock(value: string | null): string {
  if (!value) return '--:--';
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getActionType(turn: TrainingTurnResponse): AgentAction['type'] | 'none' {
  return (turn.accion?.action as AgentAction | undefined)?.type ?? 'none';
}

function getActionTone(turn: TrainingTurnResponse): string {
  const actionType = getActionType(turn);
  if (actionType === 'accusation') return 'text-rose-300 bg-rose-500/10 border-rose-500/20';
  if (actionType === 'suggestion') return 'text-sky-300 bg-sky-500/10 border-sky-500/20';
  if (actionType === 'show_card') return 'text-amber-300 bg-amber-500/10 border-amber-500/20';
  if (actionType === 'cannot_refute') return 'text-slate-300 bg-slate-500/10 border-slate-500/20';
  if (actionType === 'pass') return 'text-orange-300 bg-orange-500/10 border-orange-500/20';
  return 'text-slate-300 bg-slate-500/10 border-slate-500/20';
}

function getActionLabel(turn: TrainingTurnResponse): string {
  const actionType = getActionType(turn);
  if (actionType === 'suggestion') return 'Sugerencia';
  if (actionType === 'accusation') return 'Acusación';
  if (actionType === 'show_card') return 'Refutación';
  if (actionType === 'cannot_refute') return 'Sin refutación';
  if (actionType === 'pass') return 'Pase';
  return 'Sin acción';
}

function describeTurn(turn: TrainingTurnResponse, ownEquipoId: string): string {
  const actor = turn.equipoId === ownEquipoId ? 'Tu equipo' : `Bot ${turn.equipoId.replace('bot-', '')}`;
  const action = turn.accion?.action as AgentAction | undefined;

  if (!action) return `${actor} completó el turno sin una acción registrada.`;

  if (action.type === 'suggestion') {
    const refutationText =
      turn.refutacion?.refutadaPor == null
        ? 'Nadie pudo refutar.'
        : turn.refutacion.refutadaPor === ownEquipoId
        ? 'La refutación la hizo tu equipo.'
        : `Refutó ${turn.refutacion.refutadaPor.startsWith('bot-') ? `Bot ${turn.refutacion.refutadaPor.replace('bot-', '')}` : turn.refutacion.refutadaPor}.`;
    return `${actor} sugirió ${action.suspect} con ${action.weapon} en ${action.room}. ${refutationText}`;
  }

  if (action.type === 'accusation') {
    return `${actor} lanzó una acusación con ${action.suspect}, ${action.weapon} y ${action.room}.`;
  }

  if (action.type === 'show_card') {
    return `${actor} mostró una carta para refutar la combinación sugerida.`;
  }

  if (action.type === 'cannot_refute') {
    return `${actor} no pudo refutar la combinación actual.`;
  }

  if (action.type === 'pass') {
    return `${actor} pasó turno.`;
  }

  return `${actor} completó el turno.`;
}

function getCurrentActorId(game: TrainingGameResponse, ownEquipoId: string): string | null {
  if (game.estado !== 'en_curso') return null;
  const participants = getParticipants(ownEquipoId, game.numBots);
  if (participants.length === 0) return null;
  return participants[game.numTurnos % participants.length]?.id ?? null;
}

function getStageText(game: TrainingGameResponse, turns: TrainingTurnResponse[], ownEquipoId: string): string {
  if (game.estado === 'abortada') return 'Sesión detenida manualmente';
  if (game.estado === 'finalizada') return 'Partida de entrenamiento completada';
  const latestTurn = turns[0];
  if (!latestTurn) return 'Preparando la simulación';
  const latestType = getActionType(latestTurn);
  if (latestType === 'suggestion') return 'Resolviendo sugerencia y posible refutación';
  if (latestType === 'accusation') return 'Validando acusación y cierre de partida';
  if (latestType === 'show_card') return 'Registrando refutación del turno';
  if (latestType === 'cannot_refute') return 'Continuando la cadena de refutación';
  if (latestType === 'pass') return 'Avanzando al siguiente jugador';
  const actor = latestTurn.equipoId === ownEquipoId ? 'tu equipo' : `Bot ${latestTurn.equipoId.replace('bot-', '')}`;
  return `Procesando el siguiente movimiento tras el turno de ${actor}`;
}

function getWinnerLabel(game: TrainingGameResponse, ownEquipoId: string): string {
  if (!game.resultado?.ganadorId) return 'Sin ganador';
  return game.resultado.ganadorId === ownEquipoId
    ? 'Tu equipo'
    : `Bot ${game.resultado.ganadorId.replace('bot-', '')}`;
}

function getParticipantStatus(
  participantId: string,
  currentActorId: string | null,
  latestTurn: TrainingTurnResponse | undefined,
  winnerId: string | null,
) {
  if (winnerId && participantId === winnerId) {
    return { label: 'Ganador', tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' };
  }
  if (participantId === currentActorId) {
    return { label: 'En turno', tone: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20' };
  }
  if (latestTurn?.equipoId === participantId) {
    return { label: 'Última acción', tone: 'text-amber-300 bg-amber-500/10 border-amber-500/20' };
  }
  return { label: 'En espera', tone: 'text-slate-300 bg-slate-500/10 border-slate-500/20' };
}

export default function TrainingGameDetailPage({ params }: Props) {
  const { equipo } = useAppSession();
  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState<TrainingGameResponse | null>(null);
  const [turns, setTurns] = useState<TrainingTurnResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aborting, setAborting] = useState(false);
  const [replayMode, setReplayMode] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    params.then(({ id }) => setGameId(id));
  }, [params]);

  const fetchData = useCallback(async () => {
    if (!gameId) return;
    try {
      const [gameData, turnsData] = await Promise.all([
        apiFetch<TrainingGameResponse>(`/training/games/${gameId}`),
        apiFetch<{ turns: TrainingTurnResponse[] }>(`/training/games/${gameId}/turns`),
      ]);
      setGame(gameData);
      setTurns(turnsData.turns);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la partida');
    }
  }, [gameId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!gameId || game?.estado !== 'en_curso') return;
    const pollId = setInterval(() => {
      setNow(Date.now());
      void fetchData();
    }, POLL_INTERVAL);
    return () => clearInterval(pollId);
  }, [gameId, game?.estado, fetchData]);

  useEffect(() => {
    const clockId = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(clockId);
  }, []);

  const handleAbort = async () => {
    if (!gameId) return;
    setAborting(true);
    try {
      await apiFetch(`/training/games/${gameId}/abort`, { method: 'POST' });
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al abortar');
    } finally {
      setAborting(false);
    }
  };

  if (!game) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center">
        {error ? (
          <p className="text-red-400">{error}</p>
        ) : (
          <p className="text-slate-400 animate-pulse">Cargando partida de entrenamiento…</p>
        )}
      </div>
    );
  }

  const equipoId = equipo?.id ?? game.equipoId;
  const participants = getParticipants(equipoId, game.numBots);
  const allTeamIds = participants.map((participant) => participant.id);
  const turnsDesc = [...turns].sort((a, b) => b.numero - a.numero);
  const latestTurn = turnsDesc[0];
  const currentActorId = getCurrentActorId(game, equipoId);
  const currentActor = participants.find((participant) => participant.id === currentActorId) ?? null;
  const updatedAt = latestTurn?.createdAt ?? game.finishedAt ?? game.createdAt;
  const liveStateLabel =
    game.estado === 'en_curso'
      ? `Actualizado ${formatRelativeTime(updatedAt, now)}`
      : game.finishedAt
      ? `Cerrada a las ${formatClock(game.finishedAt)}`
      : 'Sesión lista';
  const teamsWithTurns = new Set(turns.map((turn) => turn.equipoId)).size;
  const refutedSuggestions = turns.filter((turn) => turn.refutacion?.refutadaPor).length;
  const actionSummary = latestTurn ? describeTurn(latestTurn, equipoId) : 'Aún no se han registrado acciones.';

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 pb-10 lg:p-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.16),_transparent_28%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.96))] shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
        <div className="flex flex-col gap-6 p-6 lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300/80">
                Panel de seguimiento
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Partida de entrenamiento
                </h1>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${game.estado === 'en_curso' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : game.estado === 'finalizada' ? 'border-amber-400/20 bg-amber-400/10 text-amber-300' : 'border-rose-400/20 bg-rose-400/10 text-rose-300'}`}>
                  {game.estado === 'en_curso' ? 'En curso' : game.estado === 'finalizada' ? 'Finalizada' : 'Abortada'}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                  {liveStateLabel}
                </span>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                Sigue el estado actual del entrenamiento, quién está moviendo ahora y cómo evoluciona la partida turno a turno.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">ID</p>
                <p className="mt-1 font-mono text-sm text-white">{game.id.slice(0, 8)}…</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Semilla</p>
                <p className="mt-1 font-mono text-sm text-white">{game.seed ? `${game.seed.slice(0, 10)}…` : 'Aleatoria'}</p>
              </div>
              {game.estado === 'en_curso' && (
                <button
                  onClick={handleAbort}
                  disabled={aborting}
                  className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {aborting ? 'Abortando…' : 'Abortar entrenamiento'}
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Turno actual</p>
              <p className="mt-2 text-3xl font-semibold text-white">{game.numTurnos}</p>
              <p className="mt-1 text-sm text-slate-400">Turnos registrados</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Participantes</p>
              <p className="mt-2 text-3xl font-semibold text-white">{participants.length}</p>
              <p className="mt-1 text-sm text-slate-400">1 equipo real + {game.numBots} bots</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Refutaciones</p>
              <p className="mt-2 text-3xl font-semibold text-white">{refutedSuggestions}</p>
              <p className="mt-1 text-sm text-slate-400">Sugerencias con respuesta</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Ganador</p>
              <p className="mt-2 text-xl font-semibold text-white">{getWinnerLabel(game, equipoId)}</p>
              <p className="mt-1 text-sm text-slate-400">
                {game.estado === 'en_curso' ? 'Todavía en disputa' : 'Resultado del entrenamiento'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.3)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Ahora mismo</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {currentActor ? currentActor.label : game.estado === 'finalizada' ? 'Partida finalizada' : 'Entrenamiento en pausa'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{getStageText(game, turnsDesc, equipoId)}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${latestTurn ? getActionTone(latestTurn) : 'border-slate-500/20 bg-slate-500/10 text-slate-300'}`}>
              {latestTurn ? getActionLabel(latestTurn) : 'Sin actividad'}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">Última jugada</p>
              <p className="mt-2 text-base leading-7 text-white">{actionSummary}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="rounded-full border border-white/10 px-2.5 py-1">
                  Último evento a las {formatClock(updatedAt)}
                </span>
                {latestTurn?.durationMs != null && (
                  <span className="rounded-full border border-white/10 px-2.5 py-1">
                    Duración {latestTurn.durationMs} ms
                  </span>
                )}
                <span className="rounded-full border border-white/10 px-2.5 py-1">
                  Equipos con turno: {teamsWithTurns}/{participants.length}
                </span>
              </div>
            </div>

            <div className="flex min-w-[11rem] flex-col justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Ritmo</p>
                <p className="mt-2 text-2xl font-semibold text-white">{turns.length}</p>
                <p className="text-sm text-slate-400">eventos en timeline</p>
              </div>
              <div className="mt-6 text-sm text-slate-300">
                {game.estado === 'en_curso' ? 'Polling automático cada 5 s' : 'Replay disponible al finalizar'}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.3)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Jugadores</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Mesa de entrenamiento</h2>
            </div>
            <span className="text-sm text-slate-400">{participants.length} participantes</span>
          </div>

          <div className="mt-5 grid gap-3">
            {participants.map((participant, index) => {
              const status = getParticipantStatus(
                participant.id,
                currentActorId,
                latestTurn,
                game.resultado?.ganadorId ?? null,
              );

              return (
                <article
                  key={participant.id}
                  className={`rounded-2xl border p-4 transition-colors ${
                    participant.id === currentActorId
                      ? 'border-cyan-400/30 bg-cyan-400/8'
                      : participant.isOwn
                      ? 'border-amber-400/20 bg-amber-400/5'
                      : 'border-white/10 bg-black/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-sm font-semibold ${
                        participant.isOwn
                          ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
                          : 'border-white/10 bg-white/5 text-slate-200'
                      }`}>
                        {participant.shortLabel}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-white">{participant.label}</p>
                        <p className="text-sm text-slate-400">Orden {index + 1}</p>
                      </div>
                    </div>

                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.tone}`}>
                      {status.label}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-6">
        <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.3)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Deducción</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Tablero de pistas</h2>
            </div>
            <span className="text-sm text-slate-400">Lectura estratégica por carta y jugador</span>
          </div>
          <TrainingDeductionBoard
            sobre={game.sobres}
            botHands={game.botHands}
            turns={turns}
            equipoIds={allTeamIds}
            realEquipoId={equipoId}
          />
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.3)]">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Resultado</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Sobre y cierre</h2>
          </div>
          <TrainingEnvelopeReveal game={game} equipoId={equipoId} />
        </section>
      </div>

      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.3)]">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Timeline</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Secuencia de turnos</h2>
            <p className="mt-1 text-sm text-slate-400">
              Lo más reciente aparece primero para facilitar el seguimiento en directo.
            </p>
          </div>

          {turns.length > 0 && game.estado !== 'en_curso' && (
            <button
              onClick={() => setReplayMode((value) => !value)}
              className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                replayMode
                  ? 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20'
                  : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              {replayMode ? 'Ver historial' : 'Reproducir paso a paso'}
            </button>
          )}
        </div>

        <div className="mt-5">
          {replayMode ? (
            <TrainingReplayPlayer turns={turns} equipoId={equipoId} gameId={gameId ?? game.id} />
          ) : (
            <TrainingTurnTimeline turns={turnsDesc} equipoId={equipoId} />
          )}
        </div>
      </section>
    </div>
  );
}
