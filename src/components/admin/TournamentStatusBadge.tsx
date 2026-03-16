'use client';

// src/components/admin/TournamentStatusBadge.tsx
import { useTranslations } from 'next-intl';
import type { TournamentStatus, TournamentRoundPhase, TournamentRoundStatus } from '@/types/domain';

// ── Tournament status ────────────────────────────────────────────────────────

const T_COLORS: Record<TournamentStatus, { bg: string; text: string }> = {
  draft:    { bg: '#64748b22', text: '#94a3b8' },
  active:   { bg: '#22c55e22', text: '#22c55e' },
  finished: { bg: '#f59e0b22', text: '#f59e0b' },
};

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  const t = useTranslations('admin');
  const { bg, text } = T_COLORS[status];
  const labels: Record<TournamentStatus, string> = {
    draft: t('tournamentStatusDraft'),
    active: t('tournamentStatusActive'),
    finished: t('tournamentStatusFinished'),
  };
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: bg, color: text }}
    >
      {labels[status]}
    </span>
  );
}

// ── Round status ─────────────────────────────────────────────────────────────

const R_COLORS: Record<TournamentRoundStatus, { bg: string; text: string }> = {
  pending:  { bg: '#64748b22', text: '#94a3b8' },
  active:   { bg: '#22c55e22', text: '#22c55e' },
  finished: { bg: '#f59e0b22', text: '#f59e0b' },
};

export function RoundStatusBadge({ status }: { status: TournamentRoundStatus | string }) {
  const t = useTranslations('admin');
  const { bg, text } = R_COLORS[status as TournamentRoundStatus] ?? { bg: '#64748b22', text: '#94a3b8' };
  const labels: Record<TournamentRoundStatus, string> = {
    pending: t('tournamentRoundStatusPending'),
    active: t('tournamentRoundStatusActive'),
    finished: t('tournamentRoundStatusFinished'),
  };
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-semibold"
      style={{ background: bg, color: text }}
    >
      {labels[status as TournamentRoundStatus] ?? status}
    </span>
  );
}

// ── Round phase label ─────────────────────────────────────────────────────────

export function PhaseBadge({ phase }: { phase: TournamentRoundPhase | string }) {
  const t = useTranslations('admin');
  const labels: Record<TournamentRoundPhase, string> = {
    group_stage: t('tournamentPhaseGroupStage'),
    round_of_16: t('tournamentPhaseRoundOf16'),
    quarterfinal: t('tournamentPhaseQuarterfinal'),
    semifinal: t('tournamentPhaseSemifinal'),
    final: t('tournamentPhaseFinal'),
    round: t('tournamentPhaseRound'),
  };
  const label = labels[phase as TournamentRoundPhase] ?? phase;
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300">
      {label}
    </span>
  );
}

// ── Tournament format ─────────────────────────────────────────────────────────

const FORMAT_COLORS: Record<string, { bg: string; text: string }> = {
  round_robin:    { bg: '#3b82f622', text: '#60a5fa' },
  single_bracket: { bg: '#8b5cf622', text: '#a78bfa' },
  group_stage:    { bg: '#ec489922', text: '#f472b6' },
  custom:         { bg: '#64748b22', text: '#94a3b8' },
};

export function FormatBadge({ format }: { format: string }) {
  const t = useTranslations('admin');
  const { bg, text } = FORMAT_COLORS[format] ?? { bg: '#64748b22', text: '#94a3b8' };
  const labels: Record<string, string> = {
    round_robin: t('torneoFormatoRoundRobin'),
    single_bracket: t('torneoFormatoBracket'),
    group_stage: t('torneoFormatoGrupos'),
    custom: t('torneoFormatoCustom'),
  };
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: bg, color: text }}
    >
      {labels[format] ?? format}
    </span>
  );
}
