import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { equipos, usuarios, partidaEquipos, partidas } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { UpdateTeamSchema } from '@/lib/schemas/team';

type Params = { params: Promise<{ id: string }> };

// GET /api/teams/:id
// Admin: accede a cualquier equipo. Equipo: solo el propio (G-04).
export async function GET(_req: Request, { params }: Params) {
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
    // Verificar ownership para rol equipo
    const user = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.email, session.user.email))
      .get();
    if (!user || team.usuarioId !== user.id) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
  }

  return NextResponse.json(team);
}

// PUT /api/teams/:id — Solo Admin (G-03)
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const userRol = session.user.rol;
  if (userRol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = UpdateTeamSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const team = await db.select().from(equipos).where(eq(equipos.id, id)).get();
  if (!team) {
    return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
  }

  // Verificar unicidad de nombre (excluyendo el equipo actual)
  if (parsed.data.nombre && parsed.data.nombre !== team.nombre) {
    const nameConflict = await db
      .select()
      .from(equipos)
      .where(eq(equipos.nombre, parsed.data.nombre))
      .get();
    if (nameConflict) {
      return NextResponse.json(
        { code: 'NOMBRE_DUPLICADO', error: 'Ya existe un equipo con ese nombre' },
        { status: 400 }
      );
    }
  }

  const updated = await db
    .update(equipos)
    .set(parsed.data)
    .where(eq(equipos.id, id))
    .returning()
    .get();

  return NextResponse.json(updated);
}

// DELETE /api/teams/:id — Solo Admin, con comprobación de partida activa (G-05)
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const team = await db.select().from(equipos).where(eq(equipos.id, id)).get();
  if (!team) {
    return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
  }

  // Comprobar si el equipo está en una partida activa (G-05)
  const activeGame = await db
    .select()
    .from(partidaEquipos)
    .innerJoin(partidas, eq(partidaEquipos.partidaId, partidas.id))
    .where(and(eq(partidaEquipos.equipoId, id), eq(partidas.estado, 'en_curso')))
    .get();

  if (activeGame) {
    return NextResponse.json(
      {
        code: 'EQUIPO_EN_PARTIDA',
        error: 'El equipo está en una partida activa y no puede ser eliminado',
      },
      { status: 409 }
    );
  }

  await db.delete(equipos).where(eq(equipos.id, id));
  return new Response(null, { status: 204 });
}
