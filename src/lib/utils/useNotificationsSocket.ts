'use client';

// src/lib/utils/useNotificationsSocket.ts
// Manages a WebSocket connection dedicated to lifecycle notification events (F018).
// Subscribes to `global` scope always; subscribes to `{ team: equipoId }` when provided.

import { useEffect, useRef, useCallback } from 'react';
import type { ServerMessage } from '@/lib/ws/protocol';
import { getWsUrl } from './useGameSocket';

export interface UseNotificationsSocketOptions {
  /** Called for every server message received (caller filters what it needs). */
  onMessage: (msg: ServerMessage) => void;
  /** When provided, also subscribes to team-scoped notifications. */
  equipoId?: string | null;
}

const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_ATTEMPTS = 8;

export function useNotificationsSocket({ onMessage, equipoId }: UseNotificationsSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const equipoIdRef = useRef(equipoId);
  equipoIdRef.current = equipoId;

  const subscribeAll = useCallback((ws: WebSocket) => {
    // Always subscribe to global lifecycle events
    ws.send(JSON.stringify({ type: 'subscribe:notifications', scope: 'global' }));
    // Subscribe to team channel when applicable
    if (equipoIdRef.current) {
      ws.send(JSON.stringify({ type: 'subscribe:notifications', scope: { team: equipoIdRef.current } }));
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      attemptsRef.current = 0;
      subscribeAll(ws);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        // Only surface notification-family messages to the caller
        if (msg.type.startsWith('notification:') || msg.type === 'subscribed:notifications') {
          onMessageRef.current(msg);
        }
      } catch {
        // ignore un-parseable frames
      }
    };

    ws.onclose = (evt) => {
      if (evt.code === 4001) return;            // auth failure — don't retry
      if (attemptsRef.current >= MAX_RECONNECT_ATTEMPTS) return;
      const delay = RECONNECT_DELAY_MS * Math.min(attemptsRef.current + 1, 5);
      attemptsRef.current++;
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  }, [subscribeAll]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close(1000, 'Component unmounted');
    };
  }, [connect]);

  // When equipoId becomes available after initial mount, re-subscribe
  useEffect(() => {
    if (equipoId && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe:notifications', scope: { team: equipoId } }));
    }
  }, [equipoId]);
}
