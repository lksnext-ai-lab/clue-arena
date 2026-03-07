'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api/client';
import { useAppSession } from '@/contexts/SessionContext';
import type { TrainingGameResponse, TrainingTurnResponse } from '@/types/api';
import { TrainingGameHeader } from './components/TrainingGameHeader';
import { TrainingEnvelopeReveal } from './components/TrainingEnvelopeReveal';
import { TrainingTurnTimeline } from './components/TrainingTurnTimeline';
import { TrainingDeductionBoard } from './components/TrainingDeductionBoard';
import { TrainingReplayPlayer } from './components/TrainingReplayPlayer';

interface Props {
  params: Promise<{ id: string }>;
}

const POLL_INTERVAL = 5_000;

export default function TrainingGameDetailPage({ params }: Props) {
  const { equipo } = useAppSession();
  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState<TrainingGameResponse | null>(null);
  const [turns, setTurns] = useState<TrainingTurnResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aborting, setAborting] = useState(false);
  const [replayMode, setReplayMode] = useState(false);

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

  // Poll while game is in progress
  useEffect(() => {
    if (!gameId || game?.estado !== 'en_curso') return;
    const id = setInterval(() => { void fetchData(); }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [gameId, game?.estado, fetchData]);

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
      <div className="flex items-center justify-center h-48">
        {error ? (
          <p className="text-red-400">{error}</p>
        ) : (
          <p className="text-slate-400 animate-pulse">Cargando partida…</p>
        )}
      </div>
    );
  }

  const equipoId = equipo?.id ?? game.equipoId;
  const botIds = Array.from({ length: game.numBots }, (_, i) => `bot-${i + 1}`);
  const allTeamIds = [equipoId, ...botIds];

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <TrainingGameHeader game={game} onAbort={handleAbort} aborting={aborting} />

      {error && (
        <div className="rounded border border-red-700 bg-red-900/20 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <TrainingEnvelopeReveal game={game} equipoId={equipoId} />

      <TrainingDeductionBoard
        turns={turns}
        equipoIds={allTeamIds}
        realEquipoId={equipoId}
      />

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Historial de turnos
          </h2>
          {turns.length > 0 && game?.estado !== 'en_curso' && (
            <button
              onClick={() => setReplayMode((m) => !m)}
              className={`flex items-center gap-1.5 rounded border px-3 py-1 text-xs font-semibold transition ${
                replayMode
                  ? 'border-indigo-500 bg-indigo-900/40 text-indigo-200 hover:bg-indigo-900/60'
                  : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-400 hover:text-white'
              }`}
            >
              {replayMode ? '📋 Ver historial' : '▶ Reproducir paso a paso'}
            </button>
          )}
        </div>

        {replayMode ? (
          <TrainingReplayPlayer turns={turns} equipoId={equipoId} gameId={gameId!} />
        ) : (
          <TrainingTurnTimeline turns={turns} equipoId={equipoId} />
        )}
      </section>
    </div>
  );
}
