'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';

interface Props {
  gameId: string;
}

export function TrainingGameDeleteButton({ gameId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);

    try {
      await apiFetch(`/training/games/${gameId}`, { method: 'DELETE' });
      setOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la partida.');
    }
  };

  const handleClose = () => {
    if (isPending) return;
    setOpen(false);
    setError(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isPending}
        aria-label="Eliminar partida"
        title="Eliminar partida"
        className="inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 size={14} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(2,6,23,0.99))] shadow-[0_30px_80px_rgba(2,6,23,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.18),transparent_55%)] p-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-200">
                <AlertTriangle size={14} />
                Acción destructiva
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white">
                Eliminar partida de entrenamiento
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Se borrará esta sesión y todo su historial asociado. Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="space-y-4 p-6">
              <div className="rounded-2xl border border-rose-400/15 bg-rose-400/8 p-4 text-sm text-rose-100">
                Usa esta opción solo cuando ya no necesites revisar la repetición o el detalle de turnos.
              </div>

              {error && (
                <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isPending}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {isPending ? 'Eliminando…' : 'Eliminar partida'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
