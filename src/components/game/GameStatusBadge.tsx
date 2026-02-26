import type { GameStatus } from '@/types/domain';

interface GameStatusBadgeProps {
  estado: GameStatus;
}

const LABELS: Record<GameStatus, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  finalizada: 'Finalizada',
};

const COLORS: Record<GameStatus, { bg: string; text: string }> = {
  pendiente: { bg: '#64748b22', text: '#64748b' },
  en_curso: { bg: '#22c55e22', text: '#22c55e' },
  finalizada: { bg: '#f59e0b22', text: '#f59e0b' },
};

export function GameStatusBadge({ estado }: GameStatusBadgeProps) {
  const { bg, text } = COLORS[estado];
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: bg, color: text }}
    >
      {LABELS[estado]}
    </span>
  );
}
