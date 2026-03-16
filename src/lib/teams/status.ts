import type { TeamStatus } from '@/types/domain';

export function normalizeTeamStatus(status: string | null | undefined): TeamStatus {
  if (status === 'inactivo' || status === 'finalizado') return 'inactivo';
  return 'activo';
}
