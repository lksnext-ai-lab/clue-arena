import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { equipos, usuarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TeamRegistrationSchema } from '@/lib/schemas/team';
import type { TeamResponse } from '@/types/api';
import { resolveTeamId } from '@/lib/utils/team-id';

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
    estado: t.estado as TeamResponse['estado'],
    miembros: JSON.parse(t.miembros ?? '[]') as string[],
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt),
  };
}

// GET /api/teams
// Admin: devuelve todos los equipos. Equipo: devuelve solo el propio.
export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const userRol = session.user.rol;

  if (userRol === 'admin') {
    const allTeams = await db.select().from(equipos).all();
    return NextResponse.json({ teams: allTeams.map(toTeamResponse) });
  }

  // Rol equipo/espectador: devolver solo el equipo del usuario
  const user = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, session.user.email))
    .get();

  if (!user) {
    return NextResponse.json({ teams: [] });
  }

  const userTeams = await db
    .select()
    .from(equipos)
    .where(eq(equipos.usuarioId, user.id))
    .all();

  return NextResponse.json({ teams: userTeams.map(toTeamResponse) });
}

// POST /api/teams
export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = TeamRegistrationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const userRol = session.user.rol;

  // Get user from DB
  const user = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, session.user.email))
    .get();

  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  // Check if user already has a team (admin can create multiple teams)
  if (userRol !== 'admin') {
    const existingTeam = await db
      .select()
      .from(equipos)
      .where(eq(equipos.usuarioId, user.id))
      .get();

    if (existingTeam) {
      return NextResponse.json(
        { code: 'YA_TIENE_EQUIPO', error: 'Ya tienes un equipo registrado' },
        { status: 409 }
      );
    }
  }

  // Check name uniqueness (spec: 400 NOMBRE_DUPLICADO)
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

  const resolvedTeamId = resolveTeamId(parsed.data.id, parsed.data.nombre);

  const idConflict = await db
    .select()
    .from(equipos)
    .where(eq(equipos.id, resolvedTeamId))
    .get();

  if (idConflict) {
    return NextResponse.json(
      { code: 'ID_DUPLICADO', error: 'Ya existe un equipo con ese team_id' },
      { status: 400 }
    );
  }

  const newTeam = {
    id: resolvedTeamId,
    nombre: parsed.data.nombre,
    agentId: parsed.data.agentId,
    agentBackend: parsed.data.agentBackend ?? 'mattin',
    appId: parsed.data.appId ?? null,
    mattinApiKey: parsed.data.mattinApiKey ?? null,
    miembros: JSON.stringify(parsed.data.miembros ?? []),
    usuarioId: user.id,
    estado: 'registrado' as const,
    createdAt: new Date(),
  };

  await db.insert(equipos).values(newTeam);

  return NextResponse.json(
    { equipo: toTeamResponse({ ...newTeam, descripcion: null, avatarUrl: null }) },
    { status: 201 }
  );
}
