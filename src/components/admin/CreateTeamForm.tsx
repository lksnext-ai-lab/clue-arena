'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import { TeamRegistrationSchema, type TeamRegistrationInput } from '@/lib/schemas/team';
import type { TeamResponse } from '@/types/api';

interface CreateTeamFormProps {
  onCreated: (team: TeamResponse) => void;
  onCancel: () => void;
}

export function CreateTeamForm({ onCreated, onCancel }: CreateTeamFormProps) {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TeamRegistrationInput>({
    resolver: zodResolver(TeamRegistrationSchema),
  });

  const onSubmit = async (data: TeamRegistrationInput) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const res = await apiFetch<{ equipo: TeamResponse }>('/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      reset();
      onCreated(res.equipo);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'NOMBRE_DUPLICADO') {
        setServerError('Ya existe un equipo con ese nombre.');
      } else {
        setServerError(t('errorCrearEquipo'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-slate-900/70 text-slate-200 border border-slate-700';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-xl p-4 mb-4 space-y-4 bg-slate-800 border border-slate-700"
    >
      <h3 className="text-sm font-semibold text-cyan-400">
        {t('crearEquipo')}
      </h3>

      {serverError && (
        <p className="text-sm px-3 py-2 rounded-md bg-red-900/40 text-red-300 border border-red-500/30">
          {serverError}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs mb-1 text-slate-400">
            {t('nombreEquipo')} *
          </label>
          <input
            {...register('nombre')}
            type="text"
            className={inputClass}
            placeholder="Ej: Equipo Alpha"
          />
          {errors.nombre && (
            <p className="text-xs mt-1 text-red-400">{errors.nombre.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs mb-1 text-slate-400">
            {t('agentId')} *
          </label>
          <input
            {...register('agentId')}
            type="text"
            className={inputClass}
            placeholder="Ej: agent-alpha-v2"
          />
          {errors.agentId && (
            <p className="text-xs mt-1 text-red-400">{errors.agentId.message}</p>
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors bg-slate-700 text-slate-300 hover:bg-slate-600"
        >
          {t('cancelarCrear')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors bg-cyan-500 text-slate-900 hover:bg-cyan-400 disabled:opacity-60"
        >
          {isSubmitting ? '…' : t('guardarEquipo')}
        </button>
      </div>
    </form>
  );
}
