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
    defaultValues: { nombre: '', equipoIds: [], maxTurnos: null },
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
    <div className="p-6 max-w-2xl mx-auto space-y-6 text-slate-200">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.push('/admin/partidas')}
          className="text-sm text-slate-500 hover:text-slate-300"
        >
          ← Volver a partidas
        </button>
        <h1 className="text-2xl font-bold text-cyan-400">
          Nueva Partida
        </h1>
      </div>

      {serverError && (
        <div
          className="px-4 py-3 rounded-md text-sm bg-red-900/40 text-red-300 border border-red-500/30"
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
            className="w-full px-3 py-2 rounded-md text-sm bg-slate-800 text-slate-200 border border-slate-700 focus:ring-2 focus:ring-cyan-500 outline-none"
            placeholder="Ej: Ronda 1"
            autoFocus
          />
          {errors.nombre && (
            <p className="text-xs mt-1 text-red-400">
              {errors.nombre.message}
            </p>
          )}
        </div>

        {/* Máximo de turnos */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Máximo de turnos{' '}
            <span className="text-xs font-normal text-slate-500">(opcional — deja vacío para sin límite)</span>
          </label>
          <input
            type="number"
            min={1}
            {...register('maxTurnos', {
              setValueAs: (v: string) => (v === '' || v === undefined ? null : parseInt(v, 10)),
            })}
            className="w-full px-3 py-2 rounded-md text-sm bg-slate-800 text-slate-200 border border-slate-700 focus:ring-2 focus:ring-cyan-500 outline-none"
            placeholder="Sin límite"
          />
          {errors.maxTurnos && (
            <p className="text-xs mt-1 text-red-400">
              {errors.maxTurnos.message}
            </p>
          )}
          <p className="text-xs mt-1 text-slate-600">
            Si se alcanza este número de turnos, la partida finaliza automáticamente y se penaliza a cada equipo con −3 puntos.
          </p>
        </div>

        {/* Equipos */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <label className="text-sm font-medium">
              Equipos participantes
            </label>
            <span
              className={`text-xs ${selectedTeams.length >= 2 ? 'text-emerald-400' : 'text-slate-500'}`}
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
                  className="h-10 rounded-md animate-pulse bg-slate-800"
                />
              ))}
            </div>
          ) : teams.length === 0 ? (
            <div
              className="rounded-md px-4 py-6 text-center text-sm bg-slate-800 text-slate-500"
            >
              No hay equipos registrados.{' '}
              <button
                type="button"
                className="underline text-cyan-400"
                onClick={() => router.push('/admin/equipos')}
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
                    className={`px-3 py-2 rounded-md text-sm text-left transition-colors disabled:opacity-40 ${
                      selected
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                        : noAgent
                        ? 'bg-slate-800 border-amber-800 text-slate-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    } border`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate">{team.nombre}</span>
                      {noAgent && (
                        <span
                          className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-amber-800 text-amber-300"
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
            <p className="text-xs mt-2 text-amber-400">
              ⚠️ {teamsWithoutAgent.length} equipo(s) seleccionado(s) sin agente configurado. La partida se puede crear, pero los turnos de esos equipos fallarán.
            </p>
          )}

          {/* Validation hint */}
          {selectedTeams.length < 2 && !loadingTeams && teams.length > 0 && (
            <p className="text-xs mt-2 text-slate-500">
              Mínimo 2 equipos necesarios para iniciar.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 items-center pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-6 py-2 rounded-md font-semibold text-sm disabled:opacity-40 transition-opacity bg-cyan-500 text-slate-900 hover:bg-cyan-400"
          >
            {isSubmitting ? 'Creando...' : 'Crear partida'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/partidas')}
            className="px-6 py-2 rounded-md text-sm bg-slate-700 text-slate-300 hover:bg-slate-600"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
