import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { equipos, usuarios } from '@/lib/db/schema';
import type { UserRole } from '@/types/domain';
import type { UserResponse } from '@/types/api';

type DbUserRow = {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  createdAt: Date;
};

type DbTeamRow = {
  id: string;
  nombre: string;
  agentId: string;
  usuarioId: string;
  miembros: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseTeamMembers(raw: string | null | undefined) {
  if (!raw) return [] as string[];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed
      .filter((value): value is string => typeof value === 'string')
      .map((value) => normalizeEmail(value));
  } catch {
    return [] as string[];
  }
}

function buildUserTeamMap(users: DbUserRow[], teams: DbTeamRow[]) {
  const byUserId = new Map<string, UserResponse['equipo']>();
  const userIdByEmail = new Map(users.map((user) => [normalizeEmail(user.email), user.id]));

  for (const team of teams) {
    byUserId.set(team.usuarioId, {
      id: team.id,
      nombre: team.nombre,
      agentId: team.agentId,
    });
  }

  for (const team of teams) {
    const summary = { id: team.id, nombre: team.nombre, agentId: team.agentId };

    for (const email of parseTeamMembers(team.miembros)) {
      const userId = userIdByEmail.get(email);
      if (!userId || byUserId.has(userId)) continue;
      byUserId.set(userId, summary);
    }
  }

  return byUserId;
}

function toUserResponse(user: DbUserRow, team: UserResponse['equipo'] | undefined): UserResponse {
  return {
    id: user.id,
    nombre: user.nombre,
    email: normalizeEmail(user.email),
    rol: user.rol,
    createdAt: user.createdAt.toISOString(),
    equipo: team ?? null,
  };
}

export async function listAdminUsers(): Promise<UserResponse[]> {
  const [userRows, teamRows] = await Promise.all([
    db
      .select({
        id: usuarios.id,
        nombre: usuarios.nombre,
        email: usuarios.email,
        rol: usuarios.rol,
        createdAt: usuarios.createdAt,
      })
      .from(usuarios)
      .orderBy(asc(usuarios.nombre), asc(usuarios.email))
      .all(),
    db
      .select({
        id: equipos.id,
        nombre: equipos.nombre,
        agentId: equipos.agentId,
        usuarioId: equipos.usuarioId,
        miembros: equipos.miembros,
      })
      .from(equipos)
      .all(),
  ]);

  const teamByUserId = buildUserTeamMap(userRows as DbUserRow[], teamRows as DbTeamRow[]);

  return (userRows as DbUserRow[]).map((user) => toUserResponse(user, teamByUserId.get(user.id)));
}

export async function getAdminUserById(id: string) {
  const users = await listAdminUsers();
  return users.find((user) => user.id === id) ?? null;
}

export async function countAdminUsers() {
  const admins = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.rol, 'admin'))
    .all();

  return admins.length;
}
