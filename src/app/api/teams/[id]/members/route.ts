import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { equipos, usuarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { UpdateMembersSchema } from '@/lib/schemas/team';

type Params = { params: Promise<{ id: string }> };

/**
 * PUT /api/teams/:id/members
 * Actualiza la lista de miembros (emails) de un equipo.
 * - Admin: puede actualizar cualquier equipo.
 * - Equipo: solo puede actualizar el suyo propio.
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getAuthSession();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const team = await db.select().from(equipos).where(eq(equipos.id, id)).get();
  if (!team) {
    return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
  }

  const userRol = session.user.rol;

  if (userRol !== 'admin') {
    // Los equipos solo pueden gestionar sus propios miembros
    const user = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.email, session.user.email))
      .get();

    if (!user || team.usuarioId !== user.id) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
  }

  const body = await request.json();
  const parsed = UpdateMembersSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const updated = await db
    .update(equipos)
    .set({ miembros: JSON.stringify(parsed.data.miembros) })
    .where(eq(equipos.id, id))
    .returning()
    .get();

  return NextResponse.json({
    ...updated,
    miembros: JSON.parse(updated.miembros ?? '[]') as string[],
  });
}
