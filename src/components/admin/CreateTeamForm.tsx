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
    'w-full rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500';
  const inputStyle = { background: '#0f172a', color: '#f1f5f9', border: '1px solid #334155' };
  const errorStyle = { color: '#f87171' };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-xl p-4 mb-4 space-y-4"
      style={{ background: '#1a1a2e', border: '1px solid #334155' }}
    >
      <h3 className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
        {t('crearEquipo')}
      </h3>

      {serverError && (
        <p className="text-sm px-3 py-2 rounded-md" style={{ background: '#7f1d1d', color: '#fca5a5' }}>
          {serverError}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs mb-1" style={{ color: '#94a3b8' }}>
            {t('nombreEquipo')} *
          </label>
          <input
            {...register('nombre')}
            type="text"
            className={inputClass}
            style={inputStyle}
            placeholder="Ej: Equipo Alpha"
          />
          {errors.nombre && (
            <p className="text-xs mt-1" style={errorStyle}>{errors.nombre.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: '#94a3b8' }}>
            {t('agentId')} *
          </label>
          <input
            {...register('agentId')}
            type="text"
            className={inputClass}
            style={inputStyle}
            placeholder="Ej: agent-alpha-v2"
          />
          {errors.agentId && (
            <p className="text-xs mt-1" style={errorStyle}>{errors.agentId.message}</p>
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
          style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}
        >
          {t('cancelarCrear')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
          style={{ background: '#f59e0b', color: '#0a0a0f', opacity: isSubmitting ? 0.6 : 1 }}
        >
          {isSubmitting ? '…' : t('guardarEquipo')}
        </button>
      </div>
    </form>
  );
}
