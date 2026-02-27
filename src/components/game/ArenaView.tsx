'use client';

import { useAppSession } from '@/contexts/SessionContext';
import { GameProvider, useGame } from '@/contexts/GameContext';
import type { GameDetailResponse } from '@/types/api';
import { ArenaHeader } from './ArenaHeader';
import { ArenaTeamPanel } from './ArenaTeamPanel';
import { ArenaDeductionBoard } from './ArenaDeductionBoard';
import { ArenaActionFeed } from './ArenaActionFeed';
import { ArenaFinalResult } from './ArenaFinalResult';
import { SuggestionRevealOverlay } from './SuggestionRevealOverlay';

interface ArenaViewProps {
  gameId: string;
  initialData: GameDetailResponse | null;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PulseLine({ h = 'h-4', w = 'w-full' }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} rounded bg-slate-700 animate-pulse`} />;
}

function ArenaSkeleton() {
  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Header skeleton */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-2">
        <PulseLine h="h-6" w="w-48" />
        <PulseLine h="h-4" w="w-32" />
      </div>

      {/* Main grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Team panel */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-700 p-4 space-y-2">
              <PulseLine h="h-4" w="w-28" />
              <PulseLine h="h-3" w="w-16" />
            </div>
          ))}
        </div>
        {/* Deduction board */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-2">
          {[...Array(7)].map((_, i) => (
            <PulseLine key={i} h="h-4" />
          ))}
        </div>
      </div>

      {/* Feed skeleton */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-2">
        {[...Array(4)].map((_, i) => (
          <PulseLine key={i} h="h-16" />
        ))}
      </div>
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

function ArenaError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="rounded-xl border border-red-500/30 bg-slate-800 p-8 text-center space-y-3 max-w-sm w-full">
        <p className="text-red-400 font-semibold">✖ Error al cargar la partida</p>
        <p className="text-sm text-slate-400">{error.message}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

// ── Pending state ─────────────────────────────────────────────────────────────

function ArenaPending({ partida }: { partida: GameDetailResponse }) {
  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Panel pendiente */}
      <div className="rounded-xl border border-amber-500/20 bg-slate-800 p-6 text-center space-y-2">
        <p className="text-amber-400 font-semibold text-lg">⚠ PARTIDA PENDIENTE DE INICIO</p>
        <p className="text-slate-400 text-sm">
          Esperando al administrador para iniciar la partida.
          Actualización cada 10 s…
        </p>
      </div>
      {/* Teams registered */}
      <ArenaTeamPanel partida={partida} />
    </div>
  );
}

// ── Main ArenaView (wraps GameProvider) ──────────────────────────────────────

export function ArenaView({ gameId, initialData }: ArenaViewProps) {
  return (
    <GameProvider gameId={gameId} pollingInterval={5_000}>
      <ArenaContent initialData={initialData} gameId={gameId} />
    </GameProvider>
  );
}

// ── ArenaContent (uses useGame) ───────────────────────────────────────────────

function ArenaContent({ gameId: _gameId, initialData }: ArenaViewProps) {
  const { partida: polled, isPolling, error, refresh } = useGame();
  const { rol } = useAppSession();

  // Prefer live polled data; fall back to SSR initial data
  const data = polled ?? initialData;

  if (error && !data) return <ArenaError error={error} onRetry={refresh} />;
  if (!data) return <ArenaSkeleton />;

  const isAdmin = rol === 'admin';

  if (data.estado === 'pendiente') {
    return <ArenaPending partida={data} />;
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Header */}
      <ArenaHeader
        partida={data}
        isAdmin={isAdmin}
        isSyncing={isPolling}
        onRefresh={refresh}
      />

      {/* Result banner (shown when finished) */}
      {data.estado === 'finalizada' && <ArenaFinalResult partida={data} />}

      {/* Main grid: teams + deduction board */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <ArenaTeamPanel partida={data} />
        {/* Relative wrapper so the overlay can be absolutely positioned over the board */}
        <div className="relative">
          <ArenaDeductionBoard partida={data} />
          {data.estado === 'en_curso' && (
            <SuggestionRevealOverlay partida={data} />
          )}
        </div>
      </div>

      {/* Action feed */}
      <ArenaActionFeed partida={data} />
    </div>
  );
}
