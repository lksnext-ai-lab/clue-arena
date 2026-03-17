'use client';

import { Bot, Orbit, PencilLine, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DeleteTeamResponse, TeamResponse } from '@/types/api';
import { DeleteTeamButton } from './DeleteTeamButton';
import Image from 'next/image';

interface Props {
  team: TeamResponse;
  statusColors: Record<string, string>;
  isSelected: boolean;
  onSelect: () => void;
  onDeleted: (result?: DeleteTeamResponse) => void;
}

export function EditTeamRow({ team, statusColors, isSelected, onSelect, onDeleted }: Props) {
  const t = useTranslations('admin');

  const statusColor = statusColors[team.estado] ?? '#64748b';
  const description = team.descripcion?.trim();

  return (
    <article
      className="group overflow-hidden rounded-[26px] border transition"
      style={{
        borderColor: isSelected ? 'rgba(125, 211, 252, 0.34)' : 'rgba(148, 163, 184, 0.12)',
        background: isSelected
          ? 'linear-gradient(180deg, rgba(7,18,33,0.98), rgba(9,17,31,0.96))'
          : 'linear-gradient(180deg, rgba(9,17,31,0.92), rgba(7,14,26,0.9))',
        boxShadow: isSelected ? '0 24px 48px rgba(8, 47, 73, 0.28)' : '0 18px 36px rgba(2, 6, 23, 0.18)',
      }}
    >
      <div
        className="relative overflow-hidden p-5"
        style={{
          background: `radial-gradient(circle at top right, ${statusColor}20, transparent 34%), linear-gradient(155deg, rgba(125,211,252,0.08), transparent 52%)`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)' }}
        />

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start gap-4">
              {team.avatarUrl ? (
                <div
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border"
                  style={{ borderColor: 'rgba(255,255,255,0.12)', boxShadow: '0 16px 36px rgba(15,23,42,0.28)' }}
                >
                  <Image
                    src={team.avatarUrl}
                    alt={`Avatar de ${team.nombre}`}
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border"
                  style={{
                    borderColor: 'rgba(255,255,255,0.1)',
                    background: 'linear-gradient(180deg, rgba(30,41,59,0.9), rgba(15,23,42,0.86))',
                    color: '#cbd5e1',
                  }}
                >
                  <Shield size={22} />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-semibold tracking-[-0.02em] sm:text-xl" style={{ color: '#f8fafc' }}>
                    {team.nombre}
                  </h3>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                    style={{
                      borderColor: 'rgba(125, 211, 252, 0.14)',
                      background: 'rgba(15, 23, 42, 0.72)',
                      color: '#7dd3fc',
                    }}
                  >
                    <Orbit size={11} />
                    {team.id}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                    style={{
                      borderColor: `${statusColor}33`,
                      background: `${statusColor}1a`,
                      color: statusColor,
                    }}
                  >
                    {t(`status.${team.estado}`)}
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                    style={{
                      borderColor: 'rgba(52, 211, 153, 0.16)',
                      background: 'rgba(6, 78, 59, 0.28)',
                      color: '#86efac',
                    }}
                  >
                    <Bot size={11} />
                    {team.agentBackend === 'local' ? t('agentBackendLocal') : t('agentBackendMattin')}
                  </span>
                </div>

                {description ? (
                  <p className="mt-3 line-clamp-3 max-w-2xl text-sm leading-6" style={{ color: '#cbd5e1' }}>
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onSelect}
              aria-label={t('editarEquipo')}
              title={t('editarEquipo')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border transition"
              style={{
                borderColor: isSelected ? 'rgba(251,191,36,0.24)' : 'rgba(148,163,184,0.16)',
                background: isSelected ? 'rgba(120,53,15,0.26)' : 'rgba(15,23,42,0.64)',
                color: isSelected ? '#fbbf24' : '#cbd5e1',
              }}
            >
              <PencilLine size={16} />
            </button>
            <DeleteTeamButton teamId={team.id} teamName={team.nombre} onDeleted={onDeleted} variant="icon" />
          </div>
        </div>
      </div>
    </article>
  );
}
