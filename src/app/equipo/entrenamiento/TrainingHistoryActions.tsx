'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';

interface Props {
  cleanableCount: number;
}

type CleanupScope = 'all';

export function TrainingHistoryActions({ cleanableCount }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCleanup = async (scope: CleanupScope) => {
    const label =
      'Se eliminarán todas las partidas finalizadas o abortadas. La partida en curso, si existe, se conserva. ¿Continuar?';

    if (!window.confirm(label)) return;

    setError(null);
    setMessage(null);

    try {
      const result = await apiFetch<{ deleted: number; scope: CleanupScope }>(
        '/training/games/cleanup',
        {
          method: 'POST',
          body: JSON.stringify({ scope }),
        },
      );

      const noun =
        result.deleted === 1 ? 'partida eliminada' : 'partidas eliminadas';
      setMessage(
        result.deleted === 0
          ? 'No había partidas para limpiar.'
          : `${result.deleted} ${noun}.`,
      );
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la limpieza.');
    }
  };

  return (
    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.92),rgba(2,6,23,0.98))] p-4 shadow-[0_16px_40px_rgba(2,6,23,0.2)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Mantenimiento
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Elimina sesiones de poco valor para mantener el historial más limpio y fácil de revisar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void runCleanup('all')}
            disabled={isPending || cleanableCount === 0}
            className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Limpieza completa ({cleanableCount})
          </button>
        </div>
      </div>

      {message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
