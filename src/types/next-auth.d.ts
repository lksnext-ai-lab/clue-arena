import type { DefaultSession } from 'next-auth';
import type { AppTeamSummary, AppUserRole } from '@/lib/auth/auth-shared';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      rol: AppUserRole | null;
      equipo: AppTeamSummary | null;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    rol: AppUserRole;
    equipo: AppTeamSummary | null;
    email: string;
    name: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    rol?: AppUserRole | null;
    equipo?: AppTeamSummary | null;
  }
}
