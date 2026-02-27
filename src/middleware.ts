import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// Use edge-compatible auth config (no Node.js DB imports)
import { auth } from '@/lib/auth/edge-config';
import { DEV_COOKIE, DEV_USERS } from '@/lib/auth/dev';

// Public paths that bypass authentication
const PUBLIC_PATHS = ['/login', '/auth', '/ranking', '/api/ranking', '/partidas'];
// Protected paths that require authentication
// (middleware already blocks everything not in PUBLIC_PATHS, but we keep this explicit)

/** Dev-mode auth bypass: active only when DISABLE_AUTH=true in non-production. */
function isAuthDisabledEdge(): boolean {
  return (
    process.env.DISABLE_AUTH === 'true' &&
    process.env.NODE_ENV !== 'production'
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bypass public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // --- Dev-mode bypass ---
  if (isAuthDisabledEdge()) {
    const devRole = request.cookies.get(DEV_COOKIE)?.value as keyof typeof DEV_USERS | undefined;
    // If no dev cookie yet, redirect to login to pick a role
    if (!devRole || !DEV_USERS[devRole]) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // RBAC check with dev role
    if (pathname.startsWith('/admin') && devRole !== 'admin') {
      return NextResponse.redirect(new URL('/?error=forbidden', request.url));
    }
    return NextResponse.next();
  }

  // Get session
  const session = await auth();

  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // RBAC: /admin requires admin role
  if (pathname.startsWith('/admin') && (session.user as any).rol !== 'admin') {
    return NextResponse.redirect(new URL('/?error=forbidden', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Exclude static files, Next.js internals, favicon, and the MCP endpoint
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/mcp).*)'],
};
