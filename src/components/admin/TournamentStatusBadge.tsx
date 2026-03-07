// src/components/admin/TournamentStatusBadge.tsx
import type { TournamentStatus, TournamentRoundPhase, TournamentRoundStatus } from '@/types/domain';

// ── Tournament status ────────────────────────────────────────────────────────

const T_LABELS: Record<TournamentStatus, string> = {
  draft:    'Borrador',
  active:   'Activo',
  finished: 'Finalizado',
};

const T_COLORS: Record<TournamentStatus, { bg: string; text: string }> = {
  draft:    { bg: '#64748b22', text: '#94a3b8' },
  active:   { bg: '#22c55e22', text: '#22c55e' },
  finished: { bg: '#f59e0b22', text: '#f59e0b' },
};

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  const { bg, text } = T_COLORS[status];
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: bg, color: text }}
    >
      {T_LABELS[status]}
    </span>
  );
}

// ── Round status ─────────────────────────────────────────────────────────────

const R_LABELS: Record<TournamentRoundStatus, string> = {
  pending:  'Pendiente',
  active:   'Activa',
  finished: 'Finalizada',
};

const R_COLORS: Record<TournamentRoundStatus, { bg: string; text: string }> = {
  pending:  { bg: '#64748b22', text: '#94a3b8' },
  active:   { bg: '#22c55e22', text: '#22c55e' },
  finished: { bg: '#f59e0b22', text: '#f59e0b' },
};

export function RoundStatusBadge({ status }: { status: TournamentRoundStatus | string }) {
  const { bg, text } = R_COLORS[status as TournamentRoundStatus] ?? { bg: '#64748b22', text: '#94a3b8' };
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-semibold"
      style={{ background: bg, color: text }}
    >
      {R_LABELS[status as TournamentRoundStatus] ?? status}
    </span>
  );
}

// ── Round phase label ─────────────────────────────────────────────────────────

const PHASE_LABELS: Record<TournamentRoundPhase, string> = {
  group_stage:  'Grupos',
  round_of_16:  'Octavos',
  quarterfinal: 'Cuartos',
  semifinal:    'Semifinal',
  final:        'Final',
  round:        'Ronda',
};

export function PhaseBadge({ phase }: { phase: TournamentRoundPhase | string }) {
  const label = PHASE_LABELS[phase as TournamentRoundPhase] ?? phase;
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300">
      {label}
    </span>
  );
}

// ── Tournament format ─────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<string, string> = {
  round_robin:    'Round Robin',
  single_bracket: 'Eliminación directa',
  group_stage:    'Grupos + Playoffs',
  custom:         'Custom',
};

const FORMAT_COLORS: Record<string, { bg: string; text: string }> = {
  round_robin:    { bg: '#3b82f622', text: '#60a5fa' },
  single_bracket: { bg: '#8b5cf622', text: '#a78bfa' },
  group_stage:    { bg: '#ec489922', text: '#f472b6' },
  custom:         { bg: '#64748b22', text: '#94a3b8' },
};

export function FormatBadge({ format }: { format: string }) {
  const { bg, text } = FORMAT_COLORS[format] ?? { bg: '#64748b22', text: '#94a3b8' };
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: bg, color: text }}
    >
      {FORMAT_LABELS[format] ?? format}
    </span>
  );
}
