'use client';

import { useState } from 'react';

interface TrainingGameStateDebugProps {
  gameStateView: unknown;
  turno: number;
}

export function TrainingGameStateDebug({ gameStateView, turno }: TrainingGameStateDebugProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        <span>{open ? '▼' : '▶'}</span>
        <span>GameStateView recibida (turno {turno})</span>
      </button>

      {open && (
        <pre className="mt-1 overflow-auto rounded bg-slate-900 p-3 text-xs text-green-300 border border-slate-600 max-h-80">
          {JSON.stringify(gameStateView, null, 2)}
        </pre>
      )}
    </div>
  );
}
