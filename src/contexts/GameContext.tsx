'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useGameSocket } from '@/lib/utils/useGameSocket';
import { apiFetch } from '@/lib/api/client';
import type { GameDetailResponse } from '@/types/api';
import type { ServerMessage } from '@/lib/ws/protocol';
import type { TurnActivityState, TurnActivityEntry, TurnMicroEventUI } from '@/types/domain';
import { TURN_ACTIVITY_HISTORY_LIMIT } from '@/types/domain';

interface GameContextValue {
  partida: GameDetailResponse | null;
  activeEquipoId: string | null;
  isConnected: boolean;
  lastUpdated: Date | null;
  error: Error | null;
  refresh: () => void; // fallback HTTP manual
  /**
   * Allows consumers (tests or the WS handler) to request that the displayed
   * active team be changed.  If an animation is in progress the change is
   * deferred until it finishes; otherwise it applies immediately.
   */
  scheduleActiveEquipoId: (id: string | null) => void;
  /** Called by SuggestionRevealOverlay when an animation starts/ends. */
  notifySuggestionAnimationStart: () => void;
  notifySuggestionAnimationEnd: () => void;
  /** F016: live coordinator micro-events for the current turn. */
  currentTurnActivity: TurnActivityState;
  /** G004: most recent spectator comment received; null when cleared. */
  latestSpectatorComment: LatestSpectatorComment | null;
}

/** G004: spectator comment produced by an agent for display in ArenaHeader. */
export interface LatestSpectatorComment {
  equipoId: string;
  equipoNombre: string;
  text: string;
  ts: number;
}

const EMPTY_TURN_ACTIVITY: TurnActivityState = { active: null, history: [] };

const GameContext = createContext<GameContextValue>({
  partida: null,
  activeEquipoId: null,
  isConnected: false,
  lastUpdated: null,
  error: null,
  refresh: () => {},
  scheduleActiveEquipoId: () => {},
  notifySuggestionAnimationStart: () => {},
  notifySuggestionAnimationEnd: () => {},
  currentTurnActivity: EMPTY_TURN_ACTIVITY,
  latestSpectatorComment: null,
});

interface GameProviderProps {
  children: React.ReactNode;
  gameId: string;
}

