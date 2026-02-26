'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useInterval } from '@/lib/utils/useInterval';
import { apiFetch } from '@/lib/api/client';
import type { GameDetailResponse } from '@/types/api';

interface GameContextValue {
  partida: GameDetailResponse | null;
  isPolling: boolean;
  lastUpdated: Date | null;
  error: Error | null;
  refresh: () => void;
}

const GameContext = createContext<GameContextValue>({
  partida: null,
  isPolling: false,
  lastUpdated: null,
  error: null,
  refresh: () => {},
});

interface GameProviderProps {
  children: React.ReactNode;
  gameId: string;
  pollingInterval: number; // ms
}

export function GameProvider({ children, gameId, pollingInterval }: GameProviderProps) {
  const [partida, setPartida] = useState<GameDetailResponse | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const isFinished = partida?.estado === 'finalizada';

  const fetchGame = useCallback(async () => {
    try {
      const data = await apiFetch<GameDetailResponse>(`/games/${gameId}`);
      setPartida(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    }
  }, [gameId]);

  // Initial fetch
  React.useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  // Polling: stop when game is finished
  useInterval(fetchGame, isFinished ? null : pollingInterval);

  const value: GameContextValue = {
    partida,
    isPolling: !isFinished,
    lastUpdated,
    error,
    refresh: fetchGame,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  return useContext(GameContext);
}
