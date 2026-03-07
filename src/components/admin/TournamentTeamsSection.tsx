// src/components/admin/TournamentTeamsSection.tsx
'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import type { TournamentTeamResponse, TeamResponse } from '@/types/api';
import type { TournamentStatus } from '@/types/domain';

interface Props {
  tournamentId: string;
  status:       TournamentStatus;
  teams:        TournamentTeamResponse[];
  onRefresh:    () => void;
}

export function TournamentTeamsSection({ tournamentId, status, teams, onRefresh }: Props) {
  const t = useTranslations('admin');
  const [allTeams, setAllTeams]       = useState<TeamResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enrolling, setEnrolling]     = useState(false);
  const [removing, setRemoving]       = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const canEdit = status === 'draft';

  useEffect(() => {
    if (!canEdit) return;
    apiFetch<{ teams: TeamResponse[] }>('/teams')
      .then((d) => setAllTeams(d.teams))
      .catch(() => {/* non-critical */});
  }, [canEdit]);

  const enrolledIds = new Set(teams.map((t) => t.teamId));
  const available   = allTeams.filter((t) => !enrolledIds.has(t.id));
  const allSelected = available.length > 0 && available.every((t) => selectedIds.has(t.id));

  const toggleTeam = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(available.map((t) => t.id)));
    }
  };

  const handleEnroll = async () => {
    if (selectedIds.size === 0) return;
    setEnrolling(true);
    setError(null);
    try {
      await apiFetch(`/tournaments/${tournamentId}/teams`, {
        method: 'POST',
        body: JSON.stringify({ teamIds: [...selectedIds] }),
      });
      setSelectedIds(new Set());
      onRefresh();
    } catch {
      setError(t('torneoErrorInscribir'));
    } finally {
      setEnrolling(false);
    }
  };

  const handleRemove = async (teamId: string) => {
    setRemoving(teamId);
    setError(null);
    try {
      await apiFetch(`/tournaments/${tournamentId}/teams/${teamId}`, { method: 'DELETE' });
      onRefresh();
    } catch {
      setError(t('torneoErrorDesinscribir'));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold text-cyan-400 mb-3">{t('torneoEquipos')}</h2>

      {error && (
        <p className="px-4 py-2 rounded-md text-sm mb-3 bg-red-900/40 text-red-300 border border-red-500/30">
          {error}
        </p>
      )}

      {/* Multi-select enroll panel (draft only) */}
      {canEdit && (
        <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
          {/* Panel header — select-all toggle + clear link */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/50 border-b border-slate-700">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                disabled={available.length === 0}
                className="accent-cyan-400 cursor-pointer"
              />
              <span className="text-sm text-slate-400">
                {t('torneoEquiposDisponibles')}
                <span className="ml-1.5 text-slate-500">({available.length})</span>
              </span>
            </label>
            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                {t('torneoBorrarSeleccion')}
              </button>
            )}
          </div>

          {/* Team checklist */}
          {available.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 italic">
              {t('torneoSinEquiposDisponibles')}
            </p>
          ) : (
            <ul className="max-h-56 overflow-y-auto divide-y divide-slate-700/40">
              {available.map((team) => (
                <li key={team.id}>
                  <label className="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none hover:bg-slate-700/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(team.id)}
                      onChange={() => toggleTeam(team.id)}
                      className="accent-cyan-400 cursor-pointer"
                    />
                    <span className="text-sm text-slate-200">{team.nombre}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {/* Enroll action footer */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/30 border-t border-slate-700">
            <span className="text-xs text-slate-500">
              {selectedIds.size > 0
                ? `${selectedIds.size} ${selectedIds.size === 1 ? t('torneoSeleccionado') : t('torneoSeleccionados')}`
                : t('torneoNingunSeleccionado')}
            </span>
            <button
              onClick={handleEnroll}
              disabled={selectedIds.size === 0 || enrolling}
              className="px-4 py-1.5 rounded-md text-sm font-medium bg-cyan-500 text-slate-900 hover:bg-cyan-400 disabled:opacity-50 transition-colors"
            >
              {enrolling ? '…' : t('torneoInscribirSeleccionados')}
            </button>
          </div>
        </div>
      )}

      {/* Enrolled teams table */}
      {teams.length === 0 ? (
        <p className="text-sm text-slate-500">{t('torneoNoEquipos')}</p>
      ) : (
        <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50">
              <tr className="border-b border-slate-700">
                <th className="px-4 py-2.5 text-left text-slate-500">Equipo</th>
                <th className="px-4 py-2.5 text-center text-slate-500">{t('torneoSeed')}</th>
                <th className="px-4 py-2.5 text-center text-slate-500">{t('torneoFase')}</th>
                <th className="px-4 py-2.5 text-center text-slate-500">Estado</th>
                {canEdit && <th className="px-4 py-2.5 text-right text-slate-500" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/70">
              {teams.map((tt) => (
                <tr key={tt.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-200">{tt.teamName}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-slate-400">
                    {tt.seed ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center text-slate-400">
                    {tt.groupIndex !== null ? t('torneoGrupo', { n: tt.groupIndex + 1 }) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {tt.eliminated ? (
                      <span className="text-xs text-red-400">{t('torneoEliminado')}</span>
                    ) : (
                      <span className="text-xs text-green-400">{t('torneoActivo')}</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleRemove(tt.teamId)}
                        disabled={removing === tt.teamId}
                        className="text-xs px-2 py-1 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                      >
                        {removing === tt.teamId ? '…' : t('torneoDesinscribir')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
