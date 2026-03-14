'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bot, ImageUp, KeyRound, Orbit, Radio, Shield, ShieldCheck, Sparkles } from 'lucide-react';
import { TeamRegistrationSchema, type TeamRegistrationInput } from '@/lib/schemas/team';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import type { TeamResponse } from '@/types/api';
import { resolveTeamId } from '@/lib/utils/team-id';

interface MattinCheckResponse {
  reachable: boolean;
  response?: string;
  error?: string;
}

/**
 * UI-002 — Registro de equipo
 */
export default function TeamRegistrationPage() {
  const router = useRouter();
  const t = useTranslations('equipo');
  const [serverError, setServerError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [isTestingMattin, setIsTestingMattin] = useState(false);
  const [teamIdMode, setTeamIdMode] = useState<'auto' | 'manual'>('auto');
  const [avatarMode, setAvatarMode] = useState<'none' | 'generate' | 'upload'>('none');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<TeamRegistrationInput>({
    resolver: zodResolver(TeamRegistrationSchema),
    defaultValues: { id: '', agentBackend: 'mattin' },
  });

  const nombre = watch('nombre');
  const teamId = watch('id');
  const agentBackend = watch('agentBackend');
  const agentId = watch('agentId');
  const appId = watch('appId');
  const mattinApiKey = watch('mattinApiKey');
  const suggestedTeamId = resolveTeamId(undefined, nombre ?? '');

  useEffect(() => {
    if (agentBackend === 'local') {
      setValue('appId', '');
      setValue('mattinApiKey', undefined);
      setTestMessage(null);
    }
  }, [agentBackend, setValue]);

  useEffect(() => {
    if (teamIdMode === 'auto') {
      setValue('id', suggestedTeamId === 'team' && !nombre ? '' : suggestedTeamId, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [nombre, setValue, suggestedTeamId, teamIdMode]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  const onSubmit = async (data: TeamRegistrationInput) => {
    setServerError(null);
    try {
      const created = await apiFetch<{ equipo: TeamResponse }>('/teams', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          id: data.id?.trim() || undefined,
        }),
      });

      if (avatarMode === 'generate') {
        try {
          await apiFetch<{ avatarUrl: string }>(`/teams/${created.equipo.id}/avatar`, {
            method: 'POST',
            body: JSON.stringify({ action: 'generate' }),
          });
        } catch {
          // non-blocking: the team already exists and the avatar can be regenerated later
        }
      }

      if (avatarMode === 'upload' && avatarFile) {
        try {
          const formData = new FormData();
          formData.append('avatar', avatarFile);
          await apiFetch<{ avatarUrl: string }>(`/teams/${created.equipo.id}/avatar`, {
            method: 'POST',
            body: formData,
          });
        } catch {
          // non-blocking: the team already exists and the avatar can be uploaded later
        }
      }

      router.refresh();
      router.push('/equipo');
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : '';
      let message = errMessage || t('registroError');
      try {
        const body = JSON.parse(errMessage || '{}');
        if (body?.code === 'NOMBRE_DUPLICADO') {
          message = t('registroNombreDuplicado');
        } else if (body?.code === 'YA_TIENE_EQUIPO') {
          message = t('registroYaTieneEquipo');
        } else if (body?.code === 'ID_DUPLICADO') {
          message = t('registroIdDuplicado');
        }
      } catch {
        // no-op
      }
      setServerError(message);
    }
  };

  const handleMattinCheck = async () => {
    setTestMessage(null);
    const isValid = await trigger(['agentId', 'appId', 'mattinApiKey']);
    if (!isValid) return;

    setIsTestingMattin(true);
    try {
      const result = await apiFetch<MattinCheckResponse>('/teams/check-mattin', {
        method: 'POST',
        body: JSON.stringify({
          agentId,
          appId,
          mattinApiKey,
        }),
      });
      setTestMessage(result.reachable ? t('mattinCheckOk') : result.error || t('mattinCheckError'));
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : t('mattinCheckError');
      try {
        const body = JSON.parse(message);
        message = body?.error || t('mattinCheckError');
      } catch {
        // no-op
      }
      setTestMessage(message);
    } finally {
      setIsTestingMattin(false);
    }
  };

  const sharedInputStyle = {
    background: 'rgba(15, 23, 42, 0.78)',
    color: '#e2e8f0',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
  } as const;

  const selectAvatarUpload = (file: File) => {
    if (avatarPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    const objectUrl = URL.createObjectURL(file);
    setAvatarFile(file);
    setAvatarPreviewUrl(objectUrl);
    setAvatarMode('upload');
  };

  const selectAvatarGeneration = () => {
    if (avatarPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setAvatarMode('generate');
  };

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ background: 'radial-gradient(circle at top, #1f3b57 0%, #08111d 48%, #05080d 100%)' }}
    >
      <div className="mx-auto max-w-5xl">
        <div
          className="overflow-hidden rounded-[28px] border"
          style={{
            borderColor: 'rgba(148, 163, 184, 0.18)',
            background: 'linear-gradient(135deg, rgba(8,17,29,0.96), rgba(15,23,42,0.9))',
            boxShadow: '0 30px 80px rgba(2, 6, 23, 0.55)',
          }}
        >
          <div className="grid lg:grid-cols-[1.05fr_1.35fr]">
            <section
              className="relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10"
              style={{ background: 'linear-gradient(160deg, rgba(245,158,11,0.12), rgba(34,197,94,0.08) 60%, transparent)' }}
            >
              <div
                className="absolute inset-x-8 top-8 h-40 rounded-full blur-3xl"
                style={{ background: 'rgba(245,158,11,0.12)' }}
              />

              <div className="relative space-y-6">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]"
                  style={{ background: 'rgba(245,158,11,0.14)', color: '#fbbf24' }}
                >
                  <ShieldCheck size={14} />
                  {t('registroEyebrow')}
                </div>

                <div className="space-y-3">
                  <h1 className="text-3xl font-semibold leading-tight sm:text-4xl" style={{ color: '#f8fafc' }}>
                    {t('registroTitulo')}
                  </h1>
                  <p className="max-w-md text-sm leading-6 sm:text-base" style={{ color: '#cbd5e1' }}>
                    {t('registroIntro')}
                  </p>
                </div>

                <div
                  className="rounded-3xl border p-5"
                  style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(15, 23, 42, 0.58)' }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: '#94a3b8' }}>
                    {t('teamIdPreviewLabel')}
                  </p>
                  <div className="mt-3 flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: 'rgba(8, 17, 29, 0.9)' }}>
                    <Orbit size={18} style={{ color: '#34d399' }} />
                    <code className="text-sm sm:text-base" style={{ color: '#f8fafc' }}>
                      {teamId || suggestedTeamId}
                    </code>
                  </div>
                  <p className="mt-3 text-sm leading-6" style={{ color: '#94a3b8' }}>
                    {teamIdMode === 'manual' ? t('teamIdCustomHint') : t('teamIdAutoHint')}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <InfoCard icon={<Orbit size={16} />} title={t('cardIdentityTitle')} text={t('cardIdentityDesc')} />
                  <InfoCard icon={<Bot size={16} />} title={t('cardAgentTitle')} text={t('cardAgentDesc')} />
                  <InfoCard icon={<Radio size={16} />} title={t('cardCheckTitle')} text={t('cardCheckDesc')} />
                </div>
              </div>
            </section>

            <section className="px-6 py-8 sm:px-8 sm:py-10">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6">
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <FieldBlock label={t('nombre')} hint={t('nombreHint')}>
                      <input
                        {...register('nombre')}
                        className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-amber-400/30"
                        style={sharedInputStyle}
                        placeholder={t('nombrePlaceholder')}
                      />
                      {errors.nombre && <FieldError message={errors.nombre.message} />}
                    </FieldBlock>

                    <FieldBlock label={t('teamIdLabel')} hint={t('teamIdDesc')}>
                      <input
                        {...register('id', {
                          onChange: (event) => {
                            setTeamIdMode(event.target.value.trim() ? 'manual' : 'auto');
                          },
                        })}
                        className="w-full rounded-2xl px-4 py-3 text-sm font-mono outline-none transition focus:ring-2 focus:ring-emerald-400/30"
                        style={sharedInputStyle}
                        placeholder={suggestedTeamId}
                      />
                      {errors.id && <FieldError message={errors.id.message} />}
                    </FieldBlock>
                  </div>

                  <div
                    className="rounded-3xl border p-5"
                    style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(8, 17, 29, 0.42)' }}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div
                        className="relative h-24 w-24 overflow-hidden rounded-2xl border"
                        style={{ borderColor: 'rgba(245,158,11,0.24)', background: 'rgba(15,23,42,0.72)' }}
                      >
                        {avatarPreviewUrl ? (
                          <Image
                            src={avatarPreviewUrl}
                            alt={t('avatar')}
                            fill
                            sizes="96px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center" style={{ color: '#fbbf24' }}>
                            {avatarMode === 'generate' ? <Sparkles size={28} /> : <Shield size={28} />}
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: '#f8fafc' }}>
                          {t('avatar')}
                        </p>
                        <p className="mt-1 text-sm leading-6" style={{ color: '#94a3b8' }}>
                          {avatarMode === 'generate' ? t('registroAvatarGenerateHint') : t('registroAvatarHint')}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition"
                            style={{ borderColor: 'rgba(148,163,184,0.24)', background: 'rgba(15,23,42,0.72)', color: '#cbd5e1' }}
                          >
                            <ImageUp size={16} />
                            {t('subirAvatar')}
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                selectAvatarUpload(file);
                              }
                              event.target.value = '';
                            }}
                          />
                          <button
                            type="button"
                            onClick={selectAvatarGeneration}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
                            style={{ background: 'rgba(56,189,248,0.14)', color: '#7dd3fc' }}
                          >
                            <Sparkles size={16} />
                            {t('generarConIA')}
                          </button>
                        </div>
                        {avatarMode === 'upload' && avatarFile ? (
                          <p className="mt-3 text-xs" style={{ color: '#94a3b8' }}>
                            {t('registroAvatarUploadReady', { fileName: avatarFile.name })}
                          </p>
                        ) : null}
                        {avatarMode === 'generate' ? (
                          <p className="mt-3 text-xs" style={{ color: '#94a3b8' }}>
                            {t('registroAvatarGenerateReady')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div
                    className="rounded-3xl border p-5"
                    style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(8, 17, 29, 0.42)' }}
                  >
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#f8fafc' }}>
                          {t('agentSectionTitle')}
                        </p>
                        <p className="mt-1 text-sm leading-6" style={{ color: '#94a3b8' }}>
                          {t('agentSectionDesc')}
                        </p>
                      </div>
                      <div
                        className="rounded-full px-3 py-1 text-xs font-semibold"
                        style={{ background: 'rgba(52, 211, 153, 0.12)', color: '#6ee7b7' }}
                      >
                        {agentBackend === 'mattin' ? t('agentBackendMattin') : t('agentBackendLocal')}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4">
                      <FieldBlock label={t('agentBackendLabel')}>
                        <select
                          {...register('agentBackend')}
                          className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-sky-400/30"
                          style={sharedInputStyle}
                          defaultValue="mattin"
                        >
                          <option value="mattin">{t('agentBackendMattin')}</option>
                          <option value="local">{t('agentBackendLocal')}</option>
                        </select>
                      </FieldBlock>

                      {agentBackend === 'mattin' && (
                        <>
                          <div className="grid gap-4 lg:grid-cols-2">
                            <FieldBlock label={t('agentId')} hint={t('agentIdDesc')}>
                              <input
                                {...register('agentId')}
                                className="w-full rounded-2xl px-4 py-3 text-sm font-mono outline-none transition focus:ring-2 focus:ring-amber-400/30"
                                style={sharedInputStyle}
                                placeholder={t('agentIdPlaceholder')}
                              />
                              {errors.agentId && <FieldError message={errors.agentId.message} />}
                            </FieldBlock>

                            <FieldBlock label={t('appIdLabel')} hint={t('appIdDesc')}>
                              <input
                                {...register('appId')}
                                className="w-full rounded-2xl px-4 py-3 text-sm font-mono outline-none transition focus:ring-2 focus:ring-amber-400/30"
                                style={sharedInputStyle}
                                placeholder={t('appIdPlaceholder')}
                              />
                              {errors.appId && <FieldError message={errors.appId.message} />}
                            </FieldBlock>
                          </div>

                          <FieldBlock label={t('mattinApiKeyLabel')} hint={t('mattinApiKeyDesc')}>
                            <div className="relative">
                              <KeyRound size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#64748b' }} />
                              <input
                                {...register('mattinApiKey')}
                                type="password"
                                autoComplete="new-password"
                                className="w-full rounded-2xl py-3 pl-11 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-amber-400/30"
                                style={sharedInputStyle}
                                placeholder={t('mattinApiKeyPlaceholder')}
                              />
                            </div>
                            {errors.mattinApiKey && <FieldError message={errors.mattinApiKey.message} />}
                          </FieldBlock>

                          <div
                            className="flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                            style={{ borderColor: 'rgba(52, 211, 153, 0.18)', background: 'rgba(8, 17, 29, 0.65)' }}
                          >
                            <div>
                              <p className="text-sm font-semibold" style={{ color: '#f8fafc' }}>
                                {t('mattinCheckTitle')}
                              </p>
                              <p className="mt-1 text-sm leading-6" style={{ color: '#94a3b8' }}>
                                {t('mattinCheckDesc')}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleMattinCheck}
                              disabled={isTestingMattin || isSubmitting}
                              className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold whitespace-nowrap disabled:opacity-50 sm:self-start"
                              style={{ background: '#0f766e', color: '#ecfeff' }}
                            >
                              {isTestingMattin ? t('mattinCheckLoading') : t('mattinCheckAction')}
                            </button>
                          </div>

                          {testMessage && (
                            <div
                              className="rounded-2xl border px-4 py-3 text-sm"
                              style={{
                                borderColor: testMessage === t('mattinCheckOk') ? 'rgba(34,197,94,0.28)' : 'rgba(248,113,113,0.28)',
                                background: testMessage === t('mattinCheckOk') ? 'rgba(20,83,45,0.35)' : 'rgba(127,29,29,0.35)',
                                color: testMessage === t('mattinCheckOk') ? '#bbf7d0' : '#fecaca',
                              }}
                            >
                              {testMessage}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {serverError && (
                  <div
                    className="rounded-2xl border px-4 py-3 text-sm"
                    style={{ borderColor: 'rgba(248,113,113,0.28)', background: 'rgba(127,29,29,0.45)', color: '#fecaca' }}
                  >
                    {serverError}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-6" style={{ color: '#94a3b8' }}>
                    {t('registroFooter')}
                  </p>
                  <button
                    type="submit"
                    disabled={isSubmitting || isTestingMattin}
                    className="inline-flex items-center justify-center self-start rounded-2xl px-6 py-3 text-sm font-semibold whitespace-nowrap disabled:opacity-50"
                    style={{ background: '#f59e0b', color: '#111827', boxShadow: '0 12px 30px rgba(245, 158, 11, 0.22)' }}
                  >
                    {isSubmitting ? t('registrando') : t('registrar')}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldBlock({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <label className="block text-sm font-medium" style={{ color: '#e2e8f0' }}>
          {label}
        </label>
        {hint ? (
          <p className="text-xs leading-5" style={{ color: '#64748b' }}>
            {hint}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-2 text-xs" style={{ color: '#fca5a5' }}>
      {message}
    </p>
  );
}

function InfoCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(8, 17, 29, 0.5)' }}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}>
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold" style={{ color: '#f8fafc' }}>
        {title}
      </p>
      <p className="mt-1 text-xs leading-5" style={{ color: '#94a3b8' }}>
        {text}
      </p>
    </div>
  );
}
