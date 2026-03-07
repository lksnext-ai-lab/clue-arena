'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import type { UserRole } from '@/types/domain';
import { DEV_COOKIE, DEV_USERS } from '@/lib/auth/dev';

interface SessionContextValue {
  user: { id: string; name: string; email: string } | null;
  rol: UserRole | null;
  equipo: { id: string; nombre: string; agentId: string } | null;
  isLoading: boolean;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  rol: null,
  equipo: null,
  isLoading: true,
  logout: () => {},
});

/** Read dev-role cookie value on the client side. */
function getDevRole(): keyof typeof DEV_USERS | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${DEV_COOKIE}=([^;]+)`));
  const role = match?.[1] as keyof typeof DEV_USERS | undefined;
  return role && DEV_USERS[role] ? role : null;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  // Dev-mode: serve mock user from cookie without hitting next-auth
  const [devRole, setDevRole] = useState<keyof typeof DEV_USERS | null>(null);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true') {
      setDevRole(getDevRole());
    }
  }, []);

  let value: SessionContextValue;

  if (process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true' && devRole) {
    const devUser = DEV_USERS[devRole];
    value = {
      user: { id: devUser.id, name: devUser.name, email: devUser.email },
      rol: devUser.rol,
      equipo: devUser.equipo,
      isLoading: false,
      logout: () => {
        document.cookie = `${DEV_COOKIE}=; path=/; max-age=0`;
        window.location.href = '/';
      },
    };
  } else {
    value = {
      user: session?.user
        ? {
            id: session.user.id ?? '',
            name: session.user.name ?? '',
            email: session.user.email ?? '',
          }
        : null,
      rol: session?.user?.rol ?? null,
      equipo: session?.user?.equipo ?? null,
      isLoading: status === 'loading',
      logout: () => signOut({ callbackUrl: '/' }),
    };
  }

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useAppSession(): SessionContextValue {
  return useContext(SessionContext);
}
