'use client';

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { Bot, Filter, Search, ShieldPlus, Sparkles, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import type { TeamResponse } from '@/types/api';
import { EditTeamRow } from './EditTeamRow';
import { CreateTeamForm } from './CreateTeamForm';

const STATUS_COLORS: Record<string, string> = {
  registrado: '#64748b',
  activo: '#22c55e',
  finalizado: '#f59e0b',
};

/**
 * UI-006 — Sección de gestión de equipos en el Panel Admin.
 * Carga equipos via GET /api/teams y permite edición inline y eliminación.
 */
export function AdminTeamsSection() {
  const t = useTranslations('admin');
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [query, setQuery] = useState('');

  const loadTeams = async () => {
    try {
      const data = await apiFetch<{ teams: TeamResponse[] }>('/teams');
      setTeams(data.teams);
      setFetchError(null);
    } catch {
      setFetchError(t('errorCargaEquipos'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const mattinTeams = teams.filter((team) => team.agentBackend === 'mattin').length;
  const localTeams = teams.length - mattinTeams;
  const teamsWithMembers = teams.filter((team) => team.miembros.length > 0).length;

  const handleUpdated = (updated: TeamResponse) => {
    setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleDeleted = (id: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== id));
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
              className="h-28 animate-pulse rounded-[26px] border"
              style={{ borderColor: 'rgba(148, 163, 184, 0.12)', background: 'rgba(9, 17, 31, 0.72)' }}
            />
          ))}
        </div>
        <div
          className="rounded-[28px] border p-6"
          style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(9, 17, 31, 0.84)' }}
        >
          <p className="text-sm" style={{ color: '#94a3b8' }}>{t('cargandoEquipos')}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={<Users size={18} />}
          label={t('teamsMetricTotal')}
          value={String(teams.length)}
          accent="#38bdf8"
        />
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

      <div
        className="rounded-[28px] border p-5 sm:p-6"
        style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(9, 17, 31, 0.84)' }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: '#94a3b8' }}>
              {t('gestionEquiposSectionEyebrow')}
            </p>
            <h2 className="text-2xl font-semibold" style={{ color: '#f8fafc' }}>
              {t('equipos', { n: teams.length })}
            </h2>
            <p className="max-w-2xl text-sm leading-6" style={{ color: '#94a3b8' }}>
              {t('gestionEquiposDesc')}
            </p>
          </div>

          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
              style={{ background: '#f59e0b', color: '#111827', boxShadow: '0 14px 30px rgba(245,158,11,0.18)' }}
            >
              <ShieldPlus size={16} />
              {t('crearEquipo')}
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row">
          <label
            className="flex flex-1 items-center gap-3 rounded-2xl border px-4 py-3"
            style={{ borderColor: 'rgba(148, 163, 184, 0.18)', background: 'rgba(15, 23, 42, 0.72)' }}
          >
            <Search size={16} style={{ color: '#7dd3fc' }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('buscarEquipoPlaceholder')}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
              style={{ color: '#f8fafc' }}
            />
          </label>

          <div
            className="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm"
            style={{ borderColor: 'rgba(148, 163, 184, 0.18)', background: 'rgba(15, 23, 42, 0.72)', color: '#94a3b8' }}
          >
            <Filter size={16} />
            {normalizedQuery ? t('resultadosFiltrados', { count: filteredTeams.length }) : t('sinFiltroActivo')}
          </div>
        </div>
      </div>

      {showCreateForm && (
        <CreateTeamForm
          onCreated={handleCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {fetchError && (
        <div
          className="rounded-2xl border px-4 py-3 text-sm"
          style={{ borderColor: 'rgba(248,113,113,0.28)', background: 'rgba(127,29,29,0.28)', color: '#fecaca' }}
        >
          {fetchError}
        </div>
      )}

      {teams.length === 0 ? (
        <div
          className="rounded-[28px] border px-6 py-12 text-center"
          style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(9, 17, 31, 0.84)' }}
        >
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}
          >
            <Users size={24} />
          </div>
          <h3 className="mt-4 text-xl font-semibold" style={{ color: '#f8fafc' }}>
            {t('equiposSinRegistrar')}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6" style={{ color: '#94a3b8' }}>
            {t('equiposEmptyDesc')}
          </p>
        </div>
      ) : filteredTeams.length === 0 ? (
        <div
          className="rounded-[28px] border px-6 py-10 text-center"
          style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(9, 17, 31, 0.84)' }}
        >
          <p className="text-base font-semibold" style={{ color: '#f8fafc' }}>
            {t('sinResultadosBusqueda')}
          </p>
          <p className="mt-2 text-sm" style={{ color: '#94a3b8' }}>
            {t('sinResultadosBusquedaDesc')}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {filteredTeams.map((team) => (
            <EditTeamRow
              key={team.id}
              team={team}
              statusColors={STATUS_COLORS}
              onUpdated={handleUpdated}
              onDeleted={() => handleDeleted(team.id)}
            />
          ))}
        </div>
      )}
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
    <div
      className="rounded-[26px] border p-5"
      style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(9, 17, 31, 0.84)' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ background: `${accent}1f`, color: accent }}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: '#94a3b8' }}>
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold" style={{ color: '#f8fafc' }}>
            {value}
          </p>
        </div>
      </div>
      {detail ? (
        <p className="mt-3 text-sm" style={{ color: '#94a3b8' }}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}
