'use client';

import { useRef, useState } from 'react';
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
    formState: { errors, isSubmitting },
  } = useForm<UpdateTeamInput>({
    resolver: zodResolver(UpdateTeamSchema),
    defaultValues: {
      nombre: team.nombre,
      descripcion: team.descripcion ?? '',
      agentId: team.agentId,
    },
  });

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
    reset({ nombre: team.nombre, descripcion: team.descripcion ?? '', agentId: team.agentId });
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

  // ── Edit mode (full-width panel via colSpan) ──────────────────────────────
  if (editing) {
    return (
      <tr className="border-b border-slate-700">
        <td colSpan={5} className="px-4 py-4">
          <div className="space-y-4">

            {/* nombre + agentId */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1 text-slate-400">
                  {t('nombreEquipo')}
                </label>
                <input
                  {...register('nombre')}
                  className="w-full px-2 py-1.5 rounded text-sm bg-slate-900/70 text-slate-200 border border-slate-700 focus:ring-2 focus:ring-cyan-500 outline-none"
                />
                {errors.nombre && (
                  <p className="text-xs mt-0.5 text-red-400">
                    {errors.nombre.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs mb-1 text-slate-400">
                  Agent ID
                </label>
                <input
                  {...register('agentId')}
                  className="w-full px-2 py-1.5 rounded text-sm font-mono bg-slate-900/70 text-slate-200 border border-slate-700 focus:ring-2 focus:ring-cyan-500 outline-none"
                />
                {errors.agentId && (
                  <p className="text-xs mt-0.5 text-red-400">
                    {errors.agentId.message}
                  </p>
                )}
              </div>
            </div>

            {/* descripcion */}
            <div>
              <label className="block text-xs mb-1 text-slate-400">
                {t('descripcionEquipo')}
              </label>
              <textarea
                {...register('descripcion')}
                rows={2}
                className="w-full px-2 py-1.5 rounded text-sm resize-none bg-slate-900/70 text-slate-200 border border-slate-700 focus:ring-2 focus:ring-cyan-500 outline-none"
                placeholder={t('descripcionPlaceholder')}
              />
              {errors.descripcion && (
                <p className="text-xs mt-0.5 text-red-400">
                  {errors.descripcion.message}
                </p>
              )}
            </div>

            {/* Avatar section */}
            <div
              className="rounded-lg p-3 flex items-start gap-4 bg-slate-900/50 border border-slate-700"
            >
              {/* Thumbnail */}
              <div
                className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden flex items-center justify-center bg-slate-800"
              >
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={`Avatar de ${team.nombre}`}
                    width={64}
                    height={64}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <span className="text-2xl">🛡️</span>
                )}
              </div>

              {/* Controls */}
              <div className="flex-1 space-y-2">
                <p className="text-xs font-medium text-slate-400">
                  {t('avatar')}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarLoading}
                    className="text-xs px-3 py-1.5 rounded font-medium disabled:opacity-50 bg-slate-700 text-slate-300 hover:bg-slate-600"
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
                    className="text-xs px-3 py-1.5 rounded font-medium disabled:opacity-50 bg-indigo-600/20 text-indigo-300 border border-indigo-600/40 hover:bg-indigo-600/30"
                  >
                    {avatarLoading ? `⏳ ${t('generandoAvatar')}` : `✨ ${t('generarConIA')}`}
                  </button>
                </div>
                {avatarError && (
                  <p className="text-xs text-red-400">{avatarError}</p>
                )}
                {avatarLoading && !avatarError && (
                  <p className="text-xs text-slate-500">{t('generandoAvatarDesc')}</p>
                )}
              </div>
            </div>

            {/* Owner selector */}
            <div>
              <label className="block text-xs mb-1 text-slate-400">
                {t('ownerEquipo')}
              </label>
              <select
                value={ownerUserId}
                onChange={(e) => setOwnerUserId(e.target.value)}
                disabled={usersLoading}
                className="w-full px-2 py-1.5 rounded text-sm bg-slate-900/70 text-slate-200 border border-slate-700 focus:ring-2 focus:ring-cyan-500 outline-none disabled:opacity-60"
              >
                {usersLoading && (
                  <option value="">{t('cargandoUsuarios')}</option>
                )}
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.email})
                  </option>
                ))}
                {/* Fallback: if users not yet loaded, show the current id */}
                {!usersLoading && users.length === 0 && (
                  <option value={ownerUserId}>{ownerUserId}</option>
                )}
              </select>
            </div>

            {/* Members section */}
            <div
              className="rounded-lg p-3 bg-slate-900/50 border border-slate-700"
            >
              <MembersEditor
                teamId={team.id}
                ns="admin"
                initialMembers={members}
                onSaved={(updated) => setMembers(updated)}
              />
            </div>

            {/* Submit / cancel */}
            {serverError && (
              <p className="text-xs text-red-400">{serverError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting || avatarLoading}
                className="text-xs px-3 py-1.5 rounded font-semibold disabled:opacity-50 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
              >
                {isSubmitting ? '...' : tCommon('guardar')}
              </button>
              <button
                onClick={handleCancel}
                className="text-xs px-2 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
              >
                {tCommon('cancelar')}
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  // ── View mode ─────────────────────────────────────────────────────────────
  return (
    <tr className="border-b border-slate-700/50">
      {/* Avatar */}
      <td className="px-4 py-3">
        <div
          className="w-10 h-10 rounded-md overflow-hidden flex items-center justify-center bg-slate-700"
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={`Avatar de ${team.nombre}`}
              width={40}
              height={40}
              className="object-cover w-full h-full"
              unoptimized
            />
          ) : (
            <span className="text-lg">🛡️</span>
          )}
        </div>
      </td>

      {/* Nombre + descripcion */}
      <td className="px-4 py-3">
        <span className="font-medium">{team.nombre}</span>
        {team.descripcion && (
          <p className="text-xs mt-0.5 truncate max-w-[200px] text-slate-500">
            {team.descripcion}
          </p>
        )}
      </td>

      {/* Agent ID */}
      <td className="px-4 py-3 font-mono text-xs text-slate-500">
        {team.agentId}
      </td>

      {/* Estado */}
      <td className="px-4 py-3">
        <span
          className="px-2 py-0.5 rounded-full text-xs"
          style={{ background: statusColor + '22', color: statusColor }}
        >
          {team.estado}
        </span>
      </td>

      {/* Acciones */}
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button
            onClick={openEdit}
            className="text-xs px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
            title={t('editarEquipo')}
          >
            ✎
          </button>
          <DeleteTeamButton
            teamId={team.id}
            teamName={team.nombre}
            onDeleted={onDeleted}
          />
        </div>
      </td>
    </tr>
  );
}
