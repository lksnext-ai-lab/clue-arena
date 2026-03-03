/**
 * getAuthSession — servidor (Node.js runtime, Route Handlers).
 *
 * En dev mode (DISABLE_AUTH=true) devuelve un session mock construida
 * a partir de la cookie `dev-role`, de manera que los Route Handlers
 * funcionen sin NextAuth.
 *
 * En producción delega a `auth()` de NextAuth.
 */

import { cookies } from 'next/headers';
import { auth } from './config';
import { isAuthDisabled, DEV_COOKIE, DEV_USERS } from './dev';

export interface ServerSession {
  user: {
    id: string;
    name: string;
    email: string;
    rol: 'admin' | 'equipo' | 'espectador' | null;
    equipo: { id: string; nombre: string; agentId: string } | null;
  };
}

export async function getAuthSession(): Promise<ServerSession | null> {
  if (isAuthDisabled()) {
    const cookieStore = await cookies();
    const devRole = cookieStore.get(DEV_COOKIE)?.value as keyof typeof DEV_USERS | undefined;
    if (devRole && DEV_USERS[devRole]) {
      const user = DEV_USERS[devRole];
      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          rol: user.rol,
          equipo: user.equipo ?? null,
        },
      };
    }
    return null;
  }

  const session = await auth();
  if (!session?.user) return null;

  return {
    user: {
      id: session.user.id ?? '',
      name: session.user.name ?? '',
      email: session.user.email ?? '',
      rol: session.user.rol ?? null,
      equipo: session.user.equipo ?? null,
    },
  };
}
