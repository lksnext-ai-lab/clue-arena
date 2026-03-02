'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateTrainingGameSchema, type CreateTrainingGameInput } from '@/lib/schemas/training';
import { apiFetch } from '@/lib/api/client';

export default function NuevaEntrenamientoPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateTrainingGameInput>({
    resolver: zodResolver(CreateTrainingGameSchema),
    defaultValues: { numBots: 2 },
  });

  const numBots = watch('numBots') ?? 2;

  const onSubmit = async (data: CreateTrainingGameInput) => {
    setSubmitError(null);
    try {
      const result = await apiFetch<{ id: string }>('/training/games', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      router.push(`/equipo/entrenamiento/${result.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error al iniciar la partida');
    }
  };

  return (
    <div className="mx-auto max-w-lg p-4 space-y-6">
      <h1 className="text-xl font-bold text-white">Nueva partida de entrenamiento</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* NumBots selector */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Nº de bots oponentes
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setValue('numBots', n)}
                className={`w-10 h-10 rounded border text-sm font-semibold transition
                  ${numBots === n
                    ? 'border-indigo-500 bg-indigo-600 text-white'
                    : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-400'
                  }`}
              >
                {n}
              </button>
            ))}
          </div>
          {errors.numBots && (
            <p className="text-xs text-red-400 mt-1">{errors.numBots.message}</p>
          )}
        </div>

        {/* Seed (optional) */}
        <div>
          <label htmlFor="seed" className="block text-sm font-medium text-slate-300 mb-1">
            Semilla (opcional)
          </label>
          <input
            id="seed"
            type="text"
            placeholder="Deja vacío para partida aleatoria reproducible"
            {...register('seed')}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            Misma semilla → misma distribución de cartas y sobre secreto.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="rounded border border-yellow-700/50 bg-yellow-900/10 px-3 py-2 text-sm text-yellow-300">
          ⚠ Esta partida <strong>no cuenta</strong> en el ranking oficial.
        </div>

        {/* Error */}
        {submitError && (
          <div className="rounded border border-red-700 bg-red-900/20 px-3 py-2 text-sm text-red-400">
            {submitError}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/equipo/entrenamiento')}
            className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            {isSubmitting ? 'Iniciando…' : 'Iniciar entrenamiento →'}
          </button>
        </div>
      </form>
    </div>
  );
}
