import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

export type AppUserRole = 'admin' | 'equipo' | 'espectador';

export interface AppTeamSummary {
  id: string;
  nombre: string;
  agentId: string;
}

export interface AppAuthUser {
  id: string;
  name: string;
  email: string;
  rol: AppUserRole;
  equipo: AppTeamSummary | null;
}

export const FIREBASE_AUTH_PROVIDER_ID = 'firebase';

export function applyAppUserToToken(token: JWT, user: AppAuthUser): JWT {
  token.sub = user.id;
  token.id = user.id;
  token.name = user.name;
  token.email = user.email;
  token.rol = user.rol;
  token.equipo = user.equipo;
  return token;
}

export function applyTokenToSession(session: Session, token: JWT): Session {
  session.user = {
    ...session.user,
    id: typeof token.id === 'string' ? token.id : typeof token.sub === 'string' ? token.sub : '',
    name: typeof token.name === 'string' ? token.name : (session.user?.name ?? ''),
    email: typeof token.email === 'string' ? token.email : (session.user?.email ?? ''),
    rol: (token.rol as AppUserRole | null | undefined) ?? null,
    equipo: (token.equipo as AppTeamSummary | null | undefined) ?? null,
  } as Session['user'];

  return session;
}
