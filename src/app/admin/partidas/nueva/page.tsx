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
 *
 * Flujo:
 *  1. Carga equipos via GET /api/teams.
 *  2. Admin escribe nombre + selecciona 2–6 equipos.
 *  3. Equipos sin agent_id muestran badge "Sin agente".
 *  4. Submit → POST /api/games → redirige a UI-008.
 */
export default function NuevaPartidaPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateGameInput>({
    resolver: zodResolver(CreateGameSchema),
    defaultValues: { nombre: '', equipoIds: [] },
  });

  useEffect(() => {
    apiFetch<{ teams: TeamResponse[] }>('/teams')
      .then((data) => setTeams(data.teams))
      .catch(() => setServerError('Error al cargar los equipos. Recarga la página.'))
      .finally(() => setLoadingTeams(false));
  }, []);

  const toggleTeam = (id: string) => {
    setSelectedTeams((prev) => {
      let next: string[];
      if (prev.includes(id)) next = prev.filter((t) => t !== id);
      else if (prev.length >= 6) next = prev; // max 6
      else next = [...prev, id];
      setValue('equipoIds', next, { shouldValidate: true });
      return next;
    });
  };

  const onSubmit = async (data: CreateGameInput) => {
    if (selectedTeams.length < 2) {
      setServerError('Selecciona al menos 2 equipos para la partida.');
      return;
    }
    setServerError(null);
    try {
      const game = await apiFetch<GameResponse>('/games', {
        method: 'POST',
        body: JSON.stringify({ ...data, equipoIds: selectedTeams }),
      });
      router.push(`/admin/partidas/${game.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear la partida';
      setServerError(msg);
    }
  };

  const canSubmit = !isSubmitting && selectedTeams.length >= 2;
  const teamsWithoutAgent = selectedTeams.filter(
    (id) => !teams.find((t) => t.id === id)?.agentId
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6" style={{ color: '#f1f5f9' }}>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.push('/admin')}
          className="text-sm"
          style={{ color: '#64748b' }}
        >
          ← Panel admin
        </button>
        <h1 className="text-2xl font-bold" style={{ color: '#f59e0b' }}>
          Nueva Partida
        </h1>
      </div>

      {serverError && (
        <div
          className="px-4 py-3 rounded-md text-sm"
          style={{ background: '#7f1d1d', color: '#fca5a5' }}
        >
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium mb-1">Nombre de la partida</label>
          <input
            {...register('nombre')}
            className="w-full px-3 py-2 rounded-md text-sm"
            style={{ background: '#1a1a2e', color: '#f1f5f9', border: '1px solid #334155' }}
            placeholder="Ej: Ronda 1"
            autoFocus
          />
          {errors.nombre && (
            <p className="text-xs mt-1" style={{ color: '#ef4444' }}>
              {errors.nombre.message}
            </p>
          )}
        </div>

        {/* Equipos */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <label className="text-sm font-medium">
              Equipos participantes
            </label>
            <span
              className="text-xs"
              style={{
                color: selectedTeams.length >= 2 ? '#22c55e' : '#64748b',
              }}
            >
              {selectedTeams.length} / 6 seleccionados
            </span>
          </div>

          {loadingTeams ? (
            // Skeleton
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded-md animate-pulse"
                  style={{ background: '#1e293b' }}
                />
              ))}
            </div>
          ) : teams.length === 0 ? (
            <div
              className="rounded-md px-4 py-6 text-center text-sm"
              style={{ background: '#1a1a2e', color: '#64748b' }}
            >
              No hay equipos registrados.{' '}
              <button
                type="button"
                className="underline"
                style={{ color: '#f59e0b' }}
                onClick={() => router.push('/admin')}
              >
                Crear un equipo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {teams.map((team) => {
                const selected = selectedTeams.includes(team.id);
                const noAgent = !team.agentId;
                const disabledByMax = !selected && selectedTeams.length >= 6;

                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => toggleTeam(team.id)}
                    disabled={disabledByMax}
                    className="px-3 py-2 rounded-md text-sm text-left transition-colors disabled:opacity-40"
                    style={{
                      background: selected ? '#f59e0b22' : '#1a1a2e',
                      border: `1px solid ${
                        selected ? '#f59e0b' : noAgent ? '#78350f55' : '#334155'
                      }`,
                      color: selected ? '#f59e0b' : '#f1f5f9',
                    }}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate">{team.nombre}</span>
                      {noAgent && (
                        <span
                          className="shrink-0 text-xs px-1.5 py-0.5 rounded"
                          style={{ background: '#78350f', color: '#fbbf24' }}
                        >
                          Sin agente
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Advisory: teams selected without agent */}
          {teamsWithoutAgent.length > 0 && (
            <p className="text-xs mt-2" style={{ color: '#fbbf24' }}>
              ⚠️ {teamsWithoutAgent.length} equipo(s) seleccionado(s) sin agente configurado. La partida se puede crear, pero los turnos de esos equipos fallarán.
            </p>
          )}

          {/* Validation hint */}
          {selectedTeams.length < 2 && !loadingTeams && teams.length > 0 && (
            <p className="text-xs mt-2" style={{ color: '#64748b' }}>
              Mínimo 2 equipos necesarios para iniciar.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 items-center pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-6 py-2 rounded-md font-semibold text-sm disabled:opacity-40 transition-opacity"
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
