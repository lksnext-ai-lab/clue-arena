'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useInterval } from '@/lib/utils/useInterval';
import { apiFetch } from '@/lib/api/client';
import { useAppSession } from '@/contexts/SessionContext';
import { useTranslations } from 'next-intl';
import type { GameResponse, TeamResponse } from '@/types/api';
import { MembersEditor } from '@/components/team/MembersEditor';

/**
 * UI-003 — Panel de equipo
 * Shows current team info and active games. Polls every 30s.
 */
export default function EquipoPage() {
  const { user, equipo, isLoading } = useAppSession();
  const [games, setGames] = useState<GameResponse[]>([]);
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const t = useTranslations('equipo');
  const tCommon = useTranslations('common');

  const fetchData = async () => {
    try {
      const [gamesData, teamsData] = await Promise.all([
        apiFetch<{ games: GameResponse[] }>('/games?estado=en_curso'),
        equipo ? apiFetch<TeamResponse>(`/teams/${equipo.id}`) : Promise.resolve(null),
      ]);
      setGames(gamesData.games);
      setTeam(teamsData);
    } catch {
      setFetchError(t('registroError'));
    }
  };

  useEffect(() => {
    if (!isLoading) fetchData();
  }, [isLoading]);

  useInterval(fetchData, 30_000);

  if (isLoading) {
    return <LoadingState loadingText={tCommon('cargando')} />;
  }

  if (!equipo) {
    return <NoTeamState userName={user?.name} label={t('sinEquipo', { nombre: user?.name ?? '' })} registerLabel={t('registrarEquipo')} />;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" style={{ color: '#f1f5f9' }}>
      <header>
        <h1 className="text-3xl font-bold" style={{ color: '#f59e0b' }}>
          {t('panelTitulo')}
        </h1>
        <p className="text-sm mt-1" style={{ color: '#64748b' }}>
          {user?.name} · {equipo.nombre}
        </p>
      </header>

      {fetchError && (
        <div className="px-4 py-3 rounded-md text-sm" style={{ background: '#7f1d1d', color: '#fca5a5' }}>
          {fetchError}
        </div>
      )}

      <section
        className="rounded-xl p-6"
        style={{ background: '#1a1a2e' }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: '#f59e0b' }}>
          {t('tuEquipo')}
        </h2>

        {/* Avatar */}
        {team?.avatarUrl && (
          <div className="flex justify-center mb-4">
            <div className="w-24 h-24 rounded-xl overflow-hidden" style={{ border: '2px solid #f59e0b55' }}>
              <Image
                src={team.avatarUrl}
                alt={`Avatar de ${equipo.nombre}`}
                width={96}
                height={96}
                className="object-cover w-full h-full"
                unoptimized
              />
            </div>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt style={{ color: '#64748b' }}>{t('nombreLabel')}</dt>
            <dd className="font-medium">{equipo.nombre}</dd>
          </div>
          <div>
            <dt style={{ color: '#64748b' }}>{t('agentIdLabel')}</dt>
            <dd className="font-mono text-xs">{equipo.agentId}</dd>
          </div>
          {team?.estado && (
            <div>
              <dt style={{ color: '#64748b' }}>{t('estadoLabel')}</dt>
              <dd>
                <TeamStatusBadge estado={team.estado} />
              </dd>
            </div>
          )}
          {team?.descripcion && (
            <div className="col-span-2">
              <dt style={{ color: '#64748b' }}>{t('descripcionLabel')}</dt>
              <dd className="text-sm mt-1" style={{ color: '#cbd5e1' }}>{team.descripcion}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Miembros del equipo */}
      {equipo && team && (
        <section
          className="rounded-xl p-6"
          style={{ background: '#1a1a2e' }}
        >
          <MembersEditor
            key={equipo.id}
            teamId={equipo.id}
            ns="equipo"
            initialMembers={team.miembros ?? []}
          />
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3" style={{ color: '#f59e0b' }}>
          {t('partidasEnCurso')}
        </h2>
        {games.length === 0 ? (
          <p className="text-sm" style={{ color: '#64748b' }}>
            {t('sinPartidas')}
          </p>
        ) : (
          <ul className="space-y-3">
            {games.map((game) => (
              <li
                key={game.id}
                className="rounded-xl p-4 flex items-center justify-between"
                style={{ background: '#1a1a2e' }}
              >
                <div>
                  <p className="font-medium">{game.nombre}</p>
                  <p className="text-xs mt-1" style={{ color: '#64748b' }}>
                    {t('turnoEquipos', { turno: game.turnoActual, n: game.equipos.length })}
                  </p>
                </div>
                <a
                  href={`/partidas/${game.id}`}
                  className="text-xs px-3 py-1 rounded-md"
                  style={{ background: '#f59e0b', color: '#0a0a0f' }}
                >
                  {t('verPartida')}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LoadingState({ loadingText }: { loadingText: string }) {
  return (
    <div className="p-6" style={{ color: '#64748b' }}>
      <p>{loadingText}</p>
    </div>
  );
}

function NoTeamState({ userName, label, registerLabel }: { userName?: string; label: string; registerLabel: string }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center" style={{ minHeight: 300 }}>
      <div className="text-center space-y-4">
        <p style={{ color: '#f1f5f9' }}>
          {label}
        </p>
        <a
          href="/equipo/registro"
          className="inline-block px-6 py-2 rounded-md font-semibold text-sm"
          style={{ background: '#f59e0b', color: '#0a0a0f' }}
        >
          {registerLabel}
        </a>
      </div>
    </div>
  );
}

const statusColors: Record<string, { bg: string; text: string }> = {
  registrado: { bg: '#64748b22', text: '#94a3b8' },
  activo:     { bg: '#22c55e22', text: '#22c55e' },
  finalizado: { bg: '#f59e0b22', text: '#f59e0b' },
};

function TeamStatusBadge({ estado }: { estado: string }) {
  const colors = statusColors[estado] ?? statusColors.registrado;
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: colors.bg, color: colors.text }}
    >
      {estado}
    </span>
  );
}
