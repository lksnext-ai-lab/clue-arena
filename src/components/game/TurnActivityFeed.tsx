'use client';

/**
 * TurnActivityFeed (F016)
 * Displays coordinator micro-events in real-time during each turn:
 *   turn:agent_invoked → turn:agent_responded → turn:refutation_requested → turn:refutation_received
 *
 * The component consumes `currentTurnActivity` from GameContext which is populated
 * by the WebSocket micro-event stream (turn:* messages).
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { useGame } from '@/contexts/GameContext';
import type { TurnMicroEventUI, TurnActivityEntry } from '@/types/domain';

// ── Elapsed counter hook ──────────────────────────────────────────────────────
function useElapsedMs(fromTs: number | null, active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active || fromTs === null) { setElapsed(0); return; }
    setElapsed(Date.now() - fromTs);
    const id = setInterval(() => setElapsed(Date.now() - fromTs), 100);
    return () => clearInterval(id);
  }, [fromTs, active]);
  return elapsed;
}

// ── Duration label ─────────────────────────────────────────────────────────────
function DurationBadge({ ms }: { ms: number }) {
  return (
    <span className="min-w-[56px] text-right font-mono text-xs text-slate-500">
      {ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`}
    </span>
  );
}

// ── Animated waiting row ───────────────────────────────────────────────────────
function WaitingRow({ fromTs }: { fromTs: number }) {
  const elapsed = useElapsedMs(fromTs, true);
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="min-w-[56px] text-right font-mono text-xs text-slate-500">
        {elapsed >= 1000 ? `${(elapsed / 1000).toFixed(1)} s` : `${elapsed} ms`}
      </span>
      <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
      <span className="text-slate-400 italic text-xs">esperando respuesta…</span>
    </li>
  );
}

// ── Single micro-event row ────────────────────────────────────────────────────
function EventRow({ ev }: { ev: TurnMicroEventUI }) {
  switch (ev.type) {
    case 'turn:agent_invoked':
      return (
        <span className="flex items-center gap-2 text-slate-400 text-xs">
          <span className="text-cyan-400">→</span>
          Solicitando turno a{' '}
          <span className="font-semibold text-slate-200">{ev.equipoNombre}</span>…
        </span>
      );

    case 'turn:agent_responded': {
      const isError = ev.accion === 'timeout' || ev.accion === 'formato_invalido';
      return (
        <span className={cn('flex flex-col gap-0.5 text-xs', isError ? 'text-red-400' : 'text-emerald-400')}>
          <span className="flex items-center gap-2">
            {isError ? '⏱' : '✓'}
            <span className="font-semibold text-slate-200">{ev.equipoNombre}</span>
            {ev.accion === 'sugerencia' && <span className="text-amber-400">sugiere</span>}
            {ev.accion === 'acusacion' && <span className="text-red-300">acusa</span>}
            {ev.accion === 'pasar'     && <span className="text-slate-500">pasa</span>}
            {ev.accion === 'timeout'          && <span>timeout</span>}
            {ev.accion === 'formato_invalido' && <span>formato inválido</span>}
            {ev.durationMs !== undefined && (
              <span className="ml-auto text-slate-500 font-mono text-xs">{ev.durationMs} ms</span>
            )}
          </span>
          {ev.sugerencia && (
            <span className="ml-5 text-slate-300 text-xs">
              {ev.sugerencia.sospechoso} · {ev.sugerencia.arma} · {ev.sugerencia.habitacion}
            </span>
          )}
          {/* G004: spectator comment */}
          {ev.spectatorComment && (
            <span className="mt-0.5 ml-5 block text-xs text-slate-400 italic">
              💬 &quot;{ev.spectatorComment}&quot;
            </span>
          )}
        </span>
      );
    }

    case 'turn:refutation_requested':
      return (
        <span className="flex items-center gap-2 text-slate-400 text-xs">
          <span className="text-amber-400">→</span>
          Solicitando refutación…
        </span>
      );

    case 'turn:refutation_received': {
      const refuted = ev.resultado === 'refutada';
      return (
        <span className={cn('flex flex-col gap-0.5 text-xs', refuted ? 'text-amber-400' : 'text-slate-500')}>
          <span className="flex items-center gap-2">
            {refuted ? '✓' : '·'}
            <span className="font-semibold text-slate-200">{ev.equipoNombre}</span>
            {refuted ? 'refutó' : 'no puede refutar'}
            {ev.durationMs !== undefined && (
              <span className="ml-auto text-slate-500 font-mono text-xs">{ev.durationMs} ms</span>
            )}
          </span>
          {refuted && ev.cartaMostrada && (
            <span className="ml-5 text-slate-300 text-xs">
              carta: <span className="font-semibold text-amber-300">{ev.cartaMostrada}</span>
            </span>
          )}
          {/* G004: spectator comment */}
          {ev.spectatorComment && (
            <span className="mt-0.5 ml-5 block text-xs text-slate-400 italic">
              💬 &quot;{ev.spectatorComment}&quot;
            </span>
          )}
        </span>
      );
    }

    default:
      return null;
  }
}

// ── Single turn feed block ────────────────────────────────────────────────────
function TurnFeedBlock({ entry, showWaiting }: { entry: TurnActivityEntry; showWaiting: boolean }) {
  // The last event's ts is used as the "from" reference for the elapsed counter
  const lastTs = entry.events.at(-1)?.ts ?? null;

  return (
    <div
      className={cn(
        'rounded-md border px-4 py-3 transition-colors',
        entry.isCompleted
          ? 'border-slate-700/60 bg-slate-800/30'
          : 'border-cyan-500/30 bg-slate-800/70',
      )}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            entry.isCompleted ? 'bg-slate-500' : 'bg-cyan-400 animate-pulse',
          )}
        />
        <span className={entry.isCompleted ? 'text-slate-500' : 'text-cyan-400'}>
          Turno {entry.turnoNumero}
        </span>
        {entry.isCompleted && (
          <span className="text-slate-600 font-normal normal-case tracking-normal">completado</span>
        )}
      </div>

      {/* Event rows */}
      <ol className="space-y-1.5">
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

// ── Public component ──────────────────────────────────────────────────────────
export function TurnActivityFeed() {
  const { currentTurnActivity } = useGame();
  const { active, history } = currentTurnActivity;

  return (
    <aside
      aria-label="Actividad del coordinador"
      className="rounded-xl border border-slate-700 bg-slate-800 p-4 flex flex-col gap-3 min-h-0"
    >
      {/* Panel header */}
      <h2 className="shrink-0 text-sm font-semibold text-slate-400 uppercase tracking-wider">
        Coordinador
      </h2>

      {/* Empty state */}
      {!active && history.length === 0 && (
        <div className="flex flex-1 items-center justify-center py-8 text-center">
          <p className="text-xs text-slate-600 leading-relaxed">
            La actividad del coordinador<br />aparecerá aquí al inicio del turno.
          </p>
        </div>
      )}

      {/* Scrollable event list */}
      {(active || history.length > 0) && (
        <div className="flex flex-col gap-2 overflow-y-auto">
          {/* Active turn block */}
          {active && (
            <TurnFeedBlock
              entry={active}
              showWaiting={!active.isCompleted}
            />
          )}

          {/* Last N completed turns */}
          {history.map((entry) => (
            <TurnFeedBlock key={entry.turnoId} entry={entry} showWaiting={false} />
          ))}
        </div>
      )}
    </aside>
  );
}
