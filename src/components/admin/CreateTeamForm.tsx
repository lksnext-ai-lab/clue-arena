'use client';

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { Bot, KeyRound, Orbit, ShieldPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import { TeamRegistrationSchema, type TeamRegistrationInput } from '@/lib/schemas/team';
import type { TeamResponse } from '@/types/api';
import { resolveTeamId } from '@/lib/utils/team-id';

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
    watch,
    setValue,
    formState: { errors },
  } = useForm<TeamRegistrationInput>({
    resolver: zodResolver(TeamRegistrationSchema),
    defaultValues: { agentBackend: 'mattin', id: '' },
  });
  const agentBackend = watch('agentBackend');
  const nombre = watch('nombre');
  const teamId = watch('id');
  const suggestedTeamId = resolveTeamId(undefined, nombre ?? '');

  useEffect(() => {
    if (agentBackend === 'local') {
      setValue('appId', '');
      setValue('mattinApiKey', undefined);
    }
  }, [agentBackend, setValue]);

  const onSubmit = async (data: TeamRegistrationInput) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const res = await apiFetch<{ equipo: TeamResponse }>('/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          id: data.id?.trim() || undefined,
        }),
      });
      reset();
      onCreated(res.equipo);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      try {
        const body = JSON.parse(message || '{}');
        if (body?.code === 'NOMBRE_DUPLICADO') {
          setServerError(t('registroNombreDuplicado'));
          return;
        }
        if (body?.code === 'ID_DUPLICADO') {
          setServerError(t('registroIdDuplicado'));
          return;
        }
      } catch {
        // use generic fallback below
      }
      setServerError(t('errorCrearEquipo'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-2xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-cyan-400/30';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-[28px] border p-5 sm:p-6"
      style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(9, 17, 31, 0.84)' }}
    >
      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <section
          className="rounded-[24px] border p-5"
          style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'linear-gradient(160deg, rgba(245,158,11,0.08), rgba(34,197,94,0.05) 62%, rgba(8,17,29,0.6))' }}
        >
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]"
            style={{ background: 'rgba(245,158,11,0.14)', color: '#fbbf24' }}
          >
            <ShieldPlus size={14} />
            {t('crearEquipoEyebrow')}
          </div>

          <h3 className="mt-4 text-2xl font-semibold" style={{ color: '#f8fafc' }}>
            {t('crearEquipoTitle')}
          </h3>
          <p className="mt-2 text-sm leading-6" style={{ color: '#94a3b8' }}>
            {t('crearEquipoDesc')}
          </p>

          <div
            className="mt-5 rounded-[22px] border p-4"
            style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(8, 17, 29, 0.72)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: '#94a3b8' }}>
              {t('teamIdPreviewLabel')}
            </p>
            <div className="mt-3 flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: 'rgba(15, 23, 42, 0.78)' }}>
              <Orbit size={17} style={{ color: '#34d399' }} />
              <code className="text-sm" style={{ color: '#f8fafc' }}>
                {teamId?.trim() || suggestedTeamId}
              </code>
            </div>
            <p className="mt-3 text-sm leading-6" style={{ color: '#94a3b8' }}>
              {t('teamIdAdminHint')}
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            <InfoLine icon={<Orbit size={16} />} title={t('cardIdentityTitle')} text={t('cardIdentityDesc')} />
            <InfoLine icon={<Bot size={16} />} title={t('cardAgentTitle')} text={t('cardAgentDesc')} />
            <InfoLine icon={<KeyRound size={16} />} title={t('cardCheckTitle')} text={t('adminCardCheckDesc')} />
          </div>
        </section>

        <section className="space-y-4">
          {serverError && (
            <p
              className="rounded-2xl border px-4 py-3 text-sm"
              style={{ borderColor: 'rgba(248,113,113,0.28)', background: 'rgba(127,29,29,0.28)', color: '#fecaca' }}
            >
              {serverError}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={`${t('nombreEquipo')} *`}>
              <input
                {...register('nombre')}
                type="text"
                className={inputClass}
                style={{ background: 'rgba(15, 23, 42, 0.78)', color: '#f8fafc', border: '1px solid rgba(148, 163, 184, 0.22)' }}
                placeholder="Ej: Equipo Alpha"
              />
              {errors.nombre && (
                <p className="mt-2 text-xs" style={{ color: '#fca5a5' }}>{errors.nombre.message}</p>
              )}
            </Field>

            <Field label={t('teamIdLabel')}>
              <input
                {...register('id')}
                type="text"
                className={inputClass}
                style={{ background: 'rgba(15, 23, 42, 0.78)', color: '#f8fafc', border: '1px solid rgba(148, 163, 184, 0.22)' }}
                placeholder={suggestedTeamId}
              />
              {errors.id && (
                <p className="mt-2 text-xs" style={{ color: '#fca5a5' }}>{errors.id.message}</p>
              )}
            </Field>

            <Field label={`${t('agentId')} *`}>
              <input
                {...register('agentId')}
                type="text"
                className={inputClass}
                style={{ background: 'rgba(15, 23, 42, 0.78)', color: '#f8fafc', border: '1px solid rgba(148, 163, 184, 0.22)' }}
                placeholder="Ej: agent-alpha-v2"
              />
              {errors.agentId && (
                <p className="mt-2 text-xs" style={{ color: '#fca5a5' }}>{errors.agentId.message}</p>
              )}
            </Field>

            <Field label={t('agentBackendLabel')}>
              <select
                {...register('agentBackend')}
                className={inputClass}
                style={{ background: 'rgba(15, 23, 42, 0.78)', color: '#f8fafc', border: '1px solid rgba(148, 163, 184, 0.22)' }}
                defaultValue="mattin"
              >
                <option value="mattin">{t('agentBackendMattin')}</option>
                <option value="local">{t('agentBackendLocal')}</option>
              </select>
            </Field>

            {agentBackend === 'mattin' && (
              <>
                <Field label={t('appIdLabel')}>
                  <input
                    {...register('appId')}
                    type="text"
                    className={inputClass}
                    style={{ background: 'rgba(15, 23, 42, 0.78)', color: '#f8fafc', border: '1px solid rgba(148, 163, 184, 0.22)' }}
                    placeholder={t('appIdPlaceholder')}
                  />
                  {errors.appId && (
                    <p className="mt-2 text-xs" style={{ color: '#fca5a5' }}>{errors.appId.message}</p>
                  )}
                </Field>

                <Field label={t('mattinApiKeyLabel')}>
                  <input
                    {...register('mattinApiKey')}
                    type="password"
                    autoComplete="new-password"
                    className={inputClass}
                    style={{ background: 'rgba(15, 23, 42, 0.78)', color: '#f8fafc', border: '1px solid rgba(148, 163, 184, 0.22)' }}
                    placeholder={t('mattinApiKeyPlaceholder')}
                  />
                  {errors.mattinApiKey && (
                    <p className="mt-2 text-xs" style={{ color: '#fca5a5' }}>{errors.mattinApiKey.message}</p>
                  )}
                </Field>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition"
              style={{ background: 'rgba(51,65,85,0.9)', color: '#cbd5e1' }}
            >
              {t('cancelarCrear')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
              style={{ background: '#f59e0b', color: '#111827', boxShadow: '0 14px 30px rgba(245,158,11,0.18)' }}
            >
              {isSubmitting ? '…' : t('guardarEquipo')}
            </button>
          </div>
        </section>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#94a3b8' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function InfoLine({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{ borderColor: 'rgba(148, 163, 184, 0.12)', background: 'rgba(8, 17, 29, 0.58)' }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#f8fafc' }}>{title}</p>
          <p className="text-sm" style={{ color: '#94a3b8' }}>{text}</p>
        </div>
      </div>
    </div>
  );
}
