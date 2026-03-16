import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { listAdminUsers } from '@/lib/admin/users';
import type { UserRole } from '@/types/domain';

const VALID_ROLES = new Set<UserRole>(['admin', 'equipo', 'espectador']);

/**
 * GET /api/admin/users
 * Admin-only: returns registered users, optionally filtered by role and search query.
 */
export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const query = searchParams.get('q')?.trim().toLowerCase() ?? '';
  const roleFilter = searchParams.get('rol');

  let users = await listAdminUsers();

  if (roleFilter && VALID_ROLES.has(roleFilter as UserRole)) {
    users = users.filter((user) => user.rol === roleFilter);
  }

  if (query) {
    users = users.filter((user) =>
      [user.nombre, user.email, user.equipo?.nombre ?? '', user.equipo?.agentId ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }

  return NextResponse.json({ users });
}
