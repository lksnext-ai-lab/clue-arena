import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { equipos, usuarios } from '@/lib/db/schema';
import type { AppAuthUser, AppTeamSummary } from './auth-shared';
import { DEMO_USERS, isDemoEmail, isDemoMode } from './demo';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseTeamMembers(raw: string | null | undefined): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((value): value is string => typeof value === 'string')
      .map((value) => normalizeEmail(value));
  } catch {
    return [];
  }
}

async function findUserByEmail(email: string) {
  return db
    .select()
    .from(usuarios)
    .where(sql`lower(${usuarios.email}) = ${normalizeEmail(email)}`)
    .get();
}

function toTeamSummary(team: { id: string; nombre: string; agentId: string } | null | undefined): AppTeamSummary | null {
  if (!team) return null;

  return {
    id: team.id,
    nombre: team.nombre,
    agentId: team.agentId,
  };
}

async function resolveTeamForUser(userId: string, email: string, role: AppAuthUser['rol']) {
  if (role !== 'equipo') return null;

  const ownedTeam = await db
    .select({ id: equipos.id, nombre: equipos.nombre, agentId: equipos.agentId })
    .from(equipos)
    .where(eq(equipos.usuarioId, userId))
    .get();

  if (ownedTeam) {
    return toTeamSummary(ownedTeam);
  }

  const normalizedEmail = normalizeEmail(email);
  const allTeams = await db
    .select({ id: equipos.id, nombre: equipos.nombre, agentId: equipos.agentId, miembros: equipos.miembros })
    .from(equipos)
    .all();

  const memberTeam = allTeams.find((team) => parseTeamMembers(team.miembros).includes(normalizedEmail));
  return toTeamSummary(memberTeam);
}

async function buildAppAuthUser(user: typeof usuarios.$inferSelect): Promise<AppAuthUser> {
  return {
    id: user.id,
    name: user.nombre,
    email: normalizeEmail(user.email),
    rol: user.rol,
    equipo: await resolveTeamForUser(user.id, user.email, user.rol),
  };
}

export async function getAppAuthUserByEmail(email: string): Promise<AppAuthUser | null> {
  const user = await findUserByEmail(email);
  return user ? buildAppAuthUser(user) : null;
}

export type DemoUser = {
  email: string;
  nombre: string;
  rol: 'admin' | 'equipo' | 'espectador';
};

/**
 * Returns local demo accounts (non-production domains) for display on the login page.
 * Excludes built-in DEV_USERS (clue-arena.local) — only event/demo accounts.
 */
export async function getDemoUsers(): Promise<DemoUser[]> {
  if (!isDemoMode()) {
    return [];
  }

  const rows = await db
    .select({ email: usuarios.email, nombre: usuarios.nombre, rol: usuarios.rol })
    .from(usuarios)
    .all();

  const demoUsers = rows.filter((user) => isDemoEmail(user.email));
  if (demoUsers.length > 0) {
    return demoUsers;
  }

  return DEMO_USERS.map((user) => ({
    email: user.email,
    nombre: user.name,
    rol: user.rol,
  }));
}

export async function ensureAppAuthUser(params: { email: string; name?: string | null }): Promise<AppAuthUser> {
  const email = normalizeEmail(params.email);
  const fallbackName = params.name?.trim() || email;
  let user = await findUserByEmail(email);

  if (!user) {
    const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase().trim();
    const isBootstrapAdmin = Boolean(bootstrapEmail) && email === bootstrapEmail;

    await db
      .insert(usuarios)
      .values({
        id: uuidv4(),
        email,
        nombre: fallbackName,
        rol: isBootstrapAdmin ? 'admin' : 'espectador',
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    user = await findUserByEmail(email);
  }

  if (!user) {
    throw new Error(`Unable to load authenticated user for ${email}`);
  }

  return buildAppAuthUser(user);
}
