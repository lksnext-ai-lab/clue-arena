'use client';

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { Bot, Filter, Search, ShieldPlus, Sparkles, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import type { DeleteTeamResponse, TeamResponse } from '@/types/api';
import { EditTeamRow } from './EditTeamRow';
import { CreateTeamForm } from './CreateTeamForm';
import { AdminEditTeamPanel } from './AdminEditTeamPanel';
import { cn } from '@/lib/utils/cn';

const STATUS_COLORS: Record<string, string> = {
  activo: '#22c55e',
  inactivo: '#f59e0b',
};

/**
 * UI-006 — Sección de gestión de equipos en el Panel Admin.
 * Carga equipos via GET /api/teams y usa un panel de edición desacoplado.
 */
export function AdminTeamsSection({ initialTeams }: { initialTeams?: TeamResponse[] }) {
  const t = useTranslations('admin');
  const hasInitialTeams = initialTeams !== undefined;
  const [teams, setTeams] = useState<TeamResponse[]>(initialTeams ?? []);
  const [isLoading, setIsLoading] = useState(!hasInitialTeams);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const loadTeams = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const data = await apiFetch<{ teams: TeamResponse[] }>('/teams');
      setTeams(data.teams);
      setFetchError(null);
    } catch {
      setFetchError(t('errorCargaEquipos'));
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadTeams({ silent: hasInitialTeams });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInitialTeams]);

  useEffect(() => {
    if (initialTeams === undefined) return;
    setTeams(initialTeams);
    setIsLoading(false);
  }, [initialTeams]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredTeams = teams.filter((team) => {
    if (!normalizedQuery) return true;
    return [
      team.nombre,
      team.id,
      team.agentId,
      team.appId ?? '',
      team.usuarioId,
      ...(team.miembros ?? []),
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  });

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;
  const mattinTeams = teams.filter((team) => team.agentBackend === 'mattin').length;
  const localTeams = teams.length - mattinTeams;
  const teamsWithMembers = teams.filter((team) => team.miembros.length > 0).length;

  const handleUpdated = (updated: TeamResponse) => {
    setTeams((prev) => prev.map((team) => (team.id === updated.id ? updated : team)));
  };

  const handleDeleted = (id: string, result?: DeleteTeamResponse) => {
    if (result?.archived && result.team) {
      setTeams((prev) => prev.map((team) => (team.id === id ? result.team! : team)));
      return;
    }

    setTeams((prev) => {
      const nextTeams = prev.filter((team) => team.id !== id);
      setSelectedTeamId((current) => (current === id ? null : current));
      return nextTeams;
    });
  };

  const handleCreated = (team: TeamResponse) => {
    setTeams((prev) => [team, ...prev]);
    setShowCreateForm(false);
  };

  if (isLoading) {
    return (
      <section className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(7,11,22,0.86))]"
            />
          ))}
        </div>
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(7,11,22,0.94))] p-6">
          <p className="text-sm text-slate-400">{t('cargandoEquipos')}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<Users size={18} />} label={t('teamsMetricTotal')} value={String(teams.length)} accent="#38bdf8" />
        <MetricCard
          icon={<Bot size={18} />}
          label={t('teamsMetricMattin')}
          value={String(mattinTeams)}
          accent="#34d399"
          detail={t('teamsMetricMattinDetail', { count: localTeams })}
        />
        <MetricCard
          icon={<Sparkles size={18} />}
          label={t('teamsMetricMembers')}
          value={String(teamsWithMembers)}
          accent="#fbbf24"
          detail={t('teamsMetricLocalDetail', { count: localTeams })}
        />
      </div>

      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,17,29,0.94),rgba(15,23,42,0.9))] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.28)] sm:p-6">
        <div className="absolute -left-10 top-0 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-28 w-28 rounded-full bg-amber-300/10 blur-3xl" />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              {t('gestionEquiposSectionEyebrow')}
            </p>
            <h2 className="text-2xl font-semibold text-white">
              {t('equipos', { n: teams.length })}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-400">
              {t('gestionEquiposDesc')}
            </p>
          </div>

          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="relative inline-flex items-center justify-center gap-2 rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-amber-200"
            >
              <ShieldPlus size={16} />
              {t('crearEquipo')}
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row">
          <label className="flex flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
            <Search size={16} className="text-cyan-300" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('buscarEquipoPlaceholder')}
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>

          <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
            <Filter size={16} />
            {normalizedQuery ? t('resultadosFiltrados', { count: filteredTeams.length }) : t('sinFiltroActivo')}
          </div>
        </div>
      </div>

      {showCreateForm ? <CreateTeamForm onCreated={handleCreated} onCancel={() => setShowCreateForm(false)} /> : null}

      {fetchError ? (
        <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {fetchError}
        </div>
      ) : null}

      {teams.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-white/12 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(7,11,22,0.94))] px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-300">
            <Users size={24} />
          </div>
          <h3 className="mt-4 text-xl font-semibold text-white">
            {t('equiposSinRegistrar')}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
            {t('equiposEmptyDesc')}
          </p>
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(7,11,22,0.94))] px-6 py-10 text-center">
          <p className="text-base font-semibold text-white">
            {t('sinResultadosBusqueda')}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {t('sinResultadosBusquedaDesc')}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredTeams.map((team) => (
            <EditTeamRow
              key={team.id}
              team={team}
              statusColors={STATUS_COLORS}
              isSelected={selectedTeamId === team.id}
              onSelect={() => setSelectedTeamId(team.id)}
              onDeleted={(result) => handleDeleted(team.id, result)}
            />
          ))}
        </div>
      )}

      {selectedTeam ? (
        <AdminEditTeamPanel
          team={selectedTeam}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          onClose={() => setSelectedTeamId(null)}
        />
      ) : null}
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  accent,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent: string;
  detail?: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(7,11,22,0.94))] p-5">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-2xl border',
            'border-white/10 bg-black/15'
          )}
          style={{ background: `${accent}1f`, color: accent }}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {value}
          </p>
        </div>
      </div>
      {detail ? (
        <p className="mt-3 text-sm text-slate-400">
          {detail}
        </p>
      ) : null}
    </div>
  );
}