export function GameProvider({ children, gameId }: GameProviderProps) {
  const [partida, setPartida] = useState<GameDetailResponse | null>(null);
  const [activeEquipoId, setActiveEquipoId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentTurnActivity, setCurrentTurnActivity] = useState<TurnActivityState>(EMPTY_TURN_ACTIVITY);
  // G004: most recent spectator comment from the active agent or refutador
  const [latestSpectatorComment, setLatestSpectatorComment] = useState<LatestSpectatorComment | null>(null);

  // ---------- animation / pending-team bookkeeping ----------
  const animatingRef = useRef(false);
  const pendingEquipoRef = useRef<string | null>(null);

  const scheduleActiveEquipoId = useCallback((id: string | null) => {
    // Store the requested id.  We'll flush it in one of two ways:
    // 1. If an animation is currently in progress (`animatingRef` true), it
    //    will be flushed when notifySuggestionAnimationEnd() runs.
    // 2. If no animation yet, we start a short timer.  That timer gives the
    //    overlay a chance to start shortly after the call; if animatingRef
    //    becomes true before the timeout fires we skip the flush here and let
    //    the notify-end handler apply the pending value instead.  Otherwise we
    //    commit after the delay, effectively making the change "when the overlay
    //    disappears" in the common case where no overlay ever shows.
    pendingEquipoRef.current = id;
    if (!animatingRef.current) {
      setTimeout(() => {
        if (!animatingRef.current && pendingEquipoRef.current !== null) {
          setActiveEquipoId(pendingEquipoRef.current);
          pendingEquipoRef.current = null;
        }
      }, 20); // short grace period to absorb races
    }
  }, []);

  const notifySuggestionAnimationStart = useCallback(() => {
    animatingRef.current = true;
  }, []);

  const notifySuggestionAnimationEnd = useCallback(() => {
    animatingRef.current = false;
    if (pendingEquipoRef.current !== null) {
      setActiveEquipoId(pendingEquipoRef.current);
      pendingEquipoRef.current = null;
    }
  }, []);

  // Monotonic counter to discard out-of-order HTTP responses.
  // Multiple WS events (e.g. rapid auto-run turns) can trigger concurrent
  // fetchGame() calls; a slow earlier response must never overwrite a fast
  // later one, or the turn indicator ends up showing a stale team.
  const fetchSeqRef = useRef(0);

  const isFinished = partida?.estado === 'finalizada';

  // Fetching HTTP: solo al montar (estado inicial) y como fallback manual
  const fetchGame = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    try {
      const data = await apiFetch<GameDetailResponse>(`/games/${gameId}`);
      // Only accept this response if no newer request has completed after us
      if (seq < fetchSeqRef.current) return;
      setPartida(data);
      // route updates also use the scheduling logic so animation is respected
      scheduleActiveEquipoId(data.activeEquipoId);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      if (seq < fetchSeqRef.current) return;
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    }
  }, [gameId, scheduleActiveEquipoId]);

  // Carga inicial
  React.useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  // ── F016: helpers to accumulate turn micro-events ──────────────────────────
  const appendTurnMicroEvent = useCallback((ev: TurnMicroEventUI, turnoId: string, turnoNumero: number) => {
    setCurrentTurnActivity((prev) => {
      // If there is an active entry for the same turn, append the event to it.
      if (prev.active && prev.active.turnoId === turnoId) {
        return {
          ...prev,
          active: { ...prev.active, events: [...prev.active.events, ev] },
        };
      }
      // New turn — create a fresh active entry (the old one was already sealed
      // when game:turn_completed fired, but guard here in case of ordering).
      const fresh: TurnActivityEntry = { turnoId, turnoNumero, events: [ev], isCompleted: false };
      return { ...prev, active: fresh };
    });
  }, []);

  const appendToActiveTurn = useCallback((ev: TurnMicroEventUI) => {
    setCurrentTurnActivity((prev) => {
      if (!prev.active) return prev;
      return {
        ...prev,
        active: { ...prev.active, events: [...prev.active.events, ev] },
      };
    });
  }, []);

  const sealActiveTurn = useCallback(() => {
    setCurrentTurnActivity((prev) => {
      if (!prev.active) return prev;
      const sealed = { ...prev.active, isCompleted: true };
      const history = [sealed, ...prev.history].slice(0, TURN_ACTIVITY_HISTORY_LIMIT);
      return { active: null, history };
    });
  }, []);

  // Manejador de mensajes WebSocket
  const handleWsMessage = useCallback((msg: ServerMessage) => {
    if (msg.type === 'subscribed') {
      setIsConnected(true);
      // Re-fetch completo al suscribirse para garantizar estado fresco
      fetchGame();
      return;
    }
    if (msg.type === 'game:turn_completed') {
      // Seal the current feed entry before fetching fresh data.
      sealActiveTurn();
      // G004: clear the spectator comment banner on turn completion
      setLatestSpectatorComment(null);
      // coordinator tells us which team is up next; delay visible change until
      // any running suggestion animation has finished.
      if (msg.nextEquipoId !== undefined) {
        scheduleActiveEquipoId(msg.nextEquipoId);
      }
      fetchGame();
      return;
    }
    if (msg.type === 'game:status_changed') {
      // Re-fetch completo del estado actual (simple y robusto)
      fetchGame();
      return;
    }
    // ── F016 micro-events ────────────────────────────────────────────────────
    if (msg.type === 'turn:agent_invoked') {
      const ev: TurnMicroEventUI = {
        type: 'turn:agent_invoked',
        equipoId: msg.equipoId,
        equipoNombre: msg.equipoNombre,
        ts: msg.ts,
      };
      appendTurnMicroEvent(ev, msg.turnoId, msg.turnoNumero);
      return;
    }
    if (msg.type === 'turn:agent_responded') {
      const ev: TurnMicroEventUI = {
        type: 'turn:agent_responded',
        equipoId: msg.equipoId,
        equipoNombre: msg.equipoNombre,
        accion: msg.accion,
        sugerencia: msg.sugerencia,
        durationMs: msg.durationMs,
        spectatorComment: msg.spectatorComment,
        ts: msg.ts,
      };
      appendTurnMicroEvent(ev, msg.turnoId, msg.turnoNumero);
      // G004: update spectator comment banner if present
      if (msg.spectatorComment) {
        setLatestSpectatorComment({
          equipoId: msg.equipoId,
          equipoNombre: msg.equipoNombre,
          text: msg.spectatorComment,
          ts: msg.ts,
        });
      }
      return;
    }
    if (msg.type === 'turn:refutation_requested') {
      const ev: TurnMicroEventUI = {
        type: 'turn:refutation_requested',
        equipoSugeridor: msg.equipoSugeridor,
        refutadoresIds: msg.refutadoresIds,
        ts: msg.ts,
      };
      appendTurnMicroEvent(ev, msg.turnoId, msg.turnoNumero);
      return;
    }
    if (msg.type === 'turn:refutation_received') {
      const ev: TurnMicroEventUI = {
        type: 'turn:refutation_received',
        equipoId: msg.equipoId,
        equipoNombre: msg.equipoNombre,
        resultado: msg.resultado,
        cartaMostrada: msg.cartaMostrada,
        durationMs: msg.durationMs,
        spectatorComment: msg.spectatorComment,
        ts: msg.ts,
      };
      appendTurnMicroEvent(ev, msg.turnoId, msg.turnoNumero);
      // G004: update spectator comment banner with refutador's comment
      if (msg.spectatorComment) {
        setLatestSpectatorComment({
          equipoId: msg.equipoId,
          equipoNombre: msg.equipoNombre,
          text: msg.spectatorComment,
          ts: msg.ts,
        });
      }
      return;
    }
    if (msg.type === 'warning:issued') {
      const ev: TurnMicroEventUI = {
        type: 'warning:issued',
        equipoId: msg.equipoId,
        equipoNombre: partida?.equipos.find((equipo) => equipo.equipoId === msg.equipoId)?.equipoNombre ?? msg.equipoId,
        warnings: msg.warnings,
        reason: msg.reason,
        ts: msg.ts,
      };
      appendToActiveTurn(ev);
      setPartida((prev) => prev ? {
        ...prev,
        equipos: prev.equipos.map((equipo) =>
          equipo.equipoId === msg.equipoId
            ? { ...equipo, warnings: msg.warnings }
            : equipo
        ),
      } : prev);
      return;
    }
    if (msg.type === 'warning:agent_eliminated') {
      const ev: TurnMicroEventUI = {
        type: 'warning:agent_eliminated',
        equipoId: msg.equipoId,
        equipoNombre: partida?.equipos.find((equipo) => equipo.equipoId === msg.equipoId)?.equipoNombre ?? msg.equipoId,
        equiposConCartasNuevas: msg.equiposConCartasNuevas,
        ts: msg.ts,
      };
      appendToActiveTurn(ev);
      setPartida((prev) => prev ? {
        ...prev,
        equipos: prev.equipos.map((equipo) =>
          equipo.equipoId === msg.equipoId
            ? {
                ...equipo,
                eliminado: true,
                eliminadoPorWarnings: true,
                warnings: Math.max(equipo.warnings, 3),
              }
            : equipo
        ),
      } : prev);
      return;
    }
  }, [fetchGame, scheduleActiveEquipoId, appendTurnMicroEvent, appendToActiveTurn, partida, sealActiveTurn]);

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
    activeEquipoId,
    isConnected,
    lastUpdated,
    error,
    refresh: fetchGame,
    scheduleActiveEquipoId,
    notifySuggestionAnimationStart,
    notifySuggestionAnimationEnd,
    currentTurnActivity,
    latestSpectatorComment,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  return useContext(GameContext);
}
