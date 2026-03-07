'use client';

// src/contexts/NotificationsContext.tsx
// F018: lifecycle notification context — subscribes via WS and exposes a
// notification feed that any consumer can display.

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useNotificationsSocket } from '@/lib/utils/useNotificationsSocket';
import { useAppSession } from '@/contexts/SessionContext';
import type { ServerMessage } from '@/lib/ws/protocol';

// ── Types ────────────────────────────────────────────────────────────────────

export type NotificationKind =
  | 'game_scheduled'
  | 'game_started'
  | 'game_finished'
  | 'ranking_updated'
  | 'training_started'
  | 'training_finished'
  | 'training_error';

/** A single notification item displayed in the panel / toasts. */
export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  ts: number;
  read: boolean;
}

interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
  markAllRead: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function nextId() {
  return `notif-${Date.now()}-${++_idCounter}`;
}

/** Converts a raw server message into a user-visible item (or null to ignore). */
function toNotificationItem(msg: ServerMessage): NotificationItem | null {
  const id = nextId();
  const ts = 'ts' in msg ? (msg as { ts: number }).ts : Date.now();

  switch (msg.type) {
    case 'notification:game_scheduled':
      return {
        id, kind: 'game_scheduled', ts, read: false,
        title: 'Nueva partida programada',
        description: msg.nombre,
      };
    case 'notification:game_started':
      return {
        id, kind: 'game_started', ts, read: false,
        title: 'Partida iniciada',
        description: msg.nombre,
      };
    case 'notification:game_finished': {
      const winner = msg.ganadorNombre ? `Ganador: ${msg.ganadorNombre}` : 'Sin ganador';
      return {
        id, kind: 'game_finished', ts, read: false,
        title: 'Partida finalizada',
        description: `${msg.nombre} — ${winner}`,
      };
    }
    case 'notification:ranking_updated':
      return {
        id, kind: 'ranking_updated', ts, read: false,
        title: 'Ranking actualizado',
        description: 'Comprueba la clasificación actualizada.',
      };
    case 'notification:training_started':
      return {
        id, kind: 'training_started', ts, read: false,
        title: 'Entrenamiento iniciado',
        description: `${msg.numBots} bot${msg.numBots !== 1 ? 's' : ''} adversarios`,
      };
    case 'notification:training_finished': {
      const aborted = msg.estado === 'abortada';
      const desc = aborted
        ? `Abortado${msg.motivoAbort ? `: ${msg.motivoAbort}` : ''}`
        : `${msg.puntosSimulados} pts simulados · ${msg.numTurnos} turnos`;
      return {
        id, kind: 'training_finished', ts, read: false,
        title: aborted ? 'Entrenamiento abortado' : 'Entrenamiento completado',
        description: desc,
      };
    }
    case 'notification:training_error':
      return {
        id, kind: 'training_error', ts, read: false,
        title: 'Error en entrenamiento',
        description: msg.message,
      };
    default:
      return null;
  }
}

// ── Context & Provider ───────────────────────────────────────────────────────

const NotificationsContext = createContext<NotificationsContextValue>({
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  setIsOpen: () => {},
  dismiss: () => {},
  clearAll: () => {},
  markAllRead: () => {},
});

const MAX_NOTIFICATIONS = 50; // cap to avoid unbounded memory growth

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { equipo } = useAppSession();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpenState] = useState(false);

  const handleMessage = useCallback((msg: ServerMessage) => {
    const item = toNotificationItem(msg);
    if (!item) return;
    setNotifications((prev) => {
      const next = [item, ...prev];
      return next.length > MAX_NOTIFICATIONS ? next.slice(0, MAX_NOTIFICATIONS) : next;
    });
  }, []);

  useNotificationsSocket({ onMessage: handleMessage, equipoId: equipo?.id ?? null });

  const setIsOpen = useCallback((open: boolean) => {
    setIsOpenState(open);
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, isOpen, setIsOpen, dismiss, clearAll, markAllRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
