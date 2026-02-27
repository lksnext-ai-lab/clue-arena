'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { apiFetch } from '@/lib/api/client';
import type { GameDetailResponse } from '@/types/api';

interface ArenaHeaderProps {
  partida: GameDetailResponse;
  isAdmin: boolean;
  isSyncing: boolean;
  onRefresh: () => void;
}

function statusBadge(estado: string) {
  switch (estado) {
    case 'en_curso':
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-400/10 text-emerald-400">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          EN CURSO
        </span>
      );
    case 'finalizada':
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-600/30 text-slate-400">
          FINALIZADA
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-400/10 text-amber-400">
          PENDIENTE
        </span>
      );
  }
}

function activeTeamName(partida: GameDetailResponse): string | null {
  if (partida.estado !== 'en_curso') return null;
  // Sort by orden to match coordinator's team-selection logic
  const active = [...partida.equipos]
    .filter((e) => !e.eliminado)
    .sort((a, b) => a.orden - b.orden);
  if (active.length === 0) return null;
  const idx = partida.turnoActual % active.length;
  return active[idx]?.equipoNombre ?? null;
}

export function ArenaHeader({ partida, isAdmin, isSyncing, onRefresh }: ArenaHeaderProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function callAction(action: string) {
    setBusy(action);
    setActionError(null);
    try {
      await apiFetch(`/games/${partida.id}/${action}`, { method: 'POST' });
      onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setActionError(msg);
      // Auto-dismiss after 6 s
      setTimeout(() => setActionError(null), 6_000);
    } finally {
      setBusy(null);
    }
  }

  const [showConfirm, setShowConfirm] = useState(false);

  async function handleStop() {
    if (!showConfirm) { setShowConfirm(true); return; }
    setShowConfirm(false);
    await callAction('stop');
  }

  const teamName = activeTeamName(partida);
  const isRunning = partida.estado === 'en_curso';
  const isAuto = partida.modoEjecucion === 'auto';
  const isPaused = partida.modoEjecucion === 'pausado';
  const configuredMax = partida.maxTurnos ?? null;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Title + status */}
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-bold text-white truncate">{partida.nombre}</h1>
          {statusBadge(partida.estado)}
          {isSyncing && (
            <span className="text-slate-500 text-xs" title="Actualizando...">
              <svg className="inline w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </span>
          )}
        </div>

        {/* Turn info */}
        {isRunning && (
          <div className="text-sm text-slate-400 shrink-0">
            <span className="text-white font-medium">Turno {partida.turnos.length}</span>
            {configuredMax !== null && <span> / {configuredMax}</span>}
            {teamName && (
              <span>
                {' · '}
                <span className="text-cyan-400 font-medium">{teamName}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Admin controls */}
      {isAdmin && partida.estado !== 'finalizada' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!isAuto && (
            <button
              onClick={() => callAction('run')}
              disabled={busy === 'run'}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50'
              )}
            >
              ▶ AUTO
            </button>
          )}
          {isAuto && (
            <button
              onClick={() => callAction('pause')}
              disabled={busy === 'pause'}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50'
              )}
            >
              ⏸ PAUSAR
            </button>
          )}
          {isPaused && (
            <button
              onClick={() => callAction('resume')}
              disabled={busy === 'resume'}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50'
              )}
            >
              ▶ REANUDAR
            </button>
          )}
          {(isPaused || partida.modoEjecucion === 'manual') && isRunning && (
            <button
              onClick={() => callAction('advance-turn')}
              disabled={busy === 'advance-turn'}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                'bg-slate-600/40 text-slate-300 hover:bg-slate-600/60 disabled:opacity-50'
              )}
            >
              ⏭ AVANZAR
            </button>
          )}
          <button
            onClick={handleStop}
            disabled={busy === 'stop'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              showConfirm
                ? 'bg-red-500/40 text-red-300 hover:bg-red-500/50 ring-1 ring-red-500'
                : 'bg-red-500/10 text-red-400 hover:bg-red-500/20',
              'disabled:opacity-50'
            )}
          >
            {showConfirm ? '⚠ Confirmar cierre' : '⏹ FINALIZAR'}
          </button>
          {showConfirm && (
            <button
              onClick={() => setShowConfirm(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
            >
              Cancelar
            </button>
          )}
        </div>
      )}

      {/* Action error banner */}
      {actionError && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
          <span>✖</span>
          <span className="flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400/60 hover:text-red-300">✕</button>
        </div>
      )}
    </div>
  );
}
