'use client';

// src/lib/utils/useGameSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import type { ServerMessage } from '@/lib/ws/protocol';

interface UseGameSocketOptions {
  gameId: string;
  onMessage: (msg: ServerMessage) => void;
  onDisconnect?: () => void;
  enabled: boolean; // false cuando la partida está finalizada
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3000/api/ws';
const RECONNECT_DELAY_MS = 2_000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useGameSocket({ gameId, onMessage, onDisconnect, enabled }: UseGameSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onDisconnectRef = useRef(onDisconnect);
  onDisconnectRef.current = onDisconnect;
  // Keep a ref so ws.onclose always reads the current value, not the stale closure.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const connect = useCallback(() => {
    if (!enabledRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      attemptsRef.current = 0;
      ws.send(JSON.stringify({ type: 'subscribe', gameId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        // Responder al ping automáticamente
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        onMessageRef.current(msg);
      } catch {
        console.warn('[WS] Mensaje no parseable', event.data);
      }
    };

    ws.onclose = (event) => {
      onDisconnectRef.current?.();
      if (!enabledRef.current) return; // reads current value, not stale closure
      if (event.code === 4001) return; // No reconectar si fue por auth
      if (attemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[WS] Máximo de reconexiones alcanzado.');
        return;
      }
      const delay = RECONNECT_DELAY_MS * Math.min(attemptsRef.current + 1, 5);
      attemptsRef.current++;
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [gameId]); // enabled removed — read via enabledRef to avoid stale closures

  // Connect on mount / when gameId changes.
  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close(1000, 'Component unmounted');
    };
  }, [connect]);

  // When `enabled` transitions true → false (e.g. game finished), close
  // immediately so ws.onclose sees enabledRef.current === false and won't
  // schedule another reconnect.
  useEffect(() => {
    if (!enabled) {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wsRef.current?.close(1000, 'Game finished');
    }
  }, [enabled]);
}
