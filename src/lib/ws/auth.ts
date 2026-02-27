// src/lib/ws/auth.ts
// NOTE: Solo puede importarse en código Node.js (server.ts, lib/ws/server.ts).
// NO importar en Edge runtime.
// NO importa auth() de next-auth — usa decode() directo para evitar el
// uso de AsyncLocalStorage de Next.js, que no está disponible fuera del
// pipeline de request de Next.js.
import type { IncomingMessage } from 'http';
import { decode } from 'next-auth/jwt';

function parseCookies(cookieHeader: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

export async function validateWsSession(req: IncomingMessage) {
  if (process.env.DISABLE_AUTH === 'true') {
    return { user: { id: 'dev', name: 'Dev User', email: 'dev@local', rol: 'admin' as const, equipo: null } };
  }

  const cookieHeader = req.headers.cookie ?? '';
  const cookies = parseCookies(cookieHeader);

  // Auth.js v5 usa el nombre de la cookie como salt para HKDF
  const isProd = process.env.NODE_ENV === 'production';
  const cookieName = isProd ? '__Secure-authjs.session-token' : 'authjs.session-token';
  const sessionToken = cookies[cookieName];

  if (!sessionToken) return null;

  const token = await decode({
    token: sessionToken,
    secret: process.env.AUTH_SECRET!,
    salt: cookieName,
  });

  if (!token) return null;

  return {
    user: {
      id: (token.id as string) ?? token.sub ?? '',
      name: (token.name as string) ?? '',
      email: (token.email as string) ?? '',
      rol: (token.rol as 'admin' | 'equipo' | 'espectador') ?? null,
      equipo: (token.equipo as { id: string; nombre: string; agentId: string }) ?? null,
    },
  };
}
