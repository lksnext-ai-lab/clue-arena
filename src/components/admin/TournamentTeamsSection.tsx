'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Shield, Users, UserPlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api/client';
import type { TournamentTeamResponse, TeamResponse } from '@/types/api';
import type { TournamentStatus } from '@/types/domain';

interface Props {
  tournamentId: string;
  status: TournamentStatus;
  teams: TournamentTeamResponse[];
  onRefresh: () => void;
}

export function TournamentTeamsSection({ tournamentId, status, teams, onRefresh }: Props) {
  const t = useTranslations('admin');
  const [allTeams, setAllTeams] = useState<TeamResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enrolling, setEnrolling] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEdit = status === 'draft';

  useEffect(() => {
    if (!canEdit) return;

    apiFetch<{ teams: TeamResponse[] }>('/teams')
      .then((data) => setAllTeams(data.teams))
      .catch(() => {
        // Non-blocking: the enrolled list can still be managed.
      });
  }, [canEdit]);

  const enrolledIds = useMemo(() => new Set(teams.map((team) => team.teamId)), [teams]);
  const available = useMemo(() => allTeams.filter((team) => !enrolledIds.has(team.id)), [allTeams, enrolledIds]);
  const allSelected = available.length > 0 && available.every((team) => selectedIds.has(team.id));
  const activeTeams = teams.filter((team) => !team.eliminated).length;

  const toggleTeam = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(available.map((team) => team.id)));
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
    <section className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,17,29,0.92),rgba(15,23,42,0.9))] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('torneoRosterEyebrow')}</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{t('torneoEquipos')}</h2>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-100">
              <Users size={18} />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('torneoRosterEnrolledLabel')}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{teams.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">{t('torneoRosterActiveLabel')}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{activeTeams}</p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-100">{t('torneoRosterAvailableLabel')}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{available.length}</p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-400">
            {t('torneoRosterDesc')}
          </p>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('torneoEditStatusEyebrow')}</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {canEdit ? t('torneoEditStatusOpen') : t('torneoEditStatusLocked')}
              </p>
            </div>
            <div className={`rounded-2xl border p-3 ${canEdit ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}>
              <Shield size={18} />
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('torneoEditSelectionLabel')}</p>
              <p className="mt-2 text-white">
                {selectedIds.size > 0
                  ? `${selectedIds.size} ${selectedIds.size === 1 ? t('torneoSeleccionado') : t('torneoSeleccionados')}`
                  : t('torneoNingunSeleccionado')}
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('torneoEditSeedsLabel')}</p>
              <p className="mt-2 text-white">{teams.filter((team) => team.seed !== null).length}</p>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {canEdit ? (
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(7,11,22,0.96))] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('torneoPoolEyebrow')}</p>
              <p className="mt-2 text-xl font-semibold text-white">{t('torneoEquiposDisponibles')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={available.length === 0}
                  className="accent-emerald-300"
                />
                {t('torneoSelectAll')}
              </label>
              {selectedIds.size > 0 ? (
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.08]"
                >
                  <X size={16} />
                  {t('torneoBorrarSeleccion')}
                </button>
              ) : null}
            </div>
          </div>

          {available.length === 0 ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-white/12 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
              {t('torneoSinEquiposDisponibles')}
            </div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {available.map((team) => {
                const selected = selectedIds.has(team.id);
                return (
                  <label
                    key={team.id}
                    className={`cursor-pointer rounded-[24px] border p-4 transition-all ${
                      selected
                        ? 'border-emerald-300/40 bg-emerald-300/10'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleTeam(team.id)}
                      className="sr-only"
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{team.nombre}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{team.id}</p>
                      </div>
                      <div className={`rounded-full border p-2 ${selected ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-white/10 bg-white/[0.04] text-slate-400'}`}>
                        {selected ? <Check size={16} /> : <UserPlus size={16} />}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">
              {t('torneoBulkEnrollHint')}
            </p>
            <button
              onClick={handleEnroll}
              disabled={selectedIds.size === 0 || enrolling}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UserPlus size={16} />
              {enrolling ? '…' : t('torneoInscribirSeleccionados')}
            </button>
          </div>
        </div>
      ) : null}

      {teams.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-white/12 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
          {t('torneoNoEquipos')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(7,11,22,0.96))]">
          <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-white/[0.04]">
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="px-5 py-3 text-left font-medium">{t('torneoTableTeamLabel')}</th>
                      <th className="px-5 py-3 text-center font-medium">{t('torneoSeed')}</th>
                      <th className="px-5 py-3 text-center font-medium">{t('torneoFase')}</th>
                      <th className="px-5 py-3 text-center font-medium">{t('torneoTableStatusLabel')}</th>
                      {canEdit ? <th className="px-5 py-3 text-right font-medium">{t('torneoTableActionsLabel')}</th> : null}
                    </tr>
                  </thead>
              <tbody className="divide-y divide-white/8">
                {teams.map((team) => (
                  <tr key={team.id} className="transition-colors hover:bg-white/[0.03]">
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-semibold text-white">{team.teamName}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{team.teamId}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center font-mono text-slate-300">{team.seed ?? '—'}</td>
                    <td className="px-5 py-4 text-center text-slate-300">
                      {team.groupIndex !== null ? t('torneoGrupo', { n: team.groupIndex + 1 }) : '—'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {team.eliminated ? (
                        <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-semibold text-red-200">
                          {t('torneoEliminado')}
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                          {t('torneoActivo')}
                        </span>
                      )}
                    </td>
                    {canEdit ? (
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleRemove(team.teamId)}
                          disabled={removing === team.teamId}
                          className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100 transition-colors hover:bg-red-400/20 disabled:opacity-60"
                        >
                          {removing === team.teamId ? '…' : t('torneoDesinscribir')}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
