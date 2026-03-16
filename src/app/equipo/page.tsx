'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Orbit,
  PencilLine,
  ShieldPlus,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react';
import { useInterval } from '@/lib/utils/useInterval';
import { apiFetch } from '@/lib/api/client';
import { useAppSession } from '@/contexts/SessionContext';
import { useTranslations } from 'next-intl';
import type { GameResponse, TeamResponse } from '@/types/api';
import { MembersEditor } from '@/components/team/MembersEditor';
import { EditTeamForm } from '@/components/team/EditTeamForm';
import { TeamPointsTimeline } from '@/components/team/TeamPointsTimeline';

/**
 * UI-003 — Panel de equipo
 * Shows current team info and active games. Polls every 30s.
 */
export default function EquipoPage() {
  const { user, equipo, isLoading } = useAppSession();
  const [games, setGames] = useState<GameResponse[]>([]);
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const t = useTranslations('equipo');
  const tCommon = useTranslations('common');

  const fetchData = useCallback(async () => {
    try {
      const [gamesData, teamData] = await Promise.all([
        apiFetch<{ games: GameResponse[] }>('/games?estado=en_curso'),
        equipo ? apiFetch<TeamResponse>(`/teams/${equipo.id}`) : Promise.resolve(null),
      ]);
      setGames(gamesData.games);
      setTeam(teamData);
      setFetchError(null);
    } catch {
      setFetchError(t('registroError'));
    }
  }, [equipo, t]);

  useEffect(() => {
    if (!isLoading) {
      void fetchData();
    }
  }, [fetchData, isLoading]);

  useInterval(fetchData, 30_000);

  if (isLoading) {
    return <LoadingState loadingText={tCommon('cargando')} />;
  }

  if (!equipo) {
    return (
      <NoTeamState
        userName={user?.name}
        label={t('sinEquipo', { nombre: user?.name ?? '' })}
        registerLabel={t('registrarEquipo')}
        eyebrow={t('sinEquipoEyebrow')}
        title={t('sinEquipoTitle')}
        description={t('sinEquipoDesc')}
        cardIdentityTitle={t('sinEquipoCardIdentityTitle')}
        cardIdentityDesc={t('sinEquipoCardIdentityDesc')}
        cardAgentTitle={t('sinEquipoCardAgentTitle')}
        cardAgentDesc={t('sinEquipoCardAgentDesc')}
        cardReadyTitle={t('sinEquipoCardReadyTitle')}
        cardReadyDesc={t('sinEquipoCardReadyDesc')}
      />
    );
  }

  const statusTone = getStatusTone(team?.estado ?? 'activo');
  const activeGame = games[0] ?? null;

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ background: 'radial-gradient(circle at top, #1f3b57 0%, #08111d 48%, #05080d 100%)' }}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <section
          className="overflow-hidden rounded-[30px] border"
          style={{
            borderColor: 'rgba(148, 163, 184, 0.18)',
            background: 'linear-gradient(145deg, rgba(9,17,31,0.98), rgba(15,23,42,0.94))',
            boxShadow: '0 32px 80px rgba(2, 6, 23, 0.5)',
          }}
        >
          <section
            className="relative overflow-hidden px-6 py-6 sm:px-8 sm:py-7"
            style={{ background: 'linear-gradient(160deg, rgba(245,158,11,0.1), rgba(34,197,94,0.06) 62%, transparent)' }}
          >
            <div
              className="absolute -left-16 top-0 h-40 w-40 rounded-full blur-3xl"
              style={{ background: 'rgba(245,158,11,0.14)' }}
            />
            <div
              className="absolute bottom-0 right-0 h-32 w-32 rounded-full blur-3xl"
              style={{ background: 'rgba(34,197,94,0.08)' }}
            />

            <div className="relative flex flex-col gap-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  {team?.avatarUrl ? (
                    <div
                      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border sm:h-20 sm:w-20"
                      style={{ borderColor: 'rgba(245,158,11,0.28)', boxShadow: '0 16px 30px rgba(245,158,11,0.14)' }}
                    >
                      <Image
                        src={team.avatarUrl}
                        alt={`Avatar de ${equipo.nombre}`}
                        fill
                        sizes="80px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl sm:h-20 sm:w-20"
                      style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24' }}
                    >
                      <ShieldPlus size={24} />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]"
                      style={{ background: 'rgba(245,158,11,0.14)', color: '#fbbf24' }}
                    >
                      <Sparkles size={14} />
                      {t('panelEyebrow')}
                    </div>
                    <p className="text-sm" style={{ color: '#93c5fd' }}>
                      {user?.name} · {t('panelWelcome')}
                    </p>
                    <h1 className="text-2xl font-semibold leading-tight sm:text-4xl" style={{ color: '#f8fafc' }}>
                      {equipo.nombre}
                    </h1>
                    <p className="max-w-3xl text-sm leading-6 sm:text-base" style={{ color: '#cbd5e1' }}>
                      {team?.descripcion?.trim() || t('panelNoDescription')}
                    </p>
                  </div>
                </div>

                <div
                  className="inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ background: statusTone.soft, color: statusTone.text }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: statusTone.text }} />
                  {t('estadoLabel')}: {team?.estado ? t(`status.${team.estado}`) : t('panelStatusUnknown')}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  icon={<Users size={16} />}
                  label={t('panelMetricMembers')}
                  value={String(team?.miembros?.length ?? 0)}
                  accent="#38bdf8"
                />
                <MetricCard
                  icon={<Swords size={16} />}
                  label={t('panelMetricGames')}
                  value={String(games.length)}
                  accent="#fbbf24"
                />
                <MetricCard
                  icon={<Bot size={16} />}
                  label={t('panelMetricBackend')}
                  value={team?.agentBackend === 'local' ? t('agentBackendLocal') : t('agentBackendMattin')}
                  accent="#34d399"
                />
              </div>

              {activeGame ? (
                <div
                  className="flex flex-col gap-3 rounded-[24px] border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{ borderColor: 'rgba(56,189,248,0.18)', background: 'rgba(8, 17, 29, 0.48)' }}
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: '#7dd3fc' }}>
                      {t('partidasEnCurso')}
                    </p>
                    <p className="mt-1 text-base font-semibold" style={{ color: '#f8fafc' }}>
                      {activeGame.nombre}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: '#94a3b8' }}>
                      {t('turnoEquipos', { turno: activeGame.turnoActual, n: activeGame.equipos.length })}
                    </p>
                  </div>
                  <Link
                    href={`/partidas/${activeGame.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
                    style={{ background: 'rgba(56,189,248,0.14)', color: '#7dd3fc' }}
                  >
                    {t('verPartida')}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              ) : null}
            </div>
          </section>
        </section>

        {fetchError && (
          <div
            className="rounded-2xl border px-4 py-3 text-sm"
            style={{ borderColor: 'rgba(248,113,113,0.28)', background: 'rgba(127,29,29,0.28)', color: '#fecaca' }}
          >
            {fetchError}
          </div>
        )}

        {saveSuccess && (
          <div
            className="rounded-2xl border px-4 py-3 text-sm"
            style={{ borderColor: 'rgba(34,197,94,0.26)', background: 'rgba(20,83,45,0.34)', color: '#bbf7d0' }}
          >
            {t('editExito')}
          </div>
        )}

        <TeamPointsTimeline teamId={equipo.id} />

        <div className="space-y-6">
          <section
            className="rounded-[28px] border p-6 sm:p-7"
            style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(9, 17, 31, 0.84)' }}
          >
            <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'rgba(148, 163, 184, 0.14)' }}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: '#94a3b8' }}>
                  {t('panelConfigEyebrow')}
                </p>
                <h2 className="mt-2 text-2xl font-semibold" style={{ color: '#f8fafc' }}>
                  {t('tuEquipo')}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: '#94a3b8' }}>
                  {isEditing ? t('panelEditIntro') : t('panelOverviewIntro')}
                </p>
              </div>

              {!isEditing && team && (
                <button
                  type="button"
                  onClick={() => {
                    setSaveSuccess(false);
                    setIsEditing(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
                  style={{ background: '#f59e0b', color: '#111827', boxShadow: '0 14px 30px rgba(245,158,11,0.22)' }}
                >
                  <PencilLine size={16} />
                  {t('editEditar')}
                </button>
              )}
            </div>

            {isEditing && team ? (
              <div className="pt-6">
                <EditTeamForm
                  team={team}
                  onPreviewChange={(changes) => {
                    setTeam((prev) => (prev ? { ...prev, ...changes } : prev));
                  }}
                  onSaved={(updated) => {
                    setTeam(updated);
                    setIsEditing(false);
                    setSaveSuccess(true);
                  }}
                  onCancel={() => setIsEditing(false)}
                />
              </div>
            ) : (
              <div className="grid gap-4 pt-6 lg:grid-cols-2">
                <InfoPanel
                  icon={<Sparkles size={16} />}
                  title={t('panelIdentityTitle')}
                  description={t('panelIdentityCardDesc')}
                >
                  <div className="space-y-3">
                    <IdentityPill label={t('nombreLabel')} value={equipo.nombre} />
                    <IdentityPill label={t('teamIdLabel')} value={equipo.id} mono />
                  </div>
                </InfoPanel>

                <InfoPanel
                  icon={<Bot size={16} />}
                  title={t('agentSectionTitle')}
                  description={t('agentSectionDesc')}
                >
                  <div className="space-y-3">
                    <IdentityPill label={t('agentIdLabel')} value={equipo.agentId} mono />
                    <IdentityPill
                      label={t('panelBackendLabel')}
                      value={team?.agentBackend === 'local' ? t('agentBackendLocal') : t('agentBackendMattin')}
                    />
                  </div>
                </InfoPanel>

                <div className="lg:col-span-2">
                  <InfoPanel
                    icon={<Orbit size={16} />}
                    title={t('descripcionLabel')}
                    description={t('panelStoryDesc')}
                  >
                    <p className="text-sm leading-7" style={{ color: '#cbd5e1' }}>
                      {team?.descripcion?.trim() || t('panelNoDescription')}
                    </p>
                  </InfoPanel>
                </div>
              </div>
            )}
          </section>

          <section
            className="rounded-[28px] border p-6"
            style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(9, 17, 31, 0.84)' }}
          >
            <MembersEditor
              key={equipo.id}
              teamId={equipo.id}
              ns="equipo"
              initialMembers={team?.miembros ?? []}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function LoadingState({ loadingText }: { loadingText: string }) {
  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ background: 'radial-gradient(circle at top, #1f3b57 0%, #08111d 48%, #05080d 100%)' }}
    >
      <div className="mx-auto max-w-6xl">
        <div
          className="rounded-[28px] border px-6 py-10 text-sm"
          style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(9, 17, 31, 0.82)', color: '#94a3b8' }}
        >
          {loadingText}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-3xl border p-4"
      style={{ borderColor: 'rgba(148, 163, 184, 0.12)', background: 'rgba(8, 17, 29, 0.55)' }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: `${accent}20`, color: accent }}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#94a3b8' }}>
            {label}
          </p>
          <p className="mt-1 text-base font-semibold" style={{ color: '#f8fafc' }}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function IdentityPill({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{ borderColor: 'rgba(148, 163, 184, 0.12)', background: 'rgba(8, 17, 29, 0.62)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#64748b' }}>
        {label}
      </p>
      <p className={`mt-2 text-sm ${mono ? 'font-mono' : ''}`} style={{ color: '#e2e8f0' }}>
        {value}
      </p>
    </div>
  );
}

function InfoPanel({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-[24px] border p-5"
      style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(8, 17, 29, 0.55)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-base font-semibold" style={{ color: '#f8fafc' }}>
            {title}
          </h3>
          <p className="mt-1 text-sm leading-6" style={{ color: '#94a3b8' }}>
            {description}
          </p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function NoTeamState({
  userName,
  label,
  registerLabel,
  eyebrow,
  title,
  description,
  cardIdentityTitle,
  cardIdentityDesc,
  cardAgentTitle,
  cardAgentDesc,
  cardReadyTitle,
  cardReadyDesc,
}: {
  userName?: string;
  label: string;
  registerLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  cardIdentityTitle: string;
  cardIdentityDesc: string;
  cardAgentTitle: string;
  cardAgentDesc: string;
  cardReadyTitle: string;
  cardReadyDesc: string;
}) {
  return (
    <div
      className="px-4 py-8 sm:px-6 lg:px-8"
      style={{ minHeight: 'calc(100vh - 96px)', background: 'radial-gradient(circle at top, rgba(30,58,95,0.35) 0%, rgba(5,8,13,0) 55%)' }}
    >
      <div className="mx-auto max-w-5xl">
        <div
          className="overflow-hidden rounded-[28px] border"
          style={{
            borderColor: 'rgba(148, 163, 184, 0.16)',
            background: 'linear-gradient(145deg, rgba(9,17,31,0.98), rgba(15,23,42,0.94))',
            boxShadow: '0 28px 70px rgba(2, 6, 23, 0.45)',
          }}
        >
          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            <section
              className="relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10"
              style={{ background: 'linear-gradient(160deg, rgba(245,158,11,0.12), rgba(16,185,129,0.07) 58%, transparent)' }}
            >
              <div
                className="absolute -left-8 top-10 h-44 w-44 rounded-full blur-3xl"
                style={{ background: 'rgba(245, 158, 11, 0.12)' }}
              />
              <div className="relative max-w-2xl space-y-6">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]"
                  style={{ background: 'rgba(245,158,11,0.14)', color: '#fbbf24' }}
                >
                  <ShieldPlus size={14} />
                  {eyebrow}
                </div>

                <div className="space-y-3">
                  <p className="text-sm" style={{ color: '#93c5fd' }}>
                    {label}
                  </p>
                  <h1 className="max-w-xl text-3xl font-semibold leading-tight sm:text-5xl" style={{ color: '#f8fafc' }}>
                    {title}
                  </h1>
                  <p className="max-w-2xl text-base leading-7" style={{ color: '#cbd5e1' }}>
                    {description}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href="/equipo/registro"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold"
                    style={{ background: '#f59e0b', color: '#111827', boxShadow: '0 12px 30px rgba(245,158,11,0.22)' }}
                  >
                    {registerLabel}
                    <ArrowRight size={16} />
                  </Link>
                  <div
                    className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm"
                    style={{ background: 'rgba(15, 23, 42, 0.8)', color: '#93c5fd', border: '1px solid rgba(148, 163, 184, 0.18)' }}
                  >
                    <Sparkles size={16} />
                    {userName || 'Equipo'}
                  </div>
                </div>
              </div>
            </section>

            <section className="px-6 py-8 sm:px-8 sm:py-10">
              <div
                className="rounded-[24px] border p-5"
                style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(8, 17, 29, 0.54)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: '#94a3b8' }}>
                  {eyebrow}
                </p>
                <div className="mt-4 flex items-center gap-3 rounded-2xl px-4 py-4" style={{ background: 'rgba(8, 17, 29, 0.92)' }}>
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399' }}
                  >
                    <Orbit size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#f8fafc' }}>
                      {title}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: '#94a3b8' }}>
                      {registerLabel}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  <EmptyStateCard icon={<Orbit size={16} />} title={cardIdentityTitle} description={cardIdentityDesc} />
                  <EmptyStateCard icon={<ShieldPlus size={16} />} title={cardAgentTitle} description={cardAgentDesc} />
                  <EmptyStateCard icon={<Sparkles size={16} />} title={cardReadyTitle} description={cardReadyDesc} />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyStateCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(15, 23, 42, 0.64)' }}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full"
        style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}
      >
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold" style={{ color: '#f8fafc' }}>
        {title}
      </p>
      <p className="mt-1 text-sm leading-6" style={{ color: '#94a3b8' }}>
        {description}
      </p>
    </div>
  );
}

function getStatusTone(estado: string) {
  const tones: Record<string, { soft: string; text: string }> = {
    activo: { soft: 'rgba(34,197,94,0.16)', text: '#86efac' },
    inactivo: { soft: 'rgba(245,158,11,0.16)', text: '#fcd34d' },
  };
  return tones[estado] ?? tones.activo;
}
