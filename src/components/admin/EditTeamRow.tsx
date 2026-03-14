'use client';

import type { ReactNode } from 'react';
import { useRef, useState, useEffect } from 'react';
import { Bot, CalendarDays, ChevronDown, ChevronUp, KeyRound, Orbit, PencilLine, Shield, ShieldCheck, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UpdateTeamSchema, type UpdateTeamInput } from '@/lib/schemas/team';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import type { TeamResponse, UserResponse } from '@/types/api';
import { DeleteTeamButton } from './DeleteTeamButton';
import Image from 'next/image';
import { MembersEditor } from '@/components/team/MembersEditor';

interface Props {
  team: TeamResponse;
  statusColors: Record<string, string>;
  onUpdated: (updated: TeamResponse) => void;
  onDeleted: () => void;
}

/**
 * Fila de equipo con edición en panel expandido, incluyendo
 * descripción, subida de avatar y generación con IA.
 */
export function EditTeamRow({ team, statusColors, onUpdated, onDeleted }: Props) {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');

  const [editing, setEditing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [members, setMembers] = useState<string[]>(team.miembros ?? []);
  const [ownerUserId, setOwnerUserId] = useState<string>(team.usuarioId);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(team.avatarUrl ?? null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UpdateTeamInput>({
    resolver: zodResolver(UpdateTeamSchema),
    defaultValues: {
      nombre: team.nombre,
      descripcion: team.descripcion ?? '',
      agentId: team.agentId,
      agentBackend: team.agentBackend ?? 'mattin',
      appId: team.appId ?? '',
      // mattinApiKey intentionally left blank — show placeholder when already configured
    },
  });
  const agentBackend = watch('agentBackend');

  useEffect(() => {
    if (agentBackend === 'local') {
      setValue('appId', '');
      setValue('mattinApiKey', undefined);
    }
  }, [agentBackend, setValue]);

  const openEdit = async () => {
    setEditing(true);
    if (users.length === 0) {
      setUsersLoading(true);
      try {
        const data = await apiFetch<{ users: UserResponse[] }>('/admin/users');
        setUsers(data.users);
      } catch {
        // show empty select; not blocking
      } finally {
        setUsersLoading(false);
      }
    }
  };

  const onSubmit = async (data: UpdateTeamInput) => {
    setServerError(null);
    try {
      const updated = await apiFetch<TeamResponse>(`/teams/${team.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...data,
          descripcion: data.descripcion || null,
          avatarUrl,
          usuarioId: ownerUserId,
        }),
      });
      onUpdated({ ...updated, avatarUrl, usuarioId: ownerUserId });
      setEditing(false);
    } catch (err: unknown) {
      let message = t('errorEditar');
      try {
        const body = JSON.parse((err as Error)?.message ?? '{}');
        if (body?.code === 'NOMBRE_DUPLICADO') {
          message = 'Ya existe un equipo con ese nombre.';
        }
      } catch {
        // usar mensaje genérico
      }
      setServerError(message);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setServerError(null);
    setMembers(team.miembros ?? []);
    setAvatarUrl(team.avatarUrl ?? null);
    setOwnerUserId(team.usuarioId);
    reset({ nombre: team.nombre, descripcion: team.descripcion ?? '', agentId: team.agentId, agentBackend: team.agentBackend ?? 'mattin', appId: team.appId ?? '' });
  };

  // ── Avatar actions ──────────────────────────────────────────────────────

  const handleGenerate = async () => {
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

  const handleUpload = async (file: File) => {
    setAvatarLoading(true);
    setAvatarError(null);
    const fd = new FormData();
    fd.append('avatar', file);
    try {
      const res = await apiFetch<{ avatarUrl: string }>(`/teams/${team.id}/avatar`, {
        method: 'POST',
        body: fd,
      });
      setAvatarUrl(`${res.avatarUrl}?t=${Date.now()}`);
    } catch {
      setAvatarError(t('errorSubirAvatar'));
    } finally {
      setAvatarLoading(false);
    }
  };

  const statusColor = statusColors[team.estado] ?? '#64748b';
  const statusLabel = t(`status.${team.estado}`);
  const createdAt = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(team.createdAt));

  return (
    <article
      className="overflow-hidden rounded-[28px] border"
      style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(9, 17, 31, 0.84)' }}
    >
      <div
        className="relative overflow-hidden px-5 py-5 sm:px-6"
        style={{ background: 'linear-gradient(160deg, rgba(245,158,11,0.06), rgba(34,197,94,0.04) 62%, transparent)' }}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              {avatarUrl ? (
                <div
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border"
                  style={{ borderColor: 'rgba(245,158,11,0.28)', boxShadow: '0 16px 30px rgba(245,158,11,0.14)' }}
                >
                  <Image
                    src={avatarUrl}
                    alt={`Avatar de ${team.nombre}`}
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24' }}
                >
                  <Shield size={22} />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-semibold" style={{ color: '#f8fafc' }}>
                    {team.nombre}
                  </h3>
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ background: `${statusColor}22`, color: statusColor }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: statusColor }} />
                    {statusLabel}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: '#94a3b8' }}>
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1"
                    style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc' }}
                  >
                    <Orbit size={13} />
                    {team.id}
                  </span>
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1"
                    style={{ background: 'rgba(52,211,153,0.12)', color: '#86efac' }}
                  >
                    <Bot size={13} />
                    {team.agentBackend === 'local' ? t('agentBackendLocal') : t('agentBackendMattin')}
                  </span>
                </div>

                <p className="max-w-2xl text-sm leading-6" style={{ color: '#cbd5e1' }}>
                  {team.descripcion?.trim() || t('teamCardNoDescription')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={editing ? handleCancel : openEdit}
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
                style={{ background: editing ? 'rgba(51,65,85,0.9)' : 'rgba(56,189,248,0.14)', color: editing ? '#cbd5e1' : '#7dd3fc' }}
                title={t('editarEquipo')}
              >
                <PencilLine size={16} />
                {editing ? tCommon('cancelar') : t('editarEquipo')}
              </button>
              <DeleteTeamButton
                teamId={team.id}
                teamName={team.nombre}
                onDeleted={onDeleted}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoPill icon={<KeyRound size={15} />} label={t('agentId')} value={team.agentId} mono />
            <InfoPill icon={<Users size={15} />} label={t('miembros')} value={String(members.length)} />
            <InfoPill icon={<CalendarDays size={15} />} label={t('createdAtLabel')} value={createdAt} />
            <InfoPill icon={<ShieldCheck size={15} />} label={t('ownerEquipo')} value={ownerUserId} mono />
          </div>

          <button
            type="button"
            onClick={editing ? handleCancel : openEdit}
            className="inline-flex items-center gap-2 self-start rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ background: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' }}
          >
            {editing ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {editing ? t('cerrarEdicion') : t('abrirEdicion')}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="border-t px-5 py-5 sm:px-6" style={{ borderColor: 'rgba(148, 163, 184, 0.14)' }}>
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('nombreEquipo')}>
                <input
                  {...register('nombre')}
                  className={fieldClassName}
                  style={fieldStyle}
                />
                {errors.nombre && <FieldError message={errors.nombre.message} />}
              </Field>

              <Field label={t('agentId')}>
                <input
                  {...register('agentId')}
                  className={fieldClassName}
                  style={fieldStyle}
                />
                {errors.agentId && <FieldError message={errors.agentId.message} />}
              </Field>

              <Field label={t('agentBackendLabel')}>
                <select
                  {...register('agentBackend')}
                  className={fieldClassName}
                  style={fieldStyle}
                >
                  <option value="mattin">{t('agentBackendMattin')}</option>
                  <option value="local">{t('agentBackendLocal')}</option>
                </select>
              </Field>

              {agentBackend === 'mattin' ? (
                <Field label={t('appIdLabel')}>
                  <input
                    {...register('appId')}
                    className={fieldClassName}
                    style={fieldStyle}
                    placeholder={t('appIdPlaceholder')}
                  />
                  {errors.appId && <FieldError message={errors.appId.message} />}
                </Field>
              ) : (
                <div
                  className="rounded-[24px] border px-4 py-4"
                  style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(8, 17, 29, 0.55)' }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#94a3b8' }}>
                    {t('agentBackendLabel')}
                  </p>
                  <p className="mt-2 text-sm" style={{ color: '#cbd5e1' }}>
                    {t('localBackendHint')}
                  </p>
                </div>
              )}
            </div>

            {agentBackend === 'mattin' && (
              <Field label={t('mattinApiKeyLabel')}>
                <input
                  {...register('mattinApiKey')}
                  type="password"
                  autoComplete="new-password"
                  className={fieldClassName}
                  style={fieldStyle}
                  placeholder={team.hasMattinApiKey ? t('mattinApiKeyConfigured') : t('mattinApiKeyPlaceholder')}
                />
                {errors.mattinApiKey && <FieldError message={errors.mattinApiKey.message} />}
              </Field>
            )}

            <Field label={t('descripcionEquipo')}>
              <textarea
                {...register('descripcion')}
                rows={3}
                className={`${fieldClassName} resize-none`}
                style={fieldStyle}
                placeholder={t('descripcionPlaceholder')}
              />
              {errors.descripcion && <FieldError message={errors.descripcion.message} />}
            </Field>

            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <div
                className="rounded-[24px] border p-4"
                style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(8, 17, 29, 0.55)' }}
              >
                <div className="flex items-start gap-4">
                  <div className="relative h-20 w-20 overflow-hidden rounded-2xl" style={{ background: 'rgba(15, 23, 42, 0.78)' }}>
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={`Avatar de ${team.nombre}`}
                        fill
                        sizes="80px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center" style={{ color: '#fbbf24' }}>
                        <Shield size={26} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#94a3b8' }}>
                        {t('avatar')}
                      </p>
                      <p className="mt-2 text-sm leading-6" style={{ color: '#cbd5e1' }}>
                        {t('avatarAdminDesc')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarLoading}
                        className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
                        style={{ background: 'rgba(56,189,248,0.14)', color: '#7dd3fc' }}
                      >
                        {t('subirAvatar')}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(file);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={avatarLoading}
                        className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
                        style={{ background: 'rgba(245,158,11,0.14)', color: '#fbbf24' }}
                      >
                        {avatarLoading ? t('generandoAvatar') : t('generarConIA')}
                      </button>
                    </div>
                    {avatarError ? <FieldError message={avatarError} /> : null}
                    {avatarLoading && !avatarError ? (
                      <p className="text-xs" style={{ color: '#94a3b8' }}>{t('generandoAvatarDesc')}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div
                className="rounded-[24px] border p-4"
                style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(8, 17, 29, 0.55)' }}
              >
                <Field label={t('ownerEquipo')}>
                  <select
                    value={ownerUserId}
                    onChange={(e) => setOwnerUserId(e.target.value)}
                    disabled={usersLoading}
                    className={fieldClassName}
                    style={fieldStyle}
                  >
                    {usersLoading && (
                      <option value="">{t('cargandoUsuarios')}</option>
                    )}
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre} ({u.email})
                      </option>
                    ))}
                    {!usersLoading && users.length === 0 && (
                      <option value={ownerUserId}>{ownerUserId}</option>
                    )}
                  </select>
                </Field>
              </div>
            </div>

            <div
              className="rounded-[24px] border p-4"
              style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(8, 17, 29, 0.55)' }}
            >
              <MembersEditor
                teamId={team.id}
                ns="admin"
                initialMembers={members}
                onSaved={(updated) => setMembers(updated)}
              />
            </div>

            {serverError ? <FieldError message={serverError} /> : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={handleCancel}
                className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition"
                style={{ background: 'rgba(51,65,85,0.9)', color: '#cbd5e1' }}
              >
                {tCommon('cancelar')}
              </button>
              <button
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting || avatarLoading}
                className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
                style={{ background: '#f59e0b', color: '#111827', boxShadow: '0 14px 30px rgba(245,158,11,0.18)' }}
              >
                {isSubmitting ? '...' : tCommon('guardar')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

const fieldClassName = 'w-full rounded-2xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-cyan-400/30';
const fieldStyle = {
  background: 'rgba(15, 23, 42, 0.78)',
  color: '#f8fafc',
  border: '1px solid rgba(148, 163, 184, 0.22)',
} as const;

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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-2 text-xs" style={{ color: '#fca5a5' }}>{message}</p>;
}

function InfoPill({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      className="rounded-[22px] border px-4 py-3"
      style={{ borderColor: 'rgba(148, 163, 184, 0.12)', background: 'rgba(8, 17, 29, 0.5)' }}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#94a3b8' }}>
        {icon}
        {label}
      </div>
      <p className={`mt-2 text-sm ${mono ? 'font-mono' : ''}`} style={{ color: '#f8fafc' }}>
        {value}
      </p>
    </div>
  );
}
