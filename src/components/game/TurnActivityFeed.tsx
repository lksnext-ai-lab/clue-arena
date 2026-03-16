'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';
import { useGame } from '@/contexts/GameContext';
import type { TurnMicroEventUI, TurnActivityEntry } from '@/types/domain';

function useElapsedMs(fromTs: number | null, active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active || fromTs === null) {
      setElapsed(0);
      return;
    }
    setElapsed(Date.now() - fromTs);
    const id = setInterval(() => setElapsed(Date.now() - fromTs), 100);
    return () => clearInterval(id);
  }, [fromTs, active]);
  return elapsed;
}

function DurationBadge({ ms }: { ms: number }) {
  return (
    <span className="min-w-[52px] text-right font-mono text-[11px] text-slate-500">
      {ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`}
    </span>
  );
}

function WaitingRow({ fromTs }: { fromTs: number }) {
  const t = useTranslations('arena.detail.turnFeed');
  const elapsed = useElapsedMs(fromTs, true);
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="min-w-[52px] text-right font-mono text-[11px] text-slate-500">
        {elapsed >= 1000 ? `${(elapsed / 1000).toFixed(1)} s` : `${elapsed} ms`}
      </span>
      <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
      <span className="text-[11px] italic text-slate-400">{t('waiting')}</span>
    </li>
  );
}

function EventRow({ ev }: { ev: TurnMicroEventUI }) {
  const t = useTranslations('arena.detail.turnFeed');
  switch (ev.type) {
    case 'turn:agent_invoked':
      return (
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="text-cyan-400">→</span>
          {t('requestTurn')} <span className="font-semibold text-slate-200">{ev.equipoNombre}</span>
        </span>
      );

    case 'turn:agent_responded': {
      const isError = ev.accion === 'timeout' || ev.accion === 'formato_invalido';
      return (
        <span className={cn('flex flex-col gap-0.5 text-[11px]', isError ? 'text-red-300' : 'text-emerald-300')}>
          <span className="flex items-center gap-1.5">
            {isError ? '⏱' : '✓'}
            <span className="font-semibold text-slate-200">{ev.equipoNombre}</span>
            <span className="text-slate-400">{ev.accion}</span>
            {ev.durationMs !== undefined && (
              <span className="ml-auto font-mono text-[11px] text-slate-500">{ev.durationMs} ms</span>
            )}
          </span>
          {ev.sugerencia && (
            <span className="ml-4 text-[11px] text-slate-300">
              {ev.sugerencia.sospechoso} · {ev.sugerencia.arma} · {ev.sugerencia.habitacion}
            </span>
          )}
          {ev.spectatorComment && (
            <span className="ml-4 mt-0.5 block text-[11px] italic text-slate-400">
              💬 &ldquo;{ev.spectatorComment}&rdquo;
            </span>
          )}
        </span>
      );
    }

    case 'turn:refutation_requested':
      return (
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="text-amber-400">→</span>
          {t('requestRefutation')}
        </span>
      );

    case 'turn:refutation_received': {
      const refuted = ev.resultado === 'refutada';
      return (
        <span className={cn('flex flex-col gap-0.5 text-[11px]', refuted ? 'text-amber-300' : 'text-slate-500')}>
          <span className="flex items-center gap-1.5">
            {refuted ? '✓' : '·'}
            <span className="font-semibold text-slate-200">{ev.equipoNombre}</span>
            {refuted ? t('refuted') : t('cannotRefute')}
            {ev.durationMs !== undefined && (
              <span className="ml-auto font-mono text-[11px] text-slate-500">{ev.durationMs} ms</span>
            )}
          </span>
          {refuted && ev.cartaMostrada && (
            <span className="ml-4 text-[11px] text-slate-300">
              {t('card')}: <span className="font-semibold text-amber-200">{ev.cartaMostrada}</span>
            </span>
          )}
          {ev.spectatorComment && (
            <span className="ml-4 mt-0.5 block text-[11px] italic text-slate-400">
              💬 &ldquo;{ev.spectatorComment}&rdquo;
            </span>
          )}
        </span>
      );
    }

    default:
      return null;
  }
}

function TurnFeedBlock({ entry, showWaiting }: { entry: TurnActivityEntry; showWaiting: boolean }) {
  const t = useTranslations('arena.detail.turnFeed');
  const lastTs = entry.events.at(-1)?.ts ?? null;

  return (
    <div
      className={cn(
        'rounded-2xl border px-3 py-2.5 transition-colors',
        entry.isCompleted
          ? 'border-white/8 bg-slate-950/40'
          : 'border-cyan-400/25 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_55%),rgba(15,23,42,0.9)]'
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]">
        <span className={cn('h-2 w-2 rounded-full', entry.isCompleted ? 'bg-slate-500' : 'bg-cyan-400 animate-pulse')} />
        <span className={entry.isCompleted ? 'text-slate-400' : 'text-cyan-300'}>
          {t('turn', { count: entry.turnoNumero })}
        </span>
        {entry.isCompleted && (
          <span className="normal-case tracking-normal text-slate-500">{t('completed')}</span>
        )}
      </div>

      <ol className="space-y-1">
        {entry.events.map((ev, i) => (
          <li key={i} className="flex items-start gap-3">
            <DurationBadge ms={ev.durationMs ?? 0} />
            <EventRow ev={ev} />
          </li>
        ))}
        {showWaiting && lastTs !== null && <WaitingRow fromTs={lastTs} />}
      </ol>
    </div>
  );
}

export function TurnActivityFeed() {
  const t = useTranslations('arena.detail.turnFeed');
  const { currentTurnActivity } = useGame();
  const { active, history } = currentTurnActivity;

  return (
    <aside aria-label={t('ariaLabel')} className="arena-panel flex min-h-0 flex-col gap-2.5 overflow-hidden p-3">
      <div className="shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          {t('eyebrow')}
        </p>
        <h2 className="mt-0.5 text-base font-semibold text-white">{t('title')}</h2>
      </div>

      {!active && history.length === 0 && (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/35 py-6 text-center">
          <p className="text-[11px] leading-relaxed text-slate-500">
            {t('empty')}
          </p>
        </div>
      )}

      {(active || history.length > 0) && (
        <div className="flex flex-col gap-1.5 overflow-y-auto pr-1 scrollbar-panel">
          {active && <TurnFeedBlock entry={active} showWaiting={!active.isCompleted} />}
          {history.map((entry) => (
            <TurnFeedBlock key={entry.turnoId} entry={entry} showWaiting={false} />
          ))}
        </div>
      )}
    </aside>
  );
}
