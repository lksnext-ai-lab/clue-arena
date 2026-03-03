'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TeamRegistrationSchema, type TeamRegistrationInput } from '@/lib/schemas/team';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import type { TeamResponse } from '@/types/api';

/**
 * UI-002 — Registro de equipo
 */
export default function TeamRegistrationPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const t = useTranslations('equipo');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TeamRegistrationInput>({
    resolver: zodResolver(TeamRegistrationSchema),
  });

  const onSubmit = async (data: TeamRegistrationInput) => {
    setServerError(null);
    try {
      await apiFetch<{ equipo: TeamResponse }>('/teams', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      router.refresh(); // Sincroniza SessionContext con el nuevo equipo
      router.push('/equipo');
    } catch (err: unknown) {
      // Manejar error de nombre duplicado (400 NOMBRE_DUPLICADO)
      const errMessage = err instanceof Error ? err.message : '';
      let message = errMessage || t('registroError');
      try {
        const body = JSON.parse(errMessage || '{}');
        if (body?.code === 'NOMBRE_DUPLICADO') {
          message = 'Ya existe un equipo con ese nombre.';
        } else if (body?.code === 'YA_TIENE_EQUIPO') {
          message = 'Ya tienes un equipo registrado.';
        }
      } catch {
        // no-op, usar el mensaje por defecto
      }
      setServerError(message);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div
        className="rounded-xl p-8 space-y-6"
        style={{ background: '#1a1a2e' }}
      >
        <h1 className="text-2xl font-bold" style={{ color: '#f59e0b' }}>
          {t('registroTitulo')}
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#f1f5f9' }}>
              {t('nombre')}
            </label>
            <input
              {...register('nombre')}
              className="w-full px-3 py-2 rounded-md text-sm"
              style={{ background: '#0a0a0f', color: '#f1f5f9', border: '1px solid #64748b' }}
              placeholder={t('nombrePlaceholder')}  
            />
            {errors.nombre && (
              <p className="text-xs mt-1" style={{ color: '#ef4444' }}>
                {errors.nombre.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#f1f5f9' }}>
              {t('agentId')}
            </label>
            <input
              {...register('agentId')}
              className="w-full px-3 py-2 rounded-md text-sm"
              style={{ background: '#0a0a0f', color: '#f1f5f9', border: '1px solid #64748b' }}
              placeholder={t('agentIdPlaceholder')}
            />
            {errors.agentId && (
              <p className="text-xs mt-1" style={{ color: '#ef4444' }}>
                {errors.agentId.message}
              </p>
            )}
            <p className="text-xs mt-1" style={{ color: '#64748b' }}>
              Obtén tu agent_id desde la ficha de tu agente en MattinAI.{' '}
              <span className="font-mono" style={{ color: '#94a3b8' }}>Ejemplo: &quot;agt_01HX...&quot;</span>
            </p>
          </div>

          {serverError && (
            <div
              className="px-4 py-3 rounded-md text-sm"
              style={{ background: '#7f1d1d', color: '#fca5a5' }}
            >
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 rounded-md font-semibold text-sm disabled:opacity-50"
            style={{ background: '#f59e0b', color: '#0a0a0f' }}
          >
            {isSubmitting ? t('registrando') : t('registrar')}
          </button>
        </form>
      </div>
    </div>
  );
}
