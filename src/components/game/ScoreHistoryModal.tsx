'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ChevronRight,
  Crown,
  RefreshCw,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { apiFetch } from '@/lib/api/client';
import type { ScoreEventPublic, ScoreEventsResponse } from '@/types/api';

const EVENT_META: Record<
  string,
  { key: string; color: 'emerald' | 'red' | 'amber' | 'cyan'; Icon: typeof Sparkles }
> = {
  EVT_WIN:                  { key: 'win', color: 'emerald', Icon: Crown },
  EVT_WIN_EFFICIENCY:       { key: 'winEfficiency', color: 'emerald', Icon: Sparkles },
  EVT_TURN_SPEED:           { key: 'turnSpeed', color: 'emerald', Icon: Sparkles },
  EVT_SURVIVE:              { key: 'survive', color: 'cyan', Icon: Shield },
  EVT_SUGGESTION:           { key: 'suggestion', color: 'cyan', Icon: Sparkles },
  EVT_REFUTATION:           { key: 'refutation', color: 'cyan', Icon: ChevronRight },
  EVT_WRONG_ACCUSATION:     { key: 'wrongAccusation', color: 'red', Icon: AlertTriangle },
  EVT_PASS:                 { key: 'pass', color: 'amber', Icon: ChevronRight },
  EVT_TIMEOUT:              { key: 'timeout', color: 'red', Icon: AlertTriangle },
  EVT_INVALID_CARD:         { key: 'invalidCard', color: 'red', Icon: AlertTriangle },
  EVT_REDUNDANT_SUGGESTION: { key: 'redundantSuggestion', color: 'red', Icon: AlertTriangle },
  EVT_INVALID_FORMAT:       { key: 'invalidFormat', color: 'red', Icon: AlertTriangle },
  EVT_FALSE_CANNOT_REFUTE:  { key: 'falseCannotRefute', color: 'red', Icon: AlertTriangle },
  EVT_WRONG_REFUTATION:     { key: 'wrongRefutation', color: 'red', Icon: AlertTriangle },
  EVT_COMM_ERROR:           { key: 'commError', color: 'red', Icon: AlertTriangle },
  EVT_WARNING:              { key: 'warning', color: 'amber', Icon: AlertTriangle },
  EVT_WARNING_ELIMINATION:  { key: 'warningElimination', color: 'red', Icon: AlertTriangle },
};

function eventMeta(type: string, t: ReturnType<typeof useTranslations>) {
  const meta = EVENT_META[type];
  if (!meta) return { label: type, color: 'amber' as const, Icon: AlertTriangle };
  return { label: t(`eventTypes.${meta.key}`), color: meta.color, Icon: meta.Icon };
}

const COLOR_CLASSES = {
  emerald: {
    chip: 'border-emerald-400/18 bg-emerald-400/10 text-emerald-200',
    total: 'text-emerald-200',
    line: 'bg-emerald-300/35',
  },
  red: {
    chip: 'border-red-400/18 bg-red-400/10 text-red-200',
    total: 'text-red-200',
    line: 'bg-red-300/35',
  },
  amber: {
    chip: 'border-amber-400/18 bg-amber-400/10 text-amber-200',
    total: 'text-amber-200',
    line: 'bg-amber-300/35',
  },
  cyan: {
    chip: 'border-cyan-400/18 bg-cyan-400/10 text-cyan-200',
    total: 'text-cyan-200',
    line: 'bg-cyan-300/35',
  },
} as const;

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <span className="h-6 w-6 rounded-full border-2 border-slate-600 border-t-cyan-400 animate-spin" />
    </div>
  );
}

function EmptyState() {
  const t = useTranslations('arena.detail.scoreHistory');
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] py-8 text-center text-sm text-slate-500">
      {t('empty')}
    </div>
  );
}

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
  const t = useTranslations('arena.detail.scoreHistory');
  const [mounted, setMounted] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [events, setEvents] = useState<ScoreEventPublic[]>([]);

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const res = await apiFetch<ScoreEventsResponse>(`/games/${gameId}/score-events`);
      const teamEvents = res.events
        .filter((e) => e.equipoId === equipoId)
        .sort((a, b) => a.displayTurn - b.displayTurn || a.id - b.id);
      setEvents(teamEvents);
      setLoadState('ok');
    } catch {
      setLoadState('error');
    }
  }, [gameId, equipoId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  let running = 0;

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="arena-panel arena-history-modal w-[min(1100px,96vw)] overflow-hidden p-0">
        <div className="border-b border-white/8 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                {t('title')}
              </p>
              <h2 className="mt-0.5 truncate text-base font-semibold text-white">{equipoNombre}</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-cyan-400/16 bg-cyan-400/10 px-3 py-1 text-sm font-bold text-cyan-200">
                ♦ {currentPoints} pts
              </div>
              <button
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-slate-400 transition-colors hover:text-white"
                aria-label={t('close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="scrollbar-history max-h-[82vh] overflow-y-auto p-4 sm:p-5">
          {loadState === 'loading' && <Spinner />}

          {loadState === 'error' && (
            <div className="rounded-2xl border border-red-400/16 bg-red-400/6 px-4 py-6 text-center">
              <p className="text-sm text-red-300">{t('loadError')}</p>
              <button
                onClick={load}
                className="mt-2 inline-flex items-center gap-1 rounded-full border border-cyan-400/16 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200"
              >
                <RefreshCw className="h-3 w-3" />
                {t('retry')}
              </button>
            </div>
          )}

          {loadState === 'ok' && events.length === 0 && <EmptyState />}

          {loadState === 'ok' && events.length > 0 && (
            <div className="relative pl-5">
              <span className="absolute bottom-2 left-[0.42rem] top-2 w-px bg-[linear-gradient(180deg,rgba(34,211,238,0.28),rgba(148,163,184,0.08))]" />
              <div className="space-y-2.5">
                {events.map((ev) => {
                  running += ev.points;
                  const meta = eventMeta(ev.type, t);
                  const color = COLOR_CLASSES[meta.color];
                  const sign = ev.points >= 0 ? '+' : '';

                  return (
                    <div key={ev.id} className="relative">
                      <span className={cn('absolute -left-5 top-5 h-3 w-3 rounded-full border-2 border-slate-950', color.line)} />
                      <div className="rounded-[1rem] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.82))] px-3 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] text-slate-300">
                            T{ev.displayTurn}
                          </span>
                          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]', color.chip)}>
                            <meta.Icon className="h-3 w-3" />
                            {meta.label}
                          </span>
                          <span className={cn('ml-auto text-sm font-bold', color.total)}>
                            {sign}{ev.points}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                          <span>{t('displayTurn', { count: ev.displayTurn })}</span>
                          <span className="font-mono">{t('runningTotal', { count: running })}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {loadState === 'ok' && events.length > 0 && (
          <div className="border-t border-white/8 px-4 py-3 text-xs text-slate-400">
            <div className="flex items-center justify-between">
              <span>{t('events', { count: events.length })}</span>
              <span className="font-mono font-semibold text-white">{t('total', { count: currentPoints })}</span>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
