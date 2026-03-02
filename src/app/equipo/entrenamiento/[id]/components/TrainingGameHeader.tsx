'use client';

import { Badge } from '@/components/ui/badge';
import type { TrainingGameResponse } from '@/types/api';

interface TrainingGameHeaderProps {
  game: TrainingGameResponse;
  onAbort?: () => void;
  aborting?: boolean;
}

const estadoBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  en_curso:   { label: 'En curso',   variant: 'default' },
  finalizada: { label: 'Finalizada', variant: 'secondary' },
  abortada:   { label: 'Abortada',   variant: 'destructive' },
};

export function TrainingGameHeader({ game, onAbort, aborting }: TrainingGameHeaderProps) {
  const badge = estadoBadge[game.estado] ?? { label: game.estado, variant: 'outline' };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-white">
            Entrenamiento · <span className="font-mono text-slate-300 text-sm">{game.id.slice(0, 8)}…</span>
          </h1>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <p className="text-sm text-slate-400">
          Bots: {game.numBots}
          {game.seed && (
            <> · Semilla: <span className="font-mono">{game.seed.slice(0, 10)}</span></>
          )}
          {game.estado === 'en_curso' && <span className="ml-2 animate-pulse text-yellow-400">● Ejecutando…</span>}
        </p>
      </div>

      {game.estado === 'en_curso' && onAbort && (
        <button
          onClick={onAbort}
          disabled={aborting}
          className="rounded border border-red-600 px-3 py-1 text-sm text-red-400 hover:bg-red-900/30 disabled:opacity-50 transition-colors"
        >
          {aborting ? 'Abortando…' : 'Abortar partida'}
        </button>
      )}
    </div>
  );
}
