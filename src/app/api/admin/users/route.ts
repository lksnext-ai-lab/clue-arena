import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';

/**
 * GET /api/admin/users
 * Admin-only: returns all registered users (id, nombre, email, rol).
 */
export async function GET() {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const rows = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      rol: usuarios.rol,
    })
    .from(usuarios)
    .orderBy(asc(usuarios.nombre))
    .all();

  return NextResponse.json({ users: rows });
}
