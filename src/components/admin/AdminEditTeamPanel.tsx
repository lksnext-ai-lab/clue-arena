'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Bot,
  ImageUp,
  KeyRound,
  Orbit,
  Radio,
  Save,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api/client';
import { UpdateTeamSchema, type UpdateTeamInput } from '@/lib/schemas/team';
import type { TeamResponse, UserResponse } from '@/types/api';
import { MembersEditor } from '@/components/team/MembersEditor';
import { DeleteTeamButton } from './DeleteTeamButton';

interface Props {
  team: TeamResponse | null;
  onUpdated: (updated: TeamResponse) => void;
  onDeleted: (teamId: string) => void;
  onClose: () => void;
}

interface MattinCheckResponse {
  reachable: boolean;
  response?: string;
  error?: string;
}

const sharedInputStyle = {
  background: 'rgba(15, 23, 42, 0.78)',
  color: '#e2e8f0',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
} as const;

export function AdminEditTeamPanel({ team, onUpdated, onDeleted, onClose }: Props) {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const [serverError, setServerError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [isTestingMattin, setIsTestingMattin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(team?.avatarUrl ?? null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [members, setMembers] = useState<string[]>(team?.miembros ?? []);
  const [ownerUserId, setOwnerUserId] = useState(team?.usuarioId ?? '');
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<UpdateTeamInput>({
    resolver: zodResolver(UpdateTeamSchema),
    defaultValues: {
      nombre: team?.nombre ?? '',
      descripcion: team?.descripcion ?? '',
      agentId: team?.agentId ?? '',
      agentBackend: team?.agentBackend ?? 'mattin',
      appId: team?.appId ?? '',
      mattinApiKey: undefined,
      estado: team?.estado ?? 'activo',
    },
  });

  const agentBackend = watch('agentBackend');
  const agentId = watch('agentId');
  const appId = watch('appId');
  const mattinApiKey = watch('mattinApiKey');
  const agentBackendDescription = agentBackend === 'local' ? t('agentBackendLocalDesc') : t('agentBackendMattinDesc');

  useEffect(() => {
    if (agentBackend === 'local') {
      setValue('appId', '');
      setValue('mattinApiKey', undefined);
      setTestMessage(null);
    }
  }, [agentBackend, setValue]);

  useEffect(() => {
    reset({
      nombre: team?.nombre ?? '',
      descripcion: team?.descripcion ?? '',
      agentId: team?.agentId ?? '',
      agentBackend: team?.agentBackend ?? 'mattin',
      appId: team?.appId ?? '',
      mattinApiKey: undefined,
      estado: team?.estado ?? 'activo',
    });
    setServerError(null);
    setAvatarError(null);
    setAvatarUrl(team?.avatarUrl ?? null);
    setMembers(team?.miembros ?? []);
    setOwnerUserId(team?.usuarioId ?? '');
    setTestMessage(null);
  }, [team, reset]);

  useEffect(() => {
    if (!team || users.length > 0) return;

    let cancelled = false;
    setUsersLoading(true);
    apiFetch<{ users: UserResponse[] }>('/admin/users')
      .then((data) => {
        if (!cancelled) setUsers(data.users);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [team, users.length]);

  const cleanAvatarUrl = (url: string | null) => (url ? url.split('?')[0] ?? url : null);

  const handleGenerateAvatar = async () => {
    if (!team) return;
    setAvatarLoading(true);
    setAvatarError(null);
    try {
      const res = await apiFetch<{ avatarUrl: string }>(`/teams/${team.id}/avatar`, {
        method: 'POST',
        body: JSON.stringify({ action: 'generate' }),
      });
      setAvatarUrl(`${res.avatarUrl}?t=${Date.now()}`);
    } catch {
      setAvatarError(t('errorGenerarAvatar'));
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleUploadAvatar = async (file: File) => {
    if (!team) return;
    setAvatarLoading(true);
    setAvatarError(null);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await apiFetch<{ avatarUrl: string }>(`/teams/${team.id}/avatar`, {
        method: 'POST',
        body: formData,
      });
      setAvatarUrl(`${res.avatarUrl}?t=${Date.now()}`);
    } catch {
      setAvatarError(t('errorSubirAvatar'));
    } finally {
      setAvatarLoading(false);
    }
  };

  const onSubmit = async (data: UpdateTeamInput) => {
    if (!team) return;
    setServerError(null);

    try {
      const updated = await apiFetch<TeamResponse>(`/teams/${team.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          descripcion: data.descripcion || null,
          appId: data.appId || null,
          mattinApiKey: data.mattinApiKey || undefined,
          avatarUrl: cleanAvatarUrl(avatarUrl),
          usuarioId: ownerUserId,
        }),
      });
      onUpdated({
        ...updated,
        avatarUrl: cleanAvatarUrl(avatarUrl),
        usuarioId: ownerUserId,
        miembros: members,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      try {
        const body = JSON.parse(message || '{}');
        if (body?.code === 'NOMBRE_DUPLICADO') {
          setServerError(t('registroNombreDuplicado'));
          return;
        }
        if (body?.error === 'El usuario seleccionado no existe') {
          setServerError(t('errorOwnerNoExiste'));
          return;
        }
      } catch {
        // fall through to generic error
      }
      setServerError(t('errorEditar'));
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

  if (!team) {
    return (
      <section
        className="rounded-[28px] border p-6"
        style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(9, 17, 31, 0.84)' }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}
        >
          <Shield size={24} />
        </div>
        <h3 className="mt-4 text-xl font-semibold" style={{ color: '#f8fafc' }}>
          {t('editorSinSeleccionTitle')}
        </h3>
        <p className="mt-2 text-sm leading-6" style={{ color: '#94a3b8' }}>
          {t('editorSinSeleccionDesc')}
        </p>
      </section>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border"
        style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(9, 17, 31, 0.96)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6" style={{ borderColor: 'rgba(148, 163, 184, 0.14)' }}>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: '#94a3b8' }}>
              {t('equipoSeleccionado')}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold sm:text-xl" style={{ color: '#f8fafc' }}>
                {team.nombre}
              </h2>
              <span
                className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc' }}
              >
                <Orbit size={12} />
                {team.id}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <DeleteTeamButton teamId={team.id} teamName={team.nombre} onDeleted={() => onDeleted(team.id)} />
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border px-3 py-2 text-xs font-semibold transition"
              style={{ borderColor: 'rgba(148,163,184,0.24)', background: 'rgba(15,23,42,0.72)', color: '#cbd5e1' }}
            >
              {tCommon('cancelar')}
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="scrollbar-panel min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 overscroll-contain sm:px-6 sm:py-5"
        >
          {serverError ? (
            <div
              className="rounded-2xl border px-4 py-3 text-xs sm:text-sm"
              style={{ borderColor: 'rgba(248,113,113,0.28)', background: 'rgba(127,29,29,0.34)', color: '#fecaca' }}
            >
              {serverError}
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
            <SectionCard icon={<Shield size={16} />} title={t('equipo')}>
              <div className="space-y-3">
                <FieldBlock label={t('avatar')} hint={t('avatarAdminDesc')}>
                  <div className="rounded-3xl border p-3" style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(8, 17, 29, 0.46)' }}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="relative h-20 w-20 overflow-hidden rounded-2xl border" style={{ borderColor: 'rgba(245,158,11,0.24)', background: 'rgba(15,23,42,0.72)' }}>
                        {avatarUrl ? (
                          <Image src={avatarUrl} alt={`Avatar de ${team.nombre}`} fill sizes="80px" className="object-cover" unoptimized />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center" style={{ color: '#fbbf24' }}>
                            <Shield size={24} />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={avatarLoading}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 sm:text-sm"
                            style={{ borderColor: 'rgba(148,163,184,0.24)', background: 'rgba(15,23,42,0.72)', color: '#cbd5e1' }}
                          >
                            <ImageUp size={14} />
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
                            className="inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition disabled:opacity-50 sm:text-sm"
                            style={{ background: 'rgba(56,189,248,0.14)', color: '#7dd3fc' }}
                          >
                            <Sparkles size={14} />
                            {avatarLoading ? t('generandoAvatar') : t('generarConIA')}
                          </button>
                        </div>
                        {avatarError ? <FieldError message={avatarError} /> : null}
                        {avatarLoading && !avatarError ? (
                          <p className="text-xs" style={{ color: '#94a3b8' }}>
                            {t('generandoAvatarDesc')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </FieldBlock>

                <FieldBlock label={t('nombreEquipo')}>
                  <input
                    {...register('nombre')}
                    className="w-full rounded-2xl px-3 py-2.5 text-xs outline-none transition focus:ring-2 focus:ring-amber-400/30 sm:text-sm"
                    style={sharedInputStyle}
                  />
                  {errors.nombre && <FieldError message={errors.nombre.message} />}
                </FieldBlock>

                <FieldBlock label={t('descripcionEquipo')}>
                  <textarea
                    {...register('descripcion')}
                    rows={4}
                    className="w-full resize-none rounded-2xl px-3 py-2.5 text-xs outline-none transition focus:ring-2 focus:ring-amber-400/30 sm:text-sm"
                    style={sharedInputStyle}
                    placeholder={t('descripcionPlaceholder')}
                  />
                  {errors.descripcion && <FieldError message={errors.descripcion.message} />}
                </FieldBlock>

                <FieldBlock label={t('ownerEquipo')}>
                  <select
                    value={ownerUserId}
                    onChange={(event) => setOwnerUserId(event.target.value)}
                    disabled={usersLoading}
                    className="w-full rounded-2xl px-3 py-2.5 text-xs outline-none transition focus:ring-2 focus:ring-sky-400/30 sm:text-sm"
                    style={sharedInputStyle}
                  >
                    {usersLoading ? <option value="">{t('cargandoUsuarios')}</option> : null}
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.nombre} ({user.email})
                      </option>
                    ))}
                    {!usersLoading && users.length === 0 ? <option value={ownerUserId}>{ownerUserId}</option> : null}
                  </select>
                </FieldBlock>

                <FieldBlock label={t('estadoLabel')}>
                  <select
                    {...register('estado')}
                    className="w-full rounded-2xl px-3 py-2.5 text-xs outline-none transition focus:ring-2 focus:ring-sky-400/30 sm:text-sm"
                    style={sharedInputStyle}
                  >
                    <option value="activo">{t('status.activo')}</option>
                    <option value="inactivo">{t('status.inactivo')}</option>
                  </select>
                </FieldBlock>
              </div>
            </SectionCard>

          <SectionCard icon={<Bot size={16} />} title={t('agente')}>
            <div className="space-y-4">
              <div className="rounded-3xl border p-3" style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(8, 17, 29, 0.46)' }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold sm:text-sm" style={{ color: '#f8fafc' }}>
                      {t('agentBackendLabel')}
                    </p>
                  </div>
                  <div
                    className="inline-flex shrink-0 items-center gap-2 self-start whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold"
                    style={{ background: 'rgba(52,211,153,0.12)', color: '#6ee7b7' }}
                  >
                    <Radio size={14} />
                    {agentBackend === 'local' ? t('agentBackendLocal') : t('agentBackendMattin')}
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 sm:text-sm" style={{ color: '#94a3b8' }}>
                  {agentBackendDescription}
                </p>
              </div>

              <select
                {...register('agentBackend')}
                className="w-full rounded-2xl px-3 py-2.5 text-xs outline-none transition focus:ring-2 focus:ring-sky-400/30 sm:text-sm"
                style={sharedInputStyle}
              >
                <option value="mattin">{t('agentBackendMattin')}</option>
                <option value="local">{t('agentBackendLocal')}</option>
              </select>

              {agentBackend === 'mattin' ? (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FieldBlock label={t('agentId')}>
                      <input
                        {...register('agentId')}
                        className="w-full rounded-2xl px-3 py-2.5 text-xs font-mono outline-none transition focus:ring-2 focus:ring-amber-400/30 sm:text-sm"
                        style={sharedInputStyle}
                      />
                      {errors.agentId && <FieldError message={errors.agentId.message} />}
                    </FieldBlock>

                    <FieldBlock label={t('appIdLabel')}>
                      <input
                        {...register('appId')}
                        className="w-full rounded-2xl px-3 py-2.5 text-xs font-mono outline-none transition focus:ring-2 focus:ring-amber-400/30 sm:text-sm"
                        style={sharedInputStyle}
                        placeholder={t('appIdPlaceholder')}
                      />
                      {errors.appId && <FieldError message={errors.appId.message} />}
                    </FieldBlock>
                  </div>
                </>
              ) : null}

              {agentBackend === 'mattin' ? (
                <>
                  <FieldBlock label={t('mattinApiKeyLabel')}>
                    <div className="relative">
                      <KeyRound size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#64748b' }} />
                      <input
                        {...register('mattinApiKey')}
                        type="password"
                        autoComplete="new-password"
                        className="w-full rounded-2xl py-2.5 pl-10 pr-3 text-xs outline-none transition focus:ring-2 focus:ring-amber-400/30 sm:text-sm"
                        style={sharedInputStyle}
                        placeholder={team.hasMattinApiKey ? t('mattinApiKeyConfigured') : t('mattinApiKeyPlaceholder')}
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

                  {testMessage ? (
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
                  ) : null}
                </>
              ) : null}

            </div>
          </SectionCard>
          </div>

          <div
            className="rounded-[24px] border p-3"
            style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(8, 17, 29, 0.52)' }}
          >
            <MembersEditor
              teamId={team.id}
              ns="admin"
              initialMembers={members}
              onSaved={(updatedMembers) => {
                setMembers(updatedMembers);
                onUpdated({ ...team, miembros: updatedMembers, avatarUrl: cleanAvatarUrl(avatarUrl), usuarioId: ownerUserId });
              }}
            />
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-end" style={{ borderColor: 'rgba(148, 163, 184, 0.14)' }}>
            <button
              type="button"
              onClick={() => {
                reset({
                  nombre: team.nombre,
                  descripcion: team.descripcion ?? '',
                  agentId: team.agentId,
                  agentBackend: team.agentBackend,
                  appId: team.appId ?? '',
                  mattinApiKey: undefined,
                  estado: team.estado,
                });
                setAvatarUrl(team.avatarUrl ?? null);
                setOwnerUserId(team.usuarioId);
                setServerError(null);
                setAvatarError(null);
              }}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-semibold transition disabled:opacity-50 sm:text-sm"
              style={{ borderColor: 'rgba(148,163,184,0.24)', background: 'rgba(15,23,42,0.72)', color: '#cbd5e1' }}
            >
              {tCommon('cancelar')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || avatarLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-semibold transition disabled:opacity-50 sm:text-sm"
              style={{ background: '#f59e0b', color: '#111827', boxShadow: '0 14px 30px rgba(245,158,11,0.22)' }}
            >
              <Save size={16} />
              {isSubmitting ? t('guardandoCambios') : tCommon('guardar')}
            </button>
          </div>
        </form>
      </section>
    </div>
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
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-[24px] border p-4 sm:p-5"
      style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(8, 17, 29, 0.52)' }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}>
          {icon}
        </div>
        <div>
          <h3 className="text-base font-semibold" style={{ color: '#f8fafc' }}>
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-xs leading-5 sm:text-sm" style={{ color: '#94a3b8' }}>
              {description}
            </p>
          ) : null}
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
        <label className="text-xs font-semibold sm:text-sm" style={{ color: '#e2e8f0' }}>
          {label}
        </label>
        {hint ? (
          <span className="text-[11px] sm:text-xs" style={{ color: '#64748b' }}>
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
    <p className="mt-2 text-[11px] sm:text-xs" style={{ color: '#fca5a5' }}>
      {message}
    </p>
  );
}
