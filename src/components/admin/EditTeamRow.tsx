'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UpdateTeamSchema, type UpdateTeamInput } from '@/lib/schemas/team';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import type { TeamResponse } from '@/types/api';
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

  const onSubmit = async (data: UpdateTeamInput) => {
    setServerError(null);
    try {
      const updated = await apiFetch<TeamResponse>(`/teams/${team.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...data,
          descripcion: data.descripcion || null,
          avatarUrl,
        }),
      });
      onUpdated({ ...updated, avatarUrl });
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
      <tr style={{ borderBottom: '1px solid #1e293b' }}>
        <td colSpan={5} className="px-4 py-4">
          <div className="space-y-4">

            {/* nombre + agentId */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#94a3b8' }}>
                  {t('nombreEquipo')}
                </label>
                <input
                  {...register('nombre')}
                  className="w-full px-2 py-1.5 rounded text-sm"
                  style={{ background: '#0a0a0f', color: '#f1f5f9', border: '1px solid #64748b' }}
                />
                {errors.nombre && (
                  <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>
                    {errors.nombre.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#94a3b8' }}>
                  Agent ID
                </label>
                <input
                  {...register('agentId')}
                  className="w-full px-2 py-1.5 rounded text-sm font-mono"
                  style={{ background: '#0a0a0f', color: '#f1f5f9', border: '1px solid #64748b' }}
                />
                {errors.agentId && (
                  <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>
                    {errors.agentId.message}
                  </p>
                )}
              </div>
            </div>

            {/* descripcion */}
            <div>
              <label className="block text-xs mb-1" style={{ color: '#94a3b8' }}>
                {t('descripcionEquipo')}
              </label>
              <textarea
                {...register('descripcion')}
                rows={2}
                className="w-full px-2 py-1.5 rounded text-sm resize-none"
                style={{ background: '#0a0a0f', color: '#f1f5f9', border: '1px solid #64748b' }}
                placeholder={t('descripcionPlaceholder')}
              />
              {errors.descripcion && (
                <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>
                  {errors.descripcion.message}
                </p>
              )}
            </div>

            {/* Avatar section */}
            <div
              className="rounded-lg p-3 flex items-start gap-4"
              style={{ background: '#0f172a', border: '1px solid #334155' }}
            >
              {/* Thumbnail */}
              <div
                className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden flex items-center justify-center"
                style={{ background: '#1e293b' }}
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
                <p className="text-xs font-medium" style={{ color: '#94a3b8' }}>
                  {t('avatar')}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarLoading}
                    className="text-xs px-3 py-1.5 rounded font-medium disabled:opacity-50"
                    style={{ background: '#334155', color: '#e2e8f0' }}
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
                    className="text-xs px-3 py-1.5 rounded font-medium disabled:opacity-50"
                    style={{ background: '#7c3aed22', color: '#a78bfa', border: '1px solid #7c3aed55' }}
                  >
                    {avatarLoading ? `⏳ ${t('generandoAvatar')}` : `✨ ${t('generarConIA')}`}
                  </button>
                </div>
                {avatarError && (
                  <p className="text-xs" style={{ color: '#ef4444' }}>{avatarError}</p>
                )}
                {avatarLoading && !avatarError && (
                  <p className="text-xs" style={{ color: '#64748b' }}>{t('generandoAvatarDesc')}</p>
                )}
              </div>
            </div>

            {/* Members section */}
            <div
              className="rounded-lg p-3"
              style={{ background: '#0f172a', border: '1px solid #334155' }}
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
              <p className="text-xs" style={{ color: '#ef4444' }}>{serverError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting || avatarLoading}
                className="text-xs px-3 py-1.5 rounded font-semibold disabled:opacity-50"
                style={{ background: '#22c55e22', color: '#22c55e' }}
              >
                {isSubmitting ? '...' : tCommon('guardar')}
              </button>
              <button
                onClick={handleCancel}
                className="text-xs px-2 py-1.5 rounded"
                style={{ background: '#334155', color: '#94a3b8' }}
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
    <tr style={{ borderBottom: '1px solid #1e293b' }}>
      {/* Avatar */}
      <td className="px-4 py-3">
        <div
          className="w-10 h-10 rounded-md overflow-hidden flex items-center justify-center"
          style={{ background: '#1e293b' }}
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
          <p className="text-xs mt-0.5 truncate max-w-[200px]" style={{ color: '#64748b' }}>
            {team.descripcion}
          </p>
        )}
      </td>

      {/* Agent ID */}
      <td className="px-4 py-3 font-mono text-xs" style={{ color: '#64748b' }}>
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
            onClick={() => setEditing(true)}
            className="text-xs px-2 py-1 rounded"
            style={{ color: '#f59e0b', background: '#f59e0b22' }}
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

