import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/edge-config';
import { isAuthDisabled, DEV_COOKIE, DEV_USERS } from '@/lib/auth/dev';

const PUBLIC_PATHS = [
  '/',
  '/acerca-del-juego',
  '/arena',
  '/creditos',
  '/instrucciones',
  '/ranking',
  '/partidas', // covers /partidas/[id] by startsWith
  '/login',
  '/auth',
  '/api/ranking',
  '/api/games',
];

const ADMIN_PATHS = ['/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => (p === '/' ? pathname === '/' : pathname.startsWith(p)));

  // Allow public paths, and also API routes that are not explicitly protected.
  if (isPublic || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // --- Dev-mode bypass for protected routes ---
  if (isAuthDisabled()) {
    const devRole = request.cookies.get(DEV_COOKIE)?.value as keyof typeof DEV_USERS | undefined;
    if (!devRole || !DEV_USERS[devRole]) {
      const url = new URL('/login', request.url);
      url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
    }
    // RBAC check for admin in dev mode
    if (ADMIN_PATHS.some((p) => pathname.startsWith(p)) && DEV_USERS[devRole].rol !== 'admin') {
      return NextResponse.redirect(new URL('/?error=forbidden', request.url));
    }
    return NextResponse.next();
  }

  // --- Production auth for protected routes ---
  const session = await auth();

  if (!session?.user) {
    const url = new URL('/login', request.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // RBAC for admin section
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p)) && session.user.rol !== 'admin') {
    return NextResponse.redirect(new URL('/?error=forbidden', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except for:
    // - _next/static, _next/image and any public file with an extension
    // - /api/mcp (separate auth)
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)',
  ],
};
