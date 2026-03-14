'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bot, ImageUp, KeyRound, Orbit, Radio, Save, Shield, Sparkles, X } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import { TeamMemberUpdateSchema, type TeamMemberUpdateInput } from '@/lib/schemas/team';
import type { TeamResponse } from '@/types/api';

interface EditTeamFormProps {
  team: TeamResponse;
  onSaved: (updated: TeamResponse) => void;
  onCancel: () => void;
  onPreviewChange?: (changes: Partial<TeamResponse>) => void;
}

const sharedInputStyle = {
  background: 'rgba(15, 23, 42, 0.78)',
  color: '#e2e8f0',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
} as const;

export function EditTeamForm({ team, onSaved, onCancel, onPreviewChange }: EditTeamFormProps) {
  const t = useTranslations('equipo');
  const [serverError, setServerError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(team.avatarUrl ?? null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TeamMemberUpdateInput>({
    resolver: zodResolver(TeamMemberUpdateSchema),
    defaultValues: {
      nombre: team.nombre,
      descripcion: team.descripcion ?? '',
      agentId: team.agentId,
      agentBackend: team.agentBackend,
      appId: team.appId ?? '',
      mattinApiKey: '',
    },
  });

  const agentBackend = watch('agentBackend');

  useEffect(() => {
    if (agentBackend === 'local') {
      setValue('appId', '');
      setValue('mattinApiKey', undefined);
    }
  }, [agentBackend, setValue]);

  const cleanAvatarUrl = (url: string | null) => (url ? url.split('?')[0] ?? url : null);

  const handleGenerateAvatar = async () => {
    setAvatarLoading(true);
    setAvatarError(null);
    try {
      const res = await apiFetch<{ avatarUrl: string }>(`/teams/${team.id}/avatar`, {
        method: 'POST',
        body: JSON.stringify({ action: 'generate' }),
      });
      const nextAvatarUrl = cleanAvatarUrl(res.avatarUrl);
      setAvatarUrl(`${res.avatarUrl}?t=${Date.now()}`);
      onPreviewChange?.({ avatarUrl: nextAvatarUrl });
    } catch {
      setAvatarError(t('errorGenerarAvatar'));
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleUploadAvatar = async (file: File) => {
    setAvatarLoading(true);
    setAvatarError(null);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await apiFetch<{ avatarUrl: string }>(`/teams/${team.id}/avatar`, {
        method: 'POST',
        body: formData,
      });
      const nextAvatarUrl = cleanAvatarUrl(res.avatarUrl);
      setAvatarUrl(`${res.avatarUrl}?t=${Date.now()}`);
      onPreviewChange?.({ avatarUrl: nextAvatarUrl });
    } catch {
      setAvatarError(t('errorSubirAvatar'));
    } finally {
      setAvatarLoading(false);
    }
  };

  const onSubmit = async (data: TeamMemberUpdateInput) => {
    setServerError(null);

    const payload: TeamMemberUpdateInput = {
      ...data,
      descripcion: data.descripcion || null,
      appId: data.appId || null,
      mattinApiKey: data.mattinApiKey || undefined,
    };

    try {
      const updated = await apiFetch<TeamResponse>(`/teams/${team.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      onSaved({ ...updated, avatarUrl: cleanAvatarUrl(avatarUrl) });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'NOMBRE_DUPLICADO') {
        setServerError(t('editNombreDuplicado'));
      } else {
        setServerError(t('editError'));
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError && (
        <div
          className="rounded-2xl border px-4 py-3 text-sm"
          style={{ borderColor: 'rgba(248,113,113,0.28)', background: 'rgba(127,29,29,0.34)', color: '#fecaca' }}
        >
          {serverError}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <SectionCard
          icon={<Shield size={16} />}
          title={t('editIdentityTitle')}
          description={t('editIdentityDesc')}
        >
          <div className="space-y-4">
            <FieldBlock label={t('avatar')} hint={t('editAvatarHint')}>
              <div
                className="rounded-3xl border p-4"
                style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(8, 17, 29, 0.46)' }}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div
                    className="relative h-24 w-24 overflow-hidden rounded-2xl border"
                    style={{ borderColor: 'rgba(245,158,11,0.24)', background: 'rgba(15,23,42,0.72)' }}
                  >
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={`Avatar de ${team.nombre}`}
                        fill
                        sizes="96px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center" style={{ color: '#fbbf24' }}>
                        <Shield size={28} />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-50"
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
                            void handleUploadAvatar(file);
                          }
                          event.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleGenerateAvatar}
                        disabled={avatarLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-50"
                        style={{ background: 'rgba(56,189,248,0.14)', color: '#7dd3fc' }}
                      >
                        <Sparkles size={16} />
                        {avatarLoading ? t('generandoAvatar') : t('generarConIA')}
                      </button>
                    </div>
                    {avatarError ? (
                      <p className="text-xs" style={{ color: '#fca5a5' }}>
                        {avatarError}
                      </p>
                    ) : null}
                    {avatarLoading && !avatarError ? (
                      <p className="text-xs" style={{ color: '#94a3b8' }}>
                        {t('generandoAvatarDesc')}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </FieldBlock>

            <FieldBlock label={t('nombreLabel')} hint={t('nombreHint')}>
              <input
                {...register('nombre')}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-amber-400/30"
                style={sharedInputStyle}
                placeholder={t('nombrePlaceholder')}
              />
              {errors.nombre && <FieldError message={errors.nombre.message} />}
            </FieldBlock>

            <FieldBlock label={t('teamIdLabel')} hint={t('editTeamIdHint')}>
              <div
                className="rounded-2xl border px-4 py-3 font-mono text-sm"
                style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(8, 17, 29, 0.72)', color: '#f8fafc' }}
              >
                {team.id}
              </div>
            </FieldBlock>

            <FieldBlock label={t('descripcionLabel')} hint={t('editDescriptionHint')}>
              <textarea
                {...register('descripcion')}
                rows={5}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-amber-400/30 resize-none"
                style={sharedInputStyle}
                placeholder={t('panelNoDescription')}
              />
              {errors.descripcion && <FieldError message={errors.descripcion.message} />}
            </FieldBlock>
          </div>
        </SectionCard>

        <SectionCard
          icon={<Bot size={16} />}
          title={t('editAgentTitle')}
          description={t('editAgentDesc')}
        >
          <div className="space-y-5">
            <div
              className="rounded-3xl border p-4"
              style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(8, 17, 29, 0.46)' }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#f8fafc' }}>
                    {t('agentSectionTitle')}
                  </p>
                  <p className="mt-1 text-sm leading-6" style={{ color: '#94a3b8' }}>
                    {t('agentSectionDesc')}
                  </p>
                </div>
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: 'rgba(52,211,153,0.12)', color: '#6ee7b7' }}
                >
                  <Radio size={14} />
                  {agentBackend === 'local' ? t('agentBackendLocal') : t('agentBackendMattin')}
                </div>
              </div>
            </div>

            <FieldBlock label={t('agentBackendLabel')} hint={t('editBackendHint')}>
              <select
                {...register('agentBackend')}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-sky-400/30"
                style={sharedInputStyle}
              >
                <option value="mattin">{t('agentBackendMattin')}</option>
                <option value="local">{t('agentBackendLocal')}</option>
              </select>
            </FieldBlock>

            <div className="grid gap-4 lg:grid-cols-2">
              <FieldBlock label={t('agentIdLabel')} hint={t('agentIdDesc')}>
                <input
                  {...register('agentId')}
                  className="w-full rounded-2xl px-4 py-3 text-sm font-mono outline-none transition focus:ring-2 focus:ring-amber-400/30"
                  style={sharedInputStyle}
                  placeholder={t('agentIdPlaceholder')}
                />
                {errors.agentId && <FieldError message={errors.agentId.message} />}
              </FieldBlock>

              {agentBackend === 'mattin' ? (
                <FieldBlock label={t('appIdLabel')} hint={t('appIdDesc')}>
                  <input
                    {...register('appId')}
                    className="w-full rounded-2xl px-4 py-3 text-sm font-mono outline-none transition focus:ring-2 focus:ring-amber-400/30"
                    style={sharedInputStyle}
                    placeholder={t('appIdPlaceholder')}
                  />
                  {errors.appId && <FieldError message={errors.appId.message} />}
                </FieldBlock>
              ) : (
                <FieldBlock label={t('appIdLabel')} hint={t('editLocalBackendNote')}>
                  <div
                    className="rounded-2xl border px-4 py-3 text-sm"
                    style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(8, 17, 29, 0.72)', color: '#94a3b8' }}
                  >
                    {t('editLocalBackendValue')}
                  </div>
                </FieldBlock>
              )}
            </div>

            {agentBackend === 'mattin' && (
              <FieldBlock label={t('mattinApiKeyLabel')} hint={t('mattinApiKeyDesc')}>
                <div className="relative">
                  <KeyRound
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
                    style={{ color: '#64748b' }}
                  />
                  <input
                    {...register('mattinApiKey')}
                    type="password"
                    autoComplete="new-password"
                    className="w-full rounded-2xl py-3 pl-11 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-amber-400/30"
                    style={sharedInputStyle}
                    placeholder={team.hasMattinApiKey ? t('mattinApiKeyConfigured') : t('mattinApiKeyPlaceholder')}
                  />
                </div>
                {errors.mattinApiKey && <FieldError message={errors.mattinApiKey.message} />}
              </FieldBlock>
            )}

            <div
              className="rounded-3xl border px-4 py-4"
              style={{ borderColor: 'rgba(56,189,248,0.18)', background: 'rgba(8,17,29,0.62)' }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl"
                  style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}
                >
                  <Orbit size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#f8fafc' }}>
                    {t('editSecurityTitle')}
                  </p>
                  <p className="mt-1 text-sm leading-6" style={{ color: '#94a3b8' }}>
                    {t('editSecurityDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-end" style={{ borderColor: 'rgba(148, 163, 184, 0.14)' }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-50"
          style={{ borderColor: 'rgba(148,163,184,0.24)', background: 'rgba(15,23,42,0.72)', color: '#cbd5e1' }}
        >
          <X size={16} />
          {t('editCancelar')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:opacity-50"
          style={{ background: '#f59e0b', color: '#111827', boxShadow: '0 14px 30px rgba(245,158,11,0.22)' }}
        >
          <Save size={16} />
          {isSubmitting ? t('editGuardando') : t('editGuardar')}
        </button>
      </div>
    </form>
  );
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-[28px] border p-5 sm:p-6"
      style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(8, 17, 29, 0.52)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold" style={{ color: '#f8fafc' }}>
            {title}
          </h3>
          <p className="mt-1 text-sm leading-6" style={{ color: '#94a3b8' }}>
            {description}
          </p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
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
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>
          {label}
        </label>
        {hint ? (
          <span className="text-xs" style={{ color: '#64748b' }}>
            {hint}
          </span>
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
