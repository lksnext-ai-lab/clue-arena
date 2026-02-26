'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateGameSchema, type CreateGameInput } from '@/lib/schemas/game';
import { apiFetch } from '@/lib/api/client';
import type { TeamResponse, GameResponse } from '@/types/api';

/**
 * UI-007 — Crear partida (Admin)
 */
export default function NuevaPartidaPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateGameInput>({
    resolver: zodResolver(CreateGameSchema),
    defaultValues: { equipoIds: [] },
  });

  useEffect(() => {
    apiFetch<{ teams: TeamResponse[] }>('/teams')
      .then((data) => setTeams(data.teams))
      .catch(() => setServerError('Error al cargar equipos'));
  }, []);

  const toggleTeam = (id: string) => {
    setSelectedTeams((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const onSubmit = async (data: CreateGameInput) => {
    if (selectedTeams.length < 2) {
      setServerError('Selecciona al menos 2 equipos');
      return;
    }
    setServerError(null);
    try {
      const game = await apiFetch<GameResponse>('/games', {
        method: 'POST',
        body: JSON.stringify({ ...data, equipoIds: selectedTeams }),
      });
      router.push(`/admin/partidas/${game.id}`);
    } catch (err: any) {
      setServerError(err?.message ?? 'Error al crear la partida');
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6" style={{ color: '#f1f5f9' }}>
      <h1 className="text-2xl font-bold" style={{ color: '#f59e0b' }}>
        Nueva Partida
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre de la partida</label>
          <input
            {...register('nombre')}
            className="w-full px-3 py-2 rounded-md text-sm"
            style={{ background: '#1a1a2e', color: '#f1f5f9', border: '1px solid #334155' }}
            placeholder="Ej: Ronda 1"
          />
          {errors.nombre && (
            <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{errors.nombre.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-3">
            Equipos participantes ({selectedTeams.length} seleccionados)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {teams.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => toggleTeam(team.id)}
                className="px-3 py-2 rounded-md text-sm text-left transition-colors"
                style={{
                  background: selectedTeams.includes(team.id) ? '#f59e0b22' : '#1a1a2e',
                  border: `1px solid ${selectedTeams.includes(team.id) ? '#f59e0b' : '#334155'}`,
                  color: selectedTeams.includes(team.id) ? '#f59e0b' : '#f1f5f9',
                }}
              >
                {team.nombre}
              </button>
            ))}
          </div>
          {teams.length === 0 && (
            <p className="text-sm" style={{ color: '#64748b' }}>No hay equipos registrados.</p>
          )}
        </div>

        {serverError && (
          <p className="text-sm" style={{ color: '#ef4444' }}>{serverError}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 rounded-md font-semibold text-sm disabled:opacity-50"
            style={{ background: '#f59e0b', color: '#0a0a0f' }}
          >
            {isSubmitting ? 'Creando...' : 'Crear partida'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin')}
            className="px-6 py-2 rounded-md text-sm"
            style={{ background: '#334155', color: '#f1f5f9' }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
