/**
 * Dev-mode auth bypass helpers.
 * Only active when DISABLE_AUTH=true (never in production).
 */

export const DEV_COOKIE = 'dev-role';

export const DEV_USERS = {
  admin: {
    id: 'dev-admin-id',
    name: 'Dev Admin',
    email: 'dev-admin@clue-arena.local',
    rol: 'admin' as const,
    equipo: null,
  },
  equipo: {
    id: 'dev-equipo-id',
    name: 'Dev Equipo',
    email: 'dev-equipo@clue-arena.local',
    rol: 'equipo' as const,
    equipo: { id: 'dev-team-id', nombre: 'Dev Team', agentId: 'dev-agent' },
  },
};

export function isAuthDisabled(): boolean {
  return process.env.DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production';
}
