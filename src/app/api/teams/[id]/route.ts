import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { equipos, usuarios, partidaEquipos, partidas } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { UpdateTeamSchema, TeamMemberUpdateSchema } from '@/lib/schemas/team';
import type { TeamResponse } from '@/types/api';
import { normalizeTeamStatus } from '@/lib/teams/status';

type Params = { params: Promise<{ id: string }> };

/** Builds a safe TeamResponse, never exposing mattinApiKey. */
function toTeamResponse(t: typeof equipos.$inferSelect): TeamResponse {
  return {
    id: t.id,
    nombre: t.nombre,
    descripcion: t.descripcion ?? null,
    agentId: t.agentId,
    agentBackend: (t.agentBackend ?? 'mattin') as 'mattin' | 'local',
    appId: t.appId ?? null,
    hasMattinApiKey: !!t.mattinApiKey,
    avatarUrl: t.avatarUrl ?? null,
    usuarioId: t.usuarioId,
    estado: normalizeTeamStatus(t.estado),
    miembros: JSON.parse(t.miembros ?? '[]') as string[],
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt),
  };
}

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

  return NextResponse.json(toTeamResponse(team));
}

// PUT /api/teams/:id
// Admin: full update. Equipo owner: limited fields (nombre, descripcion, agentId, agentBackend, appId, mattinApiKey).
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const userRol = session.user.rol;
  const isAdmin = userRol === 'admin';

  // Equipo role: must be the team owner
  if (!isAdmin) {
    if (userRol !== 'equipo') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
    const user = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.email, session.user.email!))
      .get();
    const team = await db.select().from(equipos).where(eq(equipos.id, id)).get();
    if (!team) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }
    if (!user || team.usuarioId !== user.id) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // Parse with restricted schema
    const body = await request.json();
    const parsed = TeamMemberUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    // Check name uniqueness
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

    const { mattinApiKey: newMattinApiKey, ...restData } = parsed.data;
    const updated = await db
      .update(equipos)
      .set({
        ...restData,
        ...(newMattinApiKey !== undefined ? { mattinApiKey: newMattinApiKey } : {}),
      })
      .where(eq(equipos.id, id))
      .returning()
      .get();

    return NextResponse.json(toTeamResponse(updated));
  }

  // Admin path: full update
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

  const { miembros: miembrosArray, usuarioId: newUsuarioId, mattinApiKey: newMattinApiKey, ...restData } = parsed.data;

  // Validate new owner exists (if provided)
  if (newUsuarioId) {
    const ownerExists = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.id, newUsuarioId))
      .get();
    if (!ownerExists) {
      return NextResponse.json(
        { error: 'El usuario seleccionado no existe' },
        { status: 400 }
      );
    }
  }

  const updated = await db
    .update(equipos)
    .set({
      ...restData,
      ...(miembrosArray !== undefined
        ? { miembros: JSON.stringify(miembrosArray) }
        : {}),
      ...(newUsuarioId !== undefined ? { usuarioId: newUsuarioId } : {}),
      // Only update mattinApiKey if explicitly provided (non-empty string)
      ...(newMattinApiKey !== undefined ? { mattinApiKey: newMattinApiKey } : {}),
    })
    .where(eq(equipos.id, id))
    .returning()
    .get();

  return NextResponse.json(toTeamResponse(updated));
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
