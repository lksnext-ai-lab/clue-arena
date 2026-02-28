'use client';

import { useState, useEffect } from 'react';
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
      <section>
        <h2 className="text-xl font-semibold mb-4" style={{ color: '#f59e0b' }}>
          {t('equipos', { n: '…' })}
        </h2>
        <p className="text-sm" style={{ color: '#64748b' }}>{t('cargandoEquipos')}</p>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold" style={{ color: '#f59e0b' }}>
          {t('equipos', { n: teams.length })}
        </h2>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={{ background: '#f59e0b', color: '#0a0a0f' }}
          >
            {t('crearEquipo')}
          </button>
        )}
      </div>

      {showCreateForm && (
        <CreateTeamForm
          onCreated={handleCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {fetchError && (
        <div
          className="px-4 py-3 rounded-md text-sm mb-4"
          style={{ background: '#7f1d1d', color: '#fca5a5' }}
        >
          {fetchError}
        </div>
      )}

      {teams.length === 0 ? (
        <p className="text-sm" style={{ color: '#64748b' }}>
          {t('equiposSinRegistrar')}
        </p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: '#1a1a2e' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                <th className="px-4 py-3 text-left w-12" style={{ color: '#64748b' }}>
                  {t('avatar')}
                </th>
                <th className="px-4 py-3 text-left" style={{ color: '#64748b' }}>
                  {t('nombre')}
                </th>
                <th className="px-4 py-3 text-left" style={{ color: '#64748b' }}>
                  {t('agentId')}
                </th>
                <th className="px-4 py-3 text-left" style={{ color: '#64748b' }}>
                  {t('estado')}
                </th>
                <th className="px-4 py-3 text-left" style={{ color: '#64748b' }}>
                  {t('acciones')}
                </th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <EditTeamRow
                  key={team.id}
                  team={team}
                  statusColors={STATUS_COLORS}
                  onUpdated={handleUpdated}
                  onDeleted={() => handleDeleted(team.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
