'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import { apiFetch } from '@/lib/api/client';
import type { ScoreEventPublic, ScoreEventsResponse } from '@/types/api';

// ── Labels & metadata per event type ─────────────────────────────────────────

const EVENT_META: Record<
  string,
  { label: string; color: 'emerald' | 'red' | 'amber' | 'cyan' }
> = {
  EVT_WIN:                  { label: '🏆 Victoria',                   color: 'emerald' },
  EVT_WIN_EFFICIENCY:       { label: '⚡ Bonificación eficiencia',     color: 'emerald' },
  EVT_SURVIVE:              { label: '🛡️ Supervivencia',               color: 'cyan'    },
  EVT_SUGGESTION:           { label: '🔍 Sugerencia válida',           color: 'cyan'    },
  EVT_REFUTATION:           { label: '↩ Refutación exitosa',          color: 'cyan'    },
  EVT_WRONG_ACCUSATION:     { label: '✗ Acusación incorrecta',        color: 'red'     },
  EVT_PASS:                 { label: '⏭ Turno pasado',               color: 'amber'   },
  EVT_TIMEOUT:              { label: '⏱ Timeout de agente',           color: 'red'     },
  EVT_INVALID_CARD:         { label: '⚠ Carta inválida',              color: 'red'     },
  EVT_REDUNDANT_SUGGESTION: { label: '♻ Sugerencia redundante',       color: 'red'     },
  EVT_INVALID_FORMAT:       { label: '⚠ Formato de respuesta inválido', color: 'red'   },
};

function eventLabel(type: string): string {
  return EVENT_META[type]?.label ?? type;
}

function eventColor(type: string): 'emerald' | 'red' | 'amber' | 'cyan' {
  return EVENT_META[type]?.color ?? 'amber';
}

const COLOR_CLASSES = {
  emerald: {
    row:    'bg-emerald-400/5 border-emerald-400/20',
    badge:  'bg-emerald-400/10 text-emerald-400',
    points: 'text-emerald-400',
  },
  red: {
    row:    'bg-red-400/5 border-red-400/20',
    badge:  'bg-red-400/10 text-red-400',
    points: 'text-red-400',
  },
  amber: {
    row:    'bg-amber-400/5 border-amber-400/20',
    badge:  'bg-amber-400/10 text-amber-400',
    points: 'text-amber-400',
  },
  cyan: {
    row:    'bg-cyan-400/5 border-cyan-400/20',
    badge:  'bg-cyan-400/10 text-cyan-400',
    points: 'text-cyan-400',
  },
} as const;

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <span className="h-6 w-6 rounded-full border-2 border-slate-600 border-t-cyan-400 animate-spin" />
    </div>
  );
}

function EmptyState() {
  return (
    <p className="py-8 text-center text-sm text-slate-500">
      Todavía no hay eventos de puntuación registrados para este equipo.
    </p>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ScoreHistoryModalProps {
  gameId: string;
  equipoId: string;
  equipoNombre: string;
  currentPoints: number;
  onClose: () => void;
}

type LoadState = 'loading' | 'ok' | 'error';

export function ScoreHistoryModal({
  gameId,
  equipoId,
  equipoNombre,
  currentPoints,
  onClose,
}: ScoreHistoryModalProps) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [events, setEvents] = useState<ScoreEventPublic[]>([]);

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const res = await apiFetch<ScoreEventsResponse>(`/games/${gameId}/score-events`);
      const teamEvents = res.events
        .filter((e) => e.equipoId === equipoId)
        .sort((a, b) => a.turno - b.turno || a.id - b.id);
      setEvents(teamEvents);
      setLoadState('ok');
    } catch {
      setLoadState('error');
    }
  }, [gameId, equipoId]);

  useEffect(() => {
    load();
  }, [load]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Running total helper
  let running = 0;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/60 gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">
              Historial de puntuación
            </h2>
            <p className="text-xs text-slate-400 truncate">{equipoNombre}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-bold text-cyan-400">
              ♦ {currentPoints} pts
            </span>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors text-lg leading-none"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-4 flex flex-col gap-1.5">
          {loadState === 'loading' && <Spinner />}
          {loadState === 'error' && (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm text-red-400">Error al cargar los eventos.</p>
              <button
                onClick={load}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}
          {loadState === 'ok' && events.length === 0 && <EmptyState />}
          {loadState === 'ok' && events.length > 0 && events.map((ev) => {
            running += ev.points;
            const color = eventColor(ev.type);
            const cls = COLOR_CLASSES[color];
            const sign = ev.points >= 0 ? '+' : '';
            return (
              <div
                key={ev.id}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                  cls.row,
                )}
              >
                {/* Turn badge */}
                <span className="shrink-0 font-mono text-slate-500 w-6 text-right">
                  T{ev.turno}
                </span>

                {/* Event label */}
                <span className={cn('flex-1 font-medium', cls.badge, 'px-1.5 py-0.5 rounded')}>
                  {eventLabel(ev.type)}
                </span>

                {/* Delta */}
                <span className={cn('shrink-0 font-mono font-bold', cls.points)}>
                  {sign}{ev.points}
                </span>

                {/* Running total */}
                <span className="shrink-0 font-mono text-slate-400 w-16 text-right">
                  = {running}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer summary */}
        {loadState === 'ok' && events.length > 0 && (
          <div className="border-t border-slate-700/60 px-4 py-3 flex items-center justify-between text-xs text-slate-400">
            <span>{events.length} evento{events.length !== 1 ? 's' : ''}</span>
            <span className="font-mono text-white font-semibold">
              Total: {currentPoints} pts
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
