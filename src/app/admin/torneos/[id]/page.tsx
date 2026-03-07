// /admin/torneos/[id] — Tournament detail and management
'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import type { TournamentDetailResponse } from '@/types/api';
import { TournamentStatusBadge, FormatBadge } from '@/components/admin/TournamentStatusBadge';
import { TournamentTeamsSection }     from '@/components/admin/TournamentTeamsSection';
import { TournamentRoundsSection }    from '@/components/admin/TournamentRoundsSection';
import { TournamentStandingsSection } from '@/components/admin/TournamentStandingsSection';

type Tab = 'teams' | 'rounds' | 'standings';

export default function AdminTorneoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations('admin');

  const [tournament, setTournament] = useState<TournamentDetailResponse | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [pageError,  setPageError]  = useState<string | null>(null);
  const [actionError,setActionError]= useState<string | null>(null);
  const [acting,     setActing]     = useState(false);
  const [activeTab,  setActiveTab]  = useState<Tab>('teams');
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<TournamentDetailResponse>(`/tournaments/${id}`);
      setTournament(data);
      setPageError(null);
    } catch {
      setPageError(t('torneoErrorCargar'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { void load(); }, [load]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    void load();
  }, [load]);

  const handleAction = async (
    action: 'start' | 'finish' | 'delete',
    confirmMsg?: string,
  ) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/tournaments/${id}/${action}`, { method: 'POST' });
      if (action === 'delete') {
        window.location.href = '/admin/torneos';
        return;
      }
      handleRefresh();
    } catch {
      setActionError(
        action === 'start'  ? t('torneoErrorIniciar')   :
        action === 'finish' ? t('torneoErrorFinalizar') :
                              t('torneoErrorCargar'),
      );
    } finally {
      setActing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar este torneo? Esta acción no se puede deshacer.')) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/tournaments/${id}`, { method: 'DELETE' });
      window.location.href = '/admin/torneos';
    } catch {
      setActionError(t('torneoErrorCargar'));
      setActing(false);
    }
  };

  // ── Loading / error states ───────────────────────────────────────────────
  if (loading && !tournament) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-slate-200">
        <p className="text-sm text-slate-500">{t('torneoCargando')}</p>
      </div>
    );
  }

  if (pageError && !tournament) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-slate-200">
        <p className="text-sm text-red-400">{pageError}</p>
        <Link href="/admin/torneos" className="text-sm text-cyan-400 hover:underline mt-2 inline-block">
          ← {t('gestionTorneos')}
        </Link>
      </div>
    );
  }

  if (!tournament) return null;

  const TAB_LABELS: Record<Tab, string> = {
    teams:      t('torneoEquipos'),
    rounds:     t('torneoRondas'),
    standings:  t('torneoClasificacion'),
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-slate-200">

      {/* Back link */}
      <Link
        href="/admin/torneos"
        className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        ← {t('gestionTorneos')}
      </Link>

      {/* Header */}
      <header className="rounded-xl p-5 bg-slate-800 border border-slate-700 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">{tournament.name}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <FormatBadge format={tournament.format} />
              <TournamentStatusBadge status={tournament.status} />
              <span className="text-xs text-slate-500">
                {tournament.teams.length} equipos · {tournament.rounds.length} rondas
              </span>
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {tournament.status === 'draft' && (
              <>
                <button
                  onClick={() => handleAction('start')}
                  disabled={acting || tournament.teams.length < 2}
                  title={tournament.teams.length < 2 ? 'Se necesitan al menos 2 equipos' : undefined}
                  className="px-4 py-2 rounded-md text-sm font-semibold bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
                >
                  {acting ? '…' : t('torneoIniciar')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={acting}
                  className="px-4 py-2 rounded-md text-sm font-semibold bg-slate-700 text-red-400 hover:bg-red-900/30 disabled:opacity-50 transition-colors"
                >
                  {t('torneoEliminar')}
                </button>
              </>
            )}

            {tournament.status === 'active' && (
              <button
                onClick={() => handleAction('finish', '¿Finalizar el torneo? Esta acción marca al ganador actual.')}
                disabled={acting}
                className="px-4 py-2 rounded-md text-sm font-semibold bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
              >
                {acting ? '…' : t('torneoFinalizar')}
              </button>
            )}
          </div>
        </div>

        {/* Action error */}
        {actionError && (
          <p className="text-sm text-red-400">{actionError}</p>
        )}
      </header>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-700 -mb-2">
        {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-md ${
              activeTab === tab
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-800/40'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab contents */}
      <div className="space-y-0">
        {activeTab === 'teams' && (
          <TournamentTeamsSection
            tournamentId={id}
            status={tournament.status}
            teams={tournament.teams}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'rounds' && (
          <TournamentRoundsSection
            tournamentId={id}
            tournamentStatus={tournament.status}
            rounds={tournament.rounds}
            refreshKey={refreshKey}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'standings' && (
          <TournamentStandingsSection
            tournamentId={id}
            refreshKey={refreshKey}
          />
        )}
      </div>
    </div>
  );
}
