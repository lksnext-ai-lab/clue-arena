'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api/client';
import { useAppSession } from '@/contexts/SessionContext';
import type { TrainingGameResponse, TrainingTurnResponse } from '@/types/api';
import { TrainingGameHeader } from './components/TrainingGameHeader';
import { TrainingEnvelopeReveal } from './components/TrainingEnvelopeReveal';
import { TrainingTurnTimeline } from './components/TrainingTurnTimeline';
import { TrainingDeductionBoard } from './components/TrainingDeductionBoard';

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

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Tablero de deducción
        </h2>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
          <TrainingDeductionBoard
            turns={turns}
            equipoIds={allTeamIds}
            realEquipoId={equipoId}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Historial de turnos
        </h2>
        <TrainingTurnTimeline turns={turns} equipoId={equipoId} />
      </section>
    </div>
  );
}
