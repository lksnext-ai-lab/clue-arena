'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UpdateTeamSchema, type UpdateTeamInput } from '@/lib/schemas/team';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import type { TeamResponse } from '@/types/api';
import { DeleteTeamButton } from './DeleteTeamButton';

interface Props {
  team: TeamResponse;
  statusColors: Record<string, string>;
  onUpdated: (updated: TeamResponse) => void;
  onDeleted: () => void;
}

/**
 * Fila de la tabla de equipos con edición inline y botón de eliminación.
 */
export function EditTeamRow({ team, statusColors, onUpdated, onDeleted }: Props) {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const [editing, setEditing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateTeamInput>({
    resolver: zodResolver(UpdateTeamSchema),
    defaultValues: { nombre: team.nombre, agentId: team.agentId },
  });

  const onSubmit = async (data: UpdateTeamInput) => {
    setServerError(null);
    try {
      const updated = await apiFetch<TeamResponse>(`/teams/${team.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      onUpdated(updated);
      setEditing(false);
    } catch (err: any) {
      let message = t('errorEditar');
      try {
        const body = JSON.parse(err?.message ?? '{}');
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
    reset({ nombre: team.nombre, agentId: team.agentId });
  };

  const statusColor = statusColors[team.estado] ?? '#64748b';

  if (editing) {
    return (
      <tr style={{ borderBottom: '1px solid #1e293b' }}>
        <td className="px-4 py-2">
          <input
            {...register('nombre')}
            className="w-full px-2 py-1 rounded text-sm"
            style={{ background: '#0a0a0f', color: '#f1f5f9', border: '1px solid #64748b' }}
          />
          {errors.nombre && (
            <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>
              {errors.nombre.message}
            </p>
          )}
          {serverError && (
            <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>
              {serverError}
            </p>
          )}
        </td>
        <td className="px-4 py-2">
          <input
            {...register('agentId')}
            className="w-full px-2 py-1 rounded text-sm font-mono"
            style={{ background: '#0a0a0f', color: '#f1f5f9', border: '1px solid #64748b' }}
          />
          {errors.agentId && (
            <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>
              {errors.agentId.message}
            </p>
          )}
        </td>
        <td className="px-4 py-2">
          <span
            className="px-2 py-0.5 rounded-full text-xs"
            style={{ background: statusColor + '22', color: statusColor }}
          >
            {team.estado}
          </span>
        </td>
        <td className="px-4 py-2">
          <div className="flex gap-2">
            <button
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className="text-xs px-2 py-1 rounded font-semibold disabled:opacity-50"
              style={{ background: '#22c55e22', color: '#22c55e' }}
            >
              {isSubmitting ? '...' : tCommon('guardar')}
            </button>
            <button
              onClick={handleCancel}
              className="text-xs px-2 py-1 rounded"
              style={{ background: '#334155', color: '#94a3b8' }}
            >
              {tCommon('cancelar')}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderBottom: '1px solid #1e293b' }}>
      <td className="px-4 py-3 font-medium">{team.nombre}</td>
      <td className="px-4 py-3 font-mono text-xs" style={{ color: '#64748b' }}>
        {team.agentId}
      </td>
      <td className="px-4 py-3">
        <span
          className="px-2 py-0.5 rounded-full text-xs"
          style={{ background: statusColor + '22', color: statusColor }}
        >
          {team.estado}
        </span>
      </td>
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

