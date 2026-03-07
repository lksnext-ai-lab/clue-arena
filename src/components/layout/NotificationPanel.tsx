'use client';

// src/components/layout/NotificationPanel.tsx
// Bell icon + dropdown panel that renders incoming F018 lifecycle notifications.

import React, { useEffect, useRef } from 'react';
import { Bell, X, Trash2, Swords, Trophy, CalendarCheck, BarChart2, Dumbbell, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationsContext';
import type { NotificationItem, NotificationKind } from '@/contexts/NotificationsContext';

// ── Visual config per notification kind ─────────────────────────────────────

interface KindStyle {
  icon: React.ReactNode;
  accent: string;         // hex / tailwind-compatible
  bg: string;             // subtle background for the row
}

function getKindStyle(kind: NotificationKind): KindStyle {
  switch (kind) {
    case 'game_scheduled':
      return { icon: <CalendarCheck size={14} />, accent: '#38bdf8', bg: 'rgba(56,189,248,0.08)' };
    case 'game_started':
      return { icon: <Swords size={14} />, accent: '#34d399', bg: 'rgba(52,211,153,0.08)' };
    case 'game_finished':
      return { icon: <Trophy size={14} />, accent: '#a78bfa', bg: 'rgba(167,139,250,0.08)' };
    case 'ranking_updated':
      return { icon: <BarChart2 size={14} />, accent: '#fbbf24', bg: 'rgba(251,191,36,0.08)' };
    case 'training_started':
      return { icon: <Dumbbell size={14} />, accent: '#60a5fa', bg: 'rgba(96,165,250,0.08)' };
    case 'training_finished':
      return { icon: <CheckCircle2 size={14} />, accent: '#4ade80', bg: 'rgba(74,222,128,0.08)' };
    case 'training_error':
      return { icon: <AlertTriangle size={14} />, accent: '#f87171', bg: 'rgba(248,113,113,0.08)' };
  }
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'ahora';
  if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)} h`;
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NotificationRow({ item, onDismiss }: { item: NotificationItem; onDismiss: (id: string) => void }) {
  const { icon, accent, bg } = getKindStyle(item.kind);

  return (
    <div
      role="listitem"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 8,
        background: item.read ? 'transparent' : bg,
        border: `1px solid ${item.read ? 'transparent' : accent + '33'}`,
        transition: 'background 0.2s',
      }}
    >
      {/* Kind icon */}
      <span
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: accent + '22',
          color: accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {icon}
      </span>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: item.read ? 400 : 600, color: '#f1f5f9', lineHeight: 1.3 }}>
          {item.title}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.description}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#475569' }}>{formatTime(item.ts)}</p>
      </div>

      {/* Dismiss button */}
      <button
        aria-label="Descartar notificación"
        onClick={() => onDismiss(item.id)}
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#475569',
          padding: 2,
          borderRadius: 4,
          lineHeight: 1,
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────

export function NotificationBell() {
  const { unreadCount, isOpen, setIsOpen, notifications, dismiss, clearAll, markAllRead } = useNotifications();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, setIsOpen]);

  // Mark all read when panel opens
  useEffect(() => {
    if (isOpen && unreadCount > 0) markAllRead();
  }, [isOpen, unreadCount, markAllRead]);

  const togglePanel = () => setIsOpen(!isOpen);

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
        onClick={togglePanel}
        style={{
          width: 34, height: 34, border: 'none', cursor: 'pointer', borderRadius: 8,
          background: isOpen ? 'rgba(248,191,36,0.12)' : 'transparent',
          color: isOpen ? '#fbbf24' : '#64748b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
          position: 'relative',
        }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 5, right: 5,
              width: 8, height: 8,
              borderRadius: '50%',
              background: '#f87171',
              border: '1.5px solid #0f172a',
            }}
          />
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          role="region"
          aria-label="Panel de notificaciones"
          style={{
            position: 'absolute',
            top: 42,
            right: 0,
            width: 340,
            maxHeight: 480,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 12,
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderBottom: '1px solid #334155',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
              Notificaciones
              {notifications.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 11, color: '#64748b' }}>
                  ({notifications.length})
                </span>
              )}
            </span>
            {notifications.length > 0 && (
              <button
                aria-label="Borrar todas"
                onClick={clearAll}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#64748b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                  padding: '2px 6px', borderRadius: 4,
                }}
                title="Borrar todas"
              >
                <Trash2 size={11} />
                Borrar todo
              </button>
            )}
          </div>

          {/* List */}
          <div
            role="list"
            style={{
              overflowY: 'auto',
              flex: 1,
              padding: notifications.length > 0 ? '8px' : 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {notifications.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px 20px',
                  color: '#475569',
                  gap: 8,
                }}
              >
                <Bell size={28} strokeWidth={1.2} />
                <p style={{ margin: 0, fontSize: 13, textAlign: 'center' }}>
                  Sin notificaciones
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationRow key={n.id} item={n} onDismiss={dismiss} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
