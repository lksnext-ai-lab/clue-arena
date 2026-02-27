'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useGameSocket } from '@/lib/utils/useGameSocket';
import { apiFetch } from '@/lib/api/client';
import type { GameDetailResponse } from '@/types/api';
import type { ServerMessage } from '@/lib/ws/protocol';

interface GameContextValue {
  partida: GameDetailResponse | null;
  isConnected: boolean;
  lastUpdated: Date | null;
  error: Error | null;
  refresh: () => void; // fallback HTTP manual
}

const GameContext = createContext<GameContextValue>({
  partida: null,
  isConnected: false,
  lastUpdated: null,
  error: null,
  refresh: () => {},
});

interface GameProviderProps {
  children: React.ReactNode;
  gameId: string;
}

export function GameProvider({ children, gameId }: GameProviderProps) {
  const [partida, setPartida] = useState<GameDetailResponse | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isFinished = partida?.estado === 'finalizada';

  // Fetching HTTP: solo al montar (estado inicial) y como fallback manual
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

  // Carga inicial
  React.useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  // Manejador de mensajes WebSocket
  const handleWsMessage = useCallback((msg: ServerMessage) => {
    if (msg.type === 'subscribed') {
      setIsConnected(true);
      // Re-fetch completo al suscribirse para garantizar estado fresco
      fetchGame();
      return;
    }
    if (msg.type === 'game:turn_completed' || msg.type === 'game:status_changed') {
      // Re-fetch completo del estado actual (simple y robusto)
      fetchGame();
    }
  }, [fetchGame]);

  const handleWsDisconnect = useCallback(() => {
    setIsConnected(false);
  }, []);

  // WebSocket: activo mientras la partida no ha finalizado
  useGameSocket({
    gameId,
    onMessage: handleWsMessage,
    onDisconnect: handleWsDisconnect,
    enabled: !isFinished,
  });

  const value: GameContextValue = {
    partida,
    isConnected,
    lastUpdated,
    error,
    refresh: fetchGame,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  return useContext(GameContext);
}
